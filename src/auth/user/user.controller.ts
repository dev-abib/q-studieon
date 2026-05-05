import { Body, Controller, Headers, HttpCode, Ip, Post } from '@nestjs/common';
import { Public } from '../decorators/public.decorator';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { VerifyAccountDto } from '../dto/verify-account.dto';
import { ResendOtpDto } from '../dto/resend-otp';
import { Auth } from '../decorators/auth.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import type { JwtPayload } from '../types/jwt.types';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { UserService } from './user.service';

@Controller('auth/user')
export class UserController {
  constructor(private readonly authService: UserService) {}

  // Register controller
  @Post('register')
  @HttpCode(201)
  @Public()
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // login controller
  @Post('login')
  @HttpCode(200)
  @Public()
  login(@Body() dto: LoginDto) {
    return this.authService.loginAccount(dto);
  }

  // Verify account controller
  @Post('verify-account')
  @HttpCode(200)
  @Public()
  verifyAccount(@Body() dto: VerifyAccountDto) {
    return this.authService.verifyAccount(dto);
  }

  // Forgot password controller
  @Post('resend-otp')
  @HttpCode(200)
  @Public()
  resendOtp(@Body() dto: ResendOtpDto) {
    return this.authService.resendOtp(dto);
  }

  // Forgot password controller
  @Post('forgot-password')
  @HttpCode(200)
  @Public()
  forgotPassword(@Body() dto: ResendOtpDto) {
    return this.authService.forgotPassword(dto);
  }

  // Verify otp controller
  @Post('verify-otp')
  @HttpCode(200)
  @Public()
  verifyOtp(@Body() dto: VerifyAccountDto) {
    return this.authService.verifyOtp(dto);
  }

  // Reset password controller
  @Post('reset-password')
  @HttpCode(200)
  @Auth('reset')
  resetPassword(
    @Body() dto: ResetPasswordDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.authService.resetPassword(dto, user);
  }

  // Change password controller
  @Post('change-password')
  @HttpCode(200)
  @Auth('user')
  changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.authService.changePassword(dto, user);
  }

  // Guest login controller
  @Post('guest-login')
  @HttpCode(200)
  @Public()
  guestLogin(@Ip() ip: string, @Headers('x-device-id') deviceId: string) {
    return this.authService.guestLogin(ip, deviceId);
  }

  // Google login controller
  @Post('google-login')
  @HttpCode(200)
  @Public()
  googleLogin(@Body('token') token: string) {
    return this.authService.googleLogin(token);
  }

  // Apple login controller
  @Post('apple-login')
  @HttpCode(200)
  @Public()
  appleLogin(@Body('token') token: string) {
    return this.authService.appleLogin(token);
  }

  // log out controller
  @Post('log-out')
  @HttpCode(200)
  @Auth('user')
  logOut(@CurrentUser() user: JwtPayload) {
    return this.authService.logOut(user.id);
  }

  // refresh token controller
  @Post('refresh-token')
  @Public()
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto.refreshToken);
  }
}
