import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AdminLoginDto } from '../dto/admin-login.dto';
import { AuthHelper } from '../helpers/auth.helper';
import { UserRepository } from 'src/common/repositories/user.repository';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthHelper,
    private readonly userRepo: UserRepository,
  ) {}

  async loginAdmin(dto: AdminLoginDto) {
    const admin = await this.userRepo.findUser('email', dto.email);

    console.log(admin);

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

    return {
      message: `${admin.role} logged in successfully`,
      data: {
        tokens: {
          accessToken,
          refreshToken,
        },
        user: {
          name: admin.name,
          email: admin.email,
          picture: admin.profilePictureURL,
          role: admin.role,
        },
      },
    };
  }
}
