import { Module } from '@nestjs/common';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';
import { PlaceDetailsHelper } from 'src/auth/helpers/place-details.helper';
import { NumerologyHelpers } from 'src/auth/helpers/numerology-helpers';
import { AiHelper } from 'src/auth/helpers/ai-helper';

@Module({
  controllers: [ReportController],
  providers: [ReportService, PlaceDetailsHelper, NumerologyHelpers, AiHelper],
})
export class ReportModule {}
