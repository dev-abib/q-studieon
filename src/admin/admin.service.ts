import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtPayload } from 'auth/types/jwt.types';
import { PaginationDto } from 'common/dto/pagination.dto';
import { UserRepository } from 'common/repositories/user.repository';
import { PrismaService } from 'prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateAdminDto } from './dto/create-admin.dto';
import { AuthHelper } from 'auth/helpers/auth.helper';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { MulterFile } from 'common/pipes/file-validation.pipe';
import { CloudinaryService } from 'common/services/cloudinary.service';
import { EmailService } from 'infra/mail/mail.service';
import { systemDeleteAccountTemplate } from 'infra/mail/templates/system/delete-account-syestem-confirmation.template';

@Injectable()
export class AdminService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly prisma: PrismaService,
    private readonly auth: AuthHelper,
    private readonly cloudinary: CloudinaryService,
    private readonly email: EmailService,
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

    const [directory, total, otpVerifiedCount, guestCount] = await Promise.all([
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
      this.prisma.user.count({ where: { ...where, isOtpVerified: true } }),
      this.prisma.user.count({ where: { ...where, isGuest: true } }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      message: ` ${isAdmin ? 'Admins ' : 'users'} list fetched successfully`,
      data: {
        directory,
        meta: {
          total,
          otpVerifiedCount,
          guestCount,
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
  async deleteAdminOrUser(
    id: string,
    isAdminDelete: boolean = true,
    session: JwtPayload,
  ) {
    const admin = await this.userRepo.findUser('id', id);

    if (isAdminDelete && session.role !== 'super_admin') {
      throw new UnauthorizedException(
        `You don't have sufficient access to remove a admin`,
      );
    }

    if (admin.profilePicturePublicId) {
      await this.cloudinary.deleteFile(admin.profilePicturePublicId);
    }

    await this.prisma.user.delete({
      where: { id: id },
    });

    if (!isAdminDelete && !admin.isGuest) {
      await this.email.sendEmail({
        to: admin.email as string,
        subject: `Account Suspension Notice — ${process.env.MAIL_FROM_NAME as string}`,
        html: systemDeleteAccountTemplate({
          name: admin.name as string,
          reason:
            'Repeated violation of our Terms of Service and Community Guidelines.',
          deletedBy: 'Site Administrator',
          supportEmail: `${process.env.MAIL_FROM}`,
        }),
      });
    }

    return {
      message: ` ${isAdminDelete ? 'Admin' : 'User'} deleted successfully`,
      data: {
        name: admin.name,
        email: admin.email,
      },
    };
  }
}
