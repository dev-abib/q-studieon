import { Test, TestingModule } from '@nestjs/testing';
import { ReportService } from './report.service';
import { PrismaService } from '../prisma/prisma.service';
import { PlaceDetailsHelper } from '../auth/helpers/place-details.helper';
import { NumerologyHelpers } from '../auth/helpers/numerology-helpers';
import { AiHelper, ReportAccessLevel } from '../auth/helpers/ai-helper';
import type { JwtPayload } from '../auth/types/jwt.types';

/**
 * Build a minimal Report-like object matching the fields buildReportResponse uses.
 */
function mockSaved(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rpt_001',
    userId: 'user_001',
    type: 'property_report',
    status: 'completed',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    overallScore: 72,
    auspiciousnessLevel: 'supportive',
    overview: 'A well-aligned property.',
    overallAlignmentSummary: 'Good energy flow overall.',
    auspiciousnessSummary: 'The property has supportive energy.',
    familyFlowSummary: 'Family dynamics are harmonious.',
    familyFlowNarrative: 'Smooth flow.',
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
    placeId: null,
    photos: null,
    aiModel: null,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    finishReason: null,
    metadata: null,
    ...overrides,
  };
}

describe('ReportService', () => {
  let service: ReportService;
  let prisma: { report: { create: jest.Mock; findMany: jest.Mock } };
  let generateByAccessLevel: jest.Mock;

  const mockUser: JwtPayload = {
    id: 'user_001',
    email: 'test@test.com',
    name: 'Test',
    role: 'user',
    isPaid: false,
    isGuest: false,
  };

  const mockPaidUser: JwtPayload = {
    id: 'user_002',
    email: 'paid@test.com',
    name: 'Paid',
    role: 'user',
    isPaid: true,
    isGuest: false,
  };

  const mockGuestUser: JwtPayload = {
    id: 'user_003',
    email: 'guest@test.com',
    name: 'Guest',
    role: 'user',
    isPaid: false,
    isGuest: true,
  };

  beforeEach(async () => {
    generateByAccessLevel = jest.fn().mockResolvedValue({
      success: true,
      data: {
        overall_alignment_summary: 'Good',
        overview: 'Nice property.',
        overall_score: 72,
        auspiciousness: { level: 'supportive', summary: 'Good' },
        entrance_direction: { degrees: 180, cardinal: 'S', label: '180° S' },
        entrance_energy: {
          narrative: 'Warm',
          tags: [],
          confidence_level: 'high',
          confidence_note: '',
        },
        numerology: {
          address_number: 6,
          full_address_number: 8,
          theme: 'Family',
          tags: [],
          narrative: '',
        },
        feng_shui: { tags: [], narrative: '', rule_summary: '' },
        vastu: { tags: [], narrative: '', rule_summary: '' },
        indicators: { supportive: [], red_flags: [] },
        practical_remedies: [],
        helpful_tips: [],
        life_aspects: {
          relationships: { flags: [], narrative: '' },
          career: { flags: [], narrative: '' },
          family: { flags: [], narrative: '' },
          romance_and_partnership: { flags: [], narrative: '' },
          wealth_and_stability: { flags: [], narrative: '' },
          daily_life: { flags: [], narrative: '' },
        },
        family_flow: { summary: '', narrative: '' },
      },
      metadata: {
        model: 'gpt-4.1-mini',
        usage: {
          prompt_tokens: 100,
          completion_tokens: 200,
          total_tokens: 300,
        },
        finishReason: 'stop',
      },
    });

    prisma = {
      report: {
        create: jest.fn().mockResolvedValue(mockSaved()),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: PlaceDetailsHelper,
          useValue: {
            getPlacePhotos: jest
              .fn()
              .mockResolvedValue([
                { place_id: 'place_001', photos: [{ photo_reference: 'p1' }] },
              ]),
          },
        },
        {
          provide: NumerologyHelpers,
          useValue: {
            createReport: jest.fn().mockReturnValue({
              addressNumber: {
                reduced: 6,
                tags: [],
                supportiveIndicators: [],
                challengeIndicators: [],
              },
              fullAddress: { reduced: 8 },
              numerologySummary: {
                primaryEnergy: [],
                supportiveIndicators: [],
                challengeIndicators: [],
              },
            }),
          },
        },
        {
          provide: AiHelper,
          useValue: { generateByAccessLevel },
        },
      ],
    }).compile();

    service = module.get<ReportService>(ReportService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createReport', () => {
    const dto = {
      address: '123 Test St',
      entranceDegrees: 180,
      latitude: 40.71,
      longitude: -74.0,
      entranceLabel: 'South',
    };

    it('returns gated response for free user', async () => {
      const result = await service.createReport(dto, mockUser);

      expect(result.success).toBe(true);
      expect(result.message).toBe(
        'Home alignment report generated successfully',
      );
      expect(result.data.accessLevel).toBe('free_preview');
      // Preview should keep overview but lock detailed sections
      const r = result.data.report as Record<string, unknown>;
      expect(r.overallScore).toBe(72);
      expect(r.entranceDirection).toBe('locked');
    });

    it('returns full report for paid user', async () => {
      const result = await service.createReport(dto, mockPaidUser);

      expect(result.data.accessLevel).toBe('paid_full');
      const r = result.data.report as Record<string, unknown>;
      expect(r.overallScore).toBe(72);
      expect(r.auspiciousnessLevel).toBe('supportive');
    });

    it('returns guest_preview for guest user', async () => {
      const result = await service.createReport(dto, mockGuestUser);

      expect(result.data.accessLevel).toBe('guest_preview');
      // Guest overview should be truncated
      const r = result.data.report as Record<string, unknown>;
      expect(r.overallScore).toBe(72);
      expect(r.entranceDirection).toBe('locked');
    });

    it('calls AI with PAID_FULL access level', async () => {
      await service.createReport(dto, mockUser);

      expect(generateByAccessLevel).toHaveBeenCalledWith(
        ReportAccessLevel.PAID_FULL,
        expect.objectContaining({
          address: dto.address,
          entranceBearing: dto.entranceDegrees,
        }),
      );
    });

    it('stores the report in the database', async () => {
      await service.createReport(dto, mockUser);

      expect(prisma.report.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: mockUser.id,
            type: 'property_report',
            status: 'completed',
            overallScore: 72,
          }),
        }),
      );
    });
  });

  describe('getMyReports', () => {
    it('returns a list of reports', async () => {
      const reports = [
        mockSaved(),
        mockSaved({ id: 'rpt_002', overallScore: 65 }),
      ];
      prisma.report.findMany.mockResolvedValue(reports);

      const result = await service.getMyReports('user_001');

      expect(result.message).toBe('Reports extracted successfully');
      expect(result.data).toHaveLength(2);
    });

    it('returns an empty array when no reports exist (findMany returns [])', async () => {
      prisma.report.findMany.mockResolvedValue([]);

      const result = await service.getMyReports('user_001');
      expect(result.data).toEqual([]);
      expect(result.message).toBe('Reports extracted successfully');
    });
  });
});
