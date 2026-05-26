import { Injectable, InternalServerErrorException } from '@nestjs/common';
import OpenAI from 'openai';
import type { CompletionUsage } from 'openai/resources';
import {
  AiHelper,
  AiReportInput,
  AiReportOutput,
  BackendPayload,
} from '../../auth/helpers/ai-helper';
import { OnsiteCaptureData } from '../types/onsite-report.types';
import { CaptureType } from './dto/add.capture.dto';

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface OnsiteAiReportInput extends AiReportInput {
  captures: OnsiteCaptureData[];
}

interface RoomEnergyProfile {
  element: string;
  tags: string[];
  supportiveNotes: string[];
  challengeNotes: string[];
}

interface RoomAnalysis {
  captureType: CaptureType;
  cardinal: string;
  bearingDegrees: number;
  isMainEntrance: boolean;
  energyProfile: RoomEnergyProfile;
}

// Keyed by the same 4 cardinals the base class uses — consistent with
// analyzeFengShui() and analyzeVastu() in ai-helper.ts
const ROOM_ENERGY: Record<string, RoomEnergyProfile> = {
  N: {
    element: 'Water',
    tags: ['career', 'introspection', 'wisdom'],
    supportiveNotes: [
      'supports focus and deep analytical thinking',
      'calm routines and quiet work thrive here',
    ],
    challengeNotes: [
      'can feel isolating if poorly lit or ventilated',
      'cold water energy may reduce social warmth',
    ],
  },
  S: {
    element: 'Fire',
    tags: ['fame', 'social energy', 'passion'],
    supportiveNotes: [
      'enhances visibility and vitality',
      'social gatherings and shared meals thrive here',
    ],
    challengeNotes: [
      'excessive fire energy can cause restlessness',
      'keep this area clutter-free to avoid overstimulation',
    ],
  },
  E: {
    element: 'Wood',
    tags: ['health', 'new beginnings', 'optimism'],
    supportiveNotes: [
      'morning light amplifies fresh-start energy',
      'supports family health and youthful vitality',
    ],
    challengeNotes: [
      'may feel overstimulating during high-activity periods',
      'wood energy needs space — avoid overcrowding',
    ],
  },
  W: {
    element: 'Metal',
    tags: ['discipline', 'stability', 'harvest'],
    supportiveNotes: [
      'supports long-term planning and focused routines',
      'grounding energy benefits structured spaces',
    ],
    challengeNotes: [
      'energy can feel rigid or slow if the space is overloaded',
      'too much metal decor can suppress warmth',
    ],
  },
};

// Which life aspects each room type influences — injected into the AI prompt
// so the model knows to weave that room's data into the right section.
const ROOM_LIFE_ASPECT_MAP: Partial<Record<CaptureType, string[]>> = {
  [CaptureType.FRONT_ENTRANCE]: [
    'entrance_energy',
    'feng_shui',
    'vastu',
    'overall_score',
  ],
  [CaptureType.BED]: ['relationships', 'romance_and_partnership', 'daily_life'],
  [CaptureType.KITCHEN]: ['wealth_and_stability', 'daily_life', 'family'],
  [CaptureType.OFFICE]: ['career', 'wealth_and_stability'],
  [CaptureType.SOFA]: ['family', 'daily_life', 'relationships'],
  [CaptureType.WASHROOM]: ['daily_life'],
};

// ---------------------------------------------------------------------------

@Injectable()
export class OnsiteAiHelper extends AiHelper {
  private readonly onsiteOpenai: OpenAI;

