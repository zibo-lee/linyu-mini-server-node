import { IsNotEmpty, IsString, MinLength, MaxLength } from 'class-validator';

/**
 * 验证密码 DTO
 */
export class VerifyDto {
  @IsNotEmpty({ message: '密码不能为空' })
  @IsString()
  password: string;
}

/**
 * 登录 DTO
 */
export class LoginDto {
  @IsNotEmpty({ message: '用户名不能为空' })
  @IsString()
  @MinLength(2, { message: '用户名至少2个字符' })
  @MaxLength(20, { message: '用户名最多20个字符' })
  name: string;

  @IsNotEmpty({ message: '邮箱不能为空' })
  @IsString()
  email: string;
}
