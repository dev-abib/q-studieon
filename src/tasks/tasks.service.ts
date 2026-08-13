import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Runs every minute.
   * Expired guests are SOFT-BLOCKED — not deleted.
   *
   * Why: we preserve their row (guestIp, guestDeviceId, reports, etc.)
   * so historical dashboard statistics remain accurate.
   *
   * What happens:
   *  - isGuest → false     : strips guest token privileges (auth guard rejects them)
   *  - blockedUntil → 2099 : permanent "expired" marker, prevents re-activation
   *
   * The guest's data (IP, device, linked reports/collections) is untouched.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async expireGuests() {
    this.logger.log('🔒 Running expired guest soft-block...');

    try {
      const now = new Date();

      const result = await this.prisma.user.updateMany({
        where: {
          isGuest: true,
          guestExpiresAt: { lt: now },
        },
        data: {
          isGuest: false,
          blockedUntil: new Date('2099-12-31T23:59:59Z'),
        },
      });

      if (result.count > 0) {
        this.logger.log(
          `✅ Soft-blocked ${result.count} expired guest(s). Data preserved.`,
        );
      }
    } catch (error) {
      this.logger.error('❌ Failed to soft-block expired guests', error.stack);
    }
  }
}
