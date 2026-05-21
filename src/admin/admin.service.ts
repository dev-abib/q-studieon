import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtPayload } from '../auth/types/jwt.types';
import { PaginationDto } from '../common/dto/pagination.dto';
import { UserRepository } from '../common/repositories/user.repository';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateAdminDto } from './dto/create-admin.dto';
import { AuthHelper } from '../auth/helpers/auth.helper';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { MulterFile } from '../common/pipes/file-validation.pipe';
import { CloudinaryService } from '../common/services/cloudinary.service';
import { EmailService } from '../infra/mail/mail.service';
import { systemDeleteAccountTemplate } from '../infra/mail/templates/system/delete-account-system-confirmation.template';

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

  async getDashboardAnalytics() {
    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const startOfYesterday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 1,
    );

    const calculateGrowth = (current: number, previous: number): number => {
      if (previous === 0) return current === 0 ? 0 : 100;
      return Math.round(((current - previous) / previous) * 100);
    };

    // ── stat cards (keep as one Promise.all — only 13 queries, fine) ──────────
    const [
      totalUsers,
      usersThisMonth,
      usersLastMonth,
      activeSubscriptions,
      subscriptionsThisMonth,
      subscriptionsLastMonth,
      guestUsers,
      reportsToday,
      reportsYesterday,
      monthlyPlanCount,
      yearlyPlanCount,
      monthlyRevenue,
      yearlyRevenue,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({
        where: { createdAt: { gte: startOfThisMonth } },
      }),
      this.prisma.user.count({
        where: { createdAt: { gte: startOfLastMonth, lt: startOfThisMonth } },
      }),
      this.prisma.user.count({
        where: { status: { in: ['active', 'trialing'] } },
      }),
      this.prisma.user.count({
        where: {
          status: { in: ['active', 'trialing'] },
          createdAt: { gte: startOfThisMonth },
        },
      }),
      this.prisma.user.count({
        where: {
          status: { in: ['active', 'trialing'] },
          createdAt: { gte: startOfLastMonth, lt: startOfThisMonth },
        },
      }),
      this.prisma.user.count({ where: { isGuest: true } }),
      this.prisma.report.count({ where: { createdAt: { gte: startOfToday } } }),
      this.prisma.report.count({
        where: { createdAt: { gte: startOfYesterday, lt: startOfToday } },
      }),
      this.prisma.user.count({
        where: {
          billingCycle: 'monthly',
          status: { in: ['active', 'trialing'] },
        },
      }),
      this.prisma.user.count({
        where: {
          billingCycle: 'yearly',
          status: { in: ['active', 'trialing'] },
        },
      }),
      this.prisma.payment.aggregate({
        where: { status: 'succeeded', billingCycle: 'monthly' },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: { status: 'succeeded', billingCycle: 'yearly' },
        _sum: { amount: true },
      }),
    ]);

    // ── revenue chart — sequential, 1 query at a time ────────────────────────
    const revenueChart: { month: string; revenue: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const start = new Date(date.getFullYear(), date.getMonth(), 1);
      const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
      const result = await this.prisma.payment.aggregate({
        where: { status: 'succeeded', createdAt: { gte: start, lt: end } },
        _sum: { amount: true },
      });
      revenueChart.push({
        month: date.toLocaleString('default', { month: 'short' }),
        revenue: Math.round((result._sum.amount ?? 0) / 100),
      });
    }

    // ── reports chart — sequential, 1 query at a time ─────────────────────────
    const reportsChart: { date: string; count: number }[] = [];
    for (let i = 0; i < 14; i++) {
      const date = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - (13 - i),
      );
      const start = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
      );
      const end = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate() + 1,
      );
      const count = await this.prisma.report.count({
        where: { createdAt: { gte: start, lt: end } },
      });
      reportsChart.push({
        date: date.toLocaleDateString('default', {
          month: 'short',
          day: 'numeric',
        }),
        count,
      });
    }

    // ── user stats chart — sequential, 2 queries per iteration ───────────────
    const userStatsChart: {
      month: string;
      registered: number;
      guests: number;
    }[] = [];
    for (let i = 0; i < 6; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const start = new Date(date.getFullYear(), date.getMonth(), 1);
      const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
      const [registered, guests] = await Promise.all([
        this.prisma.user.count({
          where: { isGuest: false, createdAt: { gte: start, lt: end } },
        }),
        this.prisma.user.count({
          where: { isGuest: true, createdAt: { gte: start, lt: end } },
        }),
      ]);
      userStatsChart.push({
        month: date.toLocaleString('default', { month: 'short' }),
        registered,
        guests,
      });
    }

    // ── revenue breakdown chart — sequential, 2 queries per iteration ─────────
    const revenueBreakdownChart: {
      month: string;
      monthly: number;
      yearly: number;
    }[] = [];
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      const start = new Date(date.getFullYear(), date.getMonth(), 1);
      const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
      const [monthly, yearly] = await Promise.all([
        this.prisma.payment.aggregate({
          where: {
            status: 'succeeded',
            billingCycle: 'monthly',
            createdAt: { gte: start, lt: end },
          },
          _sum: { amount: true },
        }),
        this.prisma.payment.aggregate({
          where: {
            status: 'succeeded',
            billingCycle: 'yearly',
            createdAt: { gte: start, lt: end },
          },
          _sum: { amount: true },
        }),
      ]);
      revenueBreakdownChart.push({
        month: date.toLocaleString('default', { month: 'short' }),
        monthly: Math.round((monthly._sum.amount ?? 0) / 100),
        yearly: Math.round((yearly._sum.amount ?? 0) / 100),
      });
    }

    // ── totals & growth ───────────────────────────────────────────────────────
    const userGrowth = calculateGrowth(usersThisMonth, usersLastMonth);
    const subscriptionGrowth = calculateGrowth(
      subscriptionsThisMonth,
      subscriptionsLastMonth,
    );
    const reportGrowth = calculateGrowth(reportsToday, reportsYesterday);
    const totalMonthlyRevenue = Math.round(
      (monthlyRevenue._sum.amount ?? 0) / 100,
    );
    const totalYearlyRevenue = Math.round(
      (yearlyRevenue._sum.amount ?? 0) / 100,
    );
    const totalRevenue = totalMonthlyRevenue + totalYearlyRevenue;
    const totalPaidUsers = monthlyPlanCount + yearlyPlanCount;

    return {
      success: true,
      message: 'Dashboard analytics fetched successfully',
      data: {
        cards: {
          totalUsers: { count: totalUsers, growth: userGrowth },
          activeSubscriptions: {
            count: activeSubscriptions,
            growth: subscriptionGrowth,
          },
          guestUsers: {
            count: guestUsers,
            percentOfTotal:
              totalUsers > 0 ? Math.round((guestUsers / totalUsers) * 100) : 0,
          },
          reportsToday: { count: reportsToday, growth: reportGrowth },
        },
        subscriptionPlans: {
          monthly: {
            count: monthlyPlanCount,
            percent:
              totalPaidUsers > 0
                ? Math.round((monthlyPlanCount / totalPaidUsers) * 100)
                : 0,
          },
          yearly: {
            count: yearlyPlanCount,
            percent:
              totalPaidUsers > 0
                ? Math.round((yearlyPlanCount / totalPaidUsers) * 100)
                : 0,
          },
        },
        revenueBreakdown: {
          totalRevenue,
          monthlyBilling: totalMonthlyRevenue,
          yearlyBilling: totalYearlyRevenue,
          monthlyPercent:
            totalRevenue > 0
              ? Math.round((totalMonthlyRevenue / totalRevenue) * 100)
              : 0,
          yearlyPercent:
            totalRevenue > 0
              ? Math.round((totalYearlyRevenue / totalRevenue) * 100)
              : 0,
        },
        charts: {
          revenueChart,
          reportsChart,
          userStatsChart,
          revenueBreakdownChart,
        },
      },
    };
  }
}
