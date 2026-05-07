import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtPayload } from 'src/auth/types/jwt.types';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { UserRepository } from 'src/common/repositories/user.repository';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateAdminDto } from './dto/create-admin.dto';
import { AuthHelper } from 'src/auth/helpers/auth.helper';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { MulterFile } from 'src/common/pipes/file-validation.pipe';
import { CloudinaryService } from 'src/common/services/cloudinary.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly prisma: PrismaService,
    private readonly auth: AuthHelper,
    private readonly cloudinary: CloudinaryService,
  ) {}

  // get me admin service
  async getMeAdmin(user: JwtPayload) {
    if (user.role === 'user') {
      throw new UnauthorizedException('Unauthorized access');
    }
    const admin = await this.userRepo.findUser('id', user.id);

    const {
      password: _password,
      otp: _otp,
      refreshToken: _refreshToken,
      resetToken: _resetToken,
      otpAttempts: _otpAttempts,
      otpExpires: _otpExpires,
      blockedUntil: _blockedUntil,
      guestIp: _guestIp,
      guestDeviceId: _guestDeviceId,
      profilePicturePublicId: _profilePicturePublicId,
      stripeCustomerId: _stripeCustomerId,
      stripeSubscriptionId: _stripeSubscriptionId,
      isResetRequest: _isResetRequest,
      ...safeAdmin
    } = admin;

    return {
      message: 'Data extracted successfully',
      data: safeAdmin,
    };
  }

  //  get all admin service
  async getAllAdminsUsers(query: PaginationDto, isAdmin: boolean = true) {
    const { page, limit, skip, sortBy, sortOrder, search } = query;

    const allowedSortFields = ['name', 'email', 'createdAt', 'updatedAt'];
    const safeSortBy = allowedSortFields.includes(sortBy)
      ? sortBy
      : 'createdAt';

    const where: Prisma.UserWhereInput = {
      role: isAdmin ? 'admin' : 'user',
      ...(search && {
        OR: [
          { name: { contains: search, mode: Prisma.QueryMode.insensitive } },
          { email: { contains: search, mode: Prisma.QueryMode.insensitive } },
        ],
      }),
    };

    const [directory, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { [safeSortBy]: sortOrder },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          profilePictureURL: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      message: ` ${isAdmin ? 'Admins ' : 'users'} list fetched successfully`,
      data: {
        directory,
        meta: {
          total,
          page,
          limit,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
    };
  }

  // create admin
  async createAdmin(dto: CreateAdminDto) {
    const isExist = await this.prisma.user.findUnique({
      where: {
        email: dto.email,
      },
    });

    if (isExist) {
      throw new ConflictException('Admin already exists');
    }

    const hashedPassword = await this.auth.hashPassword(dto.password);

    const admin = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: hashedPassword,
        role: 'admin',
        isOtpVerified: true,
        authProvider: 'local',
        termsAndConditions: true,
        isPaid: false,
        isGuest: false,
      },
    });

    return {
      message: `Admin created successfully`,
      data: {
        name: admin.name,
        email: admin.email,
        role: admin.role,
        picture: admin.profilePictureURL,
      },
    };
  }

  // update admin
  async updateAdmin(
    dto: UpdateAdminDto,
    profilePicture: MulterFile,
    user: JwtPayload,
  ) {
    const admin = await this.userRepo.findUser('id', user.id);
    let newProfilePictureURL: string | undefined;
    let newProfilePicturePublicId: string | undefined;

    if (profilePicture) {
      if (admin.profilePicturePublicId) {
        await this.cloudinary.deleteFile(admin.profilePicturePublicId);
      }

      const uploaded = await this.cloudinary.uploadFile(
        profilePicture,
        'profile-pictures',
      );
      newProfilePictureURL = uploaded.url;
      newProfilePicturePublicId = uploaded.publicId;
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        ...dto,
        ...(newProfilePictureURL && {
          profilePictureURL: newProfilePictureURL,
        }),
        ...(newProfilePicturePublicId && {
          profilePicturePublicId: newProfilePicturePublicId,
        }),
      },
    });

    return {
      message: `Admin data updated successfully`,
    };
  }

  // delete admin
  async deleteAdmin(id: string) {
    const admin = await this.userRepo.findUser('id', id);

    if (admin.profilePicturePublicId) {
      await this.cloudinary.deleteFile(admin.profilePicturePublicId);
    }

    await this.prisma.user.delete({
      where: { id: id },
    });

    return {
      message: `Admin deleted successfully`,
      data: {
        name: admin.name,
        email: admin.email,
      },
    };
  }
}
