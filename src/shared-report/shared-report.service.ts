import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ShareReportDto } from './dto/share-report.dto';
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
} from './types/shared-report.types';

@Injectable()
export class SharedReportService {
  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────────────────────────────────────────────────────────────
  // POST /shared-report/share/:reportId
  // ───────────────────────────────────────────────────────────────────────────

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
      throw new ForbiddenException(
        'You can only share your own reports.',
      );
    }

    // Check if this report was already shared by this user — return existing link
    const existing = await this.prisma.sharedReport.findFirst({
      where: { reportId, sharedById: user.id },
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

  // ───────────────────────────────────────────────────────────────────────────
  // GET /shared-report/:token  (public — no auth)
  // ───────────────────────────────────────────────────────────────────────────

  async getSharedReportPreview(
    token: string,
  ): Promise<GetSharedReportPreviewResponse> {
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
      throw new NotFoundException('Shared report not found or link is invalid.');
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
    const entrance = this.extractEntranceDirection(
      report.entranceDirection,
    );

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

  // ───────────────────────────────────────────────────────────────────────────
  // GET /shared-report/:token/full  (auth required)
  // ───────────────────────────────────────────────────────────────────────────

  async getSharedReportFull(
    token: string,
    user: JwtPayload,
  ): Promise<GetSharedReportFullResponse> {
    const shared = await this.prisma.sharedReport.findUnique({
      where: { token },
      include: { report: true },
    });

    if (!shared) {
      throw new NotFoundException('Shared report not found or link is invalid.');
    }

    const report = shared.report;

    // Determine access level for the viewing user
    const accessLevel = getAccessLevel(user);
    const { report: reportData, accessLevel: accessLvl } =
      buildReportResponse(report, accessLevel);

    return {
      success: true,
      data: {
        report: reportData as Record<string, unknown>,
        accessLevel: accessLvl,
        reportType: report.type,
      },
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // GET /shared-report/:token/check  (check if a token is valid)
  // ───────────────────────────────────────────────────────────────────────────

  async checkSharedReport(token: string): Promise<{ success: boolean; isValid: boolean }> {
    const shared = await this.prisma.sharedReport.findUnique({
      where: { token },
    });

    return {
      success: true,
      isValid: !!shared,
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
    if (
      typeof e.degrees === 'number' &&
      typeof e.cardinal === 'string'
    ) {
      return {
        degrees: e.degrees,
        cardinal: e.cardinal,
        label: (e.label as string) ?? `${e.degrees}° ${e.cardinal}`,
      };
    }
    return null;
  }
}
