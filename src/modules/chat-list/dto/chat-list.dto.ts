import { IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * 创建聊天列表 DTO - 对应 Java CreateVo
 */
export class CreateChatListDto {
  @IsNotEmpty({ message: '目标不能为空~' })
  @Transform(({ value }) => String(value))
  targetId: string;
}

/**
 * 标记已读 DTO - 对应 Java ReadVo
 * 注意：Java 后端允许 targetId 为空，此时直接返回 false
 */
export class ReadChatListDto {
  @IsOptional()
  @Transform(({ value }) => value ? String(value) : null)
  targetId?: string;
}

/**
 * 删除聊天列表 DTO - 对应 Java DeleteVo
 */
export class DeleteChatListDto {
  @Transform(({ value }) => String(value))
  chatListId: string;
}
