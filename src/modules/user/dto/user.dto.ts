import { IsOptional, IsString, IsNotEmpty, Matches } from 'class-validator';

/**
 * 更新用户信息 DTO - 对应 Java UpdateUserVo
 */
export class UpdateUserDto {
  @IsNotEmpty({ message: '用户名不能为空~' })
  @IsString()
  @Matches(/^[a-zA-Z][a-zA-Z0-9]{2,15}$/, {
    message: '用户名只能包含英文字母和数字，且必须以英文字母开头，长度为[3-16]位~',
  })
  name: string;

  @IsOptional()
  @IsString()
  avatar?: string;
}
