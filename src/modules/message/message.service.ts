import { Injectable, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../common/utils/prisma.service';
import { LoggerService } from '../../common/utils/logger.service';
import { WebsocketGateway } from '../../websocket/websocket.gateway';
import { WsContentType } from '../../common/constants';
import { SendMessageDto, RecallMessageDto, GetRecordDto } from './dto/message.dto';
import { AiService } from '../ai/ai.service';

/**
 * 消息服务 - 对应原 Java 项目的 MessageService
 */
@Injectable()
export class MessageService {
  constructor(
    private prisma: PrismaService,
    private logger: LoggerService,
    private websocket: WebsocketGateway,
    @Inject(forwardRef(() => AiService))
    private aiService: AiService,
  ) {}

  /**
   * 发送消息 - 对应 POST /api/v1/message/send
   */
  async send(userId: string, dto: SendMessageDto, ip: string) {
    // 打印详细请求日志
    this.logger.log(
      `[请求详情] userId=${userId}, dto=${JSON.stringify(dto)}, ip=${ip}`,
      'MessageService',
    );

    const now = Date.now();

    // 获取发送者信息
    const sender = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!sender) {
      throw new BadRequestException('发送者不存在');
    }

    // 敏感词过滤 (简单实现，后续可以集成完整库)
    // 与Java保持一致：机器人用户不进行敏感词过滤
    let filteredContent = dto.msgContent;
    if (sender.type !== 'bot') {
      filteredContent = this.filterSensitiveWords(dto.msgContent);
    }

    // 获取 IP 归属地
    const ipOwnership = this.getIpOwnership(ip);

    // 构建发送者信息
    const fromInfo = {
      id: sender.id,
      name: sender.name,
      type: sender.type,
      badge: sender.badge ? JSON.parse(sender.badge) : [],
      ipOwnership,
    };

    // 判断是否需要显示时间（距离上一条消息超过 5 分钟）
    const isShowTime = await this.shouldShowTime(dto.targetId, dto.source || 'user', now);

    // 解析消息内容，检测@机器人
    let botUser: any = null;
    let textContent = '';
    if (dto.type === 'text' || !dto.type) {
      try {
        const contents = JSON.parse(filteredContent);
        if (Array.isArray(contents)) {
          for (const item of contents) {
            if (item.type === 'text') {
              textContent += item.content || '';
            } else if (item.type === 'at') {
              try {
                const atUser = typeof item.content === 'string' ? JSON.parse(item.content) : item.content;
                if (atUser.type === 'bot') {
                  botUser = atUser;
                }
              } catch (e) {
                // 解析@用户失败，忽略
              }
            }
          }
        }
      } catch (e) {
        // JSON解析失败，使用原始内容
        textContent = filteredContent;
      }
    }

    // 创建消息
    const message = await this.prisma.message.create({
      data: {
        id: uuidv4().replace(/-/g, ''),
        fromId: userId,
        toId: dto.targetId,
        fromInfo: JSON.stringify(fromInfo),
        message: filteredContent,
        referenceMsg: dto.referenceMsgId ? JSON.stringify({ id: dto.referenceMsgId }) : null,
        isShowTime,
        type: dto.type || 'text',
        source: dto.source || 'user',
        createTime: BigInt(now),
        updateTime: BigInt(now),
      },
    });

    // 构建响应消息
    const responseMsg = this.formatMessageResponse(message, fromInfo);

    // WebSocket 推送
    if (dto.source === 'group') {
      // 群聊：广播给所有人
      this.websocket.sendToAll(WsContentType.Msg, responseMsg);
    } else {
      // 私聊：发送给接收者
      this.websocket.sendToUser(dto.targetId, WsContentType.Msg, responseMsg);
      // 也发送给发送者（确认消息已发送）
      this.websocket.sendToUser(userId, WsContentType.Msg, responseMsg);
    }

    // 更新聊天列表
    await this.updateChatList(userId, dto.targetId, dto.source || 'user', responseMsg);

    this.logger.log(
      `消息发送成功: ${sender.name} -> ${dto.targetId} [${dto.source}]`,
      'MessageService',
    );

    // 打印详细响应日志
    this.logger.log(
      `[响应详情] ${JSON.stringify(responseMsg)}`,
      'MessageService',
    );

    // 与Java保持一致：如果@了机器人，则调用AI服务回复
    if (botUser) {
      this.logger.log(
        `检测到@机器人: ${botUser.name || botUser.id}, 文本内容: ${textContent}`,
        'MessageService',
      );
      // 异步调用AI服务，不阻塞消息发送
      setImmediate(() => {
        this.aiService.handleAtBot(
          botUser.id,
          userId,
          fromInfo,
          textContent,
          dto.targetId,
          dto.source || 'group',
        );
      });
    }

    return responseMsg;
  }

  /**
   * 获取消息记录 - 对应 POST /api/v1/message/record
   * 与 Java MessageMapper.record 保持一致的查询逻辑
   */
  async getRecord(userId: string, dto: GetRecordDto) {
    this.logger.log(
      `[record请求] userId=${userId}, dto=${JSON.stringify(dto)}`,
      'MessageService',
    );

    const num = dto.num || 20;
    const index = dto.index || 0;

    // 与 Java 保持一致的查询条件：
    // (`from_id` = userId AND `to_id` = targetId)
    // OR (`from_id` = targetId AND `to_id` = userId)
    // OR (`source` = 'group' AND `to_id` = targetId)
    const whereCondition = {
      OR: [
        { fromId: userId, toId: dto.targetId },
        { fromId: dto.targetId, toId: userId },
        { source: 'group', toId: dto.targetId },
      ],
    };

    this.logger.log(
      `[record查询条件] whereCondition=${JSON.stringify(whereCondition)}, skip=${index}, take=${num}`,
      'MessageService',
    );

    const messages = await this.prisma.message.findMany({
      where: whereCondition,
      orderBy: { createTime: 'desc' },
      skip: index,
      take: num,
    });

    this.logger.log(
      `[record结果] 查询到 ${messages.length} 条消息`,
      'MessageService',
    );

    const result = messages.map((msg) => {
      const fromInfo = msg.fromInfo ? JSON.parse(msg.fromInfo) : null;
      return this.formatMessageResponse(msg, fromInfo);
    }).reverse(); // 返回按时间正序排列

    return result;
  }

  /**
   * 撤回消息 - 对应 POST /api/v1/message/recall
   */
  async recall(userId: string, dto: RecallMessageDto) {
    const message = await this.prisma.message.findUnique({
      where: { id: dto.msgId },
    });

    if (!message) {
      throw new BadRequestException('消息不存在');
    }

    if (message.fromId !== userId) {
      throw new BadRequestException('只能撤回自己的消息');
    }

    // 检查撤回时间限制（2分钟内）
    const now = Date.now();
    const msgTime = Number(message.createTime);
    if (now - msgTime > 2 * 60 * 1000) {
      throw new BadRequestException('消息已超过撤回时间限制');
    }

    // 更新消息类型为撤回
    const updatedMessage = await this.prisma.message.update({
      where: { id: dto.msgId },
      data: {
        type: 'recall',
        message: '此消息已被撤回',
        updateTime: BigInt(now),
      },
    });

    const fromInfo = message.fromInfo ? JSON.parse(message.fromInfo) : null;
    const responseMsg = this.formatMessageResponse(updatedMessage, fromInfo);

    // WebSocket 推送撤回消息
    if (message.source === 'group') {
      this.websocket.sendToAll(WsContentType.Msg, responseMsg);
    } else {
      this.websocket.sendToUser(message.toId, WsContentType.Msg, responseMsg);
      this.websocket.sendToUser(userId, WsContentType.Msg, responseMsg);
    }

    this.logger.log(`消息撤回成功: ${dto.msgId}`, 'MessageService');

    return responseMsg;
  }

  /**
   * 判断是否需要显示时间
   */
  private async shouldShowTime(
    targetId: string,
    source: string,
    currentTime: number,
  ): Promise<boolean> {
    const lastMessage = await this.prisma.message.findFirst({
      where: source === 'group' 
        ? { toId: targetId, source: 'group' }
        : { source: 'user' },
      orderBy: { createTime: 'desc' },
    });

    if (!lastMessage) {
      return true;
    }

    const lastTime = Number(lastMessage.createTime);
    // 超过 5 分钟显示时间
    return currentTime - lastTime > 5 * 60 * 1000;
  }

  /**
   * 更新聊天列表
   */
  private async updateChatList(
    fromId: string,
    targetId: string,
    source: string,
    lastMessage: any,
  ) {
    const now = Date.now();

    if (source === 'group') {
      // 群聊不需要更新私聊列表
      return;
    }

    // 更新或创建发送者的聊天列表
    await this.upsertChatList(fromId, targetId, 'private', lastMessage, now);
    
    // 更新或创建接收者的聊天列表（增加未读数）
    await this.upsertChatList(targetId, fromId, 'private', lastMessage, now, true);
  }

  /**
   * 更新或创建聊天列表
   */
  private async upsertChatList(
    userId: string,
    targetId: string,
    type: string,
    lastMessage: any,
    now: number,
    incrementUnread: boolean = false,
  ) {
    const existing = await this.prisma.chatList.findFirst({
      where: { userId, targetId },
    });

    if (existing) {
      await this.prisma.chatList.update({
        where: { id: existing.id },
        data: {
          lastMessage: JSON.stringify(lastMessage),
          unreadNum: incrementUnread ? existing.unreadNum + 1 : existing.unreadNum,
          updateTime: BigInt(now),
        },
      });
    } else {
      // 获取目标用户信息
      const targetUser = await this.prisma.user.findUnique({
        where: { id: targetId },
      });

      await this.prisma.chatList.create({
        data: {
          id: uuidv4().replace(/-/g, ''),
          userId,
          targetId,
          targetInfo: targetUser ? JSON.stringify({
            id: targetUser.id,
            name: targetUser.name,
            type: targetUser.type,
            portrait: targetUser.portrait,
          }) : null,
          type,
          lastMessage: JSON.stringify(lastMessage),
          unreadNum: incrementUnread ? 1 : 0,
          createTime: BigInt(now),
          updateTime: BigInt(now),
        },
      });
    }
  }

  /**
   * 格式化消息响应
   */
  private formatMessageResponse(message: any, fromInfo: any) {
    return {
      id: message.id,
      fromId: message.fromId,
      toId: message.toId,
      fromInfo,
      message: message.message,
      referenceMsg: message.referenceMsg ? JSON.parse(message.referenceMsg) : null,
      isShowTime: message.isShowTime,
      type: message.type,
      source: message.source,
      createTime: this.formatDateTime(Number(message.createTime)),
      updateTime: this.formatDateTime(Number(message.updateTime)),
    };
  }

  /**
   * 敏感词过滤（简单实现）
   */
  private filterSensitiveWords(content: string): string {
    // 这里可以后续集成 mint-filter 等敏感词库
    return content;
  }

  /**
   * 获取 IP 归属地
   */
  private getIpOwnership(ip: string): string {
    if (!ip || ip === '127.0.0.1' || ip === 'localhost' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
      return '内网';
    }
    return '未知';
  }

  /**
   * 格式化日期时间
   */
  private formatDateTime(timestamp: number): string {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${date.getMilliseconds().toString().padStart(3, '0')}`;
  }
}
