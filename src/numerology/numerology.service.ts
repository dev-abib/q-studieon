import { BadRequestException, Injectable } from '@nestjs/common';
import { AddressDto } from './dto/numerlogoy.dto';

@Injectable()
export class NumerologyService {
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

  private sanitizeAddress(
    address: string,
    options?: {
      includePostalCode?: boolean;
    },
  ): string {
    let cleaned = address;

    // Remove postal codes (4-6 consecutive digits) by default
    if (!options?.includePostalCode) {
      cleaned = cleaned.replace(/\b\d{4,6}\b/g, '');
    }

    // Remove punctuation but keep letters/numbers/spaces
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

  calculateAddressNumber(address: string) {
    // Prefer leading building number
    const match = address.trim().match(/^(\d+)/);

    if (!match) {
      throw new BadRequestException('No building number found');
    }

    const raw = match[1];

    const total = raw.split('').reduce((sum, digit) => sum + Number(digit), 0);

    return {
      raw,
      total,
      reduced: this.reduceNumber(total),
    };
  }

  calculateFullAddress(
    address: string,
    options?: {
      includePostalCode?: boolean;
    },
  ) {
    const sanitized = this.sanitizeAddress(address, options);
    const total = this.textToNumber(sanitized);

    return {
      raw: sanitized,
      total,
      reduced: this.reduceNumber(total),
    };
  }

  createReport(dto: AddressDto) {
    return {
      success: true,
      message: 'done',
      data: {
        addressNumber: this.calculateAddressNumber(dto.address),
        fullAddress: this.calculateFullAddress(dto.address, {
          includePostalCode: false,
        }),
      },
    };
  }
}
