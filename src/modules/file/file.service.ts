import { Injectable, BadRequestException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';

/**
 * 文件服务 - 对应原 Java 项目的 FileController
 */
@Injectable()
export class FileService {
  private uploadDir: string;

  constructor() {
    this.uploadDir = path.join(process.cwd(), 'uploads');
    // 确保上传目录存在
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  /**
   * 上传文件 - 对应 POST /api/v1/file/upload
   */
  async upload(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('请选择文件');
    }

    const ext = path.extname(file.originalname);
    const filename = `${uuidv4()}${ext}`;
    const filepath = path.join(this.uploadDir, filename);

    // 保存文件
    fs.writeFileSync(filepath, file.buffer);

    return {
      url: `/uploads/${filename}`,
      filename: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
    };
  }

  /**
   * 上传头像 - 对应 POST /api/v1/file/upload/portrait
   */
  async uploadPortrait(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('请选择头像文件');
    }

    // 检查文件类型
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('请上传图片文件');
    }

    // 检查文件大小 (最大 2MB)
    if (file.size > 2 * 1024 * 1024) {
      throw new BadRequestException('头像文件不能超过 2MB');
    }

    const ext = path.extname(file.originalname);
    const filename = `portrait_${uuidv4()}${ext}`;
    const portraitDir = path.join(this.uploadDir, 'portrait');

    // 确保目录存在
    if (!fs.existsSync(portraitDir)) {
      fs.mkdirSync(portraitDir, { recursive: true });
    }

    const filepath = path.join(portraitDir, filename);
    fs.writeFileSync(filepath, file.buffer);

    return {
      url: `/uploads/portrait/${filename}`,
    };
  }

  /**
   * 获取文件 - 对应 GET /api/v1/file/:filename
   */
  getFile(filename: string): string {
    const filepath = path.join(this.uploadDir, filename);
    if (!fs.existsSync(filepath)) {
      throw new BadRequestException('文件不存在');
    }
    return filepath;
  }
}
