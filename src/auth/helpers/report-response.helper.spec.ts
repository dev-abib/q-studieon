import { ReportAccessLevel } from './ai-helper';
import { getAccessLevel, buildReportResponse } from './report-response.helper';
import type { JwtPayload } from '../types/jwt.types';

// Minimal mock Report — only fields used by buildReportResponse
function mockReport(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'rpt_001',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    type: 'property_report',
    status: 'completed',
    overallScore: 72,
    auspiciousnessLevel: 'supportive',
    overview: 'A well-aligned property.',
    overallAlignmentSummary: 'Good energy flow overall.',
    auspiciousnessSummary: 'The property has supportive energy.',
    familyFlowSummary: 'Family dynamics are harmonious.',
    indicators: { supportive: ['good light'], red_flags: [] },
    helpfulTips: ['Add a plant near entrance'],
    entranceDirection: { degrees: 180, cardinal: 'S', label: '180° S' },
    entranceEnergy: {
      narrative: 'Warm',
      tags: ['fire'],
      confidence_level: 'high',
      confidence_note: '',
    },
    numerology: {
      address_number: 6,
      full_address_number: 8,
      theme: 'Family',
      tags: ['family'],
      narrative: 'Good',
    },
    fengShui: { tags: ['fire'], narrative: 'Strong', rule_summary: 'Balance' },
    vastu: {
      tags: ['south'],
      narrative: 'Needs attention',
      rule_summary: 'Remedies',
    },
    lifeAspects: {
      relationships: { flags: ['open'], narrative: 'Good' },
      career: { flags: ['steady'], narrative: 'Fine' },
      family: { flags: ['harmonious'], narrative: 'Great' },
      romance_and_partnership: { flags: ['warm'], narrative: 'Good' },
      wealth_and_stability: { flags: ['stable'], narrative: 'Fine' },
      daily_life: { flags: ['balanced'], narrative: 'Ok' },
    },
    practicalRemedies: ['Water feature'],
    familyFlowNarrative: 'Smooth flow',
    ...overrides,
  } as unknown as any;
}

describe('report-response.helper', () => {
  // -----------------------------------------------------------------------
  // getAccessLevel
  // -----------------------------------------------------------------------
  describe('getAccessLevel', () => {
    it('returns PAID_FULL when user.isPaid is true', () => {
      const user = { isPaid: true, isGuest: false } as JwtPayload;
      expect(getAccessLevel(user)).toBe(ReportAccessLevel.PAID_FULL);
    });

    it('returns GUEST_PREVIEW when user.isGuest is true (not paid)', () => {
      const user = { isPaid: false, isGuest: true } as JwtPayload;
      expect(getAccessLevel(user)).toBe(ReportAccessLevel.GUEST_PREVIEW);
    });

    it('returns FREE_PREVIEW when user is neither paid nor guest', () => {
      const user = { isPaid: false, isGuest: false } as JwtPayload;
      expect(getAccessLevel(user)).toBe(ReportAccessLevel.FREE_PREVIEW);
    });

    it('returns PAID_FULL even if guest when paid', () => {
      const user = { isPaid: true, isGuest: true } as JwtPayload;
      expect(getAccessLevel(user)).toBe(ReportAccessLevel.PAID_FULL);
    });
  });

  // -----------------------------------------------------------------------
  // buildReportResponse
  // -----------------------------------------------------------------------
  describe('buildReportResponse', () => {
    it('returns full report for PAID_FULL', () => {
      const saved = mockReport();
      const result = buildReportResponse(saved, ReportAccessLevel.PAID_FULL);

      expect(result.accessLevel).toBe('paid_full');
      expect(result.report).toBe(saved); // full object reference
    });

    it('returns locked fields for FREE_PREVIEW', () => {
      const saved = mockReport();
      const result = buildReportResponse(saved, ReportAccessLevel.FREE_PREVIEW);

      expect(result.accessLevel).toBe('free_preview');
      const r = result.report as Record<string, unknown>;
      expect(r.overview).toBe(saved.overview);
      expect(r.entranceDirection).toBe('locked');
      expect(r.entranceEnergy).toBe('locked');
      expect(r.numerology).toBe('locked');
      expect(r.fengShui).toBe('locked');
      expect(r.vastu).toBe('locked');
      expect(r.lifeAspects).toBe('locked');
    });

    it('returns locked fields + truncated overview for GUEST_PREVIEW', () => {
      const saved = mockReport({ overview: 'A'.repeat(500) });
      const result = buildReportResponse(
        saved,
        ReportAccessLevel.GUEST_PREVIEW,
      );

      expect(result.accessLevel).toBe('guest_preview');
      const r = result.report as Record<string, unknown>;
      expect(typeof r.overview).toBe('string');
      expect((r.overview as string).length).toBeLessThanOrEqual(200);
      expect(r.entranceDirection).toBe('locked');
      expect(r.numerology).toBe('locked');
    });

    it('keeps overallScore and auspiciousnessLevel in all access levels', () => {
      const saved = mockReport();
      for (const level of [
        ReportAccessLevel.PAID_FULL,
        ReportAccessLevel.FREE_PREVIEW,
        ReportAccessLevel.GUEST_PREVIEW,
      ]) {
        const result = buildReportResponse(saved, level);
        const r = result.report as Record<string, unknown>;
        expect(r.overallScore).toBe(72);
        expect(r.auspiciousnessLevel).toBe('supportive');
      }
    });
  });
});
