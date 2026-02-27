import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../common/utils/prisma.service';
import { CacheService } from '../../common/utils/cache.service';
import { LoggerService } from '../../common/utils/logger.service';
import { WebsocketGateway } from '../../websocket/websocket.gateway';
import { WsContentType } from '../../common/constants';

/**
 * AI 服务 - 对应原 Java 项目的 AiChatService
 * 支持豆包、DeepSeek 两种 AI
 */
@Injectable()
export class AiService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
    private config: ConfigService,
    private logger: LoggerService,
    private websocket: WebsocketGateway,
  ) {}

  /**
   * 处理 @机器人 消息
   * @param botId 机器人ID
   * @param userId 发送消息的用户ID
   * @param userInfo 发送消息的用户信息
   * @param message 消息内容
   * @param targetId 目标ID（群聊ID或用户ID）
   * @param source 消息来源（group/user）
   */
  async handleAtBot(
    botId: string,
    userId: string,
    userInfo: any,
    message: string,
    targetId: string,
    source: string,
  ) {
    // 检查内容是否为空
    if (!message || message.trim() === '') {
      await this.sendBotReply(botId, targetId, source, userInfo, '内容不能为空~');
      return;
    }

    // 检查内容长度限制
    const lengthLimit = this.getBotLengthLimit(botId);
    if (lengthLimit > 0 && message.length > lengthLimit) {
      await this.sendBotReply(botId, targetId, source, userInfo, '问一些简单的问题吧~');
      return;
    }

    // 检查使用次数限制
    const limitKey = `ai:${botId}:${userId}`;
    const usedCount = this.cache.get<number>(limitKey) || 0;
    const limitConfig = this.getBotLimit(botId);

    // 与Java保持一致：先增加计数再检查（incrementAndGet）
    const newCount = usedCount + 1;
    if (limitConfig > 0 && newCount > limitConfig) {
      await this.sendBotReply(botId, targetId, source, userInfo, '您已经达到限制了，请24小时后再来吧~');
      return;
    }

    // 更新使用次数（24小时过期）
    this.cache.set(limitKey, newCount, 24 * 3600);

    try {
      let reply: string;

      switch (botId) {
        case 'doubao':
          reply = await this.callDoubao(message);
          break;
        case 'deepseek':
          reply = await this.callDeepSeek(message);
          break;
        default:
          reply = '请稍后尝试~';
      }

      await this.sendBotReply(botId, targetId, source, userInfo, reply);
    } catch (error) {
      this.logger.error(`AI 调用失败: ${error.message}`, error.stack, 'AiService');

      // 根据不同机器人返回不同的错误提示
      let errorMsg = '抱歉，AI 服务暂时不可用，请稍后再试';
      switch (botId) {
        case 'doubao':
          errorMsg = '豆包已离家出走了，请稍后再试~';
          break;
        case 'deepseek':
          errorMsg = 'DeepSeek已离家出走了，请稍后再试~';
          break;
      }

      await this.sendBotReply(botId, targetId, source, userInfo, errorMsg);
    }
  }

  /**
   * 发送机器人回复
   * 与Java保持一致：回复消息包含@用户信息
   */
  private async sendBotReply(
    botId: string,
    targetId: string,
    source: string,
    userInfo: any,
    content: string,
  ) {
    const now = Date.now();
    const botInfo = this.getBotInfo(botId);

    const fromInfo = {
      id: botId,
      name: botInfo.name,
      type: 'bot',
      badge: ['bot'],
      ipOwnership: '机器人',
    };

    // 构建消息内容：与Java保持一致，包含@用户和文本内容
    const msgContent = [
      { type: 'at', content: JSON.stringify(userInfo) },
      { type: 'text', content },
    ];

    // 保存消息到数据库
    const message = await this.prisma.message.create({
      data: {
        id: uuidv4().replace(/-/g, ''),
        fromId: botId,
        toId: targetId,
        fromInfo: JSON.stringify(fromInfo),
        message: JSON.stringify(msgContent),
        isShowTime: false,
        type: 'text',
        source,
        createTime: BigInt(now),
        updateTime: BigInt(now),
      },
    });

    const responseMsg = {
      id: message.id,
      fromId: botId,
      toId: targetId,
      fromInfo,
      message: message.message,
      isShowTime: false,
      type: 'text',
      source,
      createTime: this.formatDateTime(now),
      updateTime: this.formatDateTime(now),
    };

    // WebSocket 推送
    if (source === 'group') {
      this.websocket.sendToAll(WsContentType.Msg, responseMsg);
    } else {
      this.websocket.sendToUser(targetId, WsContentType.Msg, responseMsg);
    }

    this.logger.log(`AI [${botInfo.name}] 回复消息: ${content.substring(0, 50)}...`, 'AiService');
  }

  /**
   * 调用豆包 AI
   */
  private async callDoubao(message: string): Promise<string> {
    const apiKey = this.config.get<string>('DOUBAO_API_KEY');
    const model = this.config.get<string>('DOUBAO_MODEL') || 'doubao-pro-32k';

    if (!apiKey || apiKey === 'your-doubao-api-key') {
      return '豆包 AI 未配置，请联系管理员';
    }

    const response = await axios.post(
      'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
      {
        model,
        messages: [{ role: 'user', content: message }],
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: 30000,
      },
    );

    return response.data.choices[0]?.message?.content || '无响应';
  }

  /**
   * 调用 DeepSeek AI
   */
  private async callDeepSeek(message: string): Promise<string> {
    const apiKey = this.config.get<string>('DEEPSEEK_API_KEY');
    const model = this.config.get<string>('DEEPSEEK_MODEL') || 'deepseek-chat';

    if (!apiKey || apiKey === 'your-deepseek-api-key') {
      return 'DeepSeek AI 未配置，请联系管理员';
    }

    const response = await axios.post(
      'https://api.deepseek.com/chat/completions',
      {
        model,
        stream: false,
        messages: [{ role: 'user', content: message }],
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: 30000,
      },
    );

    return response.data.choices[0]?.message?.content || '无响应';
  }

  /**
   * 获取机器人信息
   */
  private getBotInfo(botId: string) {
    const bots: Record<string, { name: string; avatar: string }> = {
      doubao: { name: '豆包', avatar: '/static/bot/doubao.png' },
      deepseek: { name: 'DeepSeek', avatar: '/static/bot/deepseek.png' },
    };
    return bots[botId] || { name: 'AI', avatar: '' };
  }

  /**
   * 获取机器人每日使用次数限制
   */
  private getBotLimit(botId: string): number {
    const limits: Record<string, string> = {
      doubao: 'DOUBAO_COUNT_LIMIT',
      deepseek: 'DEEPSEEK_COUNT_LIMIT',
    };
    const configKey = limits[botId];
    return this.config.get<number>(configKey) || 0;
  }

  /**
   * 获取机器人消息长度限制
   */
  private getBotLengthLimit(botId: string): number {
    const limits: Record<string, string> = {
      doubao: 'DOUBAO_LENGTH_LIMIT',
      deepseek: 'DEEPSEEK_LENGTH_LIMIT',
    };
    const configKey = limits[botId];
    return this.config.get<number>(configKey) || 0;
  }

  /**
   * 格式化日期时间
   */
  private formatDateTime(timestamp: number): string {
    const date = new Date(timestamp);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${date.getMilliseconds().toString().padStart(3, '0')}`;
  }
}
