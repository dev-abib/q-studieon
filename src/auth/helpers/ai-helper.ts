import { Injectable, InternalServerErrorException } from '@nestjs/common';
import OpenAI from 'openai';

export enum ReportAccessLevel {
  GUEST_PREVIEW = 'guest_preview',
  FREE_PREVIEW = 'free_preview',
  PAID_FULL = 'paid_full',
}

export interface AiReportInput {
  address: string;

  numerologyDetails: {
    addressNumber: {
      reduced: number;
      tags: string[];
      supportiveIndicators: string[];
      challengeIndicators: string[];
    };

    fullAddress: {
      reduced: number;
    };

    numerologySummary: {
      primaryEnergy: string[];
      supportiveIndicators: string[];
      challengeIndicators: string[];
    };
  };

  entranceBearing: number;

  userConfirmedDirection?: boolean;
}

export interface DirectionAnalysis {
  entrance_bearing_degrees: number;
  entrance_cardinal: string;
  cardinal_family: string;
  visual_confidence_level: string;
  directional_confidence_note: string;
  street_view_available: boolean;
  user_confirmed_direction: boolean;
}

export interface FengShuiAnalysis {
  feng_shui_tags: string[];
  supportive_indicators: string[];
  red_flag_indicators: string[];
  practical_remedies: string[];
  feng_shui_rule_summary: string;
}

export interface VastuAnalysis {
  vastu_tags: string[];
  vastu_rule_summary: string;
}

export interface AlignmentAnalysis {
  auspiciousness_level: string;
  overall_score: number;
}

export interface BackendPayload {
  selected_lens?: string;
  normalized_address?: string;
  address_display_mode?: string;

  entrance_bearing_degrees?: number | string;
  entrance_cardinal?: string;
  cardinal_family?: string;

  numerology_address_number?: number | string;
  numerology_full_address_number?: number | string;
  numerology_theme?: string; // ✅ NEW: Power & Stability label

  street_view_available?: boolean;
  user_confirmed_direction?: boolean;

  visual_confidence_level?: string;
  directional_confidence_note?: string;

  feng_shui_tags?: string[];
  vastu_tags?: string[];
  numerology_tags?: string[];

  auspiciousness_level?: string;
  supportive_indicators?: string[];
  red_flag_indicators?: string[];
  practical_remedies?: string[];

  relationship_flags?: string[];
  career_flags?: string[];
  family_flags?: string[];
  romance_partner_flags?: string[];
  wealth_stability_flags?: string[];
  daily_life_flags?: string[];

  family_flow_summary?: string;
  helpful_tips?: string[];

  feng_shui_rule_summary?: string;
  vastu_rule_summary?: string;
  numerology_rule_summary?: string;
  auspiciousness_rule_summary?: string;

  overall_score?: number;
}

/**
 * Mirrors the exact JSON schema the AI is instructed to return.
 */
export interface AiReportOutput {
  overall_alignment_summary: string;
  overview: string;

