import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../common/utils/prisma.service';
import { CacheService } from '../../common/utils/cache.service';
import { LoggerService } from '../../common/utils/logger.service';
import { SecurityUtil } from '../../common/utils/security.util';
import { LoginDto, VerifyDto } from './dto/auth.dto';

/**
 * 认证服务 - 对应原 Java 项目的 LoginService
 */
@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
    private config: ConfigService,
    private logger: LoggerService,
  ) {}

  /**
   * 验证群密码 - 对应 /api/v1/login/verify
   * 验证成功后返回一个临时 token，用于后续的登录请求
   */
  async verify(dto: VerifyDto): Promise<string> {
    // 检查在线人数限制
    const limit = this.config.get<number>('ZIBOLT_LIMIT') || 100;
    const onlineCount = this.cache.getKeysByPrefix('token:').length;
    if (onlineCount >= limit) {
      throw new BadRequestException('聊天室人数已满，请稍后再试~');
    }

    const configPassword = this.config.get<string>('ZIBOLT_PASSWORD') || 'sun55@kong';
    
    // 使用 RSA 解密前端传来的加密密码
    let decryptedPassword: string;
    try {
      decryptedPassword = SecurityUtil.decryptPassword(dto.password);
    } catch (error) {
      throw new BadRequestException('密码解析失败');
    }

    if (decryptedPassword !== configPassword) {
      throw new BadRequestException('密码错误~');
    }

    // 生成临时验证 token (与 Java 项目一致)
    const secret = this.config.get<string>('JWT_SECRET') || 'zibolt-chat-secret';
    const verifyToken = jwt.sign({ type: 'verify' }, secret, { expiresIn: '10m' });
    return verifyToken;
  }

  /**
   * 用户登录 - 对应 /api/v1/login
   * 前端通过 verify 验证密码后，再调用此接口进行登录
   */
  async login(dto: LoginDto, ip: string) {
    // 检查在线人数限制
    const limit = this.config.get<number>('ZIBOLT_LIMIT') || 100;
    const onlineCount = this.cache.getKeysByPrefix('token:').length;
    if (onlineCount >= limit) {
      throw new BadRequestException('聊天室人数已满，请稍后再试~');
    }

    const now = Date.now();
    
    // 根据 name 或 email 查找用户（与 Java 项目一致）
    let user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { name: dto.name },
          { email: dto.email }
        ]
      },
    });

    if (user) {
      // 检查用户名和邮箱是否匹配
      if (user.name === dto.name && user.email !== dto.email) {
        throw new BadRequestException('用户名已被使用~');
      }
      if (user.name !== dto.name && user.email === dto.email) {
        throw new BadRequestException('邮箱已被使用~');
      }
      // 更新登录时间
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          loginTime: BigInt(now),
          updateTime: BigInt(now),
        },
      });
    } else {
      // 创建新用户
      const badge = this.generateBadge(now);
      user = await this.prisma.user.create({
        data: {
          id: uuidv4().replace(/-/g, ''),
          name: dto.name,
          email: dto.email,
          type: 'user',
          badge: JSON.stringify(badge),
          loginTime: BigInt(now),
          createTime: BigInt(now),
          updateTime: BigInt(now),
        },
      });
    }

    // 生成 JWT Token（包含用户信息，与 Java 项目一致）
    const secret = this.config.get<string>('JWT_SECRET') || 'zibolt-chat-secret';
    const tokenPayload = {
      type: 'user',
      userId: user.id,
      userName: user.name,
      email: user.email,
      avatar: user.portrait,
    };
    const token = jwt.sign(tokenPayload, secret, { expiresIn: '7d' });

    // 缓存 Token (7 天有效)
    this.cache.set(`token:${user.id}`, token, 7 * 24 * 3600);

    this.logger.log(`用户 ${user.name}(${user.email}) 登录成功, IP: ${ip}`, 'AuthService');

    // 返回前端期望的格式
    return {
      token,
      userId: user.id,
      userName: user.name,
      email: user.email,
      avatar: user.portrait,
    };
  }

  /**
   * 获取当前用户信息 - 对应 /api/v1/current
   */
  async getCurrentUser(userId: string, ip: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('用户不存在');
    }

    const ipOwnership = await this.getIpOwnership(ip);
    return this.formatUserResponse(user, ipOwnership);
  }

  /**
   * 退出登录 - 对应 /api/v1/logout
   */
  async logout(userId: string) {
    this.cache.del(`token:${userId}`);
    this.logger.log(`用户 ${userId} 已退出登录`, 'AuthService');
    return { success: true };
  }

  /**
   * 生成 JWT Token
   */
  private generateToken(user: any): string {
    const payload = {
      userId: user.id,
      name: user.name,
      type: user.type,
    };
    const secret = this.config.get<string>('JWT_SECRET') || 'zibolt-chat-secret';
    return jwt.sign(payload, secret, { expiresIn: '7d' });
  }

  /**
   * 根据注册时间生成徽章
   */
  private generateBadge(timestamp: number): string[] {
    const badges: string[] = [];
    const date = new Date(timestamp);
    const month = date.getMonth() + 1;

    // 根据月份分配徽章（四叶草系统）
    if (month >= 3 && month <= 5) {
      badges.push('clover'); // 春季 - 四叶草
    } else if (month >= 6 && month <= 8) {
      badges.push('sun'); // 夏季 - 太阳
    } else if (month >= 9 && month <= 11) {
      badges.push('maple'); // 秋季 - 枫叶
    } else {
      badges.push('snowflake'); // 冬季 - 雪花
    }

    return badges;
  }

  /**
   * 获取 IP 归属地
   */
  private async getIpOwnership(ip: string): Promise<string> {
    if (!ip || ip === '127.0.0.1' || ip === 'localhost' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
      return '内网';
    }

    try {
      // 这里可以后续集成 ip2region
      // 暂时返回简单判断
      return '未知';
    } catch (error) {
      return '未知';
    }
  }

  /**
   * 格式化用户响应
   */
  private formatUserResponse(user: any, ipOwnership: string) {
    return {
      id: user.id,
      name: user.name,
      type: user.type,
      portrait: user.portrait,
      email: user.email,
      badge: user.badge ? JSON.parse(user.badge) : [],
      ipOwnership,
      createTime: this.formatDateTime(Number(user.createTime)),
      updateTime: this.formatDateTime(Number(user.updateTime)),
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
