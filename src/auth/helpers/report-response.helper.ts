import { Report } from '@prisma/client';
import { ReportAccessLevel } from './ai-helper';
import type { JwtPayload } from '../types/jwt.types';

export function getAccessLevel(user: JwtPayload): ReportAccessLevel {
  if (user.isPaid) return ReportAccessLevel.PAID_FULL;
  if (user.isGuest) return ReportAccessLevel.GUEST_PREVIEW;
  return ReportAccessLevel.FREE_PREVIEW;
}

export interface ReportResponseBase {
  accessLevel: 'paid_full' | 'free_preview' | 'guest_preview';
}

export interface PaidFullData extends ReportResponseBase {
  accessLevel: 'paid_full';
  report: Report;
}

export interface PreviewData extends ReportResponseBase {
  accessLevel: 'free_preview' | 'guest_preview';
  report: Record<string, unknown>;
}

export type ReportData = PaidFullData | PreviewData;

export function buildReportResponse(
  saved: Report,
  accessLevel: ReportAccessLevel,
): ReportData {
  const base = {
    id: saved.id,
    createdAt: saved.createdAt,
    updatedAt: saved.updatedAt,
    type: saved.type,
    status: saved.status,
    overallScore: saved.overallScore,
    auspiciousnessLevel: saved.auspiciousnessLevel,
    overview: saved.overview,
  };

  if (accessLevel === ReportAccessLevel.PAID_FULL) {
    return {
      report: saved,
      accessLevel: 'paid_full',
    };
  }

  if (accessLevel === ReportAccessLevel.FREE_PREVIEW) {
    return {
      report: {
        ...base,
        overallAlignmentSummary: saved.overallAlignmentSummary,
        auspiciousnessSummary: saved.auspiciousnessSummary,
        familyFlowSummary: saved.familyFlowSummary,
        indicators: saved.indicators,
        helpfulTips: saved.helpfulTips,
        entranceDirection: 'locked',
        entranceEnergy: 'locked',
        numerology: 'locked',
        fengShui: 'locked',
        vastu: 'locked',
        lifeAspects: 'locked',
        practicalRemedies: 'locked',
        familyFlowNarrative: 'locked',
      },
      accessLevel: 'free_preview',
    };
  }

  return {
    report: {
      ...base,
      overview: saved.overview?.slice(0, 200) ?? null,
      overallAlignmentSummary: saved.overallAlignmentSummary,
      entranceDirection: 'locked',
      entranceEnergy: 'locked',
      numerology: 'locked',
      fengShui: 'locked',
      vastu: 'locked',
      indicators: 'locked',
      practicalRemedies: 'locked',
      helpfulTips: 'locked',
      lifeAspects: 'locked',
      familyFlowSummary: 'locked',
      familyFlowNarrative: 'locked',
    },
    accessLevel: 'guest_preview',
  };
}
