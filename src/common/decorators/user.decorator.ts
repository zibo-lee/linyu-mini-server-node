import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * 用户 ID 装饰器 - 对应原 Java 项目的 @Userid 注解
 * 从请求中提取当前登录用户的 ID
 */
export const UserId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.userId;
  },
);

/**
 * 用户 IP 装饰器 - 对应原 Java 项目的 @UserIp 注解
 * 从请求中提取用户 IP 地址
 */
export const UserIp = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    // 获取真实 IP（考虑代理情况）
    const forwarded = request.headers['x-forwarded-for'];
    const ip = forwarded
      ? (forwarded as string).split(',')[0].trim()
      : request.ip || request.connection?.remoteAddress;
    return ip?.replace('::ffff:', '') || '127.0.0.1';
  },
);

/**
 * 完整用户信息装饰器
 * 从请求中提取当前登录用户的完整信息
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
