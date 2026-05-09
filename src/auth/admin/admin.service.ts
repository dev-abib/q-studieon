import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AdminLoginDto } from '../dto/admin-login.dto';
import { AuthHelper } from '../helpers/auth.helper';
import { UserRepository } from 'src/common/repositories/user.repository';
import { JwtPayload } from '../types/jwt.types';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthHelper,
    private readonly userRepo: UserRepository,
  ) {}

  // login service
  async loginAdmin(dto: AdminLoginDto) {
    const admin = await this.userRepo.findUser('email', dto.email);

    if (admin?.role !== 'admin' && admin?.role !== 'super_admin') {
      throw new UnauthorizedException(
        'Only admin and super admin can login here',
      );
    }

    const isValidPass = await this.auth.comparePassword(
      dto.password,
      admin?.password as string,
    );

    if (!isValidPass) {
      throw new UnauthorizedException(
        'Invalid email or password , please try again later',
      );
    }

    const payload = {
      name: admin.name as string,
      email: admin.email as string,
      id: admin.id,
      isGuest: admin.isGuest as boolean,
      isPaid: admin.isPaid as boolean,
      role: admin.role,
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

    await this.prisma.user.update({
      where: { id: admin.id },
      data: { refreshToken: this.auth.hashToken(refreshToken) },
    });
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

  async logOut(id: string) {
    await this.userRepo.logOut(id);
  }
}
