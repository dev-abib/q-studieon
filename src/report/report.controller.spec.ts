import { Test, TestingModule } from '@nestjs/testing';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';
import type { JwtPayload } from '../auth/types/jwt.types';

describe('ReportController', () => {
  let controller: ReportController;
  let service: Partial<Record<keyof ReportService, jest.Mock>>;

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
      createReport: jest.fn().mockResolvedValue({
        success: true,
        message: 'Report created.',
        data: { report: { id: 'rpt_001' }, accessLevel: 'free_preview' },
      }),
      getMyReports: jest
        .fn()
        .mockResolvedValue({ message: 'Reports', data: [] }),
      deleteReport: jest.fn().mockResolvedValue({
        success: true,
        message: 'Remote property report deleted successfully.',
      }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportController],
      providers: [{ provide: ReportService, useValue: service }],
    }).compile();

    controller = module.get<ReportController>(ReportController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('createReportDto calls service.createReport with body and user', async () => {
    const dto = {
      address: '123 St',
      entranceDegrees: 180,
      latitude: 0,
      longitude: 0,
      entranceLabel: 'S',
    };
    await controller.createReportDto(dto, mockUser);
    expect(service.createReport).toHaveBeenCalledWith(dto, mockUser);
  });

  it('getMyReports calls service.getMyReports with user id', async () => {
    await controller.getMyReports(mockUser);
    expect(service.getMyReports).toHaveBeenCalledWith(mockUser.id);
  });

  it('deleteOne calls service.deleteReport with report id and user', async () => {
    await controller.deleteOne('rpt_001', mockUser);
    expect(service.deleteReport).toHaveBeenCalledWith('rpt_001', mockUser);
  });
});
