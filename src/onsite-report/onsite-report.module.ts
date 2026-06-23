import { Module } from '@nestjs/common';
import { OnsiteReportController } from './onsite-report.controller';
import { OnsiteReportService } from './onsite-report.service';
import { OnsiteAiHelper } from './helpers/onsite-ai-helper';
import { NumerologyHelpers } from '../auth/helpers/numerology-helpers';
import { PlaceDetailsHelper } from '../auth/helpers/place-details.helper';
import { PrismaModule } from '../prisma/prisma.module';
import { CloudinaryService } from '../common/services/cloudinary.service';

@Module({
  imports: [PrismaModule],
  controllers: [OnsiteReportController],
  providers: [
    OnsiteReportService,
    OnsiteAiHelper,
    NumerologyHelpers,
    PlaceDetailsHelper,
    CloudinaryService,
  ],
  exports: [OnsiteReportService],
})
export class OnsiteReportModule {}
