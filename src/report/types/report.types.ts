import type { Report } from '@prisma/client';

export interface AiReport {
  overall_alignment_summary: string;
  overview: string;

  entrance_direction: {
    degrees: number;
    cardinal: string;
    label: string;
  };

  entrance_energy: {
    narrative: string;
    tags: string[];
    confidence_level: string;
    confidence_note: string;
  };

  numerology: {
    address_number: number;
    full_address_number: number;
    theme: string;
    tags: string[];
    narrative: string;
  };

  feng_shui: {
    tags: string[];
    narrative: string;
    rule_summary: string;
  };

  vastu: {
    tags: string[];
    narrative: string;
    rule_summary: string;
  };

  indicators: {
    supportive: string[];
    red_flags: string[];
  };

  practical_remedies: string[];

  life_aspects: {
    relationships: { flags: string[]; narrative: string };
    career: { flags: string[]; narrative: string };
    family: { flags: string[]; narrative: string };
    romance_and_partnership: { flags: string[]; narrative: string };
    wealth_and_stability: { flags: string[]; narrative: string };
    daily_life: { flags: string[]; narrative: string };
  };

  family_flow: {
    summary: string;
    narrative: string;
  };

  helpful_tips: string[];

  auspiciousness: {
    level: string;
    summary: string;
  };

  overall_score: number;
}

export interface AiUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface AiMetadata {
  model: string;
  usage?: AiUsage;
  finishReason: string;
}

export interface AiResponse {
  data: AiReport;
  metadata: AiMetadata;
}

export interface CreateReportResponse {
  success: boolean;
  message: string;
  data: {
    report: Report | Record<string, unknown>;
    accessLevel: 'paid_full' | 'free_preview' | 'guest_preview';
  };
}
