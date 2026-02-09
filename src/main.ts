import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggerService } from './common/utils/logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = app.get(LoggerService);

  // 全局前缀
  app.setGlobalPrefix('api/v1');

  // 全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // 全局异常过滤器
  app.useGlobalFilters(new HttpExceptionFilter(logger));

  // 全局响应转换拦截器
  app.useGlobalInterceptors(new TransformInterceptor());

  // 启用 CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });

  const port = process.env.PORT || 9200;
  await app.listen(port);

  logger.log(`🚀 林语Mini服务已启动: http://localhost:${port}`);
  logger.log(`📖 API 前缀: /api/v1`);
}

bootstrap();
