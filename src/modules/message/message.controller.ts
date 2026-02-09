import { Controller, Post, Body } from '@nestjs/common';
import { MessageService } from './message.service';
import { SendMessageDto, RecallMessageDto, GetRecordDto } from './dto/message.dto';
import { UserId, UserIp } from '../../common/decorators/user.decorator';

/**
 * 消息控制器 - 对应原 Java 项目的 MessageController
 */
@Controller('message')
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  /**
   * 发送消息
   * POST /api/v1/message/send
   */
  @Post('send')
  async send(
    @UserId() userId: string,
    @Body() dto: SendMessageDto,
    @UserIp() ip: string,
  ) {
    return this.messageService.send(userId, dto, ip);
  }

  /**
   * 获取消息记录
   * POST /api/v1/message/record
   */
  @Post('record')
  async getRecord(@UserId() userId: string, @Body() dto: GetRecordDto) {
    return this.messageService.getRecord(userId, dto);
  }

  /**
   * 撤回消息
   * POST /api/v1/message/recall
   */
  @Post('recall')
  async recall(@UserId() userId: string, @Body() dto: RecallMessageDto) {
    return this.messageService.recall(userId, dto);
  }
}
