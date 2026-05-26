import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { OnsiteAiHelper } from './helpers/onsite-ai-helper';
import {
  OnsiteCaptureData,
  OnsiteReportMetadata,
  ReportListItem,
  SubmitReportResponse,
  GetReportsResponse,
  GetReportResponse,
  reportListSelect,
} from './types/onsite-report.types';
import { PrismaService } from '../prisma/prisma.service';
import { NumerologyHelpers } from '../auth/helpers/numerology-helpers';
import { PlaceDetailsHelper } from '../auth/helpers/place-details.helper';
import { SubmitOnsiteReportDto } from './helpers/dto/submit-report.dto';
import { CreateCollectionDto } from './helpers/dto/collection.dto';

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

@Injectable()
export class OnsiteReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numerologyHelpers: NumerologyHelpers,
    private readonly placeDetailsHelper: PlaceDetailsHelper,
    private readonly onsiteAiHelper: OnsiteAiHelper,
  ) {}

  // ---------------------------------------------------------------------------
  // POST /onsite-report/submit
  // Receives all captures at once, runs AI, persists one Report row.
  // ---------------------------------------------------------------------------

  async submitReport(
    dto: SubmitOnsiteReportDto,
    userId: string,
  ): Promise<SubmitReportResponse> {
    // ── Validate captures ────────────────────────────────────────────────────

    const mainEntrances = dto.captures.filter((c) => c.isMainEntrance);
    if (mainEntrances.length > 1) {
      throw new BadRequestException(
        'Only one capture can be marked as the main entrance.',
      );
    }

    // ── Resolve main entrance: explicit flag → first capture ─────────────────

    const mainCapture = mainEntrances[0] ?? dto.captures[0];

    // ── Build typed captures with cardinal resolved ───────────────────────────
    // No cast needed — captureType is already CaptureType from the DTO

    const typedCaptures: OnsiteCaptureData[] = dto.captures.map((c) => ({
      id: crypto.randomUUID(),
      captureType: c.captureType,
      bearingDegrees: c.bearingDegrees,
      cardinal: this.onsiteAiHelper.getCardinalFromBearing(c.bearingDegrees),
      isMainEntrance: c.isMainEntrance ?? false,
      notes: c.notes ?? null,
      createdAt: new Date(),
    }));

    const mainCardinal = this.onsiteAiHelper.getCardinalFromBearing(
      mainCapture.bearingDegrees,
    );

    // ── Numerology ────────────────────────────────────────────────────────────

    const numerologyDetails = this.numerologyHelpers.createReport({
      address: dto.address,
      latitude: dto.latitude,
      longitude: dto.longitude,
      entranceDegrees: mainCapture.bearingDegrees,
      entranceLabel: mainCardinal,
    });

    // ── Place photos ──────────────────────────────────────────────────────────

    const placeDetails = await this.placeDetailsHelper.getPlacePhotos({
      lat: dto.latitude,
      lng: dto.longitude,
    });

    const placeId = placeDetails?.[0]?.place_id ?? null;
    const photos = [
      placeDetails?.[0]?.photos?.[0],
      placeDetails?.[0]?.photos?.[1],
    ].filter(Boolean);

    // ── AI generation ─────────────────────────────────────────────────────────

    const aiResponse = await this.onsiteAiHelper.generateOnsiteReport({
      address: dto.address,
      numerologyDetails,
      entranceBearing: mainCapture.bearingDegrees,
      userConfirmedDirection: true, // always true for on-site
      captures: typedCaptures,
    });

    const report = aiResponse.data;
    const aiMeta = aiResponse.metadata;

    // ── Build metadata with a typed interface — no `as unknown` needed ────────

    const metadata: OnsiteReportMetadata = {
      reportMode: 'onsite',
      address: dto.address,
      notes: dto.notes ?? null,
      mainEntranceType: mainCapture.captureType,
      mainCardinal,
      mainBearing: mainCapture.bearingDegrees,
      capturesTotal: typedCaptures.length,
      captures: typedCaptures,
    };

    // ── Persist ───────────────────────────────────────────────────────────────
    // toJson() performs a single, explicit boundary cast at the Prisma layer.
    // Everything above this point is fully typed.
    // photos, practicalRemedies, helpfulTips are stored as flat arrays —
    // consistent with how the remote ReportService stores them.

    const saved = await this.prisma.report.create({
      data: {
        userId,
        type: 'onsite_property_report',
        status: 'completed',

        placeId,
        photos: toJson(photos),

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

        aiModel: aiMeta.model,
        promptTokens: aiMeta.usage?.prompt_tokens ?? 0,
        completionTokens: aiMeta.usage?.completion_tokens ?? 0,
        totalTokens: aiMeta.usage?.total_tokens ?? 0,
        finishReason: aiMeta.finishReason,

        metadata: toJson(metadata),
      },
    });

    return {
      success: true,
      message: 'On-site report generated successfully.',
      data: saved,
    };
  }

  // ---------------------------------------------------------------------------
  // GET /onsite-report/my-reports
  // Lightweight list — no heavy JSON blobs.
  // ---------------------------------------------------------------------------

  async getMyReports(userId: string): Promise<GetReportsResponse> {
    const data: ReportListItem[] = await this.prisma.report.findMany({
      where: { userId, type: 'onsite_property_report' },
      orderBy: { createdAt: 'desc' },
      select: reportListSelect,
    });

    return { success: true, data };
  }

  // ---------------------------------------------------------------------------
  // GET /onsite-report/:reportId
  // Full report row.
  // ---------------------------------------------------------------------------

  async getReportById(
    reportId: string,
    userId: string,
  ): Promise<GetReportResponse> {
    const data = await this.prisma.report.findFirst({
      where: { id: reportId, userId, type: 'onsite_property_report' },
    });

    if (!data) throw new NotFoundException('Report not found.');

    return { success: true, data };
  }

  async createCollection(dto: CreateCollectionDto, userId: string) {
    const name = dto.name.trim();

    // Check duplicate name
    const existing = await this.prisma.collection.findUnique({
      where: {
        userId_name: { userId, name },
      },
    });

    if (existing) {
      return {
        success: false,
        message: `Collection with name "${name}" already exists`,
      };
    }

    const collection = await this.prisma.collection.create({
      data: {
        userId,
        name,
        description: dto.description?.trim() ?? null,
      },
    });

    return {
      success: true,
      message: 'Collection created successfully',
      data: collection,
    };
  }

  async getCollections(userId: string) {
    const collections = await this.prisma.collection.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { reports: true },
        },
      },
    });

    return {
      success: true,
      data: collections,
    };
  }

  async addReportToCollection(
    collectionId: string,
    reportId: string,
    userId: string,
  ) {
    // Check report ownership
    const report = await this.prisma.report.findFirst({
      where: { id: reportId },
    });

    if (!report || report.userId !== userId) {
      throw new NotFoundException('Report not found or access denied');
    }

    // Check collection ownership
    const collection = await this.prisma.collection.findFirst({
      where: { id: collectionId, userId },
    });

    if (!collection) {
      throw new NotFoundException('Collection not found or access denied');
    }

    // Check if already added
    const existing = await this.prisma.reportCollection.findUnique({
      where: {
        reportId_collectionId: { reportId, collectionId },
      },
    });

    if (existing) {
      return {
        success: true,
        message: 'Report is already in this collection',
        data: existing,
      };
    }

    // Add to collection
    const link = await this.prisma.reportCollection.create({
      data: { reportId, collectionId },
    });

    return {
      success: true,
      message: 'Report added to collection successfully',
      data: link,
    };
  }

  async getCollectionsWithReports(userId: string) {
    const collections = await this.prisma.collection.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        reports: {
          include: {
            report: {
              select: reportListSelect,
            },
          },
          orderBy: { addedAt: 'desc' },
        },
      },
    });

    const recentStandaloneReports = await this.prisma.report.findMany({
      where: {
        userId,
        type: 'onsite_property_report',
        ReportCollection: { none: {} },
      },
      orderBy: { createdAt: 'desc' },
      take: 4,
      select: reportListSelect,
    });

    return {
      success: true,
      data: {
        collections,
        recentStandaloneReports,
      },
    };
  }
}
