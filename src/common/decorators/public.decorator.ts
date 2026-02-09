import { SetMetadata } from '@nestjs/common';

/**
 * 公开接口装饰器 - 对应原 Java 项目的 @UrlFree 注解
 * 标记不需要认证的接口
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
