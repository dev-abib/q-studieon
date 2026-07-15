import { Module } from '@nestjs/common';
import { SharedReportController } from './shared-report.controller';
import { SharedReportService } from './shared-report.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SharedReportController],
  providers: [SharedReportService],
  exports: [SharedReportService],
})
export class SharedReportModule {}
