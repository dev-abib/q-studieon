// ── Share Link Response ─────────────────────────────────────────────────────

export interface ShareReportResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    shareLink: string;
  };
}

// ── Preview (public, no auth) ───────────────────────────────────────────────

export interface SharedReportPreview {
  token: string;
  sharedBy: {
    name: string | null;
    profilePictureURL: string | null;
  };
  property: {
    address: string;
    photos: string[];
  };
  entrance: {
    degrees: number;
    cardinal: string;
    label: string;
  } | null;
  auspiciousnessLevel: string | null;
  overallScore: number | null;
  overview: string | null;
  reportType: string;
  createdAt: Date;
}

export interface GetSharedReportPreviewResponse {
  success: boolean;
  data: SharedReportPreview;
}

// ── Full Report (auth required) ─────────────────────────────────────────────

export interface SharedReportCapture {
  id: string;
  captureType: string;
  bearingDegrees: number;
  cardinal: string;
  isMainEntrance: boolean;
  notes?: string | null;
  createdAt: Date;
  photoUrls: string[];
}

export interface SharedReportFullData {
  report: Record<string, unknown>;
  accessLevel: 'paid_full' | 'free_preview' | 'guest_preview';
  reportType: string;
  /** Onsite-only: total number of levels */
  totalLevels?: number;
  /** Onsite-only: total number of captures */
  totalCaptures?: number;
  /** Onsite-only: structured captures with photoUrls */
  captures?: SharedReportCapture[];
}

export interface GetSharedReportFullResponse {
  success: boolean;
  data: SharedReportFullData;
}

