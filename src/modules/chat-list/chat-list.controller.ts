import { Controller, Get, Post, Body } from '@nestjs/common';
import { ChatListService } from './chat-list.service';
import { UserId } from '../../common/decorators/user.decorator';
import { CreateChatListDto, ReadChatListDto, DeleteChatListDto } from './dto/chat-list.dto';

/**
 * 聊天列表控制器 - 对应原 Java 项目的 ChatListController
 */
@Controller('chat-list')
export class ChatListController {
  constructor(private readonly chatListService: ChatListService) {}

  /**
   * 获取私聊列表
   * GET /api/v1/chat-list/list/private
   */
  @Get('list/private')
  async getPrivateList(@UserId() userId: string) {
    return this.chatListService.privateList(userId);
  }

  /**
   * 获取群聊信息 - 与 Java 保持一致，根据 userId 获取或创建群聊记录
   * GET /api/v1/chat-list/group
   */
  @Get('group')
  async getGroup(@UserId() userId: string) {
    return this.chatListService.getGroup(userId);
  }

  /**
   * 创建聊天列表
   * POST /api/v1/chat-list/create
   */
  @Post('create')
  async create(
    @UserId() userId: string,
    @Body() dto: CreateChatListDto,
  ) {
    return this.chatListService.create(userId, dto.targetId);
  }

  /**
   * 标记已读
   * POST /api/v1/chat-list/read
   */
  @Post('read')
  async read(
    @UserId() userId: string,
    @Body() dto: ReadChatListDto,
  ) {
    return this.chatListService.read(userId, dto.targetId || '');
  }

  /**
   * 删除聊天列表 - 与 Java 保持一致使用 POST
   * POST /api/v1/chat-list/delete
   */
  @Post('delete')
  async delete(
    @UserId() userId: string,
    @Body() dto: DeleteChatListDto,
  ) {
    return this.chatListService.delete(userId, dto.chatListId);
  }
}
