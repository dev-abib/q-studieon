import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateReportDto } from 'src/report/dto/create-report.dto';

interface NumerologyMeaning {
  tags: string[];
  supportiveIndicators: string[];
  challengeIndicators: string[];
}

export interface NumerologyResult {
  raw: string;
  compound: number;
  reduced: number;
  tags: string[];
  supportiveIndicators: string[];
  challengeIndicators: string[];
}

@Injectable()
export class NumerologyHelpers {
  private readonly chart: Record<string, number> = {
    A: 1,
    B: 2,
    C: 3,
    D: 4,
    E: 5,
    F: 6,
    G: 7,
    H: 8,
    I: 9,
    J: 1,
    K: 2,
    L: 3,
    M: 4,
    N: 5,
    O: 6,
    P: 7,
    Q: 8,
    R: 9,
    S: 1,
    T: 2,
    U: 3,
    V: 4,
    W: 5,
    X: 6,
    Y: 7,
    Z: 8,
  };

  private readonly masterNumbers = [11, 22, 33];

  /**
   * Backend-controlled numerology meaning map.
   * AI should NEVER invent these.
   */
  private readonly meanings: Record<number, NumerologyMeaning> = {
    1: {
      tags: ['leadership', 'independence'],
      supportiveIndicators: ['initiative', 'forward movement'],
      challengeIndicators: ['impatience', 'over-control'],
    },
    2: {
      tags: ['balance', 'partnership'],
      supportiveIndicators: ['cooperation', 'emotional harmony'],
      challengeIndicators: ['sensitivity', 'indecision'],
    },
    3: {
      tags: ['creativity', 'expression'],
      supportiveIndicators: ['social warmth', 'communication'],
      challengeIndicators: ['scattered focus', 'overextension'],
    },
    4: {
      tags: ['stability', 'structure'],
      supportiveIndicators: ['discipline', 'reliability'],
      challengeIndicators: ['rigidity', 'slow adaptation'],
    },
    5: {
      tags: ['change', 'movement'],
      supportiveIndicators: ['adaptability', 'curiosity'],
      challengeIndicators: ['restlessness', 'inconsistency'],
    },
    6: {
      tags: ['family', 'responsibility'],
      supportiveIndicators: ['nurturing energy', 'home harmony'],
      challengeIndicators: ['over-responsibility', 'perfectionism'],
    },
    7: {
      tags: ['reflection', 'analysis'],
      supportiveIndicators: ['inner clarity', 'thoughtfulness'],
      challengeIndicators: ['withdrawal', 'overthinking'],
    },
    8: {
      tags: ['authority', 'material structure'],
      supportiveIndicators: ['long-term planning', 'financial discipline'],
      challengeIndicators: ['pressure', 'work imbalance'],
    },
    9: {
      tags: ['completion', 'humanitarian energy'],
      supportiveIndicators: ['compassion', 'broad perspective'],
      challengeIndicators: ['emotional heaviness', 'difficulty letting go'],
    },
    11: {
      tags: ['intuition', 'vision'],
      supportiveIndicators: ['inspiration', 'heightened awareness'],
      challengeIndicators: ['emotional intensity', 'nervous energy'],
    },
    22: {
      tags: ['master builder', 'large-scale vision'],
      supportiveIndicators: ['practical ambition', 'strong foundations'],
      challengeIndicators: ['high pressure', 'burnout risk'],
    },
    33: {
      tags: ['service', 'compassionate leadership'],
      supportiveIndicators: ['guidance', 'supportive atmosphere'],
      challengeIndicators: ['self-sacrifice', 'emotional exhaustion'],
    },
  };

  private sumDigits(num: number): number {
    return num
      .toString()
      .split('')
      .reduce((sum, digit) => sum + Number(digit), 0);
  }

  private reduceNumber(total: number): number {
    if (total <= 9 || this.masterNumbers.includes(total)) {
      return total;
    }
    return this.reduceNumber(this.sumDigits(total));
  }

  /**
   * English-only sanitization.
   * Preserves building names for better numerology richness.
   */
  private sanitizeAddress(
    address: string,
    options?: { includePostalCode?: boolean },
  ): string {
    let cleaned = address;

    // Remove postal codes (4-6 digits)
    if (!options?.includePostalCode) {
      cleaned = cleaned.replace(/\b\d{4,6}\b/g, '');
    }

    // Remove punctuation but preserve letters/numbers/spaces
    cleaned = cleaned.replace(/[^a-zA-Z0-9\s]/g, ' ');

    // Normalize spaces
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    return cleaned;
  }

  private textToNumber(text: string): number {
    let total = 0;

    for (const char of text.toUpperCase()) {
      if (this.chart[char]) {
        total += this.chart[char];
      } else if (!isNaN(Number(char)) && char !== ' ') {
        total += Number(char);
      }
    }

    return total;
  }

  private buildMeaningPayload(number: number): NumerologyMeaning {
    return (
      this.meanings[number] || {
        tags: [],
        supportiveIndicators: [],
        challengeIndicators: [],
      }
    );
  }

  calculateAddressNumber(address: string): NumerologyResult {
    // Try leading number first
    let match = address.trim().match(/^(\d+)/);

    // Fallback: any number inside address
    if (!match) {
      match = address.match(/\b(\d+)\b/);
    }

    if (!match) {
      throw new BadRequestException('No building number found');
    }

    const raw = match[1];

    // Example: 275 -> 2+7+5 = 14
    const compound = raw
      .split('')
      .reduce((sum, digit) => sum + Number(digit), 0);

    const reduced = this.reduceNumber(compound);
    const meanings = this.buildMeaningPayload(reduced);

    return {
      raw,
      compound,
      reduced,
      tags: meanings.tags,
      supportiveIndicators: meanings.supportiveIndicators,
      challengeIndicators: meanings.challengeIndicators,
    };
  }

  calculateFullAddress(
    address: string,
    options?: { includePostalCode?: boolean },
  ): NumerologyResult {
    const sanitized = this.sanitizeAddress(address, options);
    const compound = this.textToNumber(sanitized);
    const reduced = this.reduceNumber(compound);
    const meanings = this.buildMeaningPayload(reduced);

    return {
      raw: sanitized,
      compound,
      reduced,
      tags: meanings.tags,
      supportiveIndicators: meanings.supportiveIndicators,
      challengeIndicators: meanings.challengeIndicators,
    };
  }

  createReport(dto: CreateReportDto) {
    const addressNumber = this.calculateAddressNumber(dto.address);

    const fullAddress = this.calculateFullAddress(dto.address, {
      includePostalCode: false,
    });

    // FIX: challengeIndicators are now included in numerologySummary so
    // AiHelper.calculateAlignment() can factor them into the overall score.
    return {
      numerologySystem: 'pythagorean',

      addressNumber,

      fullAddress,

      numerologySummary: {
        primaryEnergy: [
          ...new Set([...addressNumber.tags, ...fullAddress.tags]),
        ],

        supportiveIndicators: [
          ...new Set([
            ...addressNumber.supportiveIndicators,
            ...fullAddress.supportiveIndicators,
          ]),
        ],

        // Previously present on individual results but never surfaced here —
        // now included so the alignment engine can deduct from the score.
        challengeIndicators: [
          ...new Set([
            ...addressNumber.challengeIndicators,
            ...fullAddress.challengeIndicators,
          ]),
        ],
      },

      confidence: {
        level: 'high',
        notes: [
          'Numerology calculated using sanitized English-language address formatting.',
        ],
      },
    };
  }
}
