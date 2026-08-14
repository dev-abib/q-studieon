import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../infra/mail/mail.service';
import { CreateContactQueryDto } from './dto/create-contact-query.dto';
import { GetAllContactQueriesDto } from './dto/get-all-contact-queries.dto';
import { ReplyContactQueryDto } from './dto/reply-contact-query.dto';
import { AssignContactQueryDto } from './dto/assign-contact-query.dto';
import {
  BulkActionContactQueriesDto,
  BulkQueryAction,
} from './dto/bulk-action-contact-queries.dto';
import { ContactQueryPriority, ContactQueryStatus, Prisma } from '@prisma/client';
import { JwtPayload } from '../auth/types/jwt.types';
import {
  newContactQueryNotificationTemplate,
  contactQueryReplyTemplate,
} from '../infra/mail/templates/contact-query/contact-query.templates';

@Injectable()
export class ContactQueryService {
  private readonly logger = new Logger(ContactQueryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  // Helper to append to activity log
  private appendLog(existingLog: unknown, newEntry: Record<string, any>) {
    const list = Array.isArray(existingLog) ? existingLog : [];
    return [...list, { ...newEntry, timestamp: new Date().toISOString() }];
  }

  // ─── 1. Public Submission ──────────────────────────────────────────────────
  async submitQuery(dto: CreateContactQueryDto) {
    const normalizedEmail = dto.email.trim().toLowerCase();

    // Check if inquirer is an existing registered user
    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, name: true, email: true },
    });

    const isRegisteredUser = Boolean(existingUser);
    const userId = existingUser ? existingUser.id : null;

    // Save to Database
    const initialLog = [
      {
        action: 'SUBMITTED',
        by: dto.name.trim(),
        email: normalizedEmail,
        isRegisteredUser,
        timestamp: new Date().toISOString(),
      },
    ];

    const query = await this.prisma.contactQuery.create({
      data: {
        name: dto.name.trim(),
        email: normalizedEmail,
        subject: dto.subject.trim(),
        message: dto.message.trim(),
        status: ContactQueryStatus.PENDING,
        priority: ContactQueryPriority.MEDIUM,
        isRegisteredUser,
        userId,
        activityLog: initialLog,
      },
    });

    // Send email notification to Site Owner
    const siteOwnerEmail =
      process.env.SITE_OWNER_MAIL ||
      process.env.MAIL_USERNAME ||
      'abibdipto@gmail.com';

    try {
      await this.emailService.sendEmail({
        to: siteOwnerEmail,
        subject: `[New Inquiry] ${dto.subject.trim()}`,
        html: newContactQueryNotificationTemplate({
          name: dto.name.trim(),
          email: normalizedEmail,
          subject: dto.subject.trim(),
          message: dto.message.trim(),
          isRegisteredUser,
          queryId: query.id,
        }),
      });
      this.logger.log(
        `Inquiry notification email sent to site owner: ${siteOwnerEmail}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send inquiry notification email to ${siteOwnerEmail}:`,
        error,
      );
      // Do not throw error so user's query remains successfully saved
    }

    return {
      success: true,
      message:
        'Thank you for contacting us. Your message has been received and our team will get back to you shortly.',
      id: query.id,
    };
  }

  // ─── 2. Admin: Get All Paginated with Filters ──────────────────────────────
  async getAllQueries(dto: GetAllContactQueriesDto) {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      isRegisteredUser,
      assignedToId,
      priority,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = dto;

    const skip = (page - 1) * limit;
    const where: Prisma.ContactQueryWhereInput = {};

    if (status) {
      where.status = status as ContactQueryStatus;
    }

    if (priority) {
      where.priority = priority as ContactQueryPriority;
    }

    if (typeof isRegisteredUser === 'boolean') {
      where.isRegisteredUser = isRegisteredUser;
    }

    if (assignedToId) {
      if (assignedToId === 'UNASSIGNED') {
        where.assignedToId = null;
      } else {
        where.assignedToId = assignedToId;
      }
    }

    if (search && search.trim().length > 0) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { subject: { contains: q, mode: 'insensitive' } },
        { message: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, queries] = await Promise.all([
      this.prisma.contactQuery.count({ where }),
      this.prisma.contactQuery.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              userRole: true,
              profilePictureURL: true,
              isPaid: true,
              createdAt: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: queries,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  // ─── 3. Admin: Statistics & Staff Workload ────────────────────────────────
  async getStats() {
    try {
      const allQueries = await this.prisma.contactQuery.findMany({
        select: {
          id: true,
          assignedToId: true,
          status: true,
          priority: true,
          isRegisteredUser: true,
        },
      });

      const staffMembers = await this.prisma.user.findMany({
        where: {
          role: {
            in: [
              'super_admin',
              'admin',
              'customer_support',
              'content_manager',
              'finance',
            ],
          },
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          profilePictureURL: true,
        },
        orderBy: {
          name: 'asc',
        },
      });

      const total = allQueries.length;
      const pending = allQueries.filter(
        (q) => q.status === ContactQueryStatus.PENDING,
      ).length;
      const inProgress = allQueries.filter(
        (q) => q.status === ContactQueryStatus.IN_PROGRESS,
      ).length;
      const resolved = allQueries.filter(
        (q) => q.status === ContactQueryStatus.RESOLVED,
      ).length;
      const registeredUserCount = allQueries.filter(
        (q) => Boolean(q.isRegisteredUser),
      ).length;
      const unassignedCount = allQueries.filter(
        (q) => !q.assignedToId,
      ).length;
      const urgentCount = allQueries.filter(
        (q) => q.priority === ContactQueryPriority.URGENT,
      ).length;
      const highCount = allQueries.filter(
        (q) => q.priority === ContactQueryPriority.HIGH,
      ).length;

      const staffWorkload = staffMembers.map((staff) => {
        const assigned = allQueries.filter((q) => q.assignedToId === staff.id);
        return {
          staffId: staff.id,
          staffName: staff.name || 'Staff Member',
          staffEmail: staff.email,
          staffRole: staff.role,
          profilePictureURL: staff.profilePictureURL,
          total: assigned.length,
          pending: assigned.filter(
            (q) => q.status === ContactQueryStatus.PENDING,
          ).length,
          inProgress: assigned.filter(
            (q) => q.status === ContactQueryStatus.IN_PROGRESS,
          ).length,
          resolved: assigned.filter(
            (q) => q.status === ContactQueryStatus.RESOLVED,
          ).length,
        };
      });

      return {
        total,
        pending,
        inProgress,
        resolved,
        registeredUserCount,
        unassignedCount,
        urgentCount,
        highCount,
        staffWorkload,
      };
    } catch (error) {
      this.logger.error('Failed to compute inquiry stats:', error);
      return {
        total: 0,
        pending: 0,
        inProgress: 0,
        resolved: 0,
        registeredUserCount: 0,
        unassignedCount: 0,
        urgentCount: 0,
        highCount: 0,
        staffWorkload: [],
      };
    }
  }

  // ─── 4. Admin: Get Single Query ────────────────────────────────────────────
  async getQueryById(id: string) {
    const query = await this.prisma.contactQuery.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            userRole: true,
            profilePictureURL: true,
            isPaid: true,
            createdAt: true,
          },
        },
      },
    });

    if (!query) {
      throw new NotFoundException(`Inquiry with ID "${id}" was not found.`);
    }

    return query;
  }

  // ─── 5. Admin: Reply to Query ──────────────────────────────────────────────
  async replyToQuery(
    id: string,
    dto: ReplyContactQueryDto,
    adminPayload: JwtPayload,
  ) {
    const query = await this.prisma.contactQuery.findUnique({
      where: { id },
    });

    if (!query) {
      throw new NotFoundException(`Inquiry with ID "${id}" was not found.`);
    }

    const responderName = adminPayload.name || 'Dwellr Support';
    const responderEmail = adminPayload.email || 'support@dwellr.tech';
    const emailSubject = dto.customSubject?.trim() || `Re: ${query.subject}`;

    // Send email response
    try {
      await this.emailService.sendEmail({
        to: query.email,
        subject: emailSubject,
        html: contactQueryReplyTemplate({
          userName: query.name,
          subject: query.subject,
          originalMessage: query.message,
          replyMessage: dto.replyMessage.trim(),
          responderName,
        }),
      });
      this.logger.log(`Reply email successfully sent to: ${query.email}`);
    } catch (error) {
      this.logger.error(`Failed to send reply email to ${query.email}:`, error);
      throw new InternalServerErrorException(
        'Failed to deliver email reply to inquirer. Please verify mail service settings.',
      );
    }

    const updatedLog = this.appendLog(query.activityLog, {
      action: 'REPLIED',
      byName: responderName,
      byEmail: responderEmail,
      byId: adminPayload.id,
      note: dto.replyMessage.trim().slice(0, 100) + '...',
    });

    // Update query record with reply history
    const updatedQuery = await this.prisma.contactQuery.update({
      where: { id },
      data: {
        replyMessage: dto.replyMessage.trim(),
        repliedAt: new Date(),
        repliedById: adminPayload.id,
        repliedByName: responderName,
        repliedByEmail: responderEmail,
        status: ContactQueryStatus.RESOLVED,
        activityLog: updatedLog,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            userRole: true,
            profilePictureURL: true,
          },
        },
      },
    });

    return {
      success: true,
      message: `Reply email successfully sent to ${query.email}`,
      data: updatedQuery,
    };
  }

  // ─── 6. Admin: Assign / Transfer Case ──────────────────────────────────────
  async assignQuery(
    id: string,
    dto: AssignContactQueryDto,
    currentAdmin: JwtPayload,
  ) {
    const existing = await this.prisma.contactQuery.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Inquiry with ID "${id}" was not found.`);
    }

    // Find target staff member
    const targetStaff = await this.prisma.user.findUnique({
      where: { id: dto.assignedToId },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!targetStaff || targetStaff.role === 'user') {
      throw new NotFoundException('Selected staff / admin member was not found.');
    }

    const updatedLog = this.appendLog(existing.activityLog, {
      action: 'TRANSFERRED',
      byName: currentAdmin.name || 'Admin',
      byEmail: currentAdmin.email,
      toName: targetStaff.name || 'Staff Member',
      toEmail: targetStaff.email,
      toRole: targetStaff.role,
      transferNote: dto.transferNote ? dto.transferNote.trim() : null,
    });

    const updated = await this.prisma.contactQuery.update({
      where: { id },
      data: {
        assignedToId: targetStaff.id,
        assignedToName: targetStaff.name || 'Admin',
        assignedToEmail: targetStaff.email,
        assignedToRole: targetStaff.role,
        assignedAt: new Date(),
        transferNote: dto.transferNote ? dto.transferNote.trim() : existing.transferNote,
        status:
          existing.status === ContactQueryStatus.PENDING
            ? ContactQueryStatus.IN_PROGRESS
            : existing.status,
        activityLog: updatedLog,
      },
    });

    return {
      success: true,
      message: `Inquiry successfully assigned to ${targetStaff.name || targetStaff.email}.`,
      data: updated,
    };
  }

  // ─── 7. Admin: Update Priority ─────────────────────────────────────────────
  async updatePriority(
    id: string,
    priority: ContactQueryPriority,
    currentAdmin: JwtPayload,
  ) {
    const existing = await this.prisma.contactQuery.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Inquiry with ID "${id}" was not found.`);
    }

    const updatedLog = this.appendLog(existing.activityLog, {
      action: 'PRIORITY_CHANGED',
      byName: currentAdmin.name || 'Admin',
      previousPriority: existing.priority,
      newPriority: priority,
    });

    const updated = await this.prisma.contactQuery.update({
      where: { id },
      data: {
        priority,
        activityLog: updatedLog,
      },
    });

    return {
      success: true,
      message: `Inquiry priority changed to ${priority}.`,
      data: updated,
    };
  }

  // ─── 8. Admin: Add Internal Staff Note ─────────────────────────────────────
  async addInternalNote(
    id: string,
    note: string,
    currentAdmin: JwtPayload,
  ) {
    const existing = await this.prisma.contactQuery.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Inquiry with ID "${id}" was not found.`);
    }

    const updatedLog = this.appendLog(existing.activityLog, {
      action: 'NOTE_ADDED',
      byName: currentAdmin.name || 'Admin',
      byRole: currentAdmin.role,
      note: note.trim(),
    });

    const combinedNotes = existing.internalNotes
      ? `${existing.internalNotes}\n\n[${new Date().toLocaleDateString()}] ${currentAdmin.name || 'Admin'}: ${note.trim()}`
      : `[${new Date().toLocaleDateString()}] ${currentAdmin.name || 'Admin'}: ${note.trim()}`;

    const updated = await this.prisma.contactQuery.update({
      where: { id },
      data: {
        internalNotes: combinedNotes,
        activityLog: updatedLog,
      },
    });

    return {
      success: true,
      message: 'Internal note recorded.',
      data: updated,
    };
  }

  // ─── Helper: Verify Deletion Privilege ─────────────────────────────────────
  private async checkCanDelete(currentAdmin: JwtPayload) {
    if (currentAdmin.role === 'super_admin') {
      return true;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: currentAdmin.id },
      select: { role: true, isOwner: true, canDeleteQueries: true },
    });

    if (user?.role === 'super_admin' || user?.isOwner || user?.canDeleteQueries) {
      return true;
    }

    throw new ForbiddenException(
      'Access Denied: Only Super Admin or staff members granted deletion privileges can delete customer inquiries.',
    );
  }

  // ─── 9. Admin: Bulk Actions ────────────────────────────────────────────────
  async bulkAction(
    dto: BulkActionContactQueriesDto,
    currentAdmin: JwtPayload,
  ) {
    const { ids, action, assignedToId, status, priority, transferNote } = dto;

    if (action === BulkQueryAction.DELETE) {
      await this.checkCanDelete(currentAdmin);

      await this.prisma.contactQuery.deleteMany({
        where: { id: { in: ids } },
      });
      return {
        success: true,
        message: `${ids.length} inquiries deleted successfully.`,
      };
    }

    if (action === BulkQueryAction.UPDATE_STATUS && status) {
      await this.prisma.contactQuery.updateMany({
        where: { id: { in: ids } },
        data: { status },
      });
      return {
        success: true,
        message: `${ids.length} inquiries updated to status ${status}.`,
      };
    }

    if (action === BulkQueryAction.UPDATE_PRIORITY && priority) {
      await this.prisma.contactQuery.updateMany({
        where: { id: { in: ids } },
        data: { priority },
      });
      return {
        success: true,
        message: `${ids.length} inquiries updated to priority ${priority}.`,
      };
    }

    if (action === BulkQueryAction.ASSIGN && assignedToId) {
      const targetStaff = await this.prisma.user.findUnique({
        where: { id: assignedToId },
        select: { id: true, name: true, email: true, role: true },
      });

      if (!targetStaff) {
        throw new NotFoundException('Target staff member was not found.');
      }

      await this.prisma.contactQuery.updateMany({
        where: { id: { in: ids } },
        data: {
          assignedToId: targetStaff.id,
          assignedToName: targetStaff.name || 'Admin',
          assignedToEmail: targetStaff.email,
          assignedToRole: targetStaff.role,
          assignedAt: new Date(),
          transferNote: transferNote || null,
        },
      });

      return {
        success: true,
        message: `${ids.length} inquiries assigned to ${targetStaff.name || targetStaff.email}.`,
      };
    }

    throw new BadRequestException('Invalid bulk action or missing parameters.');
  }

  // ─── 10. Admin: Get Available Staff Members for Assignment ─────────────────
  async getStaffMembers() {
    const staff = await this.prisma.user.findMany({
      where: {
        role: {
          in: [
            'super_admin',
            'admin',
            'customer_support',
            'content_manager',
            'finance',
          ],
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        profilePictureURL: true,
        canDeleteQueries: true,
        isOwner: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return {
      data: staff,
    };
  }

  // ─── 11. Super Admin: Toggle Delete Privilege for Staff ────────────────────
  async toggleStaffDeletePermission(
    targetStaffId: string,
    canDelete: boolean,
    currentAdmin: JwtPayload,
  ) {
    if (currentAdmin.role !== 'super_admin') {
      const caller = await this.prisma.user.findUnique({
        where: { id: currentAdmin.id },
        select: { role: true, isOwner: true },
      });
      if (caller?.role !== 'super_admin' && !caller?.isOwner) {
        throw new ForbiddenException(
          'Permission Denied: Only Super Admins can grant or revoke deletion privileges.',
        );
      }
    }

    const target = await this.prisma.user.findUnique({
      where: { id: targetStaffId },
    });

    if (!target) {
      throw new NotFoundException(`Staff member with ID "${targetStaffId}" not found.`);
    }

    const updated = await this.prisma.user.update({
      where: { id: targetStaffId },
      data: {
        canDeleteQueries: canDelete,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        canDeleteQueries: true,
      },
    });

    return {
      success: true,
      message: `${updated.name || updated.email}'s delete permission set to ${canDelete ? 'ENABLED' : 'DISABLED'}.`,
      data: updated,
    };
  }

  // ─── 12. Admin: Update Status ──────────────────────────────────────────────
  async updateStatus(id: string, status: ContactQueryStatus) {
    const existing = await this.prisma.contactQuery.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Inquiry with ID "${id}" was not found.`);
    }

    return this.prisma.contactQuery.update({
      where: { id },
      data: { status },
    });
  }

  // ─── 13. Admin: Delete Query ───────────────────────────────────────────────
  async deleteQuery(id: string, currentAdmin: JwtPayload) {
    await this.checkCanDelete(currentAdmin);

    const existing = await this.prisma.contactQuery.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Inquiry with ID "${id}" was not found.`);
    }

    await this.prisma.contactQuery.delete({
      where: { id },
    });

    return {
      success: true,
      message: 'Inquiry deleted successfully.',
    };
  }
}
