import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { FileController } from './file.controller';
import { FileService } from './file.service';
import { WebsocketModule } from '../../websocket/websocket.module';
import { LoggerService } from '../../common/utils/logger.service';

@Module({
  imports: [
    MulterModule.register({
      limits: {
        fileSize: 10 * 1024 * 1024, // 最大 10MB
      },
    }),
    WebsocketModule,
  ],
  controllers: [FileController],
  providers: [FileService, LoggerService],
  exports: [FileService],
})
export class FileModule {}
