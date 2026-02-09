import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { LoggerService } from '../utils/logger.service';

/**
 * 全局异常过滤器 - 对应原 Java 项目的 GlobalExceptionHandler
 * 统一处理所有 HTTP 异常，返回标准格式响应
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = '服务器内部错误';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const responseBody = exception.getResponse();
      message =
        typeof responseBody === 'string'
          ? responseBody
          : (responseBody as any).message || exception.message;
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    // 记录错误日志
    this.logger.error(
      `${request.method} ${request.url} - ${status} - ${message}`,
      exception instanceof Error ? exception.stack : undefined,
      'ExceptionFilter',
    );

    // 返回统一格式的错误响应
    // 与 Java 后端 ResultUtil 保持一致：
    // 0 = SUCCEED, 1 = FAIL(业务错误), -1 = TOKEN_INVALID, -2 = FORBIDDEN, -3 = LOGIN_ELSEWHERE
    response.status(status).json({
      code: status === HttpStatus.OK ? 0 : 1,
      msg: message,
      data: null,
    });
  }
}
