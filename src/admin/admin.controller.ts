import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import type { JwtPayload } from 'src/auth/types/jwt.types';
import { AdminService } from './admin.service';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { CreateAdminDto } from './dto/create-admin.dto';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // get me admin controller
  @Get('get-me-admin')
  @Auth('admin')
  @HttpCode(200)
  getMeAdmin(@CurrentUser() user: JwtPayload) {
    return this.adminService.getMeAdmin(user);
  }

  @Get('get-all-admin')
  @Auth('super_admin')
  @HttpCode(200)
  getAllAdmin(@Query() query: PaginationDto) {
    return this.adminService.getAllAdmins(query);
  }

  @Post('create-admin')
  @Auth('super_admin')
  @HttpCode(201)
  createAdmin(@Body() dto: CreateAdminDto) {
    return this.adminService.createAdmin(dto);
  }
}
