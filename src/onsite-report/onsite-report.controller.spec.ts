import { Test, TestingModule } from '@nestjs/testing';
import { OnsiteReportController } from './onsite-report.controller';
import { OnsiteReportService } from './onsite-report.service';
import type { JwtPayload } from '../auth/types/jwt.types';

describe('OnsiteReportController', () => {
  let controller: OnsiteReportController;
  let service: Partial<Record<keyof OnsiteReportService, jest.Mock>>;

  const mockUser: JwtPayload = {
    id: 'user_001',
    email: 'test@test.com',
    name: 'Test',
    role: 'user',
    isPaid: false,
    isGuest: false,
  };

  beforeEach(async () => {
    service = {
      submitReport: jest.fn().mockResolvedValue({
        success: true,
        message: 'Report generated.',
        data: {
          report: { id: 'rpt_001' },
          accessLevel: 'free_preview',
          totalLevels: 0,
          totalCaptures: 0,
          captures: [],
        },
      }),
      getMyReports: jest.fn().mockResolvedValue({ success: true, data: [] }),
      getReportById: jest.fn().mockResolvedValue({
        success: true,
        data: {
          report: { id: 'rpt_001' },
          accessLevel: 'free_preview',
          totalLevels: 0,
          totalCaptures: 0,
          captures: [],
        },
      }),
      createCollection: jest
        .fn()
        .mockResolvedValue({ success: true, data: { id: 'col_001' } }),
      getCollections: jest.fn().mockResolvedValue({ success: true, data: [] }),
      addReportToCollection: jest
        .fn()
        .mockResolvedValue({ success: true, data: {} }),
      getCollectionsWithReports: jest
        .fn()
        .mockResolvedValue({
          success: true,
          data: { collections: [], recentStandaloneReports: [] },
        }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OnsiteReportController],
      providers: [{ provide: OnsiteReportService, useValue: service }],
    }).compile();

    controller = module.get<OnsiteReportController>(OnsiteReportController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('submit calls service.submitReport with body, user, and files', async () => {
    const dto = {
      address: '123 St',
      latitude: 0,
      longitude: 0,
      levels: [],
    } as any;
    const files = [] as any;
    await controller.submit(dto, files, mockUser);
    expect(service.submitReport).toHaveBeenCalledWith(dto, mockUser, files);
  });

  it('getMyReports calls service.getMyReports with user id', async () => {
    await controller.getMyReports(mockUser);
    expect(service.getMyReports).toHaveBeenCalledWith(mockUser.id);
  });

  it('getOne calls service.getReportById with report id and user', async () => {
    await controller.getOne('rpt_001', mockUser);
    expect(service.getReportById).toHaveBeenCalledWith('rpt_001', mockUser);
  });
});
