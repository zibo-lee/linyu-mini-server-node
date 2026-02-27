import { Injectable, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../common/utils/prisma.service';
import { CacheService } from '../../common/utils/cache.service';
import { UpdateUserDto } from './dto/user.dto';
import { BadgeType, UserType, NotifyType } from '../../common/constants';
import { v4 as uuidv4 } from 'uuid';

// 前向引用，避免循环依赖
let WebsocketGateway: any;

/**
 * 用户服务 - 对应原 Java 项目的 UserService
 */
@Injectable()
export class UserService {
  private websocketGateway: any;

  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  /**
   * 设置 WebSocket 网关引用（由 WebsocketGateway 调用，避免循环依赖）
   */
  setWebsocketGateway(gateway: any) {
    this.websocketGateway = gateway;
  }

  /**
   * 获取用户列表 - 对应 GET /api/v1/user/list
   * 按 type 降序排序（bot 在前）- 与 Java 保持一致
   */
  async getUserList() {
    const users = await this.prisma.user.findMany({
      orderBy: { type: 'desc' }, // type DESC，bot 排在 user 前面
    });

    return users.map((user) => this.formatUserDto(user));
  }

  /**
   * 获取用户列表（Map 格式）- 对应 GET /api/v1/user/list/map
   * 返回以 userId 为 key 的 Map 结构
   */
  async getUserListMap() {
    const users = await this.prisma.user.findMany({
      orderBy: { type: 'desc' },
    });

    const userMap: Record<string, any> = {};
    users.forEach((user) => {
      userMap[user.id] = this.formatUserDto(user);
    });

    return userMap;
  }

  /**
   * 获取在线用户列表 - 对应 GET /api/v1/user/online/web
   * 从 WebSocket 获取真实在线用户 ID 列表
   */
  async getOnlineUsers(): Promise<string[]> {
    if (this.websocketGateway) {
      return this.websocketGateway.getOnlineUserIds();
    }
    return [];
  }

  /**
   * 获取用户详情 - 对应 GET /api/v1/user/info/:id
   */
  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return null;
    }

    return this.formatUserDto(user);
  }

  /**
   * 根据用户名获取用户
   */
  async getUserByName(name: string) {
    return await this.prisma.user.findFirst({
      where: { name },
    });
  }

  /**
   * 根据用户名或邮箱获取用户 - 对应 Java getUserByNameOrEmail
   */
  async getUserByNameOrEmail(name: string, email: string) {
    return await this.prisma.user.findFirst({
      where: {
        OR: [{ name }, { email }],
      },
    });
  }

  /**
   * 检查用户是否存在 - 对应 Java isExist
   */
  async isExist(name: string, email: string): Promise<boolean> {
    const count = await this.prisma.user.count({
      where: {
        OR: [{ name }, { email }],
      },
    });
    return count > 0;
  }

  /**
   * 创建用户 - 对应 Java createUser
   */
  async createUser(name: string, email: string) {
    const now = BigInt(Date.now());
    const user = await this.prisma.user.create({
      data: {
        id: uuidv4().replace(/-/g, ''),
        name,
        email,
        type: UserType.User,
        badge: '[]',
        createTime: now,
        updateTime: now,
        loginTime: now,
      },
    });
    return user;
  }

  /**
   * 更新用户信息 - 对应 POST /api/v1/user/update
   * 与 Java 逻辑保持一致：检查用户名是否已被使用
   */
  async updateUser(userId: string, dto: UpdateUserDto) {
    // 检查用户名是否已被其他用户使用
    const existingUser = await this.getUserByName(dto.name);
    if (existingUser && existingUser.id !== userId) {
      throw new BadRequestException('用户名已被使用~');
    }

    // 获取当前用户
    const user =
      existingUser?.id === userId
        ? existingUser
        : await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new BadRequestException('用户不存在');
    }

    // 更新用户信息（与 Java 保持一致，更新 name 和 avatar）
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: dto.name,
        avatar: dto.avatar ?? user.avatar,
        updateTime: BigInt(Date.now()),
      },
    });

    return this.formatUserDto(updatedUser);
  }

  /**
   * 搜索用户 - 对应 GET /api/v1/user/search
   */
  async searchUsers(keyword: string) {
    const users = await this.prisma.user.findMany({
      where: {
        name: { contains: keyword },
      },
      orderBy: { type: 'desc' },
    });

    return users.map((user) => this.formatUserDto(user));
  }

  /**
   * 用户上线处理 - 对应 Java online(userId)
   * 广播用户上线通知（包含完整用户信息）
   */
  async online(userId: string) {
    const userDto = await this.getUserById(userId);
    if (!userDto) return;

    const notify = {
      time: new Date().toISOString(),
      type: NotifyType.WebOnline,
      content: JSON.stringify(userDto),
    };

    if (this.websocketGateway) {
      this.websocketGateway.sendNotifyToGroup(notify);
    }
  }

  /**
   * 用户下线处理 - 对应 Java offline(userId)
   * 1. 更新已读列表
   * 2. 广播用户下线通知
   */
  async offline(userId: string) {
    const userDto = await this.getUserById(userId);
    if (!userDto) return;

    // 离线更新已读列表（防止用户直接关闭浏览器等情况）
    const readCache = this.cache.get<string>(`user:read:${userId}`);
    if (readCache) {
      // 调用 chatListService.read 来更新已读状态
      // 这里通过事件或直接导入来实现
      try {
        const { ChatListService } = await import('../chat-list/chat-list.service');
        // 由于循环依赖，这里暂时只清理缓存
        // 实际的 read 逻辑会在 WebSocket 断开时处理
      } catch (e) {
        // 忽略导入错误
      }
      this.cache.del(`user:read:${userId}`);
    }

    const notify = {
      time: new Date().toISOString(),
      type: NotifyType.WebOffline,
      content: JSON.stringify(userDto),
    };

    if (this.websocketGateway) {
      this.websocketGateway.sendNotifyToGroup(notify);
    }
  }

  /**
   * 更新用户徽章 - 对应 Java updateUserBadge
   * 根据用户注册时间和顺序发放徽章
   */
  async updateUserBadge(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) return;

    let badges: string[] = user.badge ? JSON.parse(user.badge) : [];
    let isUpdate = false;

    // 检查是否是第一个用户（获得皇冠）
    const totalCount = await this.prisma.user.count();
    if (totalCount === 1) {
      if (!badges.includes(BadgeType.Crown)) {
        badges.push(BadgeType.Crown);
        isUpdate = true;
      }
    }

    // 根据用户创建时间发放徽章
    const createTime = Number(user.createTime);
    const now = Date.now();
    const diffInDays = Math.floor((now - createTime) / (1000 * 60 * 60 * 24));

    if (diffInDays >= 0 && diffInDays <= 7) {
      // 7天内新用户获得四叶草
      if (!badges.includes(BadgeType.Clover)) {
        badges.push(BadgeType.Clover);
        isUpdate = true;
      }
    } else if (diffInDays > 7) {
      // 7天后移除四叶草，添加钻石
      if (badges.includes(BadgeType.Clover)) {
        badges = badges.filter((b) => b !== BadgeType.Clover);
        isUpdate = true;
      }
      if (!badges.includes(BadgeType.Diamond)) {
        badges.push(BadgeType.Diamond);
        isUpdate = true;
      }
    }

    if (isUpdate) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          badge: JSON.stringify(badges),
          updateTime: BigInt(Date.now()),
        },
      });
    }
  }

  /**
   * 初始化机器人用户 - 对应 Java initBotUser
   * 创建 AI 机器人用户（豆包、DeepSeek）
   */
  async initBotUser() {
    const bots = [
      { id: 'doubao', name: '豆包' },
      { id: 'deepseek', name: 'DeepSeek' },
    ];

    for (const bot of bots) {
      const existing = await this.prisma.user.findUnique({
        where: { id: bot.id },
      });

      if (!existing) {
        const now = BigInt(Date.now());
        await this.prisma.user.create({
          data: {
            id: bot.id,
            name: bot.name,
            email: `${uuidv4().replace(/-/g, '')}@robot.com`,
            type: UserType.Bot,
            badge: '[]',
            createTime: now,
            updateTime: now,
          },
        });
        console.log(`🤖 已创建机器人用户: ${bot.name}`);
      }
    }
  }

  /**
   * 删除过期用户 - 对应 Java deleteExpiredUsers
   * @param expirationDays 过期天数
   */
  async deleteExpiredUsers(expirationDays: number) {
    const expirationTime = BigInt(Date.now() - expirationDays * 24 * 60 * 60 * 1000);

    const result = await this.prisma.user.deleteMany({
      where: {
        loginTime: { lt: expirationTime },
        type: UserType.User, // 只删除普通用户，不删除机器人
      },
    });

    if (result.count > 0) {
      console.log(`🧹 已清理 ${result.count} 个过期用户`);
    }
  }

  /**
   * 更新用户登录时间
   */
  async updateLoginTime(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { loginTime: BigInt(Date.now()) },
    });
  }

  /**
   * 格式化用户响应 - 返回 UserDto 格式
   * 与 Java UserDto 保持一致
   */
  private formatUserDto(user: any) {
    return {
      id: user.id,
      name: user.name,
      avatar: user.avatar,
      type: user.type,
      badge: user.badge ? JSON.parse(user.badge) : [],
    };
  }
}