  constructor() {
    super();
    this.onsiteOpenai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  // ── Cardinal from bearing — uses the same 4-point logic as base AiHelper ──
  // (base class has a private getCardinalDirection; we expose it here for
  //  capture processing without duplicating the logic differently)

  getCardinalFromBearing(bearing: number): string {
    if (bearing >= 315 || bearing < 45) return 'N';
    if (bearing >= 45 && bearing < 135) return 'E';
    if (bearing >= 135 && bearing < 225) return 'S';
    return 'W';
  }

  // ── Analyse each capture into a room energy profile ───────────────────────

  private analyzeRoomCaptures(captures: OnsiteCaptureData[]): RoomAnalysis[] {
    return captures.map((c) => {
      const cardinal = this.getCardinalFromBearing(c.bearingDegrees);
      const energyProfile = ROOM_ENERGY[cardinal] ?? ROOM_ENERGY['E'];

      return {
        captureType: c.captureType,
        cardinal,
        bearingDegrees: c.bearingDegrees,
        isMainEntrance: c.isMainEntrance,
        energyProfile,
      };
    });
  }

  // ── Build room context block injected into the AI user prompt ─────────────

  private buildRoomContextBlock(analyses: RoomAnalysis[]): string {
    if (!analyses.length) return 'No additional room captures provided.';

    const lines = analyses.map((r) => {
      const label = r.captureType
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
      const entrance = r.isMainEntrance ? ' [MAIN ENTRANCE]' : '';
      const aspects =
        ROOM_LIFE_ASPECT_MAP[r.captureType]?.join(', ') ?? 'general';

      return [
        `• ${label}${entrance}`,
        `  Bearing     : ${r.bearingDegrees}° ${r.cardinal}`,
        `  Element     : ${r.energyProfile.element}`,
        `  Tags        : ${r.energyProfile.tags.join(', ')}`,
        `  Supportive  : ${r.energyProfile.supportiveNotes.join('; ')}`,
        `  Challenges  : ${r.energyProfile.challengeNotes.join('; ')}`,
        `  Affects     : ${aspects}`,
      ].join('\n');
    });

    return `On-Site Room Captures:\n\n${lines.join('\n\n')}`;
  }

  // ── System prompt — extends base prompt with room context rules ───────────

  private readonly ONSITE_SYSTEM_PROMPT = `
You are the AI narrative layer for Home Direction Analyzer — On-Site Mode.

ABSOLUTE RULES (never break these):
- All numbers, scores, tags, and flags come from the backend payload. NEVER invent or recalculate them.
- NEVER use fear-based language. NEVER guarantee outcomes. NEVER recommend buying or selling.
- NEVER output markdown. NEVER output anything outside the JSON object.
- If a field is marked "locked" in the payload, write "locked" as its value in the output.

ROOM CONTEXT RULES:
- The payload contains a "room_context" block listing each on-site captured room with its bearing, element, tags, and which life aspects it influences.
- bed direction directly shapes "relationships" and "romance_and_partnership" narratives.
- kitchen direction directly shapes "wealth_and_stability" and "daily_life" narratives.
- office direction directly shapes "career" narrative.
- sofa direction directly shapes "family" and "daily_life" narratives.
- main entrance drives "entrance_energy", "feng_shui", "vastu", and "overall_score".
- Every life_aspect narrative MUST reference the relevant room's cardinal direction and element if a capture exists for it.
- Cross-reference each room's element against the numerology theme to find synergy or tension and mention it in the narrative.
- Do NOT contradict any backend numbers, scores, or flags.

You must return ONLY a valid JSON object that matches this exact schema.
Every field is required. Do not add or remove keys.

{
  "overall_alignment_summary": string,
  "overview": string,
  "entrance_direction": {
    "degrees": number,
    "cardinal": string,
    "label": string
  },
  "entrance_energy": {
    "narrative": string,
    "tags": string[],
    "confidence_level": string,
    "confidence_note": string
  },
  "numerology": {
    "address_number": number,
    "full_address_number": number,
    "theme": string,
    "tags": string[],
    "narrative": string
  },
  "feng_shui": {
    "tags": string[],
    "narrative": string,
    "rule_summary": string
  },
  "vastu": {
    "tags": string[],
    "narrative": string,
    "rule_summary": string
  },
  "indicators": {
    "supportive": string[],
    "red_flags": string[]
  },
  "practical_remedies": string[],
  "life_aspects": {
    "relationships":           { "flags": string[], "narrative": string },
    "career":                  { "flags": string[], "narrative": string },
    "family":                  { "flags": string[], "narrative": string },
    "romance_and_partnership": { "flags": string[], "narrative": string },
    "wealth_and_stability":    { "flags": string[], "narrative": string },
    "daily_life":              { "flags": string[], "narrative": string }
  },
  "family_flow": {
    "summary": string,
    "narrative": string
  },
  "helpful_tips": string[],
  "auspiciousness": {
    "level": string,
    "summary": string
  },
  "overall_score": number
}
`.trim();

  // ── Main generation — same structure as generateByAccessLevel in base ──────

  async generateOnsiteReport(input: OnsiteAiReportInput): Promise<{
    success: boolean;
    data: AiReportOutput;
    metadata: {
      model: string;
      usage: CompletionUsage | undefined;
      finishReason: string | null;
    };
  }> {
    try {
      // Use the base class engine — same payload builder as remote reports
      const backendData: BackendPayload = this.buildBackendPayload(input);

      // Layer on room context — onsite-only addition
      const roomAnalyses = this.analyzeRoomCaptures(input.captures);
      const roomContextBlock = this.buildRoomContextBlock(roomAnalyses);

      const onsitePayload = {
        ...backendData,
        report_mode: 'onsite',
        captures_total: input.captures.length,
        room_context: roomContextBlock,
      };

      const completion = await this.onsiteOpenai.chat.completions.create({
        model: 'gpt-4.1-mini',
        temperature: 0.4,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: this.ONSITE_SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Generate a Home Direction Analyzer on-site report using the backend payload below.\n\nFollow the exact JSON schema from the system prompt. Every key is required. Do not add or remove keys. Do not output anything outside the JSON object.\n\nBackend Payload:\n${JSON.stringify(onsitePayload, null, 2)}`,
          },
        ],
      });

      const content = completion.choices?.[0]?.message?.content;
      if (!content) throw new InternalServerErrorException('Empty AI response');

      const data = JSON.parse(content) as AiReportOutput;

      return {
        success: true,
        data,
        metadata: {
          model: completion.model,
          usage: completion.usage,
          finishReason: completion.choices?.[0]?.finish_reason ?? null,
        },
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[OnsiteAiHelper] generateOnsiteReport failed:', message);
      throw new InternalServerErrorException(
        'Failed to generate on-site AI report',
      );
    }
  }
}
