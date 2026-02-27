import { Module, forwardRef } from '@nestjs/common';
import { AiService } from './ai.service';
import { MessageModule } from '../message/message.module';

@Module({
  imports: [forwardRef(() => MessageModule)],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
