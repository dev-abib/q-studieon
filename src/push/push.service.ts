// src/push/push.service.ts
import { Injectable, Logger } from '@nestjs/common';
import * as webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  url?: string;
  tag?: string;
  data?: Record<string, any>;
}

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly enabled: boolean;

  constructor(private readonly prisma: PrismaService) {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject =
      process.env.VAPID_SUBJECT || 'mailto:admin@dwellr.tech';

    if (publicKey && privateKey) {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      this.enabled = true;
      this.logger.log('Web Push enabled (VAPID keys configured)');
    } else {
      this.enabled = false;
      this.logger.warn(
        'VAPID keys missing — Web Push disabled. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.',
      );
    }
  }

  // ─── Subscription management ─────────────────────────────────────────────

  async subscribe(
    userId: string,
    subscription: PushSubscriptionInput,
    userAgent?: string,
  ) {
    return this.prisma.pushSubscription.upsert({
      where: {
        userId_endpoint: { userId, endpoint: subscription.endpoint },
      },
      update: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent,
      },
      create: {
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent,
      },
    });
  }

  async unsubscribe(userId: string, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({
      where: { userId, endpoint },
    });
    return { success: true };
  }

  // ─── Delivery ─────────────────────────────────────────────────────────────

  private async sendToOne(
    sub: { endpoint: string; p256dh: string; auth: string },
    payload: PushPayload,
  ) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload),
        { TTL: 60 * 60 * 24 }, // 24h — allow delivery if device is briefly offline
      );
    } catch (err: any) {
      // 404/410 → the subscription is gone (uninstalled/revoked) — clean up
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await this.prisma.pushSubscription.deleteMany({
          where: { endpoint: sub.endpoint },
        });
      } else {
        this.logger.warn(
          `Push send failed (${err?.statusCode ?? err?.message}): ${sub.endpoint}`,
        );
      }
    }
  }

  /** Send an OS push notification to every device registered for a user. */
  async sendToUser(userId: string, payload: PushPayload) {
    if (!this.enabled) return;
    try {
      const subs = await this.prisma.pushSubscription.findMany({
        where: { userId },
      });
      if (subs.length === 0) return;
      await Promise.all(subs.map((s) => this.sendToOne(s, payload)));
    } catch (err) {
      this.logger.error(
        `Failed to deliver push to user ${userId}:`,
        err as Error,
      );
    }
  }

  /** Send an OS push notification to every staff member with one of the roles. */
  async sendToRole(roles: string[], payload: PushPayload) {
    if (!this.enabled) return;
    try {
      const staff = await this.prisma.user.findMany({
        where: { role: { in: roles as any }, isDeleted: false },
        select: { id: true },
      });
      await Promise.all(staff.map((u) => this.sendToUser(u.id, payload)));
    } catch (err) {
      this.logger.error('Failed to deliver role-wide push:', err as Error);
    }
  }
}
