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
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { Auth } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/types/jwt.types';
import { AdminService } from './admin.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { createFileUploadInterceptor } from '../common/interceptors/file-upload.interceptor';
import {
  FileValidationPipe,
  type MulterFile,
} from '../common/pipes/file-validation.pipe';
import { Public } from '../auth/decorators/public.decorator';
import { UserService } from '../user/user.service';
import { AdminMailDto } from '../auth/dto/admin.mail.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly user: UserService,
  ) {}

  // get me admin controller
  @Get('get-me-admin')
  @Auth('admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get current admin profile' })
  getMeAdmin(@CurrentUser() user: JwtPayload) {
    return this.adminService.getMeAdmin(user);
  }

  // get all admin controller
  @Get('get-all-admins')
  @Auth('super_admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get all admins (super admin only)' })
  getAllAdmin(@Query() query: PaginationDto) {
    return this.adminService.getAllAdminsUsers(query);
  }

  //  create admin controller
  @Post('create-admin')
  @Auth('super_admin')
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a new admin (super admin only)' })
  createAdmin(@Body() dto: CreateAdminDto) {
    return this.adminService.createAdmin(dto);
  }

  // update admin controller
  @Put('update-admin')
  @Auth('admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Update admin profile with optional profile picture' })
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
  @ApiOperation({ summary: 'Get all users (admin only)' })
  getAllUsers(@Query() query: PaginationDto) {
    return this.adminService.getAllAdminsUsers(query, false);
  }

  // get user by id controller
  @Get('user/:id')
  @HttpCode(200)
  @Auth('admin')
  @ApiOperation({ summary: 'Get a user by ID' })
  @ApiParam({ name: 'id', description: 'User ID' })
  getUserById(@Param('id') id: string) {
    return this.user.getMe(id);
  }

  @Delete('delete-admin/:id')
  @Auth('super_admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete an admin by ID (super admin only)' })
  @ApiParam({ name: 'id', description: 'Admin ID' })
  deleteAdmin(@Param('id') id: string, @CurrentUser() admin: JwtPayload) {
    return this.adminService.deleteAdminOrUser(id, true, admin);
  }

  @Delete('delete-user/:id')
  @Auth('admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete a user by ID (admin only)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  deleteUser(@Param('id') id: string, @CurrentUser() admin: JwtPayload) {
    return this.adminService.deleteAdminOrUser(id, false, admin);
  }

  // get dashboard analytics
  @Get('dashboard-analytics')
  // @Auth('admin')
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: 'Get dashboard analytics (public)' })
  getDashboardAnalytics() {
    return this.adminService.getDashboardAnalytics();
  }

  // send admin mail
  @Post('admin-mail')
  @HttpCode(200)
  @Auth('admin')
  @ApiOperation({ summary: 'Send an email from admin to a user' })
  sendAdminMail(@Body() dto: AdminMailDto, @CurrentUser() admin: JwtPayload) {
    return this.adminService.sendAdminMail(dto, admin);
  }
}
