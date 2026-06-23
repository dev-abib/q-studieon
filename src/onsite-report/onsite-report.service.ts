import crypto from 'crypto';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, Report } from '@prisma/client';
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
import { CaptureType } from './helpers/dto/add.capture.dto';
import { CloudinaryService } from '../common/services/cloudinary.service';
import {
  getAccessLevel,
  buildReportResponse,
} from '../auth/helpers/report-response.helper';
import { ReportAccessLevel } from '../auth/helpers/ai-helper';
import type { JwtPayload } from '../auth/types/jwt.types';
import type { MulterFile } from '../common/pipes/file-validation.pipe';

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function safeNumber(val: unknown, fallback = 0): number {
  return typeof val === 'number' ? val : fallback;
}

function safeCaptureArray(val: unknown): OnsiteCaptureData[] {
  if (!Array.isArray(val)) return [];
  // Basic shape check — each item must have an id
  return val.filter(
    (item): item is OnsiteCaptureData =>
      item !== null && typeof item === 'object' && 'id' in item,
  );
}

function extractOnsiteMeta(metadata: unknown): {
  totalLevels: number;
  totalCaptures: number;
  captures: OnsiteCaptureData[];
} {
  if (!metadata || typeof metadata !== 'object') {
    return { totalLevels: 0, totalCaptures: 0, captures: [] };
  }
  const m = metadata as Record<string, unknown>;
  return {
    totalLevels: safeNumber(m.totalLevels),
    totalCaptures: safeNumber(m.totalCaptures),
    captures: safeCaptureArray(m.captures),
  };
}

