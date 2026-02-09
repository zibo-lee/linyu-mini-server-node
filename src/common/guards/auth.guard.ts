import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import { CacheService } from '../utils/cache.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * 认证守卫 - 对应原 Java 项目的 AuthenticationTokenFilter
 * 验证 JWT Token 并将用户信息注入请求
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private cacheService: CacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 检查是否为公开接口（免认证）
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('未提供认证令牌');
    }

    try {
      // 验证 Token
      const payload = jwt.verify(
        token,
        process.env.JWT_SECRET || 'linyu-mini-secret',
      ) as any;

      // 注意：由于使用内存缓存，服务重启后缓存会丢失
      // 这里我们只检查缓存用于登出场景，如果缓存中没有 token 也允许通过
      // 只有当缓存中存在不同的 token 时才拒绝（说明用户已重新登录）
      const cachedToken = this.cacheService.get<string>(`token:${payload.userId}`);
      if (cachedToken && cachedToken !== token) {
        throw new UnauthorizedException('令牌已失效，请重新登录');
      }

      // 将用户信息注入请求
      request['user'] = {
        userId: payload.userId,
        name: payload.userName || payload.name,
        type: payload.type,
      };

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('令牌验证失败');
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    // 优先检查 x-token header（前端使用的格式）
    const xToken = request.headers['x-token'] as string;
    if (xToken) {
      return xToken;
    }

    // 兼容 Authorization: Bearer xxx 格式
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
