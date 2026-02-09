import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Res,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { FileService } from './file.service';
import { Public } from '../../common/decorators/public.decorator';
import { UserId } from '../../common/decorators/user.decorator';

/**
 * 文件控制器 - 对应原 Java 项目的 FileController
 * 包含文件上传下载和文件传输信令功能
 */
@Controller('file')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  /**
   * 上传文件
   * POST /api/v1/file/upload
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(@UploadedFile() file: Express.Multer.File) {
    return this.fileService.upload(file);
  }

  /**
   * 上传头像
   * POST /api/v1/file/upload/portrait
   */
  @Post('upload/portrait')
  @UseInterceptors(FileInterceptor('file'))
  async uploadPortrait(@UploadedFile() file: Express.Multer.File) {
    return this.fileService.uploadPortrait(file);
  }

  /**
   * 获取文件
   * GET /api/v1/file/:filename
   */
  @Public()
  @Get(':filename')
  async getFile(@Param('filename') filename: string, @Res() res: Response) {
    const filepath = this.fileService.getFile(filename);
    return res.sendFile(filepath);
  }

  // ==================== 文件传输信令接口 ====================

  /**
   * 发送 Offer (SDP描述) - 对应 POST /api/v1/file/offer
   */
  @Post('offer')
  async offer(
    @UserId() fromUserId: string,
    @Body('userId') userId: string,
    @Body('desc') desc: any,
  ) {
    return this.fileService.offer(fromUserId, userId, desc);
  }

  /**
   * 发送 Answer (SDP应答) - 对应 POST /api/v1/file/answer
   */
  @Post('answer')
  async answer(
    @UserId() fromUserId: string,
    @Body('userId') userId: string,
    @Body('desc') desc: any,
  ) {
    return this.fileService.answer(fromUserId, userId, desc);
  }

  /**
   * 发送 ICE 候选 - 对应 POST /api/v1/file/candidate
   */
  @Post('candidate')
  async candidate(
    @UserId() fromUserId: string,
    @Body('userId') userId: string,
    @Body('candidate') candidate: any,
  ) {
    return this.fileService.candidate(fromUserId, userId, candidate);
  }

  /**
   * 取消文件传输 - 对应 POST /api/v1/file/cancel
   */
  @Post('cancel')
  async cancel(
    @UserId() fromUserId: string,
    @Body('userId') userId: string,
  ) {
    return this.fileService.cancel(fromUserId, userId);
  }

  /**
   * 发起文件传输邀请 - 对应 POST /api/v1/file/invite
   */
  @Post('invite')
  async invite(
    @UserId() fromUserId: string,
    @Body('userId') userId: string,
    @Body('fileInfo') fileInfo: { name: string; size: number },
  ) {
    return this.fileService.invite(fromUserId, userId, fileInfo);
  }

  /**
   * 接受文件传输邀请 - 对应 POST /api/v1/file/accept
   */
  @Post('accept')
  async accept(
    @UserId() fromUserId: string,
    @Body('userId') userId: string,
  ) {
    return this.fileService.accept(fromUserId, userId);
  }
}
