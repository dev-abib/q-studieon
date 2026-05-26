import { Prisma, Report } from '@prisma/client';
import { CaptureType } from '../helpers/dto/add.capture.dto';

// ── Capture ───────────────────────────────────────────────────────────────────

export interface OnsiteCaptureData {
  id: string;
  captureType: CaptureType;
  bearingDegrees: number;
  cardinal: string; // N | NE | E | SE | S | SW | W | NW
  isMainEntrance: boolean;
  notes?: string | null;
  createdAt: Date;
}

// ── Onsite metadata shape stored in Report.metadata ──────────────────────────

export interface OnsiteReportMetadata {
  reportMode: 'onsite';
  address: string;
  notes: string | null;
  mainEntranceType: string;
  mainCardinal: string;
  mainBearing: number;
  capturesTotal: number;
  captures: OnsiteCaptureData[];
}

// ── Prisma select shape for list endpoint ────────────────────────────────────

export const reportListSelect = {
  id: true,
  overallScore: true,
  auspiciousnessLevel: true,
  overview: true,
  createdAt: true,
  metadata: true,
} satisfies Prisma.ReportSelect;

export type ReportListItem = Prisma.ReportGetPayload<{
  select: typeof reportListSelect;
}>;

// ── Response shapes ───────────────────────────────────────────────────────────

export interface SubmitReportResponse {
  success: boolean;
  message: string;
  data: Report;
}

export interface GetReportsResponse {
  success: boolean;
  data: ReportListItem[];
}

export interface GetReportResponse {
  success: boolean;
  data: Prisma.ReportGetPayload<Record<string, never>>;
}
