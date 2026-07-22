import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

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
import {
  getAccessLevel,
  buildReportResponse,
} from '../auth/helpers/report-response.helper';
import type { JwtPayload } from '../auth/types/jwt.types';

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

@Injectable()
export class ReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly placeDetailsHelper: PlaceDetailsHelper,
    private readonly numerologyHelpers: NumerologyHelpers,
    private readonly aiHelper: AiHelper,
  ) {}

  async createReport(
    dto: CreateReportDto,
    user: JwtPayload,
  ): Promise<CreateReportResponse> {
    try {
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

      // Always generate full report for DB storage
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
          userId: user.id,
          type: 'property_report',
          status: 'completed',

          placeId: photosDetails.placeId,
          photos: toJson(photosDetails.photos),

          // Store address data
          address: dto.address,
          latitude: dto.latitude,
          longitude: dto.longitude,
          entranceDegrees: dto.entranceDegrees,
          entranceLabel: dto.entranceLabel,

          overallAlignmentSummary: report.overall_alignment_summary,
          overview: report.overview,
          overallScore: report.overall_score,
          auspiciousnessLevel: report.auspiciousness.level,
          auspiciousnessSummary: report.auspiciousness.summary,

          familyFlowSummary: report.family_flow.summary,
          familyFlowNarrative: report.family_flow.narrative,

          entranceDirection: toJson(report.entrance_direction),
          entranceEnergy: toJson(report.entrance_energy),
          numerology: toJson(report.numerology),
          fengShui: toJson(report.feng_shui),
          vastu: toJson(report.vastu),

          indicators: toJson(report.indicators),
          practicalRemedies: toJson(report.practical_remedies),
          helpfulTips: toJson(report.helpful_tips),
          lifeAspects: toJson(report.life_aspects),

          aiModel: metadata.model,
          promptTokens: metadata.usage?.prompt_tokens ?? 0,
          completionTokens: metadata.usage?.completion_tokens ?? 0,
          totalTokens: metadata.usage?.total_tokens ?? 0,
          finishReason: metadata.finishReason,
        },
      });

      // Build response based on user's access level
      const accessLevel = getAccessLevel(user);

      return {
        success: true,
        message: 'Home alignment report generated successfully',
        data: buildReportResponse(saved, accessLevel),
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[ReportService] createReport failed:', message);
      throw new InternalServerErrorException(
        `Failed to create report: ${message}`,
      );
    }
  }

  async getMyReports(id: string) {
    const reports = await this.prisma.report.findMany({
      where: { userId: id },
    });

    if (!reports || reports.length === 0) {
      throw new NotFoundException('no reports found');
    }

    return {
      message: `Reports extracted successfully`,
      data: reports,
    };
  }

  // ---------------------------------------------------------------------------
  // DELETE /report/:reportId
  // ---------------------------------------------------------------------------

  async deleteReport(
    reportId: string,
    user: JwtPayload,
  ): Promise<{ success: boolean; message: string }> {
    const report = await this.prisma.report.findFirst({
      where: { id: reportId, userId: user.id },
    });

    if (!report) throw new NotFoundException('Report not found.');

    await this.prisma.report.delete({
      where: { id: reportId },
    });

    return {
      success: true,
      message: 'Remote property report deleted successfully.',
    };
  }

  // ---------------------------------------------------------------------------
  // GET /report/:reportId
  // ---------------------------------------------------------------------------

  async getReportById(
    reportId: string,
    user: JwtPayload,
  ): Promise<CreateReportResponse> {
    const data = await this.prisma.report.findFirst({
      where: { id: reportId, userId: user.id },
    });

    if (!data) throw new NotFoundException('Report not found.');

    const accessLevel = getAccessLevel(user);
    const { report: reportData, accessLevel: accessLvl } = buildReportResponse(
      data,
      accessLevel,
    );

    return {
      success: true,
      message: 'Report retrieved successfully.',
      data: {
        report: reportData,
        accessLevel: accessLvl,
      },
    };
  }
}
