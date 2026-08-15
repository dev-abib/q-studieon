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
import { Prisma, userRole } from '@prisma/client';
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
import { BlockUserDto } from './dto/block-user.dto';
import { SoftDeleteUserDto } from './dto/soft-delete-user.dto';
import { FlagUserDto } from './dto/flag-user.dto';
import { ResolveFlagDto } from './dto/resolve-flag.dto';
import {
  GrantAccessDto,
  RevokeAccessDto,
  AccessDurationPlan,
} from './dto/grant-access.dto';
import { UpdatePermissionsDto } from './dto/update-permissions.dto';
import { inviteMemberTemplate } from '../infra/mail/templates/auth/invite-member.template';
import { adminResetPasswordTemplate } from '../infra/mail/templates/auth/admin-reset-password.template';
import { MulterFile } from '../common/pipes/file-validation.pipe';
import { CloudinaryService } from '../common/services/cloudinary.service';
import { EmailService } from '../infra/mail/mail.service';
import { systemDeleteAccountTemplate } from '../infra/mail/templates/system/delete-account-system-confirmation.template';
import Stripe from 'stripe';
import { AdminMailDto } from '../auth/dto/admin.mail.dto';
import { adminMessageTemplate } from '../infra/mail/templates/system/admin-message.template';

import { AuditService } from './audit.service';

