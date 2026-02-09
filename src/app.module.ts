import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './common/utils/prisma.module';
import { LoggerModule } from './common/utils/logger.module';
import { CacheModule } from './common/utils/cache.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { MessageModule } from './modules/message/message.module';
import { ChatListModule } from './modules/chat-list/chat-list.module';
import { NotifyModule } from './modules/notify/notify.module';
import { VideoModule } from './modules/video/video.module';
import { FileModule } from './modules/file/file.module';
import { AiModule } from './modules/ai/ai.module';
import { WebsocketModule } from './websocket/websocket.module';
import { UserService } from './modules/user/user.service';
import { WebsocketGateway } from './websocket/websocket.gateway';

@Module({
  imports: [
    // 配置模块 - 加载 .env 环境变量
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // 定时任务模块
    ScheduleModule.forRoot(),
    // 基础设施模块
    PrismaModule,
    LoggerModule,
    CacheModule,
    // WebSocket 模块
    WebsocketModule,
    // 业务模块
    AuthModule,
    UserModule,
    MessageModule,
    ChatListModule,
    NotifyModule,
    VideoModule,
    FileModule,
    AiModule,
  ],
})
export class AppModule implements OnModuleInit {
  constructor(
    private userService: UserService,
    private websocketGateway: WebsocketGateway,
  ) {}

  async onModuleInit() {
    // 建立 UserService 和 WebsocketGateway 的双向引用
    this.websocketGateway.setUserService(this.userService);

    // 初始化机器人用户
    await this.userService.initBotUser();

    console.log('✅ 应用初始化完成');
  }
}
