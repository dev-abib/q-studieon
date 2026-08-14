import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export class PresenceHeartbeatDto {
  currentPath?: string;
  targetId?: string;
  targetType?: string; // "User", "ContactQuery"
  isTyping?: boolean;
}

export interface ActiveStaffPresence {
  staffId: string;
  name: string;
  email: string;
  role: string;
  profilePictureURL: string | null;
  currentPath: string;
  targetId: string | null;
  targetType: string | null;
  isTyping: boolean;
  lastHeartbeat: Date;
}

@Injectable()
export class PresenceService {
  private readonly activePresences = new Map<string, ActiveStaffPresence>();

  constructor(private readonly prisma: PrismaService) {}

  // ─── Record / Refresh Presence Heartbeat ──────────────────────────────────
  async recordHeartbeat(
    staffId: string,
    staffName: string | undefined,
    staffEmail: string | undefined,
    staffRole: string | undefined,
    profilePictureURL: string | null | undefined,
    dto: PresenceHeartbeatDto,
  ) {
    const presence: ActiveStaffPresence = {
      staffId,
      name: staffName || 'Staff Member',
      email: staffEmail || '',
      role: staffRole || 'admin',
      profilePictureURL: profilePictureURL ?? null,
      currentPath: dto.currentPath || '/dashboard',
      targetId: dto.targetId || null,
      targetType: dto.targetType || null,
      isTyping: Boolean(dto.isTyping),
      lastHeartbeat: new Date(),
    };

    this.activePresences.set(staffId, presence);
    this.cleanupStalePresences();

    // Auto-update or create active session duration in real time
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const latestSession = await this.prisma.userSession.findFirst({
        where: {
          userId: staffId,
          loginAt: { gte: today },
        },
        orderBy: { loginAt: 'desc' },
      });

      if (latestSession) {
        await this.prisma.userSession.update({
          where: { id: latestSession.id },
          data: {
            durationSeconds: { increment: 25 },
            lastActiveAt: new Date(),
            isCurrent: true,
          },
        });
      } else {
        await this.prisma.userSession.create({
          data: {
            userId: staffId,
            ipAddress: '127.0.0.1',
            browser: 'Chrome / Web App',
            os: 'Desktop',
            device: 'Desktop',
            loginAt: new Date(),
            lastActiveAt: new Date(),
            durationSeconds: 25,
            isCurrent: true,
          },
        });
      }

      await this.prisma.user.update({
        where: { id: staffId },
        data: {
          totalSessionMinutes: { increment: 1 },
          lastLoginAt: new Date(),
        },
      });
    } catch {
      // Non-blocking
    }

    return { success: true, activeCount: this.activePresences.size };
  }

  // ─── Get All Active Staff & Collisions ────────────────────────────────────
  getActivePresences(currentStaffId?: string, targetId?: string) {
    this.cleanupStalePresences();

    const activeList = Array.from(this.activePresences.values());

    // Detect if another staff member is viewing or editing the same target (User, Query, etc.)
    const collisions = targetId
      ? activeList.filter(
          (p) => p.targetId === targetId && p.staffId !== currentStaffId,
        )
      : [];

    return {
      success: true,
      data: {
        activeStaff: activeList,
        activeCount: activeList.length,
        collisions,
      },
    };
  }

  // ─── Cleanup Presences older than 2 minutes ──────────────────────────────
  private cleanupStalePresences() {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    for (const [staffId, presence] of this.activePresences.entries()) {
      if (presence.lastHeartbeat < twoMinutesAgo) {
        this.activePresences.delete(staffId);
      }
    }
  }
}
