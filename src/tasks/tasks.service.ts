import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async cleanExpiredGuests() {
    this.logger.log('🧹 Running expired guest cleanup...');

    try {
      const now = new Date();

      const result = await this.prisma.user.deleteMany({
        where: {
          isGuest: true,
          guestExpiresAt: {
            lt: now,
          },
        },
      });

      if (result.count > 0) {
        this.logger.log(`✅ Deleted ${result.count} expired guest(s).`);
      }
    } catch (error) {
      this.logger.error('❌ Failed to clean expired guests', error.stack);
    }
  }
}
