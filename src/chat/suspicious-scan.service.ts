// src/chat/suspicious-scan.service.ts
import { Injectable } from '@nestjs/common';
import { SecurityAlertService } from '../admin/security-alert.service';

// ── Keyword / Pattern list ─────────────────────────────────────────────────────
// Extend freely. All matching is case-insensitive.
const SUSPICIOUS_KEYWORDS = [
  'password',
  'passwd',
  'secret',
  'api_key',
  'apikey',
  'access_token',
  'private_key',
  'credit card',
  'ssn',
  'social security',
  'bank account',
  'routing number',
  'wire transfer',
  'moneygram',
  'western union',
  'bribe',
  'kickback',
  'under the table',
  'hush money',
  'delete logs',
  'cover it up',
  'off the record',
];

const SUSPICIOUS_PATTERNS: Array<{ label: string; regex: RegExp }> = [
  // Credit card pattern (Visa, MC, AmEx, Discover)
  { label: 'Credit card number', regex: /\b(?:\d[ -]?){13,16}\b/ },
  // US SSN
  { label: 'US Social Security Number', regex: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/ },
  // Password: patterns like "password: abc123" or "pwd=secret"
  { label: 'Inline credential', regex: /\b(?:password|pwd|passwd|secret)\s*[:=]\s*\S+/i },
];

export interface ScanResult {
  flagged: boolean;
  reason: string | null;
}

@Injectable()
export class SuspiciousScanService {
  constructor(private readonly securityAlerts: SecurityAlertService) {}

  // ── Scan a single message ──────────────────────────────────────────────────
  scan(content: string): ScanResult {
    const lower = content.toLowerCase();

    // Keyword scan
    for (const kw of SUSPICIOUS_KEYWORDS) {
      if (lower.includes(kw)) {
        return { flagged: true, reason: `Suspicious keyword detected: "${kw}"` };
      }
    }

    // Regex pattern scan
    for (const { label, regex } of SUSPICIOUS_PATTERNS) {
      if (regex.test(content)) {
        return { flagged: true, reason: `Suspicious pattern detected: ${label}` };
      }
    }

    return { flagged: false, reason: null };
  }

  // ── Scan & raise alert if flagged (non-blocking, fire-and-forget) ──────────
  async scanAndAlert(params: {
    content: string;
    messageId: string;
    senderId: string;
    senderEmail: string;
    roomLabel: string; // e.g. "Group: Dev Team" or "DM: alice@dwellr.com"
  }): Promise<ScanResult> {
    const result = this.scan(params.content);

    if (result.flagged) {
      // Non-blocking — do not await
      void this.securityAlerts.createAlert({
        type: 'SUSPICIOUS_MESSAGE',
        severity: 'HIGH',
        staffId: params.senderId,
        staffEmail: params.senderEmail,
        title: `Suspicious message in ${params.roomLabel}`,
        description: `${result.reason}. Message ID: ${params.messageId}`,
        metadata: {
          messageId: params.messageId,
          senderId: params.senderId,
          roomLabel: params.roomLabel,
          contentSnippet: params.content.slice(0, 120),
        },
      });
    }

    return result;
  }
}
