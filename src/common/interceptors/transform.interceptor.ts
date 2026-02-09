import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * 统一响应格式
 * 对应原 Java 项目的 Result<T> 返回结构
 */
export interface ApiResponse<T> {
  code: number;
  msg?: string;
  data: T;
}

/**
 * 响应转换拦截器
 * 将所有成功响应包装为统一格式 { code: 0, data: xxx }
 */
@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        // 如果返回的数据已经是标准格式，直接返回
        if (data && typeof data === 'object' && 'code' in data) {
          return data;
        }
        // 包装为标准格式
        return {
          code: 0,
          data,
        };
      }),
    );
  }
}
