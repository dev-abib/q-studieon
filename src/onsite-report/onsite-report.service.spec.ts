import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OnsiteReportService } from './onsite-report.service';
import { OnsiteAiHelper } from './helpers/onsite-ai-helper';
import { PrismaService } from '../prisma/prisma.service';
import { NumerologyHelpers } from '../auth/helpers/numerology-helpers';
import { PlaceDetailsHelper } from '../auth/helpers/place-details.helper';
import { CloudinaryService } from '../common/services/cloudinary.service';
import { SubmitOnsiteReportDto } from './helpers/dto/submit-report.dto';
import type { JwtPayload } from '../auth/types/jwt.types';

describe('OnsiteReportService', () => {
  let service: OnsiteReportService;
  let prisma: Partial<Record<keyof PrismaService, jest.Mock>>;
  let cloudinary: Partial<Record<keyof CloudinaryService, jest.Mock>>;

  const mockUser: JwtPayload = {
    id: 'user_001',
    email: 'test@test.com',
    name: 'Test User',
    role: 'user',
    isPaid: false,
    isGuest: false,
  };

  const mockPaidUser: JwtPayload = {
    id: 'user_002',
    email: 'paid@test.com',
    name: 'Paid User',
    role: 'user',
    isPaid: true,
    isGuest: false,
  };

  beforeEach(async () => {
    prisma = {
      report: {
        create: jest.fn().mockResolvedValue({
          id: 'rpt_001',
          userId: 'user_001',
          type: 'onsite_property_report',
          status: 'completed',
          metadata: {
            totalLevels: 1,
            totalCaptures: 1,
            captures: [
              {
                id: 'cap_001',
                captureType: 'front_entrance',
                bearingDegrees: 180,
              },
            ],
          },
        }),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue({
          id: 'rpt_001',
          userId: 'user_001',
          type: 'onsite_property_report',
          status: 'completed',
          metadata: {
            totalLevels: 1,
            totalCaptures: 1,
            captures: [
              {
                id: 'cap_001',
                captureType: 'front_entrance',
                bearingDegrees: 180,
              },
            ],
          },
        }),
      },
      collection: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest
          .fn()
          .mockResolvedValue({
            id: 'col_001',
            name: 'Test',
            userId: 'user_001',
          }),
      },
      reportCollection: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest
          .fn()
          .mockResolvedValue({ reportId: 'rpt_001', collectionId: 'col_001' }),
      },
    } as any;

    cloudinary = {
      uploadFile: jest
        .fn()
        .mockResolvedValue({
          url: 'https://img.com/photo.jpg',
          publicId: 'p_001',
        }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OnsiteReportService,
        { provide: PrismaService, useValue: prisma },
        { provide: CloudinaryService, useValue: cloudinary },
        {
          provide: OnsiteAiHelper,
          useValue: {
            getCardinalFromBearing: jest.fn().mockReturnValue('S'),
            generateOnsiteReport: jest.fn().mockResolvedValue({
              success: true,
              data: {
                overall_alignment_summary: 'Good alignment',
                overview: 'A well-aligned property.',
                overall_score: 72,
                auspiciousness: { level: 'supportive', summary: 'Good' },
                entrance_direction: {
                  degrees: 180,
                  cardinal: 'S',
                  label: '180° S',
                },
                entrance_energy: {
                  narrative: 'Warm',
                  tags: ['fire'],
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
                feng_shui: {
                  tags: ['fire'],
                  narrative: 'Strong',
                  rule_summary: 'Balance',
                },
                vastu: {
                  tags: ['south'],
                  narrative: 'Needs',
                  rule_summary: 'Fix',
                },
                indicators: { supportive: ['good'], red_flags: [] },
                practical_remedies: ['Water'],
                helpful_tips: ['Plant'],
                life_aspects: {
                  relationships: { flags: ['open'], narrative: 'Good' },
                  career: { flags: ['steady'], narrative: 'Fine' },
                  family: { flags: ['harmony'], narrative: 'Great' },
                  romance_and_partnership: {
                    flags: ['warm'],
                    narrative: 'Good',
                  },
                  wealth_and_stability: {
                    flags: ['stable'],
                    narrative: 'Fine',
                  },
                  daily_life: { flags: ['balanced'], narrative: 'Ok' },
                },
                family_flow: { summary: 'Harmonious', narrative: 'Smooth' },
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
            }),
          },
        },
        {
          provide: NumerologyHelpers,
          useValue: {
            createReport: jest.fn().mockReturnValue({
              addressNumber: {
                reduced: 6,
                tags: ['family'],
                supportiveIndicators: [],
                challengeIndicators: [],
              },
              fullAddress: { reduced: 8 },
              numerologySummary: {
                primaryEnergy: ['family'],
                supportiveIndicators: ['good'],
                challengeIndicators: [],
              },
            }),
          },
        },
        {
          provide: PlaceDetailsHelper,
          useValue: {
            getPlacePhotos: jest
              .fn()
              .mockResolvedValue([
                {
                  place_id: 'place_001',
                  photos: [{ photo_reference: 'photo1' }],
                },
              ]),
          },
        },
      ],
    }).compile();

    service = module.get<OnsiteReportService>(OnsiteReportService);
  });

  // -----------------------------------------------------------------------
  // submitReport
  // -----------------------------------------------------------------------
  describe('submitReport', () => {
    const validDto = {
      address: '123 Test St',
      latitude: 40.71,
      longitude: -74.0,
      levels: [
        {
          levelName: 'Ground Floor',
          levelNumber: 0,
          elements: [
            {
              categorySlug: 'front_entrance',
              answers: [{ question: 'Condition?', selectedOption: 'Good' }],
              bearingDegrees: 180,
            },
          ],
        },
      ],
    } as SubmitOnsiteReportDto;

    it('returns success with report data', async () => {
      const result = await service.submitReport(validDto, mockUser);
      expect(result.success).toBe(true);
      expect(result.data.accessLevel).toBe('free_preview');
      expect(result.data.totalLevels).toBe(0); // non-paid, so 0
      expect(result.data.totalCaptures).toBe(0);
      expect(result.data.captures).toEqual([]);
    });

    it('returns full data for paid user', async () => {
      const result = await service.submitReport(validDto, mockPaidUser);
      expect(result.data.accessLevel).toBe('paid_full');
      expect(typeof result.data.report).toBe('object');
    });

    it('throws when levels has no elements', async () => {
      const emptyDto = {
        ...validDto,
        levels: [{ levelName: 'Empty', elements: [] }],
      } as any;
      await expect(service.submitReport(emptyDto, mockUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws when more than one front_entrance', async () => {
      const badDto = {
        ...validDto,
        levels: [
          {
            levelName: 'G',
            elements: [
              {
                categorySlug: 'front_entrance',
                answers: [{ question: 'Q?', selectedOption: 'A' }],
                bearingDegrees: 0,
              },
              {
                categorySlug: 'front_entrance',
                answers: [{ question: 'Q?', selectedOption: 'A' }],
                bearingDegrees: 90,
              },
            ],
          },
        ],
      } as any;
      await expect(service.submitReport(badDto, mockUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('uploads files to Cloudinary when provided', async () => {
      const mockFiles = [
        {
          originalname: 'photo.jpg',
          mimetype: 'image/jpeg',
          size: 100000,
          buffer: Buffer.from(''),
        },
      ] as any;
      await service.submitReport(validDto, mockUser, mockFiles);
      expect(cloudinary.uploadFile).toHaveBeenCalledTimes(1);
    });

    it('rejects invalid file type', async () => {
      const badFile = [
        {
          originalname: 'doc.pdf',
          mimetype: 'application/pdf',
          size: 1000,
          buffer: Buffer.from(''),
        },
      ] as any;
      await expect(
        service.submitReport(validDto, mockUser, badFile),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects oversized file', async () => {
      const bigFile = [
        {
          originalname: 'big.jpg',
          mimetype: 'image/jpeg',
          size: 11 * 1024 * 1024,
          buffer: Buffer.from(''),
        },
      ] as any;
      await expect(
        service.submitReport(validDto, mockUser, bigFile),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // -----------------------------------------------------------------------
  // getReportById
  // -----------------------------------------------------------------------
  describe('getReportById', () => {
    it('returns report data for paid user', async () => {
      const result = await service.getReportById('rpt_001', mockPaidUser);
      expect(result.success).toBe(true);
      expect(result.data.accessLevel).toBe('paid_full');
    });

    it('returns gated data for non-paid user', async () => {
      const result = await service.getReportById('rpt_001', mockUser);
      expect(result.data.accessLevel).toBe('free_preview');
      expect(result.data.totalLevels).toBe(0);
    });

    it('throws NotFoundException when report does not exist', async () => {
      prisma.report.findFirst.mockResolvedValue(null);
      await expect(
        service.getReportById('nonexistent', mockUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // -----------------------------------------------------------------------
  // getMyReports
  // -----------------------------------------------------------------------
  describe('getMyReports', () => {
    it('returns a list of reports', async () => {
      prisma.report.findMany.mockResolvedValue([
        { id: 'rpt_001', overallScore: 72 },
      ]);
      const result = await service.getMyReports('user_001');
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });
  });
});
