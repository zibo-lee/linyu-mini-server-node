import { Module, forwardRef } from '@nestjs/common';
import { ChatListController } from './chat-list.controller';
import { ChatListService } from './chat-list.service';
import { UserModule } from '../user/user.module';

@Module({
  imports: [forwardRef(() => UserModule)],
  controllers: [ChatListController],
  providers: [ChatListService],
  exports: [ChatListService],
})
export class ChatListModule {}
