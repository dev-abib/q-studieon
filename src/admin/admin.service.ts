import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
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
import { randomBytes } from 'crypto';
import { InviteAdminDto } from './dto/invite-admin.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import {
  AdminForgotPasswordDto,
  AdminResetPasswordDto,
} from './dto/admin-password.dto';
import { inviteMemberTemplate } from '../infra/mail/templates/auth/invite-member.template';
import { adminResetPasswordTemplate } from '../infra/mail/templates/auth/admin-reset-password.template';
import { MulterFile } from '../common/pipes/file-validation.pipe';
import { CloudinaryService } from '../common/services/cloudinary.service';
import { EmailService } from '../infra/mail/mail.service';
import { systemDeleteAccountTemplate } from '../infra/mail/templates/system/delete-account-system-confirmation.template';
import Stripe from 'stripe';
import { AdminMailDto } from '../auth/dto/admin.mail.dto';
import { adminMessageTemplate } from '../infra/mail/templates/system/admin-message.template';

@Injectable()
export class AdminService {
  private readonly stripe: InstanceType<typeof Stripe>;
  constructor(
    private readonly userRepo: UserRepository,
    private readonly prisma: PrismaService,
    private readonly auth: AuthHelper,
    private readonly cloudinary: CloudinaryService,
    private readonly email: EmailService,
  ) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
      apiVersion: '2026-04-22.dahlia',
    });
  }

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
      role: isAdmin
        ? {
            in: [
              'admin',
              'super_admin',
              'customer_support',
              'content_manager',
              'finance',
            ],
          }
        : 'user',
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
        role: dto.role || 'admin',
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

    if (!admin) {
      throw new NotFoundException('User not found');
    }

    if (admin.isOwner) {
      throw new BadRequestException(
        'The primary Site Owner account cannot be deleted under any circumstances.',
      );
    }

    if (isAdminDelete && session.role !== 'super_admin') {
      throw new UnauthorizedException(
        `You don't have sufficient access to remove an admin`,
      );
    }

    const requester = await this.userRepo.findUser('id', session.id);
    if (
      isAdminDelete &&
      admin.role === 'super_admin' &&
      !requester?.isOwner
    ) {
      throw new UnauthorizedException(
        'Only the primary Site Owner can remove another Super Admin.',
      );
    }

    // cancel stripe subscription first
    if (admin.stripeSubscriptionId) {
      try {
        const subscription = await this.stripe.subscriptions.retrieve(
          admin.stripeSubscriptionId,
        );
        if (
          subscription.status !== 'canceled' &&
          subscription.status !== 'incomplete_expired'
        ) {
          await this.stripe.subscriptions.cancel(admin.stripeSubscriptionId);
        }
      } catch (error) {
        console.error('Stripe subscription cancel failed:', error);

        throw new BadRequestException('Failed to cancel Stripe subscription');
      }
    }

    // delete profile image
    if (admin.profilePicturePublicId) {
      try {
        await this.cloudinary.deleteFile(admin.profilePicturePublicId);
      } catch (error) {
        console.error('Cloudinary delete failed:', error);
      }
    }

    // transaction
    await this.prisma.$transaction(async (tx) => {
      await tx.user.delete({
        where: { id },
      });
    });

    // email after deletion
    if (!isAdminDelete && !admin.isGuest) {
      await this.email.sendEmail({
        to: admin.email as string,
        subject: `Account Suspension Notice — ${process.env.MAIL_FROM_NAME}`,
        html: systemDeleteAccountTemplate({
          name: admin.name as string,
          reason:
            'Repeated violation of our Terms of Service and Community Guidelines.',
          deletedBy: 'Site Administrator',
          supportEmail: process.env.MAIL_FROM as string,
        }),
      });
    }

    return {
      message: `${isAdminDelete ? 'Admin' : 'User'} deleted successfully`,
      data: {
        name: admin.name,
        email: admin.email,
      },
    };
  }

  async getDashboardAnalytics(user: JwtPayload) {
    const now = new Date();
    const isSuperAdmin =
      user.role === 'super_admin' || user.role === 'finance';
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

    // ── stat cards (keep as one Promise.all — only 14 queries, fine) ──────────
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
      userRoleDistribution,
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
      isSuperAdmin
        ? this.prisma.payment.aggregate({
            where: { status: 'succeeded', billingCycle: 'monthly' },
            _sum: { amount: true },
          })
        : Promise.resolve({ _sum: { amount: null as number | null } }),
      isSuperAdmin
        ? this.prisma.payment.aggregate({
            where: { status: 'succeeded', billingCycle: 'yearly' },
            _sum: { amount: true },
          })
        : Promise.resolve({ _sum: { amount: null as number | null } }),
      this.prisma.user.groupBy({
        by: ['userRole'],
        where: { userRole: { not: null } },
        _count: { _all: true },
      }),
    ]);

    // ── revenue chart — sequential, 1 query at a time (super admin only) ──────
    const revenueChart: { month: string; revenue: number }[] = [];
    if (isSuperAdmin) {
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

    // ── revenue breakdown chart — sequential (super admin only) ───────────────
    const revenueBreakdownChart: {
      month: string;
      monthly: number;
      yearly: number;
    }[] = [];
    if (isSuperAdmin) {
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

    // ── user role distribution (profile roles) ───────────────────────────────
    const totalRoleUsers = userRoleDistribution.reduce(
      (sum, item) => sum + item._count._all,
      0,
    );
    const userRoles = userRoleDistribution
      .map((item) => ({
        role: item.userRole ?? 'unassigned',
        count: item._count._all,
        percent:
          totalRoleUsers > 0
            ? Math.round((item._count._all / totalRoleUsers) * 100)
            : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // ── user role monthly trend — sequential, 1 query per month ──────────────
    const roleTrendByMonth: {
      month: string;
      counts: Record<string, number>;
    }[] = [];
    for (let i = 0; i < 6; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const start = new Date(date.getFullYear(), date.getMonth(), 1);
      const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
      const rows = await this.prisma.user.groupBy({
        by: ['userRole'],
        where: {
          userRole: { not: null },
          createdAt: { gte: start, lt: end },
        },
        _count: { _all: true },
      });
      const counts: Record<string, number> = {};
      for (const row of rows) {
        if (row.userRole) counts[row.userRole] = row._count._all;
      }
      roleTrendByMonth.push({
        month: date.toLocaleString('default', { month: 'short' }),
        counts,
      });
    }

    // all roles present in the window, ordered by total registrations
    const roleTotals: Record<string, number> = {};
    for (const month of roleTrendByMonth) {
      for (const [role, count] of Object.entries(month.counts)) {
        roleTotals[role] = (roleTotals[role] ?? 0) + count;
      }
    }
    const allTrendRoles = Object.keys(roleTotals).sort(
      (a, b) => (roleTotals[b] ?? 0) - (roleTotals[a] ?? 0),
    );

    type RoleTrendPoint = { month: string; [key: string]: string | number };

    const userRoleTrendChart: RoleTrendPoint[] = roleTrendByMonth.map(
      (month) => {
        const point: RoleTrendPoint = { month: month.month };
        for (const role of allTrendRoles) {
          point[role] = month.counts[role] ?? 0;
        }
        return point;
      },
    );

    // revenue is only exposed to super admins
    const charts: {
      reportsChart: { date: string; count: number }[];
      userStatsChart: { month: string; registered: number; guests: number }[];
      userRoleTrendChart?: RoleTrendPoint[];
      revenueChart?: { month: string; revenue: number }[];
      revenueBreakdownChart?: {
        month: string;
        monthly: number;
        yearly: number;
      }[];
    } = {
      reportsChart,
      userStatsChart,
      userRoleTrendChart,
    };

    if (isSuperAdmin) {
      charts.revenueChart = revenueChart;
      charts.revenueBreakdownChart = revenueBreakdownChart;
    }

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
        userRoles: {
          total: totalRoleUsers,
          distribution: userRoles,
        },
        ...(isSuperAdmin && {
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
        }),
        charts,
      },
    };
  }

  // send admin mail
  async sendAdminMail(dto: AdminMailDto, admin: JwtPayload) {
    const user = await this.userRepo.findUser('email', dto.email);

    await this.email.sendEmail({
      to: dto.email,
      subject: `[Admin Message] ${dto.subject}`,
      html: adminMessageTemplate({
        userName: user.name as string,
        adminName: admin.name,
        message: dto.message,
        subject: dto.subject,
      }),
    });

    return {
      message: `Successfully sent admin mail`,
    };
  }

  // Invite team member via email
  async inviteTeamMember(dto: InviteAdminDto, inviter: JwtPayload) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new BadRequestException(
        'A user with this email address already exists.',
      );
    }

    // Delete existing pending invitation if any
    await this.prisma.invitation.deleteMany({
      where: { email: dto.email },
    });

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await this.prisma.invitation.create({
      data: {
        email: dto.email,
        role: dto.role,
        token,
        invitedBy: inviter.email,
        expiresAt,
      },
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const inviteLink = `${frontendUrl}/auth/accept-invite?token=${token}`;

    await this.email.sendEmail({
      to: dto.email,
      subject: `You're invited to join Dwellr as ${dto.role.replace('_', ' ')}`,
      html: inviteMemberTemplate({
        email: dto.email,
        role: dto.role,
        inviteLink,
        invitedByName: inviter.name || 'Site Admin',
      }),
    });

    return {
      message: `Invitation email sent successfully to ${dto.email}`,
    };
  }

  // Verify invitation token
  async verifyInviteToken(token: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token },
    });

    if (!invitation || invitation.expiresAt < new Date()) {
      throw new BadRequestException(
        'Invitation token is invalid or has expired.',
      );
    }

    return {
      email: invitation.email,
      role: invitation.role,
    };
  }

  // Accept invitation & complete setup
  async acceptInvite(dto: AcceptInviteDto) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token: dto.token },
    });

    if (!invitation || invitation.expiresAt < new Date()) {
      throw new BadRequestException(
        'Invitation token is invalid or has expired.',
      );
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: invitation.email },
    });

    if (existingUser) {
      throw new BadRequestException(
        'An account with this email already exists.',
      );
    }

    const hashedPassword = await this.auth.hashPassword(dto.password);

    await this.prisma.user.create({
      data: {
        email: invitation.email,
        name: dto.name,
        password: hashedPassword,
        role: invitation.role,
        isOtpVerified: true,
        authProvider: 'local',
        termsAndConditions: true,
        isPaid: false,
        isGuest: false,
      },
    });

    // Remove consumed invitation
    await this.prisma.invitation.delete({
      where: { token: dto.token },
    });

    return {
      message: 'Account activated successfully. You can now log in.',
    };
  }

  // Admin forgot password
  async adminForgotPassword(dto: AdminForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || user.role === 'user') {
      throw new BadRequestException(
        'No admin account found with this email address.',
      );
    }

    const token = randomBytes(32).toString('hex');
    await this.prisma.user.update({
      where: { email: dto.email },
      data: { resetToken: token },
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetLink = `${frontendUrl}/auth/reset-password?token=${token}`;

    await this.email.sendEmail({
      to: dto.email,
      subject: `Reset Your Dwellr Admin Password`,
      html: adminResetPasswordTemplate({
        name: user.name || 'Admin',
        resetLink,
      }),
    });

    return {
      message: 'Password reset link has been sent to your email.',
    };
  }

  // Admin reset password
  async adminResetPassword(dto: AdminResetPasswordDto) {
    const user = await this.prisma.user.findFirst({
      where: { resetToken: dto.token },
    });

    if (!user || !dto.token) {
      throw new BadRequestException(
        'Password reset token is invalid or has expired.',
      );
    }

    const hashedPassword = await this.auth.hashPassword(dto.newPassword);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
      },
    });

    return {
      message: 'Password reset successfully. You can now log in.',
    };
  }
}