@Injectable()
export class OnsiteReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numerologyHelpers: NumerologyHelpers,
    private readonly placeDetailsHelper: PlaceDetailsHelper,
    private readonly onsiteAiHelper: OnsiteAiHelper,
    private readonly cloudinary: CloudinaryService,
  ) {}

  // ---------------------------------------------------------------------------
  // POST /onsite-report/submit
  // ---------------------------------------------------------------------------

  async submitReport(
    dto: SubmitOnsiteReportDto,
    user: JwtPayload,
    files?: MulterFile[],
  ): Promise<SubmitReportResponse> {
    // ── Flatten levels → elements → captures ─────────────────────────────────

    const allElements = dto.levels.flatMap((level) =>
      level.elements.map((element) => ({
        ...element,
        levelName: level.levelName,
        levelNumber: level.levelNumber,
      })),
    );

    if (!allElements.length) {
      throw new BadRequestException('At least one element is required.');
    }

    // ── Validate: only one front_entrance ────────────────────────────────────

    const mainElements = allElements.filter(
      (e) => e.categorySlug === 'front_entrance',
    );
    if (mainElements.length > 1) {
      throw new BadRequestException(
        'Only one element can be marked as the front entrance.',
      );
    }

    // ── Resolve main element ─────────────────────────────────────────────────

    const mainElement = mainElements[0] ?? allElements[0];

    // ── Build typed captures ─────────────────────────────────────────────────

    const typedCaptures: OnsiteCaptureData[] = allElements.map((e) => ({
      id: crypto.randomUUID(),
      captureType: e.categorySlug as CaptureType,
      bearingDegrees: e.bearingDegrees,
      cardinal: this.onsiteAiHelper.getCardinalFromBearing(e.bearingDegrees),
      isMainEntrance: e.categorySlug === 'front_entrance',
      notes: e.notes ?? null,
      createdAt: new Date(),
    }));

    const mainCardinal = this.onsiteAiHelper.getCardinalFromBearing(
      mainElement.bearingDegrees,
    );

    // ── Numerology ───────────────────────────────────────────────────────────

    const numerologyDetails = this.numerologyHelpers.createReport({
      address: dto.address,
      latitude: dto.latitude,
      longitude: dto.longitude,
      entranceDegrees: mainElement.bearingDegrees,
      entranceLabel: mainCardinal,
    });

    // ── Validate and upload photos to Cloudinary ────────────────────────────

    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const maxSize = 10 * 1024 * 1024; // 10 MB

    let uploadedPhotos: { url: string; publicId: string }[] = [];
    if (files && files.length > 0) {
      // Validate each file
      for (const file of files) {
        if (!allowedMimes.includes(file.mimetype)) {
          throw new BadRequestException(
            `Invalid file type: ${file.mimetype}. Allowed: ${allowedMimes.join(', ')}`,
          );
        }
        if (file.size > maxSize) {
          throw new BadRequestException(
            `File ${file.originalname} exceeds 10MB limit`,
          );
        }
      }

      uploadedPhotos = await Promise.all(
        files.map((file) => this.cloudinary.uploadFile(file, 'onsite-reports')),
      );
    }

    // ── Place photos (Google Maps) ───────────────────────────────────────────

    const placeDetails = await this.placeDetailsHelper.getPlacePhotos({
      lat: dto.latitude,
      lng: dto.longitude,
    });

    const placeId = placeDetails?.[0]?.place_id ?? null;
    const googlePhotos = [
      placeDetails?.[0]?.photos?.[0],
      placeDetails?.[0]?.photos?.[1],
    ].filter(Boolean);

    // ── AI generation ────────────────────────────────────────────────────────

    const aiResponse = await this.onsiteAiHelper.generateOnsiteReport({
      address: dto.address,
      numerologyDetails,
      entranceBearing: mainElement.bearingDegrees,
      userConfirmedDirection: true,
      captures: typedCaptures,
    });

    const report = aiResponse.data;
    const aiMeta = aiResponse.metadata;

    // ── Build metadata ───────────────────────────────────────────────────────

    const totalLevels = dto.levels.length;
    const totalCaptures = typedCaptures.length;

    const metadata: OnsiteReportMetadata = {
      reportMode: 'onsite',
      address: dto.address,
      notes: null,
      mainEntranceType: mainElement.categorySlug,
      mainCardinal,
      mainBearing: mainElement.bearingDegrees,
      totalLevels,
      totalCaptures,
      captures: typedCaptures,
    };

    // ── Persist ───────────────────────────────────────────────────────────────

    const saved = await this.prisma.report.create({
      data: {
        userId: user.id,
        type: 'onsite_property_report',
        status: 'completed',

        placeId,
        photos: toJson([...googlePhotos, ...uploadedPhotos]),

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

    // ── Build response based on access level ─────────────────────────────────

    const accessLevel = getAccessLevel(user);
    const { report: reportData, accessLevel: accessLvl } = buildReportResponse(
      saved,
      accessLevel,
    );
    const isPaid = accessLevel === ReportAccessLevel.PAID_FULL;

    return {
      success: true,
      message: 'On-site report generated successfully.',
      data: {
        report: reportData,
        accessLevel: accessLvl,
        totalLevels: isPaid ? totalLevels : 0,
        totalCaptures: isPaid ? totalCaptures : 0,
        captures: isPaid ? typedCaptures : [],
      },
    };
  }

  // ---------------------------------------------------------------------------
  // GET /onsite-report/my-reports
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
  // ---------------------------------------------------------------------------

  async getReportById(
    reportId: string,
    user: JwtPayload,
  ): Promise<GetReportResponse> {
    const data = await this.prisma.report.findFirst({
      where: { id: reportId, userId: user.id, type: 'onsite_property_report' },
    });

    if (!data) throw new NotFoundException('Report not found.');

    const accessLevel = getAccessLevel(user);
    const meta = extractOnsiteMeta(data.metadata);
    const { report: reportData, accessLevel: accessLvl } = buildReportResponse(
      data,
      accessLevel,
    );
    const isPaid = accessLevel === ReportAccessLevel.PAID_FULL;

    return {
      success: true,
      data: {
        report: reportData,
        accessLevel: accessLvl,
        totalLevels: isPaid ? meta.totalLevels : 0,
        totalCaptures: isPaid ? meta.totalCaptures : 0,
        captures: isPaid ? meta.captures : [],
      },
    };
  }

  async createCollection(dto: CreateCollectionDto, userId: string) {
    const name = dto.name.trim();

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
    const report = await this.prisma.report.findFirst({
      where: { id: reportId },
    });

    if (!report || report.userId !== userId) {
      throw new NotFoundException('Report not found or access denied');
    }

    const collection = await this.prisma.collection.findFirst({
      where: { id: collectionId, userId },
    });

    if (!collection) {
      throw new NotFoundException('Collection not found or access denied');
    }

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
