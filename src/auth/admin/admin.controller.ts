import {
  Body,
  Controller,
  HttpCode,
  Post,
  Put,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { Public } from '../decorators/public.decorator';
import { AdminLoginDto } from '../dto/admin-login.dto';
import { CookieHelper } from '../../common/helpers/cookie.helper';
import type { Request, Response } from 'express';
import { Auth } from '../decorators/auth.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import type { JwtPayload } from '../types/jwt.types';
import { ChangePasswordDto } from '../dto/change-password.dto';

@ApiTags('Auth - Admin')
@Controller('auth/admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // login admin controller
  @Post('login')
  @Public()
  @ApiOperation({ summary: 'Admin login' })
  async loginAdmin(
    @Body() dto: AdminLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.adminService.loginAdmin(dto);

    CookieHelper.setAdminAuthCookies(
      res,
      result.data.tokens.accessToken,
      result.data.tokens.refreshToken,
    );

    return {
      message: result.message,
      data: result.data.admin,
    };
  }

  //  admin refresh token controller
  @Post('refresh-token')
  @Public()
  @ApiOperation({ summary: 'Refresh admin access token' })
  async refreshToken(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.refreshToken as string;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const result = await this.adminService.refreshToken(refreshToken);

    CookieHelper.setAdminAuthCookies(
      res,
      result.data.tokens.accessToken,
      result.data.tokens.refreshToken,
    );

    return {
      message: result.message,
      data: null,
    };
  }

  // log out controller
  @Post('log-out')
  @HttpCode(200)
  @Auth('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin logout' })
  async logOut(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.adminService.logOut(user.id);

    CookieHelper.clearAdminAuthCookies(res);

    return { message: 'Logged out successfully' };
  }

  // change password controller
  @Put('change-password')
  @HttpCode(200)
  @Auth('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change admin password' })
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.adminService.changePassword(dto, user.id);

    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    return { message: 'Password changed successfully' };
  }
}
