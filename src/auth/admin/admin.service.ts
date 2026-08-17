import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminLoginDto } from '../dto/admin-login.dto';
import { AuthHelper } from '../helpers/auth.helper';
import { UserRepository } from '../../common/repositories/user.repository';
import { JwtPayload } from '../types/jwt.types';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { parseUserAgent } from '../../common/helpers/user-agent.helper';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthHelper,
    private readonly userRepo: UserRepository,
  ) {}

  // login admin service
  async loginAdmin(dto: AdminLoginDto, clientIp?: string, userAgent?: string) {
    const admin = await this.userRepo.findUser('email', dto.email);
    if (!admin) {
      throw new NotFoundException('Admin user does not exist');
    }

    if (admin.role !== 'admin' && admin.role !== 'super_admin') {
      throw new UnauthorizedException('Unauthorized access');
    }

    const isMatch = await this.auth.comparePassword(
      dto.password,
      admin.password as string,
    );
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: JwtPayload = {
      id: admin.id,
      email: admin.email as string,
      name: admin.name as string,
      role: admin.role,
      isGuest: admin.isGuest as boolean,
      isPaid: admin.isPaid as boolean,
      isOwner: admin.isOwner as boolean,
    };

    let accessToken: string = '';
    let refreshToken: string = '';

    if (admin.role === 'super_admin') {
      accessToken = this.auth.generateToken(payload, 'super_admin', 'access');
      refreshToken = this.auth.generateToken(payload, 'super_admin', 'refresh');
    } else if (admin.role === 'admin') {
      accessToken = this.auth.generateToken(payload, 'admin', 'access');
      refreshToken = this.auth.generateToken(payload, 'admin', 'refresh');
    }

    const rawIp = clientIp || '127.0.0.1';
    const cleanIp = rawIp.replace('::ffff:', '').trim();
    const { browser, os, device } = parseUserAgent(userAgent);

    await this.prisma.user.update({
      where: { id: admin.id },
      data: {
        refreshToken: this.auth.hashToken(refreshToken),
        lastLoginAt: new Date(),
        lastActiveIp: cleanIp,
        loginCount: { increment: 1 },
      },
    });

    try {
      await this.prisma.userSession.updateMany({
        where: { userId: admin.id, isCurrent: true },
        data: { isCurrent: false },
      });

      await this.prisma.userSession.create({
        data: {
          userId: admin.id,
          ipAddress: cleanIp,
          userAgent: userAgent || null,
          browser,
          os,
          device,
          loginAt: new Date(),
          lastActiveAt: new Date(),
          durationSeconds: 60,
          isCurrent: true,
        },
      });
    } catch {
      // Non-blocking
    }

    return {
      message: `${admin.role} logged in successfully`,
      data: {
        tokens: {
          accessToken,
          refreshToken,
        },
        admin: {
          name: admin.name,
          email: admin.email,
          picture: admin.profilePictureURL,
          role: admin.role,
        },
      },
    };
  }

  //  refresh token service
  async refreshToken(refreshToken: string) {
    let payload: JwtPayload;
    try {
      payload = this.auth.verifyToken(refreshToken, 'admin', 'refresh');
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const admin = await this.userRepo.findUser('id', payload.id);

    const hashedIncoming = this.auth.hashToken(refreshToken);
    if (!admin.refreshToken || admin.refreshToken !== hashedIncoming) {
      throw new UnauthorizedException('Refresh token revoked or mismatched');
    }

    const newPayload: JwtPayload = {
      id: admin.id,
      email: admin.email as string,
      name: admin.name as string,
      role: admin.role,
      isGuest: admin.isGuest as boolean,
      isPaid: admin.isPaid as boolean,
    };

    const newAccessToken = this.auth.generateToken(
      newPayload,
      'admin',
      'access',
    );
    const newRefreshToken = this.auth.generateToken(
      newPayload,
      'admin',
      'refresh',
    );

    await this.prisma.user.update({
      where: { id: admin.id },
      data: { refreshToken: this.auth.hashToken(newRefreshToken) },
    });

    return {
      message: 'Token refreshed successfully',
      data: {
        tokens: {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
        },
      },
    };
  }

  // log out service
  async logOut(id: string) {
    await this.userRepo.logOut(id);
    return {
      message: `Log out successfully`,
    };
  }

  // change password service
  async changePassword(dto: ChangePasswordDto, id: string) {
    const existingUser = await this.userRepo.findUser('id', id);

    if (existingUser.role === 'user') {
      throw new UnauthorizedException('Unauthorized access');
    }

    // Check permission: Only super_admin / isOwner OR accounts with canChangePassword: true can manually change password
    const isSuper = existingUser.role === 'super_admin' || existingUser.isOwner;
    if (!isSuper && !existingUser.canChangePassword) {
      throw new ForbiddenException(
        'Manual password changes are restricted. You must have permission from a Super Admin to change your password, or use the Forgot Password recovery link on the sign-in page.',
      );
    }

    if (!existingUser.password) {
      throw new BadRequestException('No password set for this account');
    }

    const isValidPass = await this.userRepo.comparePassword(
      dto.oldPassword,
      existingUser.password,
    );

    if (!isValidPass) {
      throw new BadRequestException('Old password is incorrect');
    }

    const hashPassword = await this.auth.hashPassword(dto.password);

    await this.prisma.user.update({
      where: { id: existingUser.id },
      data: {
        password: hashPassword,
      },
    });

    return {
      message: 'Password changed successfully.',
      data: null,
    };
  }
}
