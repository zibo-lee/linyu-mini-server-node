import { Injectable, BadRequestException } from '@nestjs/common';
import { WebsocketGateway } from '../../websocket/websocket.gateway';
import { LoggerService } from '../../common/utils/logger.service';

/**
 * 视频通话服务 - 对应原 Java 项目的 VideoService
 * 实现 WebRTC 信令转发
 */
@Injectable()
export class VideoService {
  constructor(
    private websocket: WebsocketGateway,
    private logger: LoggerService,
  ) {}

  /**
   * 发起视频邀请 - 对应 POST /api/v1/video/invite
   */
  async invite(fromUserId: string, toUserId: string, isOnlyAudio?: boolean) {
    if (!this.websocket.isUserOnline(toUserId)) {
      throw new BadRequestException('对方不在线');
    }

    this.websocket.sendVideoToUser({
      type: 'invite',
      fromId: fromUserId,
      isOnlyAudio: isOnlyAudio || false,
    }, toUserId);

    this.logger.log(`视频邀请: ${fromUserId} -> ${toUserId}, 纯语音: ${isOnlyAudio || false}`, 'VideoService');
    return { success: true };
  }

  /**
   * 接受视频邀请 - 对应 POST /api/v1/video/accept
   */
  async accept(fromUserId: string, toUserId: string) {
    this.websocket.sendVideoToUser({
      type: 'accept',
      fromId: fromUserId,
    }, toUserId);

    this.logger.log(`视频接受: ${fromUserId} -> ${toUserId}`, 'VideoService');
    return { success: true };
  }

  /**
   * 发送 Offer (SDP描述) - 对应 POST /api/v1/video/offer
   */
  async offer(fromUserId: string, toUserId: string, desc: any) {
    this.websocket.sendVideoToUser({
      type: 'offer',
      fromId: fromUserId,
      desc,
    }, toUserId);

    this.logger.log(`视频Offer: ${fromUserId} -> ${toUserId}`, 'VideoService');
    return { success: true };
  }

  /**
   * 发送 Answer (SDP应答) - 对应 POST /api/v1/video/answer
   */
  async answer(fromUserId: string, toUserId: string, desc: any) {
    this.websocket.sendVideoToUser({
      type: 'answer',
      fromId: fromUserId,
      desc,
    }, toUserId);

    this.logger.log(`视频Answer: ${fromUserId} -> ${toUserId}`, 'VideoService');
    return { success: true };
  }

  /**
   * 发送 ICE 候选 - 对应 POST /api/v1/video/candidate
   */
  async candidate(fromUserId: string, toUserId: string, candidate: any) {
    this.websocket.sendVideoToUser({
      type: 'candidate',
      fromId: fromUserId,
      candidate,
    }, toUserId);

    return { success: true };
  }

  /**
   * 挂断 - 对应 POST /api/v1/video/hangup
   */
  async hangup(fromUserId: string, toUserId: string) {
    this.websocket.sendVideoToUser({
      type: 'hangup',
      fromId: fromUserId,
    }, toUserId);

    this.logger.log(`视频挂断: ${fromUserId} -> ${toUserId}`, 'VideoService');
    return { success: true };
  }
}
