import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { NotifyService } from './notify.service';
import { Public } from '../../common/decorators/public.decorator';

/**
 * 通知控制器 - 对应原 Java 项目的 NotifyController
 */
@Controller('notify')
export class NotifyController {
  constructor(private readonly notifyService: NotifyService) {}

  /**
   * 获取最新通知
   * GET /api/v1/notify/get
   */
  @Public()
  @Get('get')
  async getNotify() {
    return this.notifyService.getLatestNotify();
  }

  /**
   * 获取通知列表
   * GET /api/v1/notify/list
   */
  @Get('list')
  async getNotifyList(
    @Query('page') page?: string,
    @Query('size') size?: string,
  ) {
    return this.notifyService.getNotifyList(
      parseInt(page || '0'),
      parseInt(size || '10'),
    );
  }

  /**
   * 创建通知
   * POST /api/v1/notify/create
   */
  @Post('create')
  async createNotify(
    @Body('title') title: string,
    @Body('content') content: string,
    @Body('type') type?: string,
  ) {
    return this.notifyService.createNotify(title, content, type);
  }
}
