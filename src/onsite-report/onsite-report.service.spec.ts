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
  let prisma: Record<string, any>;
  let cloudinary: Record<string, any>;

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
        delete: jest.fn().mockResolvedValue({ id: 'rpt_001' }),
      },
      collection: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({
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
      uploadFile: jest.fn().mockResolvedValue({
        url: 'https://img.com/photo.jpg',
        publicId: 'p_001',
      }),
      deleteFile: jest.fn().mockResolvedValue(undefined),
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
            getPlacePhotos: jest.fn().mockResolvedValue([
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

    it('uploads files to Cloudinary when provided with element field naming', async () => {
      const mockFiles = [
        {
          fieldname: 'element_0',
          originalname: 'photo.jpg',
          mimetype: 'image/jpeg',
          size: 100000,
          buffer: Buffer.from(''),
        },
      ] as any;
      await service.submitReport(validDto, mockUser, mockFiles);
      expect(cloudinary.uploadFile).toHaveBeenCalledTimes(1);
    });

    it('rejects file with invalid fieldname', async () => {
      const badFile = [
        {
          fieldname: 'photos',
          originalname: 'photo.jpg',
          mimetype: 'image/jpeg',
          size: 100000,
          buffer: Buffer.from(''),
        },
      ] as any;
      await expect(
        service.submitReport(validDto, mockUser, badFile),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects file with out-of-range element index', async () => {
      const badFile = [
        {
          fieldname: 'element_5',
          originalname: 'photo.jpg',
          mimetype: 'image/jpeg',
          size: 100000,
          buffer: Buffer.from(''),
        },
      ] as any;
      await expect(
        service.submitReport(validDto, mockUser, badFile),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects invalid file type', async () => {
      const badFile = [
        {
          fieldname: 'element_0',
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
          fieldname: 'element_0',
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

    it('maps multiple photos to the correct elements', async () => {
      // Two elements in the DTO
      const twoElementDto = {
        ...validDto,
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
              {
                categorySlug: 'kitchen',
                answers: [{ question: 'Clean?', selectedOption: 'Yes' }],
                bearingDegrees: 90,
              },
            ],
          },
        ],
      } as SubmitOnsiteReportDto;

      const mockFiles = [
        {
          fieldname: 'element_0',
          originalname: 'entrance.jpg',
          mimetype: 'image/jpeg',
          size: 100000,
          buffer: Buffer.from(''),
        },
        {
          fieldname: 'element_0',
          originalname: 'entrance-closeup.jpg',
          mimetype: 'image/jpeg',
          size: 100000,
          buffer: Buffer.from(''),
        },
        {
          fieldname: 'element_1',
          originalname: 'kitchen.jpg',
          mimetype: 'image/jpeg',
          size: 100000,
          buffer: Buffer.from(''),
        },
      ] as any;

      // Mock cloudinary to return different URLs for each file
      cloudinary.uploadFile
        .mockResolvedValueOnce({
          url: 'https://img.com/entrance.jpg',
          publicId: 'entrance',
        })
        .mockResolvedValueOnce({
          url: 'https://img.com/entrance-closeup.jpg',
          publicId: 'entrance-closeup',
        })
        .mockResolvedValueOnce({
          url: 'https://img.com/kitchen.jpg',
          publicId: 'kitchen',
        });

      const result = await service.submitReport(
        twoElementDto,
        mockPaidUser,
        mockFiles,
      );

      expect(cloudinary.uploadFile).toHaveBeenCalledTimes(3);
      // Capture 0 (front_entrance) should have 2 photos
      expect(result.data.captures[0].photoUrls).toEqual([
        'https://img.com/entrance.jpg',
        'https://img.com/entrance-closeup.jpg',
      ]);
      // Capture 1 (kitchen) should have 1 photo
      expect(result.data.captures[1].photoUrls).toEqual([
        'https://img.com/kitchen.jpg',
      ]);
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
  // deleteReport
  // -----------------------------------------------------------------------
  describe('deleteReport', () => {
    const mockReportWithPhotos = {
      id: 'rpt_001',
      userId: 'user_001',
      type: 'onsite_property_report',
      status: 'completed',
      photos: [
        { url: 'https://img.com/photo1.jpg', publicId: 'p_001' },
        { url: 'https://img.com/photo2.jpg', publicId: 'p_002' },
        { url: 'https://img.com/gphoto.jpg' }, // Google photo without publicId
      ],
      placeId: 'place_001',
      address: '123 Test St',
      latitude: 40.71,
      longitude: -74.0,
      entranceDegrees: 180,
      entranceLabel: 'S',
    };

    it('successfully deletes a report and its cloudinary photos', async () => {
      prisma.report.findFirst.mockResolvedValue(mockReportWithPhotos);

      const result = await service.deleteReport('rpt_001', mockUser);

      expect(result.success).toBe(true);
      expect(result.message).toBe('On-site report deleted successfully.');
      // Should delete cloudinary photos that have publicId
      expect(cloudinary.deleteFile).toHaveBeenCalledTimes(2);
      expect(cloudinary.deleteFile).toHaveBeenCalledWith('p_001');
      expect(cloudinary.deleteFile).toHaveBeenCalledWith('p_002');
      // Should not try to delete Google photos (no publicId)
      expect(cloudinary.deleteFile).not.toHaveBeenCalledWith(undefined);
      // Should delete the report from DB
      expect(prisma.report.delete).toHaveBeenCalledWith({
        where: { id: 'rpt_001' },
      });
    });

    it('successfully deletes a report with no photos', async () => {
      prisma.report.findFirst.mockResolvedValue({
        ...mockReportWithPhotos,
        photos: null,
      });

      const result = await service.deleteReport('rpt_002', mockUser);

      expect(result.success).toBe(true);
      expect(cloudinary.deleteFile).not.toHaveBeenCalled();
      expect(prisma.report.delete).toHaveBeenCalledWith({
        where: { id: 'rpt_002' },
      });
    });

    it('throws NotFoundException when report does not exist', async () => {
      prisma.report.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteReport('nonexistent', mockUser),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.report.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when report belongs to another user', async () => {
      // findFirst returns null because the query filters by userId
      prisma.report.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteReport('rpt_001', {
          ...mockUser,
          id: 'other_user',
        }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.report.delete).not.toHaveBeenCalled();
    });

    it('handles cloudinary deletion errors gracefully', async () => {
      prisma.report.findFirst.mockResolvedValue(mockReportWithPhotos);
      // One photo fails to delete
      cloudinary.deleteFile
        .mockRejectedValueOnce(new Error('Cloudinary error'))
        .mockResolvedValueOnce(undefined);

      const result = await service.deleteReport('rpt_001', mockUser);

      // Should still succeed and delete the report
      expect(result.success).toBe(true);
      expect(prisma.report.delete).toHaveBeenCalled();
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
