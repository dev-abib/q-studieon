import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../infra/mail/mail.service';
import { UserRepository } from '../common/repositories/user.repository';
import { CloudinaryService } from '../common/services/cloudinary.service';
import { MulterFile } from '../common/pipes/file-validation.pipe';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { deleteAccountConfirmationTemplate } from '../infra/mail/templates/user/delete-account-self-confirmation.template';
import type { JwtPayload } from '../auth/types/jwt.types';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly userRepo: UserRepository,
    private readonly cloudinary: CloudinaryService,
  ) {}

  // ─── Permission Check: View User Details ──────────────────────────────────
  async checkCanViewUserDetails(currentAdmin?: JwtPayload) {
    if (!currentAdmin) return;
    if (currentAdmin.role === 'super_admin' || currentAdmin.isOwner) {
      return;
    }

    const adminUser = await this.prisma.user.findUnique({
      where: { id: currentAdmin.id },
      select: { role: true, isOwner: true, canViewUserDetails: true },
    });

    if (
      !adminUser ||
      (!adminUser.isOwner &&
        adminUser.role !== 'super_admin' &&
        !adminUser.canViewUserDetails)
    ) {
      throw new ForbiddenException(
        'Permission Denied: Only Super Admins and authorized staff with explicit view privileges can access user details.',
      );
    }
  }

  // get me service
  async getMe(id: string, currentAdmin?: JwtPayload) {
    if (currentAdmin) {
      await this.checkCanViewUserDetails(currentAdmin);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: id },
      include: {
        _count: {
          select: {
            collections: true,
            reports: true,
            payments: true,
            contactQueries: true,
            sessions: true,
          },
        },
        reports: {
          orderBy: { createdAt: 'desc' },
          take: 100,
        },
        sessions: {
          orderBy: { loginAt: 'desc' },
          take: 50,
        },
        collections: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: {
            reports: {
              include: {
                report: {
                  select: {
                    id: true,
                    type: true,
                    status: true,
                    address: true,
                    overallScore: true,
                    auspiciousnessLevel: true,
                    createdAt: true,
                  },
                },
              },
            },
          },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        contactQueries: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        flags: {
          include: {
            flaggedBy: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!user)
      throw new NotFoundException(
        ' User not found, account removed or deleted,',
      );

    // Merge contact queries by userId or matching email so all inquiries show
    let allQueries = user.contactQueries || [];
    if (user.email) {
      const emailQueries = await this.prisma.contactQuery.findMany({
        where: {
          OR: [
            { userId: user.id },
            { email: { equals: user.email, mode: 'insensitive' } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      const qMap = new Map<string, any>();
      allQueries.forEach((q: any) => qMap.set(q.id, q));
      emailQueries.forEach((q: any) => qMap.set(q.id, q));
      allQueries = Array.from(qMap.values());
    }

    // Compute Engagement & Report Generation Velocity Metrics
    const reports = user.reports || [];
    const sessions = user.sessions || [];
    const totalReports = reports.length;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const reportsLast30Days = reports.filter(
      (r) => new Date(r.createdAt) >= thirtyDaysAgo,
    ).length;
    const reportsLast7Days = reports.filter(
      (r) => new Date(r.createdAt) >= sevenDaysAgo,
    ).length;

    let daysSinceLastReport: number | null = null;
    let avgReportIntervalDays: number | null = null;

    if (reports.length > 0) {
      const latestReportDate = new Date(reports[0].createdAt);
      daysSinceLastReport = Math.max(
        0,
        Math.floor(
          (now.getTime() - latestReportDate.getTime()) / (1000 * 60 * 60 * 24),
        ),
      );

      if (reports.length > 1) {
        const oldestReportDate = new Date(
          reports[reports.length - 1].createdAt,
        );
        const spanDays = Math.max(
          1,
          Math.floor(
            (latestReportDate.getTime() - oldestReportDate.getTime()) /
              (1000 * 60 * 60 * 24),
          ),
        );
        avgReportIntervalDays =
          Math.round((spanDays / (reports.length - 1)) * 10) / 10;
      }
    }

    // Favorite Report Type
    const typeCounts: Record<string, number> = {};
    reports.forEach((r) => {
      if (r.type) typeCounts[r.type] = (typeCounts[r.type] || 0) + 1;
    });
    let favoriteReportType: string | null = null;
    let maxCount = 0;
    for (const [type, count] of Object.entries(typeCounts)) {
      if (count > maxCount) {
        maxCount = count;
        favoriteReportType = type;
      }
    }

    // Engagement Tier Classification
    let engagementTier:
      | 'power_user'
      | 'active_regular'
      | 'occasional'
      | 'explorer'
      | 'dormant' = 'explorer';
    let tierLabel = 'Explorer / Prospect';

    const lastLogin = user.lastLoginAt
      ? new Date(user.lastLoginAt)
      : new Date(user.createdAt);
    const isDormant =
      now.getTime() - lastLogin.getTime() > 30 * 24 * 60 * 60 * 1000 &&
      totalReports === 0;

    if (totalReports >= 10 || reportsLast30Days >= 5) {
      engagementTier = 'power_user';
      tierLabel = 'Power Generator';
    } else if (totalReports >= 3 || (totalReports > 0 && reportsLast7Days > 0)) {
      engagementTier = 'active_regular';
      tierLabel = 'Active Regular';
    } else if (totalReports >= 1) {
      engagementTier = 'occasional';
      tierLabel = 'Occasional Generator';
    } else if (isDormant) {
      engagementTier = 'dormant';
      tierLabel = 'Dormant Account';
    } else {
      engagementTier = 'explorer';
      tierLabel = 'Explorer / Prospect';
    }

    // Unique IP addresses collection
    const uniqueIps = new Set<string>();
    if (user.lastActiveIp) uniqueIps.add(user.lastActiveIp);
    if (user.guestIp) uniqueIps.add(user.guestIp);
    sessions.forEach((s) => {
      if (s.ipAddress) uniqueIps.add(s.ipAddress);
    });

    const engagement = {
      tier: engagementTier,
      tierLabel,
      totalReports,
      reportsLast30Days,
      reportsLast7Days,
      daysSinceLastReport,
      avgReportIntervalDays,
      favoriteReportType,
      uniqueIpCount: uniqueIps.size,
      uniqueIps: Array.from(uniqueIps),
      totalLogins:
        user.loginCount || sessions.length || (user.lastLoginAt ? 1 : 0),
      totalSessionMinutes: user.totalSessionMinutes || 0,
      lastLoginAt: user.lastLoginAt,
      lastActiveIp: user.lastActiveIp,
    };

    const {
      password: _password,
      otp: _otp,
      otpAttempts: _otpAttempts,
      otpExpires: _otpExpires,
      refreshToken: _refreshToken,
      resetToken: _resetToken,
      ...safeUser
    } = user;

    return {
      message: 'User profile fetched successfully',
      data: {
        ...safeUser,
        contactQueries: allQueries,
        sessions,
        engagement,
        _count: {
          ...user._count,
          contactQueries: allQueries.length,
          sessions: sessions.length,
        },
      },
    };
  }

  // update user service
  async updateUser(dto: UpdateUserDto, id: string, profilePicture: MulterFile) {
    const user = await this.userRepo.findUser('id', id);

    let newProfilePictureURL: string | undefined;
    let newProfilePicturePublicId: string | undefined;

    if (profilePicture) {
      if (user.profilePicturePublicId) {
        await this.cloudinary.deleteFile(user.profilePicturePublicId);
      }

      const uploaded = await this.cloudinary.uploadFile(
        profilePicture,
        'profile-pictures',
      );
      newProfilePictureURL = uploaded.url;
      newProfilePicturePublicId = uploaded.publicId;
    }

    const updated = await this.prisma.user.update({
      where: { id },
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

    const {
      password: _password,
      otp: _otp,
      otpAttempts: _otpAttempts,
      otpExpires: _otpExpires,
      refreshToken: _refreshToken,
      resetToken: _resetToken,
      profilePicturePublicId: _profilePicturePublicId,
      ...safeUser
    } = updated;

    return {
      message: 'Profile updated successfully',
      data: safeUser,
    };
  }

  // delete user service
  async deleteUser(dto: DeleteAccountDto, id: string) {
    const user = await this.userRepo.findUser('id', id);

    const isValidPass = await this.userRepo.comparePassword(
      dto.password,
      user.password as string,
    );

    if (!isValidPass) {
      throw new UnauthorizedException(
        'Invalid password , please try again later',
      );
    }

    if (user.profilePicturePublicId) {
      await this.cloudinary.deleteFile(user.profilePicturePublicId);
    }

    await this.prisma.user.delete({
      where: { id: id },
    });

    await this.email.sendEmail({
      to: user.email as string,
      subject: `Self account delete confirmation - ${process.env.MAIL_FROM_NAME as string}`,
      html: deleteAccountConfirmationTemplate({
        name: user.name as string,
      }),
    });

    return {
      message: 'Account deleted successfully',
    };
  }
}
