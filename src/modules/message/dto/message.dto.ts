import { IsNotEmpty, IsString, IsOptional, IsNumber, IsIn, Max } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * 发送消息 DTO
 */
export class SendMessageDto {
  @IsNotEmpty({ message: '消息内容不能为空' })
  @IsString()
  msgContent: string;

  @IsNotEmpty({ message: '目标ID不能为空' })
  @Transform(({ value }) => String(value))
  @IsString()
  targetId: string;

  @IsOptional()
  @IsString()
  @IsIn(['text', 'image', 'file', 'video', 'emoji', 'recall', 'call'], { message: '消息类型无效' })
  type?: string;

  @IsOptional()
  @IsString()
  @IsIn(['user', 'group'], { message: '消息来源无效' })
  source?: string;

  @IsOptional()
  @IsString()
  referenceMsgId?: string;
}

/**
 * 撤回消息 DTO
 */
export class RecallMessageDto {
  @IsNotEmpty({ message: '消息ID不能为空' })
  @IsString()
  msgId: string;
}

/**
 * 获取消息记录 DTO - 对应 Java RecordVo
 */
export class GetRecordDto {
  @IsNotEmpty({ message: '目标ID不能为空' })
  @Transform(({ value }) => String(value))
  @IsString()
  targetId: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  index?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Max(100)
  num?: number;
}
