import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { AuthService } from './services/auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyAccountDto } from './dto/verify-account.dto';
import { ResendOtpDto } from './dto/resend-otp';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Auth } from './decorators/auth.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import type { JwtPayload } from './types/jwt.types';
import { Public } from './decorators/public.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(201)
  @Public()
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(200)
  @Public()
  login(@Body() dto: LoginDto) {
    return this.authService.loginAccount(dto);
  }

  @Post('verify-account')
  @HttpCode(200)
  @Public()
  verifyAccount(@Body() dto: VerifyAccountDto) {
    return this.authService.verifyAccount(dto);
  }

  @Post('forgot-password')
  @HttpCode(200)
  @Public()
  forgotPassword(@Body() dto: ResendOtpDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('verify-otp')
  @HttpCode(200)
  @Public()
  verifyOtp(@Body() dto: VerifyAccountDto) {
    return this.authService.verifyOtp(dto);
  }

  @Post('reset-password')
  @HttpCode(200)
  @Auth('reset')
  resetPassword(
    @Body() dto: ResetPasswordDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.authService.resetPassword(dto, user);
  }

  @Post('change-password')
  @HttpCode(200)
  @Auth('user')
  changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.authService.changePassword(dto, user);
  }
}