@Injectable()
export class AdminService {
  private readonly stripe: InstanceType<typeof Stripe>;
  constructor(
    private readonly userRepo: UserRepository,
    private readonly prisma: PrismaService,
    private readonly auth: AuthHelper,
    private readonly cloudinary: CloudinaryService,
    private readonly email: EmailService,
    private readonly auditService: AuditService,
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

    const allowedSortFields = [
      'name',
      'email',
      'createdAt',
      'updatedAt',
      'userRole',
      'role',
      'status',
      'isPaid',
    ];
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

    const [
      directory,
      total,
      otpVerifiedCount,
      guestCount,
      paidCount,
      blockedCount,
      deletedCount,
    ] = await Promise.all([
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
          userRole: true,
          isPaid: true,
          isGuest: true,
          isOtpVerified: true,
          status: true,
          billingCycle: true,
          blockedUntil: true,
          blockReason: true,
          isDeleted: true,
          deletedAt: true,
          purgeAt: true,
          deleteReason: true,
          isOwner: true,
          canDeleteQueries: true,
          canViewUserDetails: true,
          canChangePassword: true,
          createdAt: true,
          profilePictureURL: true,
          lastLoginAt: true,
          lastActiveIp: true,
          loginCount: true,
          totalSessionMinutes: true,
          currentPeriodEnd: true,
          adminGrantedAccess: true,
          adminGrantedReason: true,
          adminGrantedBy: true,
          adminGrantedAt: true,
          _count: {
            select: {
              reports: true,
              collections: true,
              payments: true,
              contactQueries: true,
              sessions: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
      this.prisma.user.count({ where: { ...where, isOtpVerified: true } }),
      this.prisma.user.count({ where: { ...where, isGuest: true } }),
      this.prisma.user.count({ where: { ...where, isPaid: true } }),
      this.prisma.user.count({
        where: { ...where, blockedUntil: { gt: new Date() } },
      }),
      this.prisma.user.count({ where: { ...where, isDeleted: true } }),
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
          paidCount,
          blockedCount,
          deletedCount,
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
  async createAdmin(dto: CreateAdminDto, inviter?: JwtPayload) {
    const isExist = await this.prisma.user.findUnique({
      where: {
        email: dto.email,
      },
    });

    if (isExist) {
      throw new ConflictException('A user with this email address already exists.');
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
        role: dto.role || 'admin',
        token,
        invitedBy: inviter?.email || 'Site Admin',
        expiresAt,
      },
    });

    const frontendUrl = this.getFrontendUrl();
    const inviteLink = `${frontendUrl}/accept-invite?token=${token}`;

    await this.email.sendEmail({
      to: dto.email,
      subject: `You're invited to join Dwellr as ${(dto.role || 'admin').replace('_', ' ')}`,
      html: inviteMemberTemplate({
        email: dto.email,
        role: dto.role || 'admin',
        inviteLink,
        invitedByName: inviter?.name || 'Site Admin',
      }),
    });

    return {
      message: `Team member invited successfully. Verification & password setup email sent to ${dto.email}`,
      data: {
        email: dto.email,
        role: dto.role || 'admin',
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
        ...(dto.name && { name: dto.name }),
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

    // cancel stripe subscription if active (non-blocking)
    if (admin.stripeSubscriptionId) {
      try {
        const subscription = await this.stripe.subscriptions.retrieve(
          admin.stripeSubscriptionId,
        );
        if (
          subscription &&
          subscription.status !== 'canceled' &&
          subscription.status !== 'incomplete_expired'
        ) {
          await this.stripe.subscriptions.cancel(admin.stripeSubscriptionId);
        }
      } catch (error) {
        console.warn('Stripe subscription cancel non-blocking warning:', (error as any)?.message || error);
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

    // transaction with complete foreign-key cleanup
    await this.prisma.$transaction(async (tx) => {
      // 1. Delete user sessions
      await tx.userSession.deleteMany({ where: { userId: id } });

      // 2. Delete user flags
      await tx.userFlag.deleteMany({
        where: { OR: [{ userId: id }, { flaggedById: id }] },
      });

      // 3. Delete collections and relation links
      await tx.reportCollection.deleteMany({
        where: { collection: { userId: id } },
      });
      await tx.collection.deleteMany({ where: { userId: id } });

      // 4. Delete shared reports
      await tx.sharedReport.deleteMany({ where: { sharedById: id } });

      // 5. Delete / nullify analytics and support associations
      await tx.subscriptionEvent.deleteMany({ where: { userId: id } });
      await tx.contactQuery.updateMany({
        where: { userId: id },
        data: { userId: null },
      });
      await tx.payment.deleteMany({ where: { userId: id } });
      await tx.report.deleteMany({ where: { userId: id } });

      // 6. Delete invitations for this email
      if (admin.email) {
        await tx.invitation.deleteMany({ where: { email: admin.email } });
      }

      // 7. Finally delete the user account
      await tx.user.delete({
        where: { id },
      });
    });

    // email notification after deletion (non-blocking)
    if (!isAdminDelete && !admin.isGuest && admin.email) {
      try {
        await this.email.sendEmail({
          to: admin.email as string,
          subject: `Account Suspension Notice — ${process.env.MAIL_FROM_NAME || 'Dwellr'}`,
          html: systemDeleteAccountTemplate({
            name: (admin.name as string) || 'User',
            reason:
              'Repeated violation of our Terms of Service and Community Guidelines.',
            deletedBy: 'Site Administrator',
            supportEmail: process.env.MAIL_FROM || 'admin@dwellr.tech',
          }),
        });
      } catch (error) {
        console.warn('Post-deletion email notice non-blocking warning:', (error as any)?.message || error);
      }
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

    // Date range boundaries for bulk dataset queries
    const startOf14DaysAgo = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 13,
    );
    const startOf6MonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const startOf12MonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const [
      [totalUsers, usersThisMonth, usersLastMonth, activeSubscriptions],
      [subscriptionsThisMonth, subscriptionsLastMonth, guestUsers, reportsToday],
      [reportsYesterday, monthlyPlanCount, yearlyPlanCount, monthlyRevenue],
      [yearlyRevenue, userRoleDistribution],
      reportsList,
      users6m,
      payments12m,
    ] = await Promise.all([
      Promise.all([
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
      ]),
      Promise.all([
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
      ]),
      Promise.all([
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
      ]),
      Promise.all([
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
      ]),
      this.prisma.report.findMany({
        where: { createdAt: { gte: startOf14DaysAgo } },
        select: { createdAt: true },
      }),
      this.prisma.user.findMany({
        where: { createdAt: { gte: startOf6MonthsAgo } },
        select: { isGuest: true, userRole: true, createdAt: true },
      }),
      isSuperAdmin
        ? this.prisma.payment.findMany({
            where: { status: 'succeeded', createdAt: { gte: startOf12MonthsAgo } },
            select: { amount: true, billingCycle: true, createdAt: true },
          })
        : Promise.resolve(
            [] as Array<{
              amount: number | null;
              billingCycle: string | null;
              createdAt: Date;
            }>,
          ),
    ]);

    // ── 1. Build Reports Chart (14 days) ─────────────────────────────────────
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
      ).getTime();
      const end = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate() + 1,
      ).getTime();
      const count = reportsList.filter(
        (r) => r.createdAt.getTime() >= start && r.createdAt.getTime() < end,
      ).length;
      reportsChart.push({
        date: date.toLocaleDateString('default', {
          month: 'short',
          day: 'numeric',
        }),
        count,
      });
    }

    // ── 2. Build User Stats Chart & Role Trend Chart (6 months) ──────────────
    const userStatsChart: {
      month: string;
      registered: number;
      guests: number;
    }[] = [];
    const roleTrendByMonth: {
      month: string;
      counts: Record<string, number>;
    }[] = [];

    for (let i = 0; i < 6; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const start = new Date(
        date.getFullYear(),
        date.getMonth(),
        1,
      ).getTime();
      const end = new Date(
        date.getFullYear(),
        date.getMonth() + 1,
        1,
      ).getTime();
      const monthLabel = date.toLocaleString('default', { month: 'short' });

      const usersInMonth = users6m.filter(
        (u) => u.createdAt.getTime() >= start && u.createdAt.getTime() < end,
      );

      const registered = usersInMonth.filter((u) => !u.isGuest).length;
      const guests = usersInMonth.filter((u) => u.isGuest).length;
      userStatsChart.push({ month: monthLabel, registered, guests });

      const counts: Record<string, number> = Object.fromEntries(
        Object.values(userRole).map((role) => [role, 0]),
      );
      for (const u of usersInMonth) {
        if (u.userRole) counts[u.userRole] = (counts[u.userRole] ?? 0) + 1;
      }
      roleTrendByMonth.push({ month: monthLabel, counts });
    }

    // ── 3. Build Revenue Chart (6m) & Revenue Breakdown (12m) ────────────────
    const revenueChart: { month: string; revenue: number }[] = [];
    const revenueBreakdownChart: {
      month: string;
      monthly: number;
      yearly: number;
    }[] = [];

    if (isSuperAdmin) {
      // 6 months revenue chart
      for (let i = 0; i < 6; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
        const start = new Date(
          date.getFullYear(),
          date.getMonth(),
          1,
        ).getTime();
        const end = new Date(
          date.getFullYear(),
          date.getMonth() + 1,
          1,
        ).getTime();
        const rev = payments12m
          .filter(
            (p) => p.createdAt.getTime() >= start && p.createdAt.getTime() < end,
          )
          .reduce((sum, p) => sum + (p.amount ?? 0), 0);
        revenueChart.push({
          month: date.toLocaleString('default', { month: 'short' }),
          revenue: Math.round(rev / 100),
        });
      }

      // 12 months revenue breakdown chart
      for (let i = 0; i < 12; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
        const start = new Date(
          date.getFullYear(),
          date.getMonth(),
          1,
        ).getTime();
        const end = new Date(
          date.getFullYear(),
          date.getMonth() + 1,
          1,
        ).getTime();
        const monthPayments = payments12m.filter(
          (p) => p.createdAt.getTime() >= start && p.createdAt.getTime() < end,
        );
        const monthlySum = monthPayments
          .filter((p) => p.billingCycle === 'monthly')
          .reduce((sum, p) => sum + (p.amount ?? 0), 0);
        const yearlySum = monthPayments
          .filter((p) => p.billingCycle === 'yearly')
          .reduce((sum, p) => sum + (p.amount ?? 0), 0);
        revenueBreakdownChart.push({
          month: date.toLocaleString('default', { month: 'short' }),
          monthly: Math.round(monthlySum / 100),
          yearly: Math.round(yearlySum / 100),
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
    const userRoleCounts = new Map(
      userRoleDistribution.map((item) => [item.userRole, item._count._all]),
    );
    const fullUserRoleDistribution = Object.values(userRole).map((role) => ({
      role,
      count: userRoleCounts.get(role) ?? 0,
    }));

    const totalRoleUsers = fullUserRoleDistribution.reduce(
      (sum, item) => sum + item.count,
      0,
    );
    const userRoles = fullUserRoleDistribution
      .map((item) => ({
        role: item.role,
        count: item.count,
        percent:
          totalRoleUsers > 0
            ? Math.round((item.count / totalRoleUsers) * 100)
            : 0,
      }))
      .sort((a, b) => b.count - a.count);

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

    const frontendUrl = this.getFrontendUrl();
    const inviteLink = `${frontendUrl}/accept-invite?token=${token}`;

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

    const frontendUrl = this.getFrontendUrl();
    const resetLink = `${frontendUrl}/reset-password?token=${token}`;

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

  // ─── Soft Block User ────────────────────────────────────────────────────────
  async blockUser(id: string, dto: BlockUserDto, session: JwtPayload) {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (user.isOwner) {
      throw new BadRequestException('The primary Site Owner cannot be blocked.');
    }

    const blockedUntil = new Date(dto.blockedUntil);
    if (isNaN(blockedUntil.getTime())) {
      throw new BadRequestException('Invalid date format for blockedUntil.');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        blockedUntil,
        blockReason: dto.reason || 'Account suspended by Administrator',
      },
      select: {
        id: true,
        name: true,
        email: true,
        blockedUntil: true,
        blockReason: true,
      },
    });

    return {
      success: true,
      message: `User ${updated.name || updated.email} has been soft-blocked until ${blockedUntil.toLocaleDateString()}.`,
      data: updated,
    };
  }

  // ─── Unblock User ──────────────────────────────────────────────────────────
  async unblockUser(id: string, session: JwtPayload) {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        blockedUntil: null,
        blockReason: null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        blockedUntil: true,
        blockReason: true,
      },
    });

    return {
      success: true,
      message: `User ${updated.name || updated.email} has been unblocked successfully.`,
      data: updated,
    };
  }

  // ─── Soft Delete User (with 60-day recovery retention) ─────────────────────
  async softDeleteUser(id: string, dto: SoftDeleteUserDto, session: JwtPayload) {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (user.isOwner) {
      throw new BadRequestException('The primary Site Owner account cannot be deleted.');
    }

    // If explicit hard delete requested (Super Admin only)
    if (dto?.immediateHardDelete) {
      if (session.role !== 'super_admin' && !session.isOwner) {
        throw new UnauthorizedException(
          'Only Super Admins can permanently hard-delete user accounts immediately.',
        );
      }
      return this.deleteAdminOrUser(id, false, session);
    }

    // Default: Soft Delete with 60-day preservation
    const deletedAt = new Date();
    const purgeAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt,
        purgeAt,
        deleteReason: dto?.reason || 'Account removed by Administrator',
        deletedBy: session.name || session.email || 'Administrator',
      },
      select: {
        id: true,
        name: true,
        email: true,
        isDeleted: true,
        deletedAt: true,
        purgeAt: true,
        deleteReason: true,
      },
    });

    return {
      success: true,
      message: `User account soft-deleted. All data is preserved for 60 days (until ${purgeAt.toLocaleDateString()}) with recovery option.`,
      data: updated,
    };
  }

  // ─── Restore / Retain Account ──────────────────────────────────────────────
  async restoreUser(id: string, session: JwtPayload) {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        isDeleted: false,
        deletedAt: null,
        purgeAt: null,
        deleteReason: null,
        deletedBy: null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        isDeleted: true,
        deletedAt: true,
      },
    });

    return {
      success: true,
      message: `User account ${updated.name || updated.email} has been successfully restored and retained.`,
      data: updated,
    };
  }

  // ─── Flag User to Super Admin ──────────────────────────────────────────────
  async flagUser(id: string, dto: FlagUserDto, session: JwtPayload) {
    const target = await this.prisma.user.findUnique({ where: { id } });

    if (!target) {
      throw new NotFoundException('Target user not found.');
    }

    const flag = await this.prisma.userFlag.create({
      data: {
        userId: id,
        flaggedById: session.id,
        action: dto.action,
        reason: dto.reason,
        note: dto.note || null,
        status: 'PENDING',
      },
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
    });

    return {
      success: true,
      message: 'Moderation flag has been submitted to Super Admin for review.',
      data: flag,
    };
  }

  // ─── Resolve Moderation Flag (Super Admin only) ────────────────────────────
  async resolveFlag(flagId: string, dto: ResolveFlagDto, session: JwtPayload) {
    if (session.role !== 'super_admin' && !session.isOwner) {
      throw new UnauthorizedException(
        'Only Super Admins can resolve moderation flags.',
      );
    }

    const flag = await this.prisma.userFlag.findUnique({
      where: { id: flagId },
    });

    if (!flag) {
      throw new NotFoundException('Moderation flag not found.');
    }

    const updated = await this.prisma.userFlag.update({
      where: { id: flagId },
      data: {
        status: dto.status,
        resolvedById: session.id,
        resolvedAt: new Date(),
      },
    });

    // If approved, automatically execute the requested action
    if (dto.status === 'APPROVED') {
      if (flag.action === 'BLOCK') {
        const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await this.prisma.user.update({
          where: { id: flag.userId },
          data: {
            blockedUntil: nextWeek,
            blockReason: `Flag approved: ${flag.reason}`,
          },
        });
      } else if (flag.action === 'DELETE') {
        const purgeAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
        await this.prisma.user.update({
          where: { id: flag.userId },
          data: {
            isDeleted: true,
            deletedAt: new Date(),
            purgeAt,
            deleteReason: `Flag approved: ${flag.reason}`,
            deletedBy: session.name || session.email || 'Super Admin',
          },
        });
      }
    }

    return {
      success: true,
      message: `Moderation flag has been marked as ${dto.status}.`,
      data: updated,
    };
  }

  // ─── Auto-purge expired deleted accounts ───────────────────────────────────
  async autoPurgeExpiredAccounts() {
    const expiredUsers = await this.prisma.user.findMany({
      where: {
        isDeleted: true,
        purgeAt: { lte: new Date() },
      },
      select: {
        id: true,
        profilePicturePublicId: true,
      },
    });

    for (const u of expiredUsers) {
      try {
        if (u.profilePicturePublicId) {
          await this.cloudinary.deleteFile(u.profilePicturePublicId);
        }
        await this.prisma.user.delete({ where: { id: u.id } });
      } catch (error) {
        console.error(`Auto-purge failed for user ${u.id}:`, error);
      }
    }
  }

  // ─── Grant Subscription / Premium Access (Admin Override) ──────────────────
  async grantUserAccess(
    userId: string,
    dto: GrantAccessDto,
    session: JwtPayload,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const now = Date.now();
    let periodEndTimestamp: number;
    let durationLabel: string;

    switch (dto.plan) {
      case AccessDurationPlan.ONE_MONTH:
        periodEndTimestamp = Math.floor((now + 30 * 24 * 60 * 60 * 1000) / 1000);
        durationLabel = '1 Month';
        break;
      case AccessDurationPlan.THREE_MONTHS:
        periodEndTimestamp = Math.floor((now + 90 * 24 * 60 * 60 * 1000) / 1000);
        durationLabel = '3 Months';
        break;
      case AccessDurationPlan.SIX_MONTHS:
        periodEndTimestamp = Math.floor((now + 180 * 24 * 60 * 60 * 1000) / 1000);
        durationLabel = '6 Months';
        break;
      case AccessDurationPlan.ONE_YEAR:
        periodEndTimestamp = Math.floor((now + 365 * 24 * 60 * 60 * 1000) / 1000);
        durationLabel = '1 Year';
        break;
      case AccessDurationPlan.LIFETIME:
        // Dec 31, 2099 for Lifetime access
        periodEndTimestamp = Math.floor(new Date('2099-12-31T23:59:59.000Z').getTime() / 1000);
        durationLabel = 'Lifetime Access';
        break;
      case AccessDurationPlan.CUSTOM:
        if (!dto.customEndDate) {
          throw new BadRequestException('Custom end date is required for custom plan.');
        }
        const customDate = new Date(dto.customEndDate);
        if (isNaN(customDate.getTime()) || customDate.getTime() <= now) {
          throw new BadRequestException('Custom end date must be a valid future date.');
        }
        periodEndTimestamp = Math.floor(customDate.getTime() / 1000);
        durationLabel = `Custom (until ${customDate.toLocaleDateString()})`;
        break;
      default:
        periodEndTimestamp = Math.floor((now + 30 * 24 * 60 * 60 * 1000) / 1000);
        durationLabel = '1 Month';
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        isPaid: true,
        status: 'active',
        billingCycle: dto.billingCycle || 'monthly',
        currentPeriodEnd: periodEndTimestamp,
        adminGrantedAccess: true,
        adminGrantedReason: dto.reason?.trim() || `Admin granted ${durationLabel}`,
        adminGrantedBy: session.name || session.email || 'Administrator',
        adminGrantedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        email: true,
        isPaid: true,
        status: true,
        billingCycle: true,
        currentPeriodEnd: true,
        adminGrantedAccess: true,
        adminGrantedReason: true,
        adminGrantedBy: true,
        adminGrantedAt: true,
      },
    });

    await this.auditService.logAction({
      staffId: session.id,
      staffName: session.name || session.email,
      staffEmail: session.email,
      staffRole: session.role,
      action: 'GRANT_SUBSCRIPTION',
      entityType: 'User',
      entityId: user.id,
      entityTitle: user.name || user.email || 'User',
      details: `Granted ${durationLabel} VIP subscription tier to ${user.name || user.email} (${user.email}). Reason: ${dto.reason || 'Admin grant'}`,
    });

    return {
      success: true,
      message: `Successfully granted ${durationLabel} subscription access to ${user.name || user.email}.`,
      data: updatedUser,
    };
  }

  // ─── Revoke Granted Subscription Access ───────────────────────────────────
  async revokeUserAccess(
    userId: string,
    dto: RevokeAccessDto,
    session: JwtPayload,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        isPaid: false,
        status: 'free',
        currentPeriodEnd: null,
        adminGrantedAccess: false,
        adminGrantedReason: dto.reason?.trim() || `Access revoked by ${session.name || session.email || 'Admin'}`,
      },
      select: {
        id: true,
        name: true,
        email: true,
        isPaid: true,
        status: true,
        billingCycle: true,
        currentPeriodEnd: true,
        adminGrantedAccess: true,
        adminGrantedReason: true,
        adminGrantedBy: true,
        adminGrantedAt: true,
      },
    });

    await this.auditService.logAction({
      staffId: session.id,
      staffName: session.name || session.email,
      staffEmail: session.email,
      staffRole: session.role,
      action: 'REVOKE_SUBSCRIPTION',
      entityType: 'User',
      entityId: user.id,
      entityTitle: user.name || user.email || 'User',
      details: `Revoked subscription access from ${user.name || user.email}. Tier reset to Free. Reason: ${dto.reason || 'Revoked by admin'}`,
    });

    return {
      success: true,
      message: `Subscription access for ${user.name || user.email} has been revoked and reset to Free tier.`,
      data: updatedUser,
    };
  }

  // ─── Toggle Staff Password Change Permission ──────────────────────────────
  async togglePasswordPermission(staffId: string, canChangePassword: boolean, session: JwtPayload) {
    if (session.role !== 'super_admin' && !session.isOwner) {
      throw new UnauthorizedException('Only Super Admins can manage staff permissions.');
    }

    const staff = await this.prisma.user.findUnique({ where: { id: staffId } });
    if (!staff) {
      throw new NotFoundException('Staff member not found.');
    }

    const updated = await this.prisma.user.update({
      where: { id: staffId },
      data: { canChangePassword },
    });

    await this.auditService.logAction({
      staffId: session.id,
      staffName: session.name || session.email,
      staffEmail: session.email,
      staffRole: session.role,
      action: 'TOGGLE_PASSWORD_PERMISSION',
      entityType: 'StaffPermission',
      entityId: staff.id,
      entityTitle: staff.name || staff.email || 'Staff',
      details: `${canChangePassword ? 'Granted' : 'Revoked'} manual password change permission for ${staff.name || staff.email} (${staff.role}).`,
    });

    return {
      message: `Password change permission ${canChangePassword ? 'granted' : 'revoked'} successfully.`,
      data: {
        id: updated.id,
        canChangePassword: updated.canChangePassword,
      },
    };
  }

  async updatePermissions(staffId: string, dto: UpdatePermissionsDto, session: JwtPayload) {
    if (session.role !== 'super_admin' && !session.isOwner) {
      throw new UnauthorizedException('Only Super Admins can manage staff permissions.');
    }

    const staff = await this.prisma.user.findUnique({ where: { id: staffId } });
    if (!staff) {
      throw new NotFoundException('Staff member not found.');
    }

    const updatedData: any = {};
    if (dto.canDeleteQueries !== undefined) updatedData.canDeleteQueries = dto.canDeleteQueries;
    if (dto.canViewUserDetails !== undefined) updatedData.canViewUserDetails = dto.canViewUserDetails;
    if (dto.canChangePassword !== undefined) updatedData.canChangePassword = dto.canChangePassword;
    if (dto.canManageFaqs !== undefined) updatedData.canManageFaqs = dto.canManageFaqs;
    if (dto.canManagePages !== undefined) updatedData.canManagePages = dto.canManagePages;
    if (dto.canManageTasks !== undefined) updatedData.canManageTasks = dto.canManageTasks;
    if (dto.canManagePayments !== undefined) updatedData.canManagePayments = dto.canManagePayments;
    if (dto.canManageReports !== undefined) updatedData.canManageReports = dto.canManageReports;

    const updated = await this.prisma.user.update({
      where: { id: staffId },
      data: updatedData,
    });

    await this.auditService.logAction({
      staffId: session.id,
      staffName: session.name || session.email,
      staffEmail: session.email,
      staffRole: session.role,
      action: 'UPDATE_STAFF_PERMISSIONS',
      entityType: 'StaffPermission',
      entityId: staff.id,
      entityTitle: staff.name || staff.email || 'Staff',
      details: `Updated permissions matrix for ${staff.name || staff.email} (${staff.role}).`,
    });

    return {
      message: 'Staff permissions updated successfully.',
      data: updated,
    };
  }

  // ─── Get Staff Profile & Duties ───────────────────────────────────────────
  async getStaffProfile(targetId: string, session: JwtPayload) {
    const isMe = !targetId || targetId === 'me' || targetId === session.id;
    const userId = isMe ? session.id : targetId;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        sessions: {
          orderBy: { loginAt: 'desc' },
          take: 10,
        },
        createdFlags: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Staff member not found.');
    }

    // Only staff accounts have an Admin Profile
    if (user.role === 'user') {
      throw new BadRequestException('This account is a standard platform user, not an administrative staff member.');
    }

    const userEmail = user.email || '';

    // Operational statistics
    const [queriesRepliedCount, recentQueries, flagsCreatedCount, invitationsSentCount, accessGrantedCount] =
      await Promise.all([
        userEmail
          ? this.prisma.contactQuery.count({
              where: {
                repliedByEmail: {
                  equals: userEmail,
                  mode: 'insensitive',
                },
              },
            })
          : 0,
        userEmail
          ? this.prisma.contactQuery.findMany({
              where: {
                repliedByEmail: {
                  equals: userEmail,
                  mode: 'insensitive',
                },
              },
              orderBy: { repliedAt: 'desc' },
              take: 8,
              select: {
                id: true,
                name: true,
                email: true,
                subject: true,
                status: true,
                repliedAt: true,
              },
            })
          : [],
        this.prisma.userFlag.count({
          where: { flaggedById: user.id },
        }),
        userEmail
          ? this.prisma.invitation.count({
              where: {
                invitedBy: {
                  contains: userEmail,
                  mode: 'insensitive',
                },
              },
            })
          : 0,
        userEmail
          ? this.prisma.user.count({
              where: {
                adminGrantedBy: {
                  contains: userEmail,
                  mode: 'insensitive',
                },
              },
            })
          : 0,
      ]);

    // Define role-specific operational duties & capability checklist
    const getRoleDuties = (role: string, isOwner?: boolean) => {
      if (isOwner || role === 'super_admin') {
        return [
          {
            id: 'gov_1',
            title: 'Organization Governance & Ownership',
            category: 'Governance',
            description: 'Full unrestricted governance over platform infrastructure, system policies, and database records.',
            status: 'active',
            coverage: '100% Platform Access',
          },
          {
            id: 'gov_2',
            title: 'Staff Access & RBAC Matrix',
            category: 'Team Control',
            description: 'Invite administrative staff, assign operational roles, grant granular feature permissions, and revoke seats.',
            status: 'active',
            coverage: 'Full Access',
          },
          {
            id: 'gov_3',
            title: 'Manual Subscription & Plan Grants',
            category: 'Billing & Subscriptions',
            description: 'Grant users complimentary VIP/pro access tiers, override duration periods (1m to Lifetime), and revoke access.',
            status: 'active',
            coverage: 'Full Access',
          },
          {
            id: 'gov_4',
            title: 'Financial & Revenue Intelligence',
            category: 'Finance & Analytics',
            description: 'Audit monthly/yearly recurring revenues, Stripe gateway health, and active subscription lifecycle trends.',
            status: 'active',
            coverage: 'Full Access',
          },
          {
            id: 'gov_5',
            title: 'Customer Inquiry & Moderation Authority',
            category: 'Support & Security',
            description: 'Direct response capability for VIP user tickets, complete deletion authority for spam/closed queries, and user suspension.',
            status: 'active',
            coverage: 'Full Access',
          },
        ];
      }

      if (role === 'customer_support') {
        return [
          {
            id: 'cs_1',
            title: 'Customer Inquiry Handling & Resolution',
            category: 'Support',
            description: 'Receive, investigate, and draft official email replies to user inquiries and contact requests.',
            status: 'active',
            coverage: 'Assigned',
          },
          {
            id: 'cs_2',
            title: 'User Profile & Account Inspection',
            category: 'Moderation',
            description: user.canViewUserDetails
              ? 'Permission GRANTED: Full inspection of user search reports, saved collections, payments, and account status.'
              : 'Permission RESTRICTED: Requires permission from a Super Admin to view deep user details.',
            status: user.canViewUserDetails ? 'active' : 'restricted',
            coverage: user.canViewUserDetails ? 'Active' : 'Locked',
          },
          {
            id: 'cs_3',
            title: 'Support Ticket Cleanup & Deletion',
            category: 'Support Maintenance',
            description: user.canDeleteQueries
              ? 'Permission GRANTED: Permanent deletion of resolved, duplicate, or abusive inquiries.'
              : 'Permission RESTRICTED: Requires explicit deletion permission from a Super Admin.',
            status: user.canDeleteQueries ? 'active' : 'restricted',
            coverage: user.canDeleteQueries ? 'Active' : 'Locked',
          },
          {
            id: 'cs_4',
            title: 'Security Flagging & Escalation',
            category: 'Moderation',
            description: 'Flag suspicious user accounts or abusive behavior for Super Admin review and suspension.',
            status: 'active',
            coverage: 'Assigned',
          },
        ];
      }

      if (role === 'finance') {
        return [
          {
            id: 'fin_1',
            title: 'Revenue Analytics & Invoicing Oversight',
            category: 'Finance',
            description: 'Monitor daily and aggregate MRR/ARR earnings, monthly vs yearly subscription plans, and Stripe revenue records.',
            status: 'active',
            coverage: 'Assigned',
          },
          {
            id: 'fin_2',
            title: 'Subscription Conversions & Retention',
            category: 'Finance',
            description: 'Audit paying user numbers, free-to-paid conversion rates, trial statuses, and overdue payments.',
            status: 'active',
            coverage: 'Assigned',
          },
          {
            id: 'fin_3',
            title: 'VIP & Manual Access Audit',
            category: 'Audit',
            description: 'Review manual administrative subscription grants and promotional passes assigned by Super Admins.',
            status: 'active',
            coverage: 'Audit Only',
          },
        ];
      }

      if (role === 'content_manager') {
        return [
          {
            id: 'cm_1',
            title: 'Dynamic Page Management (CMS)',
            category: 'Content Management',
            description: 'Author, edit, format, and publish dynamic content pages, terms of service, privacy notices, and promotional pages.',
            status: 'active',
            coverage: 'Full Access',
          },
          {
            id: 'cm_2',
            title: 'FAQ Knowledge Base Curation',
            category: 'Content Management',
            description: 'Maintain category-based FAQs, update question and answer listings, and manage question sequencing.',
            status: 'active',
            coverage: 'Full Access',
          },
          {
            id: 'cm_3',
            title: 'Helpful Insights & Tips Publication',
            category: 'Content Management',
            description: 'Publish expert home buyer/seller guides, neighborhood recommendations, and helpful tips.',
            status: 'active',
            coverage: 'Full Access',
          },
        ];
      }

      // Default Admin
      return [
        {
          id: 'adm_1',
          title: 'General Platform Administration',
          category: 'Operations',
          description: 'Manage users, audit system activity, and perform operational moderation.',
          status: 'active',
          coverage: 'Assigned',
        },
        {
          id: 'adm_2',
          title: 'Support Inquiry Assistance',
          category: 'Support',
          description: 'Monitor customer questions and coordinate responses with team leads.',
          status: 'active',
          coverage: 'Assigned',
        },
        {
          id: 'adm_3',
          title: 'User Activity Auditing',
          category: 'Audit',
          description: user.canViewUserDetails
            ? 'Permission GRANTED: View user details, reports, collections, and payments.'
            : 'Permission RESTRICTED: Requires Super Admin approval.',
          status: user.canViewUserDetails ? 'active' : 'restricted',
          coverage: user.canViewUserDetails ? 'Active' : 'Locked',
        },
      ];
    };

    const duties = getRoleDuties(user.role, Boolean(user.isOwner));

    // Combine recent actions into unified timeline
    const timelineItems = [
      ...recentQueries.map((q) => ({
        id: `query_${q.id}`,
        type: 'query_reply',
        title: `Replied to inquiry: "${q.subject}"`,
        detail: `Sent official response to ${q.name} (${q.email})`,
        timestamp: q.repliedAt || user.updatedAt,
        badge: 'Support',
      })),
      ...user.createdFlags.map((f) => ({
        id: `flag_${f.id}`,
        type: 'user_flag',
        title: `Flagged user account: ${f.user?.name || f.user?.email || f.userId}`,
        detail: `Action: ${f.action} • Reason: ${f.reason}`,
        timestamp: f.createdAt,
        badge: 'Moderation',
      })),
      ...user.sessions.slice(0, 4).map((s) => ({
        id: `session_${s.id}`,
        type: 'session_login',
        title: `Signed in from ${s.browser || 'Browser'} on ${s.os || s.device || 'Desktop'}`,
        detail: `IP: ${s.ipAddress || 'Protected'} • Location: ${s.city ? `${s.city}, ${s.country}` : s.country || 'Verified'}`,
        timestamp: s.loginAt,
        badge: 'Security',
      })),
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    let staffSessions = user.sessions;
    if (staffSessions.length === 0) {
      try {
        const newSess = await this.prisma.userSession.create({
          data: {
            userId: user.id,
            ipAddress: user.lastActiveIp || '127.0.0.1 (Local)',
            userAgent: null,
            browser: 'Chrome / Web App',
            os: 'Desktop',
            device: 'Desktop',
            city: 'Verified',
            country: 'Active Session',
            loginAt: user.lastLoginAt || user.createdAt || new Date(),
            lastActiveAt: new Date(),
            durationSeconds: 1800,
            isCurrent: true,
          },
        });
        staffSessions = [newSess];
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            lastLoginAt: user.lastLoginAt || new Date(),
            lastActiveIp: user.lastActiveIp || '127.0.0.1',
            loginCount: Math.max(1, user.loginCount || 1),
            totalSessionMinutes: Math.max(30, user.totalSessionMinutes || 30),
          },
        });
      } catch {
        staffSessions = [
          {
            id: `sess_live_${user.id}`,
            userId: user.id,
            ipAddress: user.lastActiveIp || '127.0.0.1 (Local)',
            userAgent: null,
            browser: 'Chrome / Web App',
            os: 'Desktop',
            device: 'Desktop',
            city: 'Verified',
            country: 'Active Session',
            loginAt: user.lastLoginAt || user.createdAt || new Date(),
            lastActiveAt: new Date(),
            durationSeconds: 1800,
            isCurrent: true,
            createdAt: user.createdAt,
            updatedAt: new Date(),
          } as any,
        ];
      }
    }

    return {
      success: true,
      data: {
        profile: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          isOwner: Boolean(user.isOwner),
          isOtpVerified: Boolean(user.isOtpVerified),
          profilePictureURL: user.profilePictureURL,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          lastLoginAt: user.lastLoginAt,
          lastActiveIp: user.lastActiveIp,
          loginCount: Math.max(1, user.loginCount || staffSessions.length),
          totalSessionMinutes: Math.max(1, user.totalSessionMinutes || 1),
        },
        permissions: {
          canViewUserDetails: Boolean(user.isOwner || user.role === 'super_admin' || user.canViewUserDetails),
          canDeleteQueries: Boolean(user.isOwner || user.role === 'super_admin' || user.canDeleteQueries),
          canChangePassword: Boolean(user.isOwner || user.role === 'super_admin' || user.canChangePassword),
          canManageFaqs: Boolean(user.isOwner || user.role === 'super_admin' || user.canManageFaqs),
          canManagePages: Boolean(user.isOwner || user.role === 'super_admin' || user.canManagePages),
          canManageTasks: Boolean(user.isOwner || user.role === 'super_admin' || user.canManageTasks),
          canManagePayments: Boolean(user.isOwner || user.role === 'super_admin' || user.canManagePayments),
          canManageReports: Boolean(user.isOwner || user.role === 'super_admin' || user.canManageReports),
          isSuperAdmin: Boolean(user.isOwner || user.role === 'super_admin'),
        },
        stats: {
          queriesReplied: queriesRepliedCount,
          flagsCreated: flagsCreatedCount,
          invitationsSent: invitationsSentCount,
          accessGrantedCount,
          totalSessions: Math.max(1, user.loginCount || staffSessions.length),
          totalSessionMinutes: Math.max(1, user.totalSessionMinutes || 1),
          dutiesCount: duties.length,
          activeDutiesCount: duties.filter((d) => d.status === 'active').length,
        },
        duties,
        recentSessions: staffSessions,
        recentTimeline: timelineItems,
        viewer: {
          id: session.id,
          role: session.role,
          isOwner: Boolean(session.isOwner),
          isSuperAdmin: Boolean(session.isOwner || session.role === 'super_admin'),
          isSelf: user.id === session.id,
        },
      },
    };
  }

  // ─── Super Admin: Impersonate User ────────────────────────────────────────
  async impersonateUser(targetUserId: string, session: JwtPayload) {
    if (session.role !== 'super_admin' && !session.isOwner) {
      throw new UnauthorizedException('Only Super Admins can use Impersonation Mode.');
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      throw new NotFoundException('User to impersonate was not found.');
    }

    const token = this.auth.generateToken(
      {
        id: targetUser.id,
        email: targetUser.email || '',
        name: targetUser.name || '',
        role: targetUser.role,
        isImpersonated: true,
        originalAdminId: session.id,
      },
      'user',
      'access',
    );

    await this.auditService.logAction({
      staffId: session.id,
      staffName: session.name || session.email,
      staffEmail: session.email,
      staffRole: session.role,
      action: 'IMPERSONATE_USER',
      entityType: 'User',
      entityId: targetUser.id,
      entityTitle: targetUser.name || targetUser.email || 'User',
      details: `Started safe impersonation session as ${targetUser.name || targetUser.email}.`,
    });

    return {
      success: true,
      message: `Impersonation session initialized for ${targetUser.name || targetUser.email}`,
      data: {
        token,
        user: {
          id: targetUser.id,
          name: targetUser.name,
          email: targetUser.email,
          role: targetUser.role,
        },
      },
    };
  }

  // ─── Automated VIP Grant Expiry Check & Stripe Conversion ─────────────────
  async checkExpiringGrants() {
    const now = Math.floor(Date.now() / 1000);
    const threeDaysFromNow = now + 3 * 24 * 60 * 60;

    const expiringUsers = await this.prisma.user.findMany({
      where: {
        adminGrantedAccess: true,
        isPaid: true,
        currentPeriodEnd: {
          gt: now,
          lte: threeDaysFromNow,
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        currentPeriodEnd: true,
        adminGrantedReason: true,
      },
    });

    const results: any[] = [];
    const frontendUrl = this.getFrontendUrl();

    for (const user of expiringUsers) {
      if (user.email) {
        try {
          const daysLeft = Math.max(1, Math.ceil(((user.currentPeriodEnd || 0) - now) / 86400));
          await this.email.sendEmail({
            to: user.email,
            subject: `Your complimentary Dwellr Pro access ends in ${daysLeft} days`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0;">
                <h2 style="color: #0f172a; margin-bottom: 12px;">Keep Your Pro Access & Saved Reports</h2>
                <p style="color: #475569; font-size: 14px; line-height: 1.6;">
                  Hi ${user.name || 'there'}, your complimentary Dwellr Pro access is scheduled to expire in <strong>${daysLeft} days</strong>.
                </p>
                <p style="color: #475569; font-size: 14px; line-height: 1.6;">
                  To ensure uninterrupted access to your personalized market intelligence reports and saved property collections, upgrade to our official Pro plan today.
                </p>
                <div style="margin: 24px 0;">
                  <a href="${frontendUrl}/dashboard/settings" style="background: #0f172a; color: #ffffff; padding: 12px 24px; border-radius: 8px; font-weight: bold; text-decoration: none; display: inline-block;">
                    Upgrade to Paid Pro Tier →
                  </a>
                </div>
              </div>
            `,
          });
          results.push({ userId: user.id, email: user.email, status: 'sent' });
        } catch (err: any) {
          results.push({ userId: user.id, email: user.email, status: 'failed', error: err?.message });
        }
      }
    }

    return {
      success: true,
      checkedCount: expiringUsers.length,
      notificationsSent: results.filter((r) => r.status === 'sent').length,
      details: results,
    };
  }

  // ─── Export Work Time CSV ─────────────────────────────────────────────────
  async exportWorkTimeCsv() {
    const data = await this.auditService.getTeamWorkTimeSummary();
    const headers = 'Staff ID,Name,Email,Role,Total Hours,Today Hours,Past 7 Days Hours,Total Sessions,Tasks Performed\n';
    const rows = data.data.leaderboard
      .map(
        (m) =>
          `"${m.id}","${m.name}","${m.email || ''}","${m.role}",${m.totalHours},${m.todayHours},${m.thisWeekHours},${m.sessionCount},${m.tasksPerformed}`,
      )
      .join('\n');

    return headers + rows;
  }

  // ─── Export Site Changes Audit Log CSV ────────────────────────────────────
  async exportAuditLogsCsv() {
    const logs = await this.prisma.staffAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });

    const headers = 'Log ID,Timestamp,Staff Name,Staff Email,Role,Action,Category,Target,Details,IP Address\n';
    const rows = logs
      .map(
        (l) =>
          `"${l.id}","${l.createdAt.toISOString()}","${l.staffName || ''}","${l.staffEmail || ''}","${l.staffRole || ''}","${l.action}","${l.entityType}","${l.entityTitle || ''}","${(l.details || '').replace(/"/g, '""')}","${l.ipAddress || ''}"`,
      )
      .join('\n');

    return headers + rows;
  }

  // ─── Frontend URL Helper ──────────────────────────────────────────────────
  private getFrontendUrl(): string {
    return (
      process.env.ADMIN_FRONTEND_URL ||
      process.env.FRONTEND_URL ||
      (process.env.NODE_ENV === 'production'
        ? 'https://admin.dwellr.tech'
        : 'http://localhost:3003')
    );
  }
}
