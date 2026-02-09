import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../common/utils/prisma.service';
import { WebsocketGateway } from '../../websocket/websocket.gateway';

/**
 * 通知服务 - 对应原 Java 项目的 NotifyService
 */
@Injectable()
export class NotifyService {
  constructor(
    private prisma: PrismaService,
    private websocket: WebsocketGateway,
  ) {}

  /**
   * 获取最新通知 - 对应 GET /api/v1/notify/get
   */
  async getLatestNotify() {
    const notify = await this.prisma.notify.findFirst({
      orderBy: { createTime: 'desc' },
    });

    if (!notify) {
      return null;
    }

    return this.formatNotifyResponse(notify);
  }

  /**
   * 获取通知列表 - 对应 GET /api/v1/notify/list
   */
  async getNotifyList(page: number = 0, size: number = 10) {
    const skip = page * size;

    const [notifies, total] = await Promise.all([
      this.prisma.notify.findMany({
        orderBy: { createTime: 'desc' },
        skip,
        take: size,
      }),
      this.prisma.notify.count(),
    ]);

    return {
      list: notifies.map((n) => this.formatNotifyResponse(n)),
      total,
      page,
      size,
    };
  }

  /**
   * 创建通知 - 对应 POST /api/v1/notify/create
   */
  async createNotify(title: string, content: string, type?: string) {
    const now = Date.now();

    const notify = await this.prisma.notify.create({
      data: {
        id: uuidv4().replace(/-/g, ''),
        notifyTitle: title,
        notifyContent: content,
        type: type || 'system',
        createTime: BigInt(now),
        updateTime: BigInt(now),
      },
    });

    const formattedNotify = this.formatNotifyResponse(notify);

    // 广播通知给所有在线用户
    this.websocket.sendNotify(null, formattedNotify);

    return formattedNotify;
  }

  /**
   * 格式化通知响应
   */
  private formatNotifyResponse(notify: any) {
    return {
      id: notify.id,
      notifyTitle: notify.notifyTitle,
      notifyContent: notify.notifyContent,
      type: notify.type,
      createTime: this.formatDateTime(Number(notify.createTime)),
      updateTime: this.formatDateTime(Number(notify.updateTime)),
    };
  }

  /**
   * 格式化日期时间
   */
  private formatDateTime(timestamp: number): string {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${date.getMilliseconds().toString().padStart(3, '0')}`;
  }
}
