import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import * as winston from 'winston';
import 'winston-daily-rotate-file';
import * as path from 'path';

/**
 * 日志服务 - 对应原 Java 项目的 Logback 配置
 * 支持控制台输出和文件滚动记录
 */
@Injectable()
export class LoggerService implements NestLoggerService {
  private logger: winston.Logger;

  constructor() {
    const logDir = path.join(process.cwd(), 'logs');

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        winston.format.printf(({ timestamp, level, message, context }) => {
          return `${timestamp} [${level.toUpperCase()}] ${context ? `[${context}]` : ''} ${message}`;
        }),
      ),
      transports: [
        // 控制台输出
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
            winston.format.printf(({ timestamp, level, message, context }) => {
              return `${timestamp} [${level}] ${context ? `[${context}]` : ''} ${message}`;
            }),
          ),
        }),
        // 文件滚动输出
        new winston.transports.DailyRotateFile({
          dirname: logDir,
          filename: 'linyu-mini-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '14d',
        }),
      ],
    });
  }

  log(message: string, context?: string) {
    this.logger.info(message, { context });
  }

  error(message: string, trace?: string, context?: string) {
    this.logger.error(`${message}${trace ? ` - ${trace}` : ''}`, { context });
  }

  warn(message: string, context?: string) {
    this.logger.warn(message, { context });
  }

  debug(message: string, context?: string) {
    this.logger.debug(message, { context });
  }

  verbose(message: string, context?: string) {
    this.logger.verbose(message, { context });
  }

  // 请求日志
  logRequest(method: string, url: string, body?: any, ip?: string) {
    const bodyStr = body ? JSON.stringify(body) : '';
    this.logger.info(`${method} ${url} ${ip || ''} ${bodyStr}`, { context: 'HTTP' });
  }

  // 响应日志
  logResponse(method: string, url: string, statusCode: number, duration: number) {
    this.logger.info(`${method} ${url} ${statusCode} ${duration}ms`, { context: 'HTTP' });
  }
}
