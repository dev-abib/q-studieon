import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

describe('AppController', () => {
  let appController: AppController;

  const mockPrismaService = {
    $queryRaw: jest.fn().mockResolvedValue([{ '1': 1 }]),
  };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return system status with data and message', async () => {
      const result = await appController.getSystemStatus();
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('message', 'System health check');
      expect(result.data).toHaveProperty('status', 'healthy');
      expect(result.data).toHaveProperty('server');
      expect(result.data).toHaveProperty('database');
      expect(result.data).toHaveProperty('environment');
      expect(result.data).toHaveProperty('timestamp');
    });
  });
});
