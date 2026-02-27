import { Injectable, BadRequestException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';
import { WebsocketGateway } from '../../websocket/websocket.gateway';
import { LoggerService } from '../../common/utils/logger.service';

/**
 * 文件服务 - 对应原 Java 项目的 FileService
 * 包含文件上传下载和文件传输信令功能
 */
@Injectable()
export class FileService {
  private uploadDir: string;

  constructor(
    private websocket: WebsocketGateway,
    private logger: LoggerService,
  ) {
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
      filename: filename,  // 返回存储的唯一文件名，用于后续获取文件
      originalName: file.originalname,  // 原始文件名
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

  // ==================== 文件传输信令方法 ====================

  /**
   * 发送 Offer (SDP描述) - 对应 POST /api/v1/file/offer
   */
  async offer(fromUserId: string, toUserId: string, desc: any) {
    this.websocket.sendFileToUser({
      type: 'offer',
      fromId: fromUserId,
      desc,
    }, toUserId);

    this.logger.log(`文件传输Offer: ${fromUserId} -> ${toUserId}`, 'FileService');
    return { success: true };
  }

  /**
   * 发送 Answer (SDP应答) - 对应 POST /api/v1/file/answer
   */
  async answer(fromUserId: string, toUserId: string, desc: any) {
    this.websocket.sendFileToUser({
      type: 'answer',
      fromId: fromUserId,
      desc,
    }, toUserId);

    this.logger.log(`文件传输Answer: ${fromUserId} -> ${toUserId}`, 'FileService');
    return { success: true };
  }

  /**
   * 发送 ICE 候选 - 对应 POST /api/v1/file/candidate
   */
  async candidate(fromUserId: string, toUserId: string, candidate: any) {
    this.websocket.sendFileToUser({
      type: 'candidate',
      fromId: fromUserId,
      candidate,
    }, toUserId);

    return { success: true };
  }

  /**
   * 取消文件传输 - 对应 POST /api/v1/file/cancel
   */
  async cancel(fromUserId: string, toUserId: string) {
    this.websocket.sendFileToUser({
      type: 'cancel',
      fromId: fromUserId,
    }, toUserId);

    this.logger.log(`文件传输取消: ${fromUserId} -> ${toUserId}`, 'FileService');
    return { success: true };
  }

  /**
   * 发起文件传输邀请 - 对应 POST /api/v1/file/invite
   */
  async invite(fromUserId: string, toUserId: string, fileInfo: { name: string; size: number }) {
    this.websocket.sendFileToUser({
      type: 'invite',
      fromId: fromUserId,
      fileInfo,
    }, toUserId);

    this.logger.log(`文件传输邀请: ${fromUserId} -> ${toUserId}, 文件: ${fileInfo.name}`, 'FileService');
    return { success: true };
  }

  /**
   * 接受文件传输邀请 - 对应 POST /api/v1/file/accept
   */
  async accept(fromUserId: string, toUserId: string) {
    this.websocket.sendFileToUser({
      type: 'accept',
      fromId: fromUserId,
    }, toUserId);

    this.logger.log(`文件传输接受: ${fromUserId} -> ${toUserId}`, 'FileService');
    return { success: true };
  }
}
