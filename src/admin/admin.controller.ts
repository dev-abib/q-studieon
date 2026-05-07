import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import type { JwtPayload } from 'src/auth/types/jwt.types';
import { AdminService } from './admin.service';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { createFileUploadInterceptor } from 'src/common/interceptors/file-upload.interceptor';
import {
  FileValidationPipe,
  type MulterFile,
} from 'src/common/pipes/file-validation.pipe';

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

  // get all admin controller
  @Get('get-all-admins')
  @Auth('super_admin')
  @HttpCode(200)
  getAllAdmin(@Query() query: PaginationDto) {
    return this.adminService.getAllAdminsUsers(query);
  }

  //  create admin controller
  @Post('create-admin')
  @Auth('super_admin')
  @HttpCode(201)
  createAdmin(@Body() dto: CreateAdminDto) {
    return this.adminService.createAdmin(dto);
  }

  // update admin controller
  @Put('update-admin')
  @Auth('admin')
  @HttpCode(200)
  @UseInterceptors(createFileUploadInterceptor({ fieldName: 'profilePicture' }))
  updateAdmin(
    @Body() dto: UpdateAdminDto,
    @UploadedFile(new FileValidationPipe({ required: false, maxSizeMB: 5 }))
    profilePicture: MulterFile,
    @CurrentUser() user: JwtPayload,
  ) {
    const hasBodyField = Object.keys(dto).some(
      (key) => dto[key as keyof UpdateAdminDto] !== undefined,
    );

    if (!hasBodyField && !profilePicture) {
      throw new BadRequestException('At least one field must be provided');
    }
    return this.adminService.updateAdmin(dto, profilePicture, user);
  }

  // get all users controller
  @Get('get-all-users')
  @Auth('admin')
  @HttpCode(200)
  getAllUsers(@Query() query: PaginationDto) {
    return this.adminService.getAllAdminsUsers(query, false);
  }

  @Delete('delete-admin/:id')
  @Auth('super_admin')
  @HttpCode(200)
  deleteAdmin(@Param('id') id: string, @CurrentUser() admin: JwtPayload) {
    return this.adminService.deleteAdminOrUser(id, true, admin);
  }

  @Delete('delete-user/:id')
  @Auth('admin')
  @HttpCode(200)
  deleteUser(@Param('id') id: string, @CurrentUser() admin: JwtPayload) {
    return this.adminService.deleteAdminOrUser(id, false, admin);
  }
}
