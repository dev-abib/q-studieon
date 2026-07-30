// ── Share Link Response (base) ──────────────────────────────────────────────

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

// ── Collection Share ────────────────────────────────────────────────────────

/** Minimal report data shown in a shared collection preview */
export interface SharedCollectionReportItem {
  id: string;
  type: string;
  status: string;
  overallScore: number | null;
  auspiciousnessLevel: string | null;
  overview: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  photos: unknown;
  createdAt: Date;
}

export interface SharedCollectionPreview {
  token: string;
  sharedBy: {
    name: string | null;
    profilePictureURL: string | null;
  };
  collection: {
    id: string;
    name: string;
    type: string;
    description: string | null;
    reportCount: number;
  };
  createdAt: Date;
}

export interface GetSharedCollectionPreviewResponse {
  success: boolean;
  data: SharedCollectionPreview;
}

export interface SharedCollectionFullData {
  collection: {
    id: string;
    name: string;
    type: string;
    description: string | null;
  };
  reports: Record<string, unknown>[];
  accessLevel: 'paid_full' | 'free_preview' | 'guest_preview';
}

export interface GetSharedCollectionFullResponse {
  success: boolean;
  data: SharedCollectionFullData;
}

// ── Comparison Share ────────────────────────────────────────────────────────

export interface SharedComparisonReportItem {
  id: string;
  type: string;
  overallScore: number | null;
  auspiciousnessLevel: string | null;
  overview: string | null;
  address: string | null;
  photos: unknown;
  createdAt: Date;
}

export interface SharedComparisonPreview {
  token: string;
  sharedBy: {
    name: string | null;
    profilePictureURL: string | null;
  };
  comparison: {
    report1: SharedComparisonReportItem;
    report2: SharedComparisonReportItem;
  };
  createdAt: Date;
}

export interface GetSharedComparisonPreviewResponse {
  success: boolean;
  data: SharedComparisonPreview;
}

export interface SharedComparisonFullData {
  report1: Record<string, unknown>;
  report2: Record<string, unknown>;
  accessLevel: 'paid_full' | 'free_preview' | 'guest_preview';
}

export interface GetSharedComparisonFullResponse {
  success: boolean;
  data: SharedComparisonFullData;
}