  // ✅ NEW: entrance direction with degrees + cardinal for the UI header
  entrance_direction: {
    degrees: number;
    cardinal: string;
    label: string; // e.g. "275° W"
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
    theme: string; // ✅ NEW: e.g. "Power & Stability"
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

// ---------------------------------------------------------------------------
// Direction-aware flag tables
// ---------------------------------------------------------------------------

interface LifeAreaFlags {
  relationship: string[];
  career: string[];
  family: string[];
  romance_partner: string[];
  wealth_stability: string[];
  daily_life: string[];
  family_flow_summary: string;
  helpful_tips: string[];
}

const DIRECTION_FLAGS: Record<string, LifeAreaFlags> = {
  N: {
    relationship: [
      'introspective communication style',
      'depth over breadth in connections',
    ],
    career: [
      'supports independent and analytical work',
      'favours research and strategy roles',
    ],
    family: ['quiet household rhythm', 'values privacy and personal space'],
    romance_partner: [
      'calm and considered emotional expression recommended',
      'avoid emotional suppression',
    ],
    wealth_stability: [
      'steady accumulation favoured over speculation',
      'long-term savings mindset',
    ],
    daily_life: [
      'morning routines benefit from stillness',
      'avoid overcommitting socially',
    ],
    family_flow_summary:
      'A north-facing entrance brings a reflective, inward quality to family dynamics. Members may value personal space and quiet connection. Shared rituals — a regular family meal, a calm evening routine — help maintain cohesion without overwhelming introverted household members.',
    helpful_tips: [
      'Place a bright lamp or warm-toned artwork near the entrance to offset the cooler northern energy.',
      'Keep the entrance corridor uncluttered to allow energy to move freely inward.',
      'Introduce living plants in the entryway to bring upward, growth-oriented energy.',
      'Avoid dark or heavy colours on the front door — opt for whites, creams, or warm neutrals.',
    ],
  },

  S: {
    relationship: [
      'open and expressive communication style',
      'warmth in social interactions',
    ],
    career: [
      'supports visibility and public-facing roles',
      'favours leadership and creative work',
    ],
    family: [
      'active and socially engaged household',
      'high energy may need intentional calm zones',
    ],
    romance_partner: [
      'passionate expression is natural',
      'create quiet spaces to balance intensity',
    ],
    wealth_stability: [
      'growth opportunities are present',
      'guard against impulsive financial decisions',
    ],
    daily_life: [
      'high activity days are common',
      'schedule deliberate downtime to avoid burnout',
    ],
    family_flow_summary:
      'A south-facing entrance brings lively, outward energy to family life. The home tends to feel open and socially active. To balance this, designate quieter areas within the home — a reading nook or a calm bedroom — where family members can decompress away from the entrance energy.',
    helpful_tips: [
      'Use a red or deep-toned front door accent to channel the fire energy of the south positively.',
      'Add a water feature (small fountain or bowl) near the entrance to moderate excessive fire energy.',
      'Keep the entrance well-lit and welcoming — south entrances benefit from strong, confident presentation.',
      'Avoid mirrors directly facing the front door, which can push energy back out.',
    ],
  },

  E: {
    relationship: [
      'communication balance',
      'growth-oriented social interactions',
    ],
    career: [
      'supports disciplined work',
      'favours innovation and forward momentum',
    ],
    family: ['stable household atmosphere', 'encourages healthy routines'],
    romance_partner: [
      'soft visual tones recommended',
      'fresh energy supports new beginnings',
    ],
    wealth_stability: [
      'long-term consistency',
      'favourable for gradual wealth building',
    ],
    daily_life: [
      'transition flow variations',
      'mornings are energetically strong',
    ],
    family_flow_summary:
      'An east-facing entrance channels the energy of new beginnings and growth into the home. Family dynamics tend to be forward-looking and optimistic. This direction supports healthy morning routines and progressive household goals. Encourage open family conversations and shared planning.',
    helpful_tips: [
      'Use green or wooden accents near the entrance to amplify the wood element associated with the east.',
      'Keep windows near the entrance clean to maximise morning light.',
      'A small welcome mat with earthy tones helps ground the upward growth energy.',
      'Avoid metallic or heavy stone décor at the entrance, which can suppress the wood-element energy.',
    ],
  },

  W: {
    relationship: [
      'structured and reliable communication patterns',
      'consistency builds trust',
    ],
    career: [
      'supports long-term planning and financial discipline',
      'favours methodical execution',
    ],
    family: [
      'grounded family structure',
      'predictable routines benefit household wellbeing',
    ],
    romance_partner: [
      'stability and dependability are strengths',
      'introduce spontaneity to keep energy fresh',
    ],
    wealth_stability: [
      'strong foundation for wealth preservation',
      'suitable for property and asset-based growth',
    ],
    daily_life: [
      'evenings are energetically strong',
      'routines and structure feel natural',
    ],
    family_flow_summary:
      'A west-facing entrance brings grounded, harvest-like energy to the household. Family life tends to be stable and predictable, which can be deeply comforting. To prevent stagnation, introduce variety in shared activities — new experiences and outings help keep the household energy vibrant.',
    helpful_tips: [
      'Use metallic accents (gold, silver, or copper tones) near the entrance to complement western metal energy.',
      'Add a wind chime near the entrance to activate and circulate incoming energy.',
      'Keep the entrance area well-maintained — peeling paint or worn fixtures have a stronger negative effect on west-facing homes.',
      'Use earth tones (terracotta, sand, warm beige) to support and ground the metal energy.',
    ],
  },
};

// ---------------------------------------------------------------------------
// Numerology theme map — maps reduced number → UI label
// ---------------------------------------------------------------------------
const NUMEROLOGY_THEMES: Record<number, string> = {
  1: 'Leadership & Independence',
  2: 'Balance & Partnership',
  3: 'Creativity & Expression',
  4: 'Power & Stability',
  5: 'Change & Movement',
  6: 'Family & Responsibility',
  7: 'Reflection & Analysis',
  8: 'Authority & Abundance',
  9: 'Completion & Wisdom',
  11: 'Intuition & Vision',
  22: 'Master Builder',
  33: 'Compassionate Leadership',
};

// ---------------------------------------------------------------------------

@Injectable()
export class AiHelper {
  private readonly openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  private readonly SYSTEM_PROMPT = `
You are the AI narrative layer for Home Direction Analyzer.

RULES (never break these):
- All numbers, tags, indicators, flags, and scores come from the backend payload. NEVER recalculate or invent them.
- NEVER use fear-based language. NEVER guarantee outcomes. NEVER recommend buying or selling.
- NEVER output markdown. NEVER output text outside the JSON object.
- If a field is marked "locked" in the payload, write "locked" for that field in the output.

You must return ONLY a valid JSON object that matches this exact schema.
Every field is required. Do not add or remove keys.

{
  "overall_alignment_summary": string,
    // 1–2 sentence plain-English summary of the home's overall energy alignment.

  "overview": string,
    // 4–6 sentence narrative combining entrance direction, feng shui, vastu, and numerology.

  "entrance_direction": {
    "degrees": number,
      // copy entrance_bearing_degrees from payload exactly
    "cardinal": string,
      // copy entrance_cardinal from payload exactly
    "label": string
      // format as "{degrees}° {cardinal}" e.g. "275° W"
  },

  "entrance_energy": {
    "narrative": string,
      // 2–3 sentences describing what the entrance direction means for daily energy flow.
    "tags": string[],
      // copy feng_shui_tags from payload
    "confidence_level": string,
      // copy visual_confidence_level from payload
    "confidence_note": string
      // copy directional_confidence_note from payload
  },

  "numerology": {
    "address_number": number,
      // copy numerology_address_number from payload
    "full_address_number": number,
      // copy numerology_full_address_number from payload
    "theme": string,
      // copy numerology_theme from payload verbatim
    "tags": string[],
      // copy numerology_tags from payload
    "narrative": string
      // copy numerology_rule_summary from payload, do not paraphrase
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
    "relationships": { "flags": string[], "narrative": string },
    "career": { "flags": string[], "narrative": string },
    "family": { "flags": string[], "narrative": string },
    "romance_and_partnership": { "flags": string[], "narrative": string },
    "wealth_and_stability": { "flags": string[], "narrative": string },
    "daily_life": { "flags": string[], "narrative": string }
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
`;

  // -------------------------------------------------------------------------
  // Engine functions
  // -------------------------------------------------------------------------

  analyzeDirection(bearing: number, userConfirmed = false): DirectionAnalysis {
    const cardinal = this.getCardinalDirection(bearing);

    return {
      entrance_bearing_degrees: bearing,
      entrance_cardinal: cardinal,
      cardinal_family: this.getCardinalFamily(cardinal),
      visual_confidence_level: userConfirmed ? 'high' : 'moderate',
      directional_confidence_note: userConfirmed
        ? 'Entrance direction confirmed by user.'
        : 'Entrance direction estimated from map imagery.',
      street_view_available: true,
      user_confirmed_direction: userConfirmed,
    };
  }

  private getCardinalDirection(degrees: number): string {
    if (degrees >= 315 || degrees < 45) return 'N';
    if (degrees >= 45 && degrees < 135) return 'E';
    if (degrees >= 135 && degrees < 225) return 'S';
    return 'W';
  }

  private getCardinalFamily(cardinal: string): string {
    switch (cardinal) {
      case 'N':
        return 'northern';
      case 'E':
        return 'eastern';
      case 'S':
        return 'southern';
      case 'W':
        return 'western';
      default:
        return 'unknown';
    }
  }

  analyzeFengShui(cardinal: string): FengShuiAnalysis {
    switch (cardinal) {
      case 'N':
        return {
          feng_shui_tags: ['water element', 'introspection', 'career energy'],
          supportive_indicators: [
            'supports career advancement and wisdom',
            'encourages deep thinking and focused work',
            'favourable for individuals in analytical roles',
          ],
          red_flag_indicators: [
            'can feel isolating if entrance is poorly lit',
            'cold energy may dampen social warmth',
          ],
          practical_remedies: [
            'add warm lighting at the entrance',
            'place a wooden element (plant or furniture) to balance water energy',
            'use a light, welcoming colour on the front door',
          ],
          feng_shui_rule_summary:
            'North-facing entrances carry water element energy, supporting career growth and wisdom. Balance with wood elements to avoid stagnant or overly cool energy.',
        };

      case 'S':
        return {
          feng_shui_tags: ['fire element', 'fame energy', 'social expansion'],
          supportive_indicators: [
            'enhances reputation and visibility',
            'supports creative and social endeavours',
            'high outward energy promotes opportunity',
          ],
          red_flag_indicators: [
            'excessive fire energy can create restlessness',
            'may amplify conflict if entrance is cluttered',
          ],
          practical_remedies: [
            'introduce a water feature near the entrance to moderate fire energy',
            'keep entrance tidy and open to channel fame energy productively',
            'use earthy tones in décor to ground the fire element',
          ],
          feng_shui_rule_summary:
            'South-facing entrances carry fire element energy, associated with fame, recognition, and social vitality. Moderation with water or earth elements prevents energy from becoming overwhelming.',
        };

      case 'E':
        return {
          feng_shui_tags: ['wood element', 'growth', 'new beginnings'],
          supportive_indicators: [
            'encourages fresh opportunities',
            'supports social flow',
            'morning light energises the entrance',
          ],
          red_flag_indicators: [
            'may feel overstimulating during peak growth phases',
          ],
          practical_remedies: [
            'maintain organised entry flow',
            'balance décor with calm earthy tones',
            'keep plants healthy — dying plants amplify negative wood energy',
          ],
          feng_shui_rule_summary:
            'East-facing entrances carry wood element energy, associated with growth, health, and new beginnings.',
        };

      case 'W':
        return {
          feng_shui_tags: ['metal element', 'stability', 'discipline'],
          supportive_indicators: [
            'stable entrance energy',
            'supports long-term planning',
            'structured outward flow',
          ],
          red_flag_indicators: ['energy may occasionally feel rigid or slow'],
          practical_remedies: [
            'increase natural lighting near entry',
            'soften hard visual lines with rounded décor',
            'reduce entrance clutter to allow chi to circulate',
          ],
          feng_shui_rule_summary:
            'West-facing entrances carry metal element energy, associated with structure, precision, and long-term stability.',
        };

      default:
        return {
          feng_shui_tags: ['balanced energy'],
          supportive_indicators: ['stable atmosphere'],
          red_flag_indicators: [],
          practical_remedies: [],
          feng_shui_rule_summary: 'General balanced entrance pattern.',
        };
    }
  }

  analyzeVastu(cardinal: string): VastuAnalysis {
    switch (cardinal) {
      case 'N':
        return {
          vastu_tags: ['kubera direction', 'wealth energy', 'career support'],
          vastu_rule_summary:
            'North is the direction of Kubera (the deity of wealth) in Vastu Shastra. A north-facing entrance is considered highly auspicious for financial prosperity and career growth. Keeping this entrance clutter-free is especially important.',
        };

      case 'S':
        return {
          vastu_tags: [
            'yama direction',
            'discipline energy',
            'requires remediation',
          ],
          vastu_rule_summary:
            'South is associated with Yama in Vastu Shastra and is traditionally considered a challenging direction for the main entrance. It can be balanced with appropriate remedies such as a Vastu pyramid at the entrance threshold, strong lighting, and avoiding dark or heavy colours on the door.',
        };

      case 'E':
        return {
          vastu_tags: [
            'surya direction',
            'solar energy',
            'health and prosperity',
          ],
          vastu_rule_summary:
            'East is the direction of Surya (the Sun) in Vastu Shastra and is considered one of the most auspicious directions for a main entrance. It invites solar energy, vitality, and prosperity into the home.',
        };

      case 'W':
        return {
          vastu_tags: [
            'varuna direction',
            'water energy',
            'moderate auspiciousness',
          ],
          vastu_rule_summary:
            'West is associated with Varuna (the deity of water and cosmic order) in Vastu Shastra. A west-facing entrance is considered moderately auspicious. It supports stability and methodical progress but benefits from active, well-lit décor to maintain energy flow.',
        };

      default:
        return {
          vastu_tags: ['neutral directional flow'],
          vastu_rule_summary: 'General balanced Vastu pattern.',
        };
    }
  }

  calculateAlignment(
    supportive: string[],
    redFlags: string[],
    numerologyChallenges: string[],
  ): AlignmentAnalysis {
    const supportiveScore = supportive.length;
    const redFlagScore = redFlags.length;
    const challengeScore = numerologyChallenges.length;

    const rawScore =
      62 + supportiveScore * 3.5 - redFlagScore * 5 - challengeScore * 3.5;
    const normalized = Math.round(Math.max(35, Math.min(95, rawScore)));

    let auspiciousness_level: string;
    if (normalized >= 85) {
      auspiciousness_level = 'highly supportive';
    } else if (normalized >= 70) {
      auspiciousness_level = 'supportive';
    } else if (normalized >= 55) {
      auspiciousness_level = 'balanced';
    } else {
      auspiciousness_level = 'needs attention';
    }

    return { overall_score: normalized, auspiciousness_level };
  }

  private buildNumerologyRuleSummary(
    addressReduced: number,
    fullAddressReduced: number,
    tags: string[],
  ): string {
    const tagPhrase =
      tags.length > 0 ? tags.slice(0, 3).join(', ') : 'balanced';
    return (
      `Address number ${addressReduced} combined with full-address number ${fullAddressReduced} ` +
      `creates a numerology profile centred on ${tagPhrase}. ` +
      `This pattern ${
        addressReduced === fullAddressReduced
          ? 'shows strong internal consistency between the building number and the full address'
          : 'shows a complementary interplay between the building number and the street energy'
      }.`
    );
  }

  buildBackendPayload(input: AiReportInput): BackendPayload {
    const direction = this.analyzeDirection(
      input.entranceBearing,
      input.userConfirmedDirection ?? false,
    );

    const fengShui = this.analyzeFengShui(direction.entrance_cardinal);
    const vastu = this.analyzeVastu(direction.entrance_cardinal);

    const alignment = this.calculateAlignment(
      [
        ...fengShui.supportive_indicators,
        ...input.numerologyDetails.numerologySummary.supportiveIndicators,
      ],
      [
        ...fengShui.red_flag_indicators,
        ...input.numerologyDetails.numerologySummary.challengeIndicators,
      ],
      input.numerologyDetails.numerologySummary.challengeIndicators,
    );

    const directionFlags =
      DIRECTION_FLAGS[direction.entrance_cardinal] ?? DIRECTION_FLAGS['E'];

    const numerologyRuleSummary = this.buildNumerologyRuleSummary(
      input.numerologyDetails.addressNumber.reduced,
      input.numerologyDetails.fullAddress.reduced,
      input.numerologyDetails.numerologySummary.primaryEnergy,
    );

    // ✅ Resolve numerology theme from the address number
    const numerologyTheme =
      NUMEROLOGY_THEMES[input.numerologyDetails.addressNumber.reduced] ??
      'Balanced Energy';

    return {
      selected_lens: 'combined',
      normalized_address: input.address,
      address_display_mode: 'full',

      ...direction,

      numerology_address_number: input.numerologyDetails.addressNumber.reduced,
      numerology_full_address_number:
        input.numerologyDetails.fullAddress.reduced,
      numerology_theme: numerologyTheme, // ✅ NEW

      numerology_tags: input.numerologyDetails.numerologySummary.primaryEnergy,

      feng_shui_tags: fengShui.feng_shui_tags,
      vastu_tags: vastu.vastu_tags,

      supportive_indicators: [
        ...fengShui.supportive_indicators,
        ...input.numerologyDetails.numerologySummary.supportiveIndicators,
      ],
      red_flag_indicators: [
        ...fengShui.red_flag_indicators,
        ...input.numerologyDetails.numerologySummary.challengeIndicators,
      ],
      practical_remedies: fengShui.practical_remedies,

      relationship_flags: directionFlags.relationship,
      career_flags: directionFlags.career,
      family_flags: directionFlags.family,
      romance_partner_flags: directionFlags.romance_partner,
      wealth_stability_flags: directionFlags.wealth_stability,
      daily_life_flags: directionFlags.daily_life,

      family_flow_summary: directionFlags.family_flow_summary,
      helpful_tips: directionFlags.helpful_tips,

      feng_shui_rule_summary: fengShui.feng_shui_rule_summary,
      vastu_rule_summary: vastu.vastu_rule_summary,
      numerology_rule_summary: numerologyRuleSummary,

      auspiciousness_rule_summary: alignment.auspiciousness_level,
      auspiciousness_level: alignment.auspiciousness_level,
      overall_score: alignment.overall_score,
    };
  }

  async generateByAccessLevel(
    accessLevel: ReportAccessLevel,
    input: AiReportInput,
  ) {
    try {
      const backendData = this.buildBackendPayload(input);
      const payload = this.buildPayloadByAccessLevel(accessLevel, backendData);

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4.1-mini',
        temperature: 0.4,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: this.SYSTEM_PROMPT },
          {
            role: 'user',
            content: `
Generate a Home Direction Analyzer report using the backend payload below.

Follow the exact JSON schema from the system prompt. Every key is required.
Do not add keys. Do not remove keys. Do not output anything outside the JSON object.

Backend Payload:
${JSON.stringify(payload, null, 2)}
`,
          },
        ],
      });

