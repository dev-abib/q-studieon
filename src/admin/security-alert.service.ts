import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SecurityAlertService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Create a Security Alert ──────────────────────────────────────────────
  async createAlert(params: {
    type: string;
    severity?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    staffId?: string;
    staffEmail?: string;
    title: string;
    description: string;
    metadata?: Record<string, any>;
  }) {
    try {
      return await this.prisma.securityAlert.create({
        data: {
          type: params.type,
          severity: params.severity || 'HIGH',
          staffId: params.staffId ?? null,
          staffEmail: params.staffEmail ?? null,
          title: params.title,
          description: params.description,
          metadata: params.metadata ?? {},
        },
      });
    } catch (err) {
      console.error('Failed to create security alert:', err);
      return null;
    }
  }

  // ─── Get Active Security Alerts ───────────────────────────────────────────
  async getAlerts(isResolved: boolean = false) {
    const alerts = await this.prisma.securityAlert.findMany({
      where: { isResolved },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const unresolvedCount = await this.prisma.securityAlert.count({
      where: { isResolved: false },
    });

    return {
      success: true,
      data: {
        alerts,
        unresolvedCount,
      },
    };
  }

  // ─── Resolve a Security Alert ─────────────────────────────────────────────
  async resolveAlert(alertId: string, resolvedBy: string) {
    const updated = await this.prisma.securityAlert.update({
      where: { id: alertId },
      data: {
        isResolved: true,
        resolvedAt: new Date(),
        resolvedBy,
      },
    });

    return {
      success: true,
      message: 'Security alert marked as resolved.',
      data: updated,
    };
  }

  // ─── Scan for Impossible Travel / Multi-IP Concurrency ────────────────────
  async scanForAnomalies(userId: string, currentIp: string, currentCountry?: string) {
    const recentSessions = await this.prisma.userSession.findMany({
      where: { userId },
      orderBy: { loginAt: 'desc' },
      take: 2,
    });

    if (recentSessions.length >= 2) {
      const prev = recentSessions[1];
      const curr = recentSessions[0];

      // If IPs are different and login occurred within 30 minutes with different countries
      if (
        prev.ipAddress &&
        curr.ipAddress &&
        prev.ipAddress !== curr.ipAddress &&
        prev.country &&
        curr.country &&
        prev.country !== curr.country
      ) {
        const timeDiffMinutes = (new Date(curr.loginAt).getTime() - new Date(prev.loginAt).getTime()) / (1000 * 60);
        if (timeDiffMinutes < 60) {
          await this.createAlert({
            type: 'IMPOSSIBLE_TRAVEL',
            severity: 'CRITICAL',
            staffId: userId,
            title: `Impossible Travel Detected for User (${curr.country} vs ${prev.country})`,
            description: `User signed in from ${curr.ipAddress} (${curr.country}) only ${Math.round(timeDiffMinutes)} minutes after signing in from ${prev.ipAddress} (${prev.country}).`,
            metadata: { prevSession: prev, currSession: curr },
          });
        }
      }
    }
  }
}
