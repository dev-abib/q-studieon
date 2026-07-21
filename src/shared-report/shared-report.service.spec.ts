import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { SharedReportService } from './shared-report.service';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from '../auth/types/jwt.types';

describe('SharedReportService', () => {
  let service: SharedReportService;
  let prisma: Record<string, any>;

  const mockUser: JwtPayload = {
    id: 'user_001',
    email: 'test@test.com',
    name: 'Test User',
    role: 'user',
    isPaid: false,
    isGuest: false,
  };

  const mockPaidUser: JwtPayload = {
    id: 'user_001',
    email: 'paid@test.com',
    name: 'Paid User',
    role: 'user',
    isPaid: true,
    isGuest: false,
  };

  const mockGuestUser: JwtPayload = {
    id: 'guest_001',
    email: 'guest@test.com',
    name: 'Guest User',
    role: 'user',
    isPaid: false,
    isGuest: true,
  };

  /** Reusable onsite report shape with captures and photoUrls */
  const onsiteBaseReport = {
    id: 'rpt_001',
    userId: 'user_001',
    type: 'onsite_property_report',
    status: 'completed',
    overallScore: 72,
    auspiciousnessLevel: 'supportive',
    overview: 'A well-aligned property.',
    overallAlignmentSummary: 'Good alignment',
    auspiciousnessSummary: 'Good',
    familyFlowSummary: 'Harmonious',
    familyFlowNarrative: 'Smooth',
    indicators: { supportive: ['good'], red_flags: [] },
    helpfulTips: ['Plant'],
    entranceDirection: { degrees: 180, cardinal: 'S', label: '180° S' },
    entranceEnergy: { narrative: 'Warm', tags: ['fire'] },
    numerology: { address_number: 6 },
    fengShui: { tags: ['fire'], narrative: 'Strong' },
    vastu: { tags: ['south'], narrative: 'Needs' },
    practicalRemedies: ['Water'],
    lifeAspects: {
      relationships: { narrative: 'Good' },
      career: { narrative: 'Fine' },
    },
    photos: [
      { url: 'https://img.com/photo1.jpg', publicId: 'p1' },
      { url: 'https://img.com/photo2.jpg', publicId: 'p2' },
    ],
    placeId: 'place_001',
    address: '123 Test St',
    latitude: 40.71,
    longitude: -74.0,
    entranceDegrees: 180,
    entranceLabel: 'S',
    createdAt: new Date('2026-07-21'),
    updatedAt: new Date('2026-07-21'),
    aiModel: null,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    finishReason: null,
    metadata: {
      reportMode: 'onsite',
      address: '123 Test St',
      notes: null,
      mainEntranceType: 'front_entrance',
      mainCardinal: 'S',
      mainBearing: 180,
      totalLevels: 2,
      totalCaptures: 3,
      captures: [
        {
          id: 'cap_001',
          captureType: 'front_entrance',
          bearingDegrees: 180,
          cardinal: 'S',
          isMainEntrance: true,
          notes: 'Main entrance',
          createdAt: '2026-07-21T00:00:00.000Z',
          photoUrls: ['https://img.com/entrance.jpg'],
        },
        {
          id: 'cap_002',
          captureType: 'kitchen',
          bearingDegrees: 90,
          cardinal: 'E',
          isMainEntrance: false,
          notes: null,
          createdAt: '2026-07-21T00:00:00.000Z',
          photoUrls: [
            'https://img.com/kitchen.jpg',
            'https://img.com/kitchen2.jpg',
          ],
        },
        {
          id: 'cap_003',
          captureType: 'garden',
          bearingDegrees: 270,
          cardinal: 'W',
          isMainEntrance: false,
          notes: null,
          createdAt: '2026-07-21T00:00:00.000Z',
          photoUrls: [],
        },
      ],
    },
  };

  /** Non-onsite report (regular feng shui report) */
  const regularReport = {
    ...onsiteBaseReport,
    type: 'feng_shui_report',
    metadata: null,
  };

  /** Shared record with the linked report */
  function makeShared(report: Record<string, any>, overrides = {}) {
    return {
      id: 'shr_001',
      token: 'token-abc-123',
      reportId: report.id,
      sharedById: 'user_001',
      address: null,
      sharedBy: {
        name: 'Test User',
        profilePictureURL: null,
      },
      report,
      ...overrides,
    };
  }

  beforeEach(async () => {
    prisma = {
      report: {
        findFirst: jest.fn().mockResolvedValue(onsiteBaseReport),
      },
      sharedReport: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn(),
        create: jest.fn().mockImplementation(({ data }) => ({
          id: 'shr_new',
          token: 'new-token',
          reportId: data.reportId,
          sharedById: data.sharedById,
          address: data.address,
        })),
      },
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SharedReportService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<SharedReportService>(SharedReportService);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // generateShareLink
  // ──────────────────────────────────────────────────────────────────────────
  describe('generateShareLink', () => {
    it('generates a new share link', async () => {
      const result = await service.generateShareLink('rpt_001', mockUser);
      expect(result.success).toBe(true);
      expect(result.data.token).toBe('new-token');
      expect(result.data.shareLink).toContain('new-token');
    });

    it('returns existing link if already shared', async () => {
      prisma.sharedReport.findFirst.mockResolvedValue({
        id: 'shr_existing',
        token: 'existing-token',
        reportId: 'rpt_001',
        sharedById: 'user_001',
      });

      const result = await service.generateShareLink('rpt_001', mockUser);
      expect(result.success).toBe(true);
      expect(result.message).toBe('Share link already exists.');
      expect(result.data.token).toBe('existing-token');
    });

    it('throws ForbiddenException if report belongs to another user', async () => {
      prisma.report.findFirst.mockResolvedValue({
        ...onsiteBaseReport,
        userId: 'other_user',
      });

      await expect(
        service.generateShareLink('rpt_001', mockUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException if report does not exist', async () => {
      prisma.report.findFirst.mockResolvedValue(null);

      await expect(
        service.generateShareLink('rpt_not_found', mockUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // getSharedReportPreview  (public — no auth)
  // ──────────────────────────────────────────────────────────────────────────
  describe('getSharedReportPreview', () => {
    it('returns preview with flat photos and no captures', async () => {
      prisma.sharedReport.findUnique.mockResolvedValue(
        makeShared(onsiteBaseReport),
      );

      const result = await service.getSharedReportPreview('token-abc-123');
      expect(result.success).toBe(true);
      expect(result.data.property.photos).toHaveLength(2);
      expect(result.data.property.address).toBe('123 Test St');
      expect(result.data.overallScore).toBe(72);
      // Preview should NOT include captures
      expect((result.data as any).captures).toBeUndefined();
    });

    it('returns stored address from shared record when available', async () => {
      prisma.sharedReport.findUnique.mockResolvedValue(
        makeShared(onsiteBaseReport, { address: '456 Oak Ave' }),
      );

      const result = await service.getSharedReportPreview('token-abc-123');
      expect(result.data.property.address).toBe('456 Oak Ave');
    });

    it('throws NotFoundException for invalid token', async () => {
      prisma.sharedReport.findUnique.mockResolvedValue(null);

      await expect(
        service.getSharedReportPreview('invalid-token'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // getSharedReportFull  (auth required)  ← THE KEY NEW FUNCTIONALITY
  // ──────────────────────────────────────────────────────────────────────────
  describe('getSharedReportFull', () => {
    // ── Onsite report + paid user → should include captures with photoUrls ──
    it('includes onsite captures with photoUrls for paid user', async () => {
      prisma.sharedReport.findUnique.mockResolvedValue(
        makeShared(onsiteBaseReport),
      );

      const result = await service.getSharedReportFull(
        'token-abc-123',
        mockPaidUser,
      );

      expect(result.success).toBe(true);
      expect(result.data.accessLevel).toBe('paid_full');
      expect(result.data.totalLevels).toBe(2);
      expect(result.data.totalCaptures).toBe(3);
      expect(result.data.captures).toBeDefined();
      expect(result.data.captures).toHaveLength(3);

      // Capture 0 — front entrance with 1 photo
      expect(result.data.captures![0].id).toBe('cap_001');
      expect(result.data.captures![0].captureType).toBe('front_entrance');
      expect(result.data.captures![0].isMainEntrance).toBe(true);
      expect(result.data.captures![0].photoUrls).toEqual([
        'https://img.com/entrance.jpg',
      ]);

      // Capture 1 — kitchen with 2 photos
      expect(result.data.captures![1].id).toBe('cap_002');
      expect(result.data.captures![1].photoUrls).toEqual([
        'https://img.com/kitchen.jpg',
        'https://img.com/kitchen2.jpg',
      ]);

      // Capture 2 — garden with 0 photos
      expect(result.data.captures![2].id).toBe('cap_003');
      expect(result.data.captures![2].photoUrls).toEqual([]);
    });

    // ── Onsite report + free user → should NOT include captures ───────────
    it('omits onsite captures for non-paid user', async () => {
      prisma.sharedReport.findUnique.mockResolvedValue(
        makeShared(onsiteBaseReport),
      );

      const result = await service.getSharedReportFull(
        'token-abc-123',
        mockUser,
      );

      expect(result.data.accessLevel).toBe('free_preview');
      expect(result.data.totalLevels).toBeUndefined();
      expect(result.data.totalCaptures).toBeUndefined();
      expect(result.data.captures).toBeUndefined();
    });

    // ── Onsite report + guest user → should NOT include captures ─────────
    it('omits onsite captures for guest user', async () => {
      prisma.sharedReport.findUnique.mockResolvedValue(
        makeShared(onsiteBaseReport),
      );

      const result = await service.getSharedReportFull(
        'token-abc-123',
        mockGuestUser,
      );

      expect(result.data.accessLevel).toBe('guest_preview');
      expect(result.data.captures).toBeUndefined();
    });

    // ── Non-onsite report + paid user → should NOT include captures ───────
    it('omits captures for non-onsite report even for paid user', async () => {
      prisma.sharedReport.findUnique.mockResolvedValue(
        makeShared(regularReport),
      );

      const result = await service.getSharedReportFull(
        'token-abc-123',
        mockPaidUser,
      );

      expect(result.data.accessLevel).toBe('paid_full');
      expect(result.data.totalLevels).toBeUndefined();
      expect(result.data.totalCaptures).toBeUndefined();
      expect(result.data.captures).toBeUndefined();
    });

    // ── Invalid token → throws ───────────────────────────────────────────
    it('throws NotFoundException for invalid token', async () => {
      prisma.sharedReport.findUnique.mockResolvedValue(null);

      await expect(
        service.getSharedReportFull('invalid-token', mockPaidUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // checkSharedReport
  // ──────────────────────────────────────────────────────────────────────────
  describe('checkSharedReport', () => {
    it('returns isValid=true for an existing token', async () => {
      prisma.sharedReport.findUnique.mockResolvedValue({ id: 'shr_001' });

      const result = await service.checkSharedReport('valid-token');
      expect(result.isValid).toBe(true);
    });

    it('returns isValid=false for a non-existent token', async () => {
      prisma.sharedReport.findUnique.mockResolvedValue(null);

      const result = await service.checkSharedReport('invalid-token');
      expect(result.isValid).toBe(false);
    });
  });
});
