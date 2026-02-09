import {
  Controller,
  Post,
  Get,
  Param,
  Res,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { FileService } from './file.service';
import { Public } from '../../common/decorators/public.decorator';

/**
 * 文件控制器 - 对应原 Java 项目的 FileController
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
}
