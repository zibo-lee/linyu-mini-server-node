import { Controller, Post, Get, Body, HttpCode } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, VerifyDto } from './dto/auth.dto';
import { Public } from '../../common/decorators/public.decorator';
import { UserId, UserIp } from '../../common/decorators/user.decorator';
import { SecurityUtil } from '../../common/utils/security.util';

/**
 * 认证控制器 - 对应原 Java 项目的 LoginController
 * 路由前缀: /api/v1/login
 */
@Controller('login')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * 获取 RSA 公钥
   * GET /api/v1/login/public-key
   */
  @Public()
  @Get('public-key')
  async getPublicKey() {
    return SecurityUtil.getPublicKey();
  }

  /**
   * 验证群密码
   * POST /api/v1/login/verify
   */
  @Public()
  @Post('verify')
  @HttpCode(200)
  async verify(@Body() dto: VerifyDto) {
    return this.authService.verify(dto);
  }

  /**
   * 用户登录
   * POST /api/v1/login
   */
  @Public()
  @Post()
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @UserIp() ip: string) {
    return this.authService.login(dto, ip);
  }

  /**
   * 获取当前用户信息
   * GET /api/v1/login/current
   */
  @Get('current')
  async getCurrentUser(@UserId() userId: string, @UserIp() ip: string) {
    return this.authService.getCurrentUser(userId, ip);
  }

  /**
   * 退出登录
   * POST /api/v1/login/logout
   */
  @Post('logout')
  async logout(@UserId() userId: string) {
    return this.authService.logout(userId);
  }
}
