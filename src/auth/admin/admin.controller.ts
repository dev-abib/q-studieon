import { Body, Controller, Post } from '@nestjs/common';
import { AdminService } from './admin.service';
import { Public } from '../decorators/public.decorator';
import { AdminLoginDto } from '../dto/admin-login.dto';

@Controller('auth/admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('login')
  @Public()
  loginAdmin(@Body() dto: AdminLoginDto) {
    return this.adminService.loginAdmin(dto);
  }
}
