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
 * 支持豆包、DeepSeek、RAGFlow 三种 AI
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
   */
  async handleAtBot(
    botId: string,
    userId: string,
    message: string,
    targetId: string,
    source: string,
  ) {
    // 检查使用次数限制
    const limitKey = `ai:${botId}:${userId}:${new Date().toISOString().split('T')[0]}`;
    const usedCount = this.cache.get<number>(limitKey) || 0;
    const limitConfig = this.getBotLimit(botId);

    if (usedCount >= limitConfig) {
      await this.sendBotReply(botId, targetId, source, `今日使用次数已达上限（${limitConfig}次）`);
      return;
    }

    // 更新使用次数
    this.cache.set(limitKey, usedCount + 1, 24 * 3600);

    try {
      let reply: string;

      switch (botId) {
        case 'doubao':
          reply = await this.callDoubao(message);
          break;
        case 'deepseek':
          reply = await this.callDeepSeek(message);
          break;
        case 'ragflow':
          reply = await this.callRagFlow(message);
          break;
        default:
          reply = '未知的机器人类型';
      }

      await this.sendBotReply(botId, targetId, source, reply);
    } catch (error) {
      this.logger.error(`AI 调用失败: ${error.message}`, error.stack, 'AiService');
      await this.sendBotReply(botId, targetId, source, '抱歉，AI 服务暂时不可用，请稍后再试');
    }
  }

  /**
   * 发送机器人回复
   */
  private async sendBotReply(
    botId: string,
    targetId: string,
    source: string,
    content: string,
  ) {
    const now = Date.now();
    const botInfo = this.getBotInfo(botId);

    const fromInfo = {
      id: botId,
      name: botInfo.name,
      type: 'bot',
      badge: ['bot'],
      ipOwnership: '云端',
    };

    // 保存消息到数据库
    const message = await this.prisma.message.create({
      data: {
        id: uuidv4().replace(/-/g, ''),
        fromId: botId,
        toId: targetId,
        fromInfo: JSON.stringify(fromInfo),
        message: JSON.stringify([{ type: 'text', content }]),
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
   * 调用 RAGFlow
   */
  private async callRagFlow(message: string): Promise<string> {
    const apiKey = this.config.get<string>('RAGFLOW_API_KEY');
    const baseUrl = this.config.get<string>('RAGFLOW_URL') || 'http://localhost:8080';

    if (!apiKey || apiKey === 'your-ragflow-api-key') {
      return 'RAGFlow 未配置，请联系管理员';
    }

    const response = await axios.post(
      `${baseUrl}/api/v1/chat`,
      { query: message },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: 30000,
      },
    );

    return response.data.answer || '无响应';
  }

  /**
   * 获取机器人信息
   */
  private getBotInfo(botId: string) {
    const bots: Record<string, { name: string; avatar: string }> = {
      doubao: { name: '豆包', avatar: '/static/bot/doubao.png' },
      deepseek: { name: 'DeepSeek', avatar: '/static/bot/deepseek.png' },
      ragflow: { name: '林语小助手', avatar: '/static/bot/ragflow.png' },
    };
    return bots[botId] || { name: 'AI', avatar: '' };
  }

  /**
   * 获取机器人每日使用限制
   */
  private getBotLimit(botId: string): number {
    const limits: Record<string, string> = {
      doubao: 'DOUBAO_COUNT_LIMIT',
      deepseek: 'DEEPSEEK_COUNT_LIMIT',
      ragflow: 'RAGFLOW_COUNT_LIMIT',
    };
    const configKey = limits[botId];
    return this.config.get<number>(configKey) || 5;
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
