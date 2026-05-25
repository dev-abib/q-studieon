import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Report } from '@prisma/client';

import { PlaceDetailsHelper } from '../auth/helpers/place-details.helper';
import { NumerologyHelpers } from '../auth/helpers/numerology-helpers';
import { AiHelper, ReportAccessLevel } from '../auth/helpers/ai-helper';
import { PrismaService } from '../prisma/prisma.service';

import { CreateReportDto } from './dto/create-report.dto';
import type {
  AiReport,
  AiMetadata,
  AiResponse,
  CreateReportResponse,
} from './types/report.types';
import { UserRepository } from '../common/repositories/user.repository';

@Injectable()
export class ReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly placeDetailsHelper: PlaceDetailsHelper,
    private readonly numerologyHelpers: NumerologyHelpers,
    private readonly aiHelper: AiHelper,
    private readonly userRepo: UserRepository,
  ) {}

  async createReport(
    dto: CreateReportDto,
    userId: string,
  ): Promise<CreateReportResponse<{ saved: Report }>> {
    const placeDetails = await this.placeDetailsHelper.getPlacePhotos({
      lat: dto.latitude,
      lng: dto.longitude,
    });

    const photosDetails = {
      placeId: placeDetails?.[0]?.place_id ?? null,
      photos: [
        placeDetails?.[0]?.photos?.[0],
        placeDetails?.[0]?.photos?.[1],
      ].filter(Boolean),
    };

    const numerologyDetails = this.numerologyHelpers.createReport(dto);

    const aiResponse = (await this.aiHelper.generateByAccessLevel(
      ReportAccessLevel.PAID_FULL,
      {
        address: dto.address,
        numerologyDetails,
        entranceBearing: dto.entranceDegrees,
        userConfirmedDirection: true,
      },
    )) as AiResponse;

    const report: AiReport = aiResponse.data;
    const metadata: AiMetadata = aiResponse.metadata;

    const saved = await this.prisma.report.create({
      data: {
        userId,
        type: 'property_report',
        status: 'completed',

        placeId: photosDetails.placeId,
        photos: photosDetails.photos as unknown as Prisma.JsonArray,

        overallAlignmentSummary: report.overall_alignment_summary,
        overview: report.overview,
        overallScore: report.overall_score,
        auspiciousnessLevel: report.auspiciousness.level,
        auspiciousnessSummary: report.auspiciousness.summary,

        familyFlowSummary: report.family_flow.summary,
        familyFlowNarrative: report.family_flow.narrative,

        entranceDirection:
          report.entrance_direction as unknown as Prisma.JsonObject,

        entranceEnergy: report.entrance_energy as unknown as Prisma.JsonObject,
        numerology: report.numerology as unknown as Prisma.JsonObject,
        fengShui: report.feng_shui as unknown as Prisma.JsonObject,
        vastu: report.vastu as unknown as Prisma.JsonObject,

        indicators: report.indicators as unknown as Prisma.JsonObject,
        practicalRemedies:
          report.practical_remedies as unknown as Prisma.JsonArray,
        helpfulTips: report.helpful_tips as unknown as Prisma.JsonArray,
        lifeAspects: report.life_aspects as unknown as Prisma.JsonObject,

        aiModel: metadata.model,
        promptTokens: metadata.usage?.prompt_tokens ?? 0,
        completionTokens: metadata.usage?.completion_tokens ?? 0,
        totalTokens: metadata.usage?.total_tokens ?? 0,
        finishReason: metadata.finishReason,
      },
    });

    return {
      success: true,
      message: 'Home alignment report generated successfully',
      data: { saved },
    };
  }

  async getMyReports(id: string) {
    const reports = await this.prisma.report.findMany({
      where: { userId: id },
    });

    if (!reports) {
      throw new NotFoundException('no reports found');
    }

    return {
      message: `Reports extracted successfully`,
      data: reports,
    };
  }
}
