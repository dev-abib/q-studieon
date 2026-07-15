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

export interface SharedReportFullData {
  report: Record<string, unknown>;
  accessLevel: 'paid_full' | 'free_preview' | 'guest_preview';
  reportType: string;
}

export interface GetSharedReportFullResponse {
  success: boolean;
  data: SharedReportFullData;
}

