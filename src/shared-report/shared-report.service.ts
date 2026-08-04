import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ShareReportDto } from './dto/share-report.dto';

import { ShareComparisonDto } from './dto/share-comparison.dto';
import {
  getAccessLevel,
  buildReportResponse,
} from '../auth/helpers/report-response.helper';
import { ReportAccessLevel } from '../auth/helpers/ai-helper';
import type { JwtPayload } from '../auth/types/jwt.types';
import type {
  ShareReportResponse,
  GetSharedReportPreviewResponse,
  GetSharedReportFullResponse,
  SharedReportPreview,
  SharedReportCapture,
  GetSharedCollectionPreviewResponse,
  GetSharedCollectionFullResponse,
  SharedCollectionPreview,
  GetSharedComparisonPreviewResponse,
  GetSharedComparisonFullResponse,
  SharedComparisonPreview,
} from './types/shared-report.types';

@Injectable()
export class SharedReportService {
  constructor(private readonly prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // SHARE: Report
  // ═══════════════════════════════════════════════════════════════════════════

  async generateShareLink(
    reportId: string,
    user: JwtPayload,
    dto?: ShareReportDto,
  ): Promise<ShareReportResponse> {
    // Verify the report exists and belongs to the current user
    const report = await this.prisma.report.findFirst({
      where: { id: reportId },
    });

    if (!report) {
      throw new NotFoundException('Report not found.');
    }

    if (report.userId !== user.id) {
      throw new ForbiddenException('You can only share your own reports.');
    }

    // Check if this report was already shared by this user — return existing link
    const existing = await this.prisma.sharedReport.findFirst({
      where: { reportId, sharedById: user.id, shareType: 'report' },
    });

    if (existing) {
      return {
        success: true,
        message: 'Share link already exists.',
        data: {
          token: existing.token,
          shareLink: this.buildShareLink(existing.token),
        },
      };
    }

    // Create a new shared report entry
    const shared = await this.prisma.sharedReport.create({
      data: {
        shareType: 'report',
        reportId,
        sharedById: user.id,
        address: dto?.address ?? null,
      },
    });

    return {
      success: true,
      message: 'Share link generated successfully.',
      data: {
        token: shared.token,
        shareLink: this.buildShareLink(shared.token),
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SHARE: Collection
  // ═══════════════════════════════════════════════════════════════════════════

  async generateCollectionShareLink(
    collectionId: string,
    user: JwtPayload,
  ): Promise<ShareReportResponse> {
    // Verify the collection exists and belongs to the user
    const collection = await this.prisma.collection.findFirst({
      where: { id: collectionId, userId: user.id },
    });

    if (!collection) {
      throw new NotFoundException('Collection not found or access denied.');
    }

    // Check if this collection was already shared by this user
    const existing = await this.prisma.sharedReport.findFirst({
      where: { collectionId, sharedById: user.id, shareType: 'collection' },
    });

    if (existing) {
      return {
        success: true,
        message: 'Share link already exists for this collection.',
        data: {
          token: existing.token,
          shareLink: this.buildShareLink(existing.token),
        },
      };
    }

    // Create a new shared collection entry
    const shared = await this.prisma.sharedReport.create({
      data: {
        shareType: 'collection',
        collectionId,
        sharedById: user.id,
      },
    });

    return {
      success: true,
      message: 'Collection share link generated successfully.',
      data: {
        token: shared.token,
        shareLink: this.buildShareLink(shared.token),
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SHARE: Comparison
  // ═══════════════════════════════════════════════════════════════════════════

  async generateComparisonShareLink(
    dto: ShareComparisonDto,
    user: JwtPayload,
  ): Promise<ShareReportResponse> {
    const { reportId1, reportId2 } = dto;

    if (reportId1 === reportId2) {
      throw new BadRequestException('Cannot share a comparison of a report with itself.');
    }

    // Verify both reports exist and belong to the user
    const [report1, report2] = await Promise.all([
      this.prisma.report.findFirst({
        where: { id: reportId1, userId: user.id },
      }),
      this.prisma.report.findFirst({
        where: { id: reportId2, userId: user.id },
      }),
    ]);

    if (!report1) {
      throw new NotFoundException(
        `Report with ID "${reportId1}" not found or access denied.`,
      );
    }
    if (!report2) {
      throw new NotFoundException(
        `Report with ID "${reportId2}" not found or access denied.`,
      );
    }

    // Check if this comparison was already shared by this user (either order)
    const existing = await this.prisma.sharedReport.findFirst({
      where: {
        sharedById: user.id,
        shareType: 'comparison',
        OR: [
          {
            comparisonReportId1: reportId1,
            comparisonReportId2: reportId2,
          },
          {
            comparisonReportId1: reportId2,
            comparisonReportId2: reportId1,
          },
        ],
      },
    });

    if (existing) {
      return {
        success: true,
        message: 'Share link already exists for this comparison.',
        data: {
          token: existing.token,
          shareLink: this.buildShareLink(existing.token),
        },
      };
    }

    // Create a new shared comparison entry
    const shared = await this.prisma.sharedReport.create({
      data: {
        shareType: 'comparison',
        comparisonReportId1: reportId1,
        comparisonReportId2: reportId2,
        sharedById: user.id,
      },
    });

    return {
      success: true,
      message: 'Comparison share link generated successfully.',
      data: {
        token: shared.token,
        shareLink: this.buildShareLink(shared.token),
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GET: Preview (public — no auth)
  // ═══════════════════════════════════════════════════════════════════════════

  async getSharedReportPreview(
    token: string,
  ): Promise<
    | GetSharedReportPreviewResponse
    | GetSharedCollectionPreviewResponse
    | GetSharedComparisonPreviewResponse
  > {
    const shared = await this.prisma.sharedReport.findUnique({
      where: { token },
      include: {
        sharedBy: {
          select: {
            name: true,
            profilePictureURL: true,
          },
        },
        report: true,
      },
    });

    if (!shared) {
      throw new NotFoundException(
        'Shared report not found or link is invalid.',
      );
    }

    // Route based on share type
    if (shared.shareType === 'collection') {
      return this.buildCollectionPreview(shared);
    }

    if (shared.shareType === 'comparison') {
      return this.buildComparisonPreview(shared);
    }

    // Default: report preview
    return this.buildReportPreview(shared);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GET: Full (auth required)
  // ═══════════════════════════════════════════════════════════════════════════

  async getSharedReportFull(
    token: string,
    user: JwtPayload,
  ): Promise<
    | GetSharedReportFullResponse
    | GetSharedCollectionFullResponse
    | GetSharedComparisonFullResponse
  > {
    const shared = await this.prisma.sharedReport.findUnique({
      where: { token },
      include: { report: true },
    });

    if (!shared) {
      throw new NotFoundException(
        'Shared report not found or link is invalid.',
      );
    }

    // Route based on share type
    if (shared.shareType === 'collection') {
      return this.buildCollectionFull(shared, user);
    }

    if (shared.shareType === 'comparison') {
      return this.buildComparisonFull(shared, user);
    }

    // Default: report full
    return this.buildReportFull(shared, user);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GET: Check token validity
  // ═══════════════════════════════════════════════════════════════════════════

  async checkSharedReport(
    token: string,
  ): Promise<{ success: boolean; isValid: boolean }> {
    const shared = await this.prisma.sharedReport.findUnique({
      where: { token },
    });

    return {
      success: true,
      isValid: !!shared,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BUILD: Report preview
  // ═══════════════════════════════════════════════════════════════════════════

  private async buildReportPreview(shared: any): Promise<GetSharedReportPreviewResponse> {
    if (!shared.report) {
      throw new NotFoundException('Report data not found.');
    }
    const report = shared.report;

    // Determine address: use stored address from share, or fallback
    const address =
      shared.address ??
      this.extractAddressFromMetadata(report.metadata) ??
      'Address not available';

    // Extract photo URLs
    const photos = this.extractPhotos(report.photos);

    // Extract entrance direction
    const entrance = this.extractEntranceDirection(report.entranceDirection);

    const preview: SharedReportPreview = {
      token: shared.token,
      sharedBy: {
        name: shared.sharedBy.name ?? 'Unknown User',
        profilePictureURL: shared.sharedBy.profilePictureURL,
      },
      property: {
        address,
        photos,
      },
      entrance,
      auspiciousnessLevel: report.auspiciousnessLevel,
      overallScore: report.overallScore,
      overview: report.overview,
      reportType: report.type,
      createdAt: report.createdAt,
    };

    return {
      success: true,
      data: preview,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BUILD: Collection preview
  // ═══════════════════════════════════════════════════════════════════════════

  private async buildCollectionPreview(shared: any): Promise<GetSharedCollectionPreviewResponse> {
    if (!shared.collectionId) {
      throw new NotFoundException('Collection not found.');
    }

    const collection = await this.prisma.collection.findUnique({
      where: { id: shared.collectionId },
      include: {
        _count: { select: { reports: true } },
      },
    });

    if (!collection) {
      throw new NotFoundException('Collection not found or has been deleted.');
    }

    const preview: SharedCollectionPreview = {
      token: shared.token,
      sharedBy: {
        name: shared.sharedBy.name ?? 'Unknown User',
        profilePictureURL: shared.sharedBy.profilePictureURL,
      },
      collection: {
        id: collection.id,
        name: collection.name,
        type: collection.type,
        description: collection.description,
        reportCount: collection._count.reports,
      },
      createdAt: shared.createdAt,
    };

    return {
      success: true,
      data: preview,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BUILD: Comparison preview
  // ═══════════════════════════════════════════════════════════════════════════

  private async buildComparisonPreview(shared: any): Promise<GetSharedComparisonPreviewResponse> {
    if (!shared.comparisonReportId1 || !shared.comparisonReportId2) {
      throw new NotFoundException('Comparison data is incomplete.');
    }

    const [report1, report2] = await Promise.all([
      this.prisma.report.findUnique({
        where: { id: shared.comparisonReportId1 },
        select: {
          id: true,
          type: true,
          overallScore: true,
          auspiciousnessLevel: true,
          overview: true,
          address: true,
          photos: true,
          createdAt: true,
        },
      }),
      this.prisma.report.findUnique({
        where: { id: shared.comparisonReportId2 },
        select: {
          id: true,
          type: true,
          overallScore: true,
          auspiciousnessLevel: true,
          overview: true,
          address: true,
          photos: true,
          createdAt: true,
        },
      }),
    ]);

    if (!report1 || !report2) {
      throw new NotFoundException('One or both reports not found.');
    }

    const preview: SharedComparisonPreview = {
      token: shared.token,
      sharedBy: {
        name: shared.sharedBy.name ?? 'Unknown User',
        profilePictureURL: shared.sharedBy.profilePictureURL,
      },
      comparison: {
        report1,
        report2,
      },
      createdAt: shared.createdAt,
    };

    return {
      success: true,
      data: preview,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BUILD: Report full
  // ═══════════════════════════════════════════════════════════════════════════

  private async buildReportFull(
    shared: any,
    user: JwtPayload,
  ): Promise<GetSharedReportFullResponse> {
    if (!shared.report) {
      throw new NotFoundException('Report data not found.');
    }
    const report = shared.report;

    // Determine access level for the viewing user
    const accessLevel = getAccessLevel(user);
    const { report: reportData, accessLevel: accessLvl } = buildReportResponse(
      report,
      accessLevel,
    );

    // Extract onsite capture data with photoUrls if this is an onsite report
    const onsiteData = this.extractOnsiteCaptures(report.metadata);

    return {
      success: true,
      data: {
        report: reportData,
        accessLevel: accessLvl,
        reportType: report.type,
        ...onsiteData,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BUILD: Collection full
  // ═══════════════════════════════════════════════════════════════════════════

  private async buildCollectionFull(
    shared: any,
    user: JwtPayload,
  ): Promise<GetSharedCollectionFullResponse> {
    if (!shared.collectionId) {
      throw new NotFoundException('Collection not found.');
    }

    const collection = await this.prisma.collection.findUnique({
      where: { id: shared.collectionId },
      include: {
        reports: {
          include: {
            report: true,
          },
          orderBy: { addedAt: 'desc' },
        },
      },
    });

    if (!collection) {
      throw new NotFoundException('Collection not found or has been deleted.');
    }

    const accessLevel = getAccessLevel(user);

    // Build report responses for each report based on viewer access level
    const reports = collection.reports.map((rc) => {
      const { report } = buildReportResponse(rc.report, accessLevel);
      return report;
    });

    const accessLvl = accessLevel === ReportAccessLevel.PAID_FULL
      ? 'paid_full'
      : accessLevel === ReportAccessLevel.FREE_PREVIEW
        ? 'free_preview'
        : 'guest_preview';

    return {
      success: true,
      data: {
        collection: {
          id: collection.id,
          name: collection.name,
          type: collection.type,
          description: collection.description,
        },
        reports,
        accessLevel: accessLvl,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BUILD: Comparison full
  // ═══════════════════════════════════════════════════════════════════════════

  private async buildComparisonFull(
    shared: any,
    user: JwtPayload,
  ): Promise<GetSharedComparisonFullResponse> {
    if (!shared.comparisonReportId1 || !shared.comparisonReportId2) {
      throw new NotFoundException('Comparison data is incomplete.');
    }

    const [report1, report2] = await Promise.all([
      this.prisma.report.findUnique({
        where: { id: shared.comparisonReportId1 },
      }),
      this.prisma.report.findUnique({
        where: { id: shared.comparisonReportId2 },
      }),
    ]);

    if (!report1 || !report2) {
      throw new NotFoundException('One or both reports not found.');
    }

    const accessLevel = getAccessLevel(user);
    const { report: reportData1 } = buildReportResponse(report1, accessLevel);
    const { report: reportData2 } = buildReportResponse(report2, accessLevel);

    const accessLvl = accessLevel === ReportAccessLevel.PAID_FULL
      ? 'paid_full'
      : accessLevel === ReportAccessLevel.FREE_PREVIEW
        ? 'free_preview'
        : 'guest_preview';

    return {
      success: true,
      data: {
        report1: reportData1,
        report2: reportData2,
        accessLevel: accessLvl,
      },
    };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private buildShareLink(token: string): string {
    const baseUrl = process.env.APP_URL ?? 'https://app.q-studieon.com';
    return `${baseUrl}/shared-report/${token}`;
  }

  private extractAddressFromMetadata(
    metadata: Prisma.JsonValue,
  ): string | null {
    if (!metadata || typeof metadata !== 'object') return null;
    const m = metadata as Record<string, unknown>;
    return typeof m.address === 'string' ? m.address : null;
  }

  private extractPhotos(photos: Prisma.JsonValue): string[] {
    if (!Array.isArray(photos)) return [];
    return photos
      .map((p: unknown) => {
        if (typeof p === 'string') return p;
        if (p && typeof p === 'object') {
          const obj = p as Record<string, unknown>;
          // Support both cloudinary uploads { url } and google photos { photo_reference }
          return (obj.url as string) ?? (obj.photo_reference as string) ?? null;
        }
        return null;
      })
      .filter((url): url is string => url !== null);
  }

  private extractEntranceDirection(
    entranceDirection: Prisma.JsonValue,
  ): { degrees: number; cardinal: string; label: string } | null {
    if (!entranceDirection || typeof entranceDirection !== 'object')
      return null;
    const e = entranceDirection as Record<string, unknown>;
    if (typeof e.degrees === 'number' && typeof e.cardinal === 'string') {
      return {
        degrees: e.degrees,
        cardinal: e.cardinal,
        label: (e.label as string) ?? `${e.degrees}° ${e.cardinal}`,
      };
    }
    return null;
  }

  /**
   * Extract onsite capture data (including photoUrls) from metadata JSON.
   * Available to all users (free, guest, and paid).
   */
  private extractOnsiteCaptures(
    metadata: Prisma.JsonValue,
  ): {
    totalLevels?: number;
    totalCaptures?: number;
    captures?: SharedReportCapture[];
  } {
    if (!metadata || typeof metadata !== 'object') {
      return {};
    }

    const m = metadata as Record<string, unknown>;
    if (m.reportMode !== 'onsite') {
      return {};
    }

    const totalLevels = typeof m.totalLevels === 'number' ? m.totalLevels : 0;
    const totalCaptures =
      typeof m.totalCaptures === 'number' ? m.totalCaptures : 0;
    const rawCaptures = Array.isArray(m.captures) ? m.captures : [];

    const captures: SharedReportCapture[] = rawCaptures.map((c: unknown) => {
      const cap = (c ?? {}) as Record<string, unknown>;
      return {
        id: (cap.id as string) ?? '',
        captureType: (cap.captureType as string) ?? '',
        bearingDegrees: (cap.bearingDegrees as number) ?? 0,
        cardinal: (cap.cardinal as string) ?? '',
        isMainEntrance: (cap.isMainEntrance as boolean) ?? false,
        notes: (cap.notes as string | null | undefined) ?? null,
        createdAt:
          typeof cap.createdAt === 'string' || typeof cap.createdAt === 'object'
            ? new Date(cap.createdAt as string | Date)
            : new Date(),
        photoUrls: Array.isArray(cap.photoUrls)
          ? (cap.photoUrls as string[])
          : [],
      };
    });

    return { totalLevels, totalCaptures, captures };
  }
}
