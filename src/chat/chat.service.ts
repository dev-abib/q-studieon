// src/chat/chat.service.ts
import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const PAGE_SIZE = 40;

export interface StaffSummary {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  profilePictureURL: string | null;
}

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Staff list (for DM / mention autocomplete) ────────────────────────────
  async getStaffList(excludeId: string): Promise<StaffSummary[]> {
    const staffRoles = [
      'admin',
      'super_admin',
      'customer_support',
      'content_manager',
      'finance',
    ];
    return this.prisma.user.findMany({
      where: { role: { in: staffRoles as any }, id: { not: excludeId }, isDeleted: false },
      select: { id: true, name: true, email: true, role: true, profilePictureURL: true },
      orderBy: { name: 'asc' },
    }) as any;
  }

  // ─── Groups ────────────────────────────────────────────────────────────────

  async getMyGroups(staffId: string) {
    return this.prisma.chatGroup.findMany({
      where: {
        isArchived: false,
        members: { some: { staffId } },
      },
      include: {
        members: {
          include: {
            staff: {
              select: { id: true, name: true, profilePictureURL: true, role: true },
            },
          },
        },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  // Lightweight: just the ids of the groups a staff member belongs to.
  // Used by the gateway to auto-join socket rooms on connect.
  async getMyGroupIds(staffId: string): Promise<string[]> {
    const groups = await this.prisma.chatGroup.findMany({
      where: {
        isArchived: false,
        members: { some: { staffId } },
      },
      select: { id: true },
    });
    return groups.map((g) => g.id);
  }

  async getGroupMemberIds(groupId: string): Promise<string[]> {
    const members = await this.prisma.chatGroupMember.findMany({
      where: { groupId },
      select: { staffId: true },
    });
    return members.map((m) => m.staffId);
  }

  async createGroup(
    createdById: string,
    dto: { name: string; description?: string; avatarColor?: string; avatarUrl?: string; memberIds: string[] },
  ) {
    const allMemberIds = [...new Set([createdById, ...dto.memberIds])];
    return this.prisma.chatGroup.create({
      data: {
        name: dto.name,
        description: dto.description,
        avatarColor: dto.avatarColor,
        avatarUrl: dto.avatarUrl,
        createdById,
        members: {
          create: allMemberIds.map((id) => ({ staffId: id })),
        },
      },
      include: {
        members: {
          include: {
            staff: { select: { id: true, name: true, profilePictureURL: true, role: true } },
          },
        },
      },
    });
  }

  async updateGroup(
    groupId: string,
    requesterId: string,
    dto: { name?: string; description?: string; avatarColor?: string; avatarUrl?: string; memberIds?: string[] },
  ) {
    const group = await this.prisma.chatGroup.findUnique({
      where: { id: groupId },
      include: { members: true },
    });
    if (!group) throw new NotFoundException('Group not found');

    const requester = await this.prisma.user.findUnique({ where: { id: requesterId } });
    const isSuperAdmin = requester?.role === 'super_admin';
    const isMember = group.members.some((m) => m.staffId === requesterId);

    if (group.createdById !== requesterId && !isSuperAdmin && !isMember) {
      throw new ForbiddenException('Only group members or super admins can edit this group');
    }

    return this.prisma.chatGroup.update({
      where: { id: groupId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.avatarColor && { avatarColor: dto.avatarColor }),
        ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
        ...(dto.memberIds && {
          members: {
            deleteMany: {},
            create: [...new Set([group.createdById, requesterId, ...dto.memberIds])].map((id) => ({
              staffId: id,
            })),
          },
        }),
      },
      include: { members: { include: { staff: { select: { id: true, name: true, profilePictureURL: true, role: true } } } } },
    });
  }

  async archiveGroup(groupId: string, requesterId: string) {
    const group = await this.prisma.chatGroup.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Group not found');

    const requester = await this.prisma.user.findUnique({ where: { id: requesterId } });
    const isSuperAdmin = requester?.role === 'super_admin';

    if (group.createdById !== requesterId && !isSuperAdmin) {
      throw new ForbiddenException('Only the group creator or a super admin can archive it');
    }
    return this.prisma.chatGroup.update({
      where: { id: groupId },
      data: { isArchived: true },
    });
  }

  async leaveGroup(groupId: string, staffId: string) {
    const group = await this.prisma.chatGroup.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Group not found');
    if (group.createdById === staffId) {
      throw new ForbiddenException('Group creator cannot leave the group. Archive or transfer ownership instead.');
    }
    const member = await this.prisma.chatGroupMember.findUnique({
      where: { groupId_staffId: { groupId, staffId } },
    });
    if (!member) throw new NotFoundException('Not a member of this group');

    await this.prisma.chatGroupMember.delete({
      where: { id: member.id },
    });
    return { success: true };
  }

  // ─── Messages ──────────────────────────────────────────────────────────────

  async getGroupMessages(groupId: string, staffId: string, cursor?: string) {
    // Verify membership
    const member = await this.prisma.chatGroupMember.findUnique({
      where: { groupId_staffId: { groupId, staffId } },
    });
    if (!member) throw new ForbiddenException('Not a member of this group');

    return this.prisma.chatMessage.findMany({
      where: { groupId, isDeleted: false },
      take: PAGE_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        sender: { select: { id: true, name: true, profilePictureURL: true, role: true } },
        mentions: {
          include: { mentioned: { select: { id: true, name: true } } },
        },
      },
    });
  }

  async getDmMessages(staffId: string, partnerId: string, cursor?: string) {
    // Build canonical DM filter that matches both directions
    const filter = {
      OR: [
        { senderId: staffId, dmPartnerId: partnerId },
        { senderId: partnerId, dmPartnerId: staffId },
      ],
      groupId: null,
      isDeleted: false,
    };
    return this.prisma.chatMessage.findMany({
      where: filter,
      take: PAGE_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        sender: { select: { id: true, name: true, profilePictureURL: true, role: true } },
        mentions: {
          include: { mentioned: { select: { id: true, name: true } } },
        },
      },
    });
  }

  // ─── DM thread list ────────────────────────────────────────────────────────

  async getMyDmThreads(staffId: string) {
    // Get distinct partner IDs
    const sent = await this.prisma.chatMessage.findMany({
      where: { senderId: staffId, dmPartnerId: { not: null }, isDeleted: false },
      distinct: ['dmPartnerId'],
      select: { dmPartnerId: true },
    });
    const received = await this.prisma.chatMessage.findMany({
      where: { dmPartnerId: staffId, isDeleted: false },
      distinct: ['senderId'],
      select: { senderId: true },
    });

    const partnerIds = [
      ...new Set([
        ...sent.map((m) => m.dmPartnerId!),
        ...received.map((m) => m.senderId),
      ]),
    ].filter((id) => id !== staffId);

    const partners = await this.prisma.user.findMany({
      where: { id: { in: partnerIds } },
      select: { id: true, name: true, email: true, profilePictureURL: true, role: true },
    });

    return partners;
  }

  // ─── Persist a message (called from gateway) ───────────────────────────────

  async saveMessage(params: {
    senderId: string;
    content: string;
    groupId?: string;
    dmPartnerId?: string;
    mentionedIds?: string[];
    isAutoFlagged?: boolean;
    autoFlagReason?: string | null;
    attachmentUrl?: string;
    attachmentType?: string;
    attachmentName?: string;
    attachmentSizeBytes?: number;
    attachmentPublicId?: string;
  }) {
    return this.prisma.chatMessage.create({
      data: {
        senderId: params.senderId,
        content: params.content,
        groupId: params.groupId ?? null,
        dmPartnerId: params.dmPartnerId ?? null,
        isAutoFlagged: params.isAutoFlagged ?? false,
        autoFlagReason: params.autoFlagReason ?? null,
        attachmentUrl: params.attachmentUrl ?? null,
        attachmentType: params.attachmentType ?? null,
        attachmentName: params.attachmentName ?? null,
        attachmentSizeBytes: params.attachmentSizeBytes ?? null,
        attachmentPublicId: params.attachmentPublicId ?? null,
        mentions: params.mentionedIds?.length
          ? {
              create: params.mentionedIds.map((id) => ({ mentionedId: id })),
            }
          : undefined,
      },
      include: {
        sender: { select: { id: true, name: true, profilePictureURL: true, role: true } },
        mentions: {
          include: { mentioned: { select: { id: true, name: true } } },
        },
      },
    });
  }

  async editMessage(messageId: string, requesterId: string, content: string) {
    const msg = await this.prisma.chatMessage.findUnique({ where: { id: messageId } });
    if (!msg) throw new NotFoundException('Message not found');
    if (msg.senderId !== requesterId) throw new ForbiddenException('Cannot edit another user\'s message');
    return this.prisma.chatMessage.update({
      where: { id: messageId },
      data: { content, isEdited: true, editedAt: new Date() },
      include: { sender: { select: { id: true, name: true, profilePictureURL: true, role: true } } },
    });
  }

  async deleteMessage(messageId: string, requesterId: string, isSuperAdmin: boolean) {
    const msg = await this.prisma.chatMessage.findUnique({ where: { id: messageId } });
    if (!msg) throw new NotFoundException('Message not found');
    if (msg.senderId !== requesterId && !isSuperAdmin) {
      throw new ForbiddenException('Cannot delete another user\'s message');
    }
    return this.prisma.chatMessage.update({
      where: { id: messageId },
      data: { isDeleted: true, deletedAt: new Date() },
    });
  }

  // ─── Unread counts ─────────────────────────────────────────────────────────

  async getUnreadCounts(staffId: string): Promise<{
    totalMentions: number;
    byGroup: Record<string, number>;
  }> {
    const mentions = await this.prisma.chatMention.count({
      where: { mentionedId: staffId, isRead: false },
    });

    const groupMentions = await this.prisma.chatMention.groupBy({
      by: ['messageId'],
      where: { mentionedId: staffId, isRead: false },
      _count: true,
    });

    return {
      totalMentions: mentions,
      byGroup: {},
      // Simplified: just return total for now
    };
  }

  async markMentionsRead(staffId: string, roomKey: string) {
    // Mark all unread mentions as read for this user
    await this.prisma.chatMention.updateMany({
      where: { mentionedId: staffId, isRead: false },
      data: { isRead: true },
    });
  }

  // ─── Surveillance (super_admin) ────────────────────────────────────────────

  async getSurveillanceMessages(params: {
    page?: number;
    search?: string;
    isFlagged?: boolean;
    isAutoFlagged?: boolean;
    senderId?: string;
  }) {
    const page = params.page ?? 1;
    const limit = 30;
    const skip = (page - 1) * limit;

    const where: any = {
      isDeleted: false,
      ...(params.search && { content: { contains: params.search, mode: 'insensitive' } }),
      ...(params.isFlagged === true && { isFlagged: true }),
      ...(params.isAutoFlagged === true && { isAutoFlagged: true }),
      ...(params.senderId && { senderId: params.senderId }),
    };

    const [messages, total] = await Promise.all([
      this.prisma.chatMessage.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          sender: { select: { id: true, name: true, email: true, profilePictureURL: true, role: true } },
          group: { select: { id: true, name: true } },
        },
      }),
      this.prisma.chatMessage.count({ where }),
    ]);

    return { messages, total, page, limit };
  }

  async flagMessage(
    messageId: string,
    flaggedById: string,
    reason: string,
  ) {
    return this.prisma.chatMessage.update({
      where: { id: messageId },
      data: {
        isFlagged: true,
        flagReason: reason,
        flaggedById,
        flaggedAt: new Date(),
      },
    });
  }
}
