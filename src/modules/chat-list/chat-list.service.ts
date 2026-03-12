import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/utils/prisma.service';
import { UserService } from '../user/user.service';
import { v4 as uuidv4 } from 'uuid';

/**
 * 聊天列表类型 - 对应 Java ChatListType
 */
export enum ChatListType {
  User = 'user',   // 私聊
  Group = 'group', // 群聊
}

/**
 * 聊天列表服务 - 对应原 Java 项目的 ChatListServiceImpl
 */
@Injectable()
export class ChatListService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    @Inject(forwardRef(() => UserService))
    private userService: UserService,
  ) {}

  /**
   * 获取私聊列表 - 对应 Java privateList
   */
  async privateList(userId: string) {
    const chatLists = await this.prisma.chatList.findMany({
      where: { 
        userId, 
        type: ChatListType.User,
      },
      orderBy: { updateTime: 'desc' },
    });

    return chatLists.map((item) => this.formatChatListResponse(item));
  }

  /**
   * 获取群聊信息 - 对应 Java getGroup
   * 根据 userId 获取或创建用户的群聊记录
   */
  async getGroup(userId: string) {
    // 查找用户的群聊记录
    let chatList = await this.prisma.chatList.findFirst({
      where: {
        userId,
        type: ChatListType.Group,
      },
    });

    // 如果不存在则创建
    if (!chatList) {
      // 获取默认群组
      let group = await this.prisma.group.findFirst();
      if (!group) {
        const now = Date.now();
        group = await this.prisma.group.create({
          data: {
            id: '1',
            name: this.config.get('ZIBOLT_NAME') || 'ZiboltChat聊天室',
            createTime: BigInt(now),
            updateTime: BigInt(now),
          },
        });
      }

      const now = Date.now();
      const targetInfo = {
        id: '1',
        name: group.name,
        avatar: group.avatar || group.portrait,
      };

      chatList = await this.prisma.chatList.create({
        data: {
          id: uuidv4().replace(/-/g, ''),
          type: ChatListType.Group,
          userId,
          targetId: '1',
          targetInfo: JSON.stringify(targetInfo),
          unreadNum: 0,
          createTime: BigInt(now),
          updateTime: BigInt(now),
        },
      });
    }

    return this.formatChatListResponse(chatList);
  }

  /**
   * 获取目标聊天列表 - 对应 Java getTargetChatList
   */
  async getTargetChatList(userId: string, targetId: string) {
    return await this.prisma.chatList.findFirst({
      where: {
        userId,
        targetId,
        type: ChatListType.User,
      },
    });
  }

  /**
   * 创建聊天列表 - 对应 Java create
   */
  async create(userId: string, targetId: string) {
    // 不能和自己聊天
    if (userId === targetId) {
      return null;
    }

    // 检查是否已存在
    const existingChatList = await this.getTargetChatList(userId, targetId);
    if (existingChatList) {
      return this.formatChatListResponse(existingChatList);
    }

    // 获取目标用户信息
    const targetUser = await this.userService.getUserById(targetId);

    const now = Date.now();
    const chatList = await this.prisma.chatList.create({
      data: {
        id: uuidv4().replace(/-/g, ''),
        userId,
        targetId,
        type: ChatListType.User,
        targetInfo: JSON.stringify(targetUser),
        lastMessage: JSON.stringify({}),
        unreadNum: 0,
        createTime: BigInt(now),
        updateTime: BigInt(now),
      },
    });

    return this.formatChatListResponse(chatList);
  }

  /**
   * 更新群聊消息 - 对应 Java updateChatListGroup
   */
  async updateChatListGroup(message: any): Promise<boolean> {
    try {
      await this.prisma.chatList.updateMany({
        where: { type: ChatListType.Group },
        data: {
          lastMessage: JSON.stringify(message),
          updateTime: BigInt(Date.now()),
        },
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 更新单个聊天列表 - 对应 Java updateChatList
   */
  private async updateChatList(userId: string, targetId: string, message: any): Promise<boolean> {
    try {
      // 判断聊天列表是否存在
      let chatList = await this.prisma.chatList.findFirst({
        where: {
          userId: targetId,
          targetId: userId,
        },
      });

      if (!chatList) {
        // 不存在则创建
        const targetUser = await this.userService.getUserById(userId);
        const now = Date.now();
        await this.prisma.chatList.create({
          data: {
            id: uuidv4().replace(/-/g, ''),
            userId: targetId,
            type: ChatListType.User,
            targetId: userId,
            unreadNum: 1,
            targetInfo: JSON.stringify(targetUser),
            lastMessage: JSON.stringify(message),
            createTime: BigInt(now),
            updateTime: BigInt(now),
          },
        });
      } else {
        // 存在则更新
        await this.prisma.chatList.update({
          where: { id: chatList.id },
          data: {
            unreadNum: chatList.unreadNum + 1,
            lastMessage: JSON.stringify(message),
            updateTime: BigInt(Date.now()),
          },
        });
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 更新私聊消息 - 对应 Java updateChatListPrivate
   */
  async updateChatListPrivate(userId: string, targetId: string, message: any): Promise<boolean> {
    // 更新对方的聊天列表
    await this.updateChatList(targetId, userId, message);
    // 更新自己的聊天列表
    return await this.updateChatList(userId, targetId, message);
  }

  /**
   * 标记已读 - 对应 Java read
   */
  async read(userId: string, targetId: string): Promise<boolean> {
    if (!targetId) return false;

    try {
      await this.prisma.chatList.updateMany({
        where: {
          userId,
          targetId,
        },
        data: {
          unreadNum: 0,
          updateTime: BigInt(Date.now()),
        },
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 删除聊天列表 - 对应 Java delete
   */
  async delete(userId: string, chatListId: string): Promise<boolean> {
    try {
      await this.prisma.chatList.delete({
        where: { id: chatListId },
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 格式化聊天列表响应
   */
  private formatChatListResponse(chatList: any) {
    return {
      id: chatList.id,
      userId: chatList.userId,
      targetId: chatList.targetId,
      targetInfo: chatList.targetInfo ? JSON.parse(chatList.targetInfo) : null,
      unreadCount: chatList.unreadNum,
      lastMessage: chatList.lastMessage ? JSON.parse(chatList.lastMessage) : null,
      type: chatList.type,
      createTime: this.formatDateTime(Number(chatList.createTime)),
      updateTime: this.formatDateTime(Number(chatList.updateTime)),
    };
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
