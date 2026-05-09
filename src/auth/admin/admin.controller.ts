import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { Public } from '../decorators/public.decorator';
import { AdminLoginDto } from '../dto/admin-login.dto';
import { CookieHelper } from 'src/common/helpers/cookie.helper';
import type { Request, Response } from 'express';
import { Auth } from '../decorators/auth.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import type { JwtPayload } from '../types/jwt.types';

@Controller('auth/admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // login admin controller
  @Post('login')
  @Public()
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
  async logOut(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.adminService.logOut(user.id);

    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
  }
}
