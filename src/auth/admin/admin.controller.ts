import { Body, Controller, Get, Post } from '@nestjs/common';
import { AdminService } from './admin.service';
import { Public } from '../decorators/public.decorator';
import { AdminLoginDto } from '../dto/admin-login.dto';
import { Auth } from '../decorators/auth.decorator';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { CurrentUser } from '../decorators/current-user.decorator';
import type { JwtPayload } from '../types/jwt.types';

@Controller('auth/admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('login')
  @Public()
  loginAdmin(@Body() dto: AdminLoginDto) {
    return this.adminService.loginAdmin(dto);
  }

  @Post('refresh-token')
  @Public()
  refreshToken(@Body() dto: RefreshTokenDto) {
    return this.adminService.refreshToken(dto.refreshToken);
  }
}
