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
    @UserId() fromUserId: string,
    @Body('userId') userId: string,
    @Body('isOnlyAudio') isOnlyAudio?: boolean,
  ) {
    return this.videoService.invite(fromUserId, userId, isOnlyAudio);
  }

  /**
   * 接受视频邀请
   * POST /api/v1/video/accept
   */
  @Post('accept')
  async accept(
    @UserId() fromUserId: string,
    @Body('userId') userId: string,
  ) {
    return this.videoService.accept(fromUserId, userId);
  }

  /**
   * 发送 Offer
   * POST /api/v1/video/offer
   */
  @Post('offer')
  async offer(
    @UserId() fromUserId: string,
    @Body('userId') userId: string,
    @Body('desc') desc: any,
  ) {
    return this.videoService.offer(fromUserId, userId, desc);
  }

  /**
   * 发送 Answer
   * POST /api/v1/video/answer
   */
  @Post('answer')
  async answer(
    @UserId() fromUserId: string,
    @Body('userId') userId: string,
    @Body('desc') desc: any,
  ) {
    return this.videoService.answer(fromUserId, userId, desc);
  }

  /**
   * 发送 ICE 候选
   * POST /api/v1/video/candidate
   */
  @Post('candidate')
  async candidate(
    @UserId() fromUserId: string,
    @Body('userId') userId: string,
    @Body('candidate') candidate: any,
  ) {
    return this.videoService.candidate(fromUserId, userId, candidate);
  }

  /**
   * 挂断
   * POST /api/v1/video/hangup
   */
  @Post('hangup')
  async hangup(
    @UserId() fromUserId: string,
    @Body('userId') userId: string,
  ) {
    return this.videoService.hangup(fromUserId, userId);
  }
}
