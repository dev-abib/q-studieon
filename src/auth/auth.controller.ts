import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { AuthService } from './services/auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyAccountDto } from './dto/verify-account.dto';
import { ResendOtpDto } from './dto/resend-otp';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(201)
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.authService.loginAccount(dto);
  }

  @Post('verify-account')
  @HttpCode(200)
  VerifyOtp(@Body() dto: VerifyAccountDto) {
    return this.authService.verifyAccount(dto);
  }

  @Post('resend-otp')
  @HttpCode(200)
  ResendOtp(@Body() dto: ResendOtpDto) {
    return this.authService.resendOtp(dto);
  }
}