      const content = completion.choices?.[0]?.message?.content;

      if (!content) {
        throw new InternalServerErrorException('Invalid AI response');
      }

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
      console.error('[AiHelper] generateByAccessLevel failed:', message);
      throw new InternalServerErrorException('Failed to generate AI report');
    }
  }

  buildPayloadByAccessLevel(
    accessLevel: ReportAccessLevel,
    data: BackendPayload,
  ) {
    if (accessLevel === ReportAccessLevel.PAID_FULL) {
      return { access_level: accessLevel, ...data };
    }

    if (accessLevel === ReportAccessLevel.FREE_PREVIEW) {
      return {
        access_level: accessLevel,
        normalized_address: data.normalized_address,
        entrance_cardinal: 'locked',
        entrance_bearing_degrees: 'locked',
        supportive_indicators: data.supportive_indicators?.slice(0, 3) ?? [],
        red_flag_indicators: data.red_flag_indicators?.slice(0, 1) ?? [],
      };
    }

    // GUEST_PREVIEW
    return {
      access_level: accessLevel,
      normalized_address: data.normalized_address,
      entrance_cardinal: 'locked',
      entrance_bearing_degrees: 'locked',
      supportive_indicators: data.supportive_indicators?.slice(0, 1) ?? [],
    };
  }
}
