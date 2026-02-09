import { Controller, Post, Body } from '@nestjs/common';
import { VideoService } from './video.service';
import { UserId, CurrentUser } from '../../common/decorators/user.decorator';

/**
 * 视频通话控制器 - 对应原 Java 项目的 VideoController
 */
@Controller('video')
export class VideoController {
  constructor(private readonly videoService: VideoService) {}

  /**
   * 发起视频邀请
   * POST /api/v1/video/invite
   */
  @Post('invite')
  async invite(
    @UserId() userId: string,
    @CurrentUser() user: any,
    @Body('toUserId') toUserId: string,
  ) {
    return this.videoService.invite(userId, toUserId, user.name);
  }

  /**
   * 接受视频邀请
   * POST /api/v1/video/accept
   */
  @Post('accept')
  async accept(
    @UserId() userId: string,
    @Body('toUserId') toUserId: string,
  ) {
    return this.videoService.accept(userId, toUserId);
  }

  /**
   * 拒绝视频邀请
   * POST /api/v1/video/reject
   */
  @Post('reject')
  async reject(
    @UserId() userId: string,
    @Body('toUserId') toUserId: string,
    @Body('reason') reason?: string,
  ) {
    return this.videoService.reject(userId, toUserId, reason);
  }

  /**
   * 发送 Offer
   * POST /api/v1/video/offer
   */
  @Post('offer')
  async offer(
    @UserId() userId: string,
    @Body('toUserId') toUserId: string,
    @Body('sdp') sdp: any,
  ) {
    return this.videoService.offer(userId, toUserId, sdp);
  }

  /**
   * 发送 Answer
   * POST /api/v1/video/answer
   */
  @Post('answer')
  async answer(
    @UserId() userId: string,
    @Body('toUserId') toUserId: string,
    @Body('sdp') sdp: any,
  ) {
    return this.videoService.answer(userId, toUserId, sdp);
  }

  /**
   * 发送 ICE 候选
   * POST /api/v1/video/candidate
   */
  @Post('candidate')
  async candidate(
    @UserId() userId: string,
    @Body('toUserId') toUserId: string,
    @Body('candidate') candidate: any,
  ) {
    return this.videoService.candidate(userId, toUserId, candidate);
  }

  /**
   * 挂断
   * POST /api/v1/video/hangup
   */
  @Post('hangup')
  async hangup(
    @UserId() userId: string,
    @Body('toUserId') toUserId: string,
  ) {
    return this.videoService.hangup(userId, toUserId);
  }
}
