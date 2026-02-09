import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/user.dto';
import { UserId } from '../../common/decorators/user.decorator';

/**
 * 用户控制器 - 对应原 Java 项目的 UserController
 */
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * 获取用户列表
   * GET /api/v1/user/list
   */
  @Get('list')
  async getUserList() {
    return this.userService.getUserList();
  }

  /**
   * 获取用户列表（Map 格式，以 userId 为 key）
   * GET /api/v1/user/list/map
   */
  @Get('list/map')
  async getUserListMap() {
    return this.userService.getUserListMap();
  }

  /**
   * 获取在线用户列表
   * GET /api/v1/user/online/web
   */
  @Get('online/web')
  async getOnlineUsers() {
    return this.userService.getOnlineUsers();
  }

  /**
   * 获取用户详情
   * GET /api/v1/user/info/:id
   */
  @Get('info/:id')
  async getUserById(@Param('id') id: string) {
    return this.userService.getUserById(id);
  }

  /**
   * 更新用户信息
   * POST /api/v1/user/update - 与 Java 保持一致使用 POST
   */
  @Post('update')
  async updateUser(@UserId() userId: string, @Body() dto: UpdateUserDto) {
    return this.userService.updateUser(userId, dto);
  }

  /**
   * 搜索用户
   * GET /api/v1/user/search
   */
  @Get('search')
  async searchUsers(@Query('keyword') keyword: string) {
    return this.userService.searchUsers(keyword || '');
  }
}
