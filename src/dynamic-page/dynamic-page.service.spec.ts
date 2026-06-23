import { Test, TestingModule } from '@nestjs/testing';
import { DynamicPageService } from './dynamic-page.service';
import { PrismaService } from '../prisma/prisma.service';

describe('DynamicPageService', () => {
  let service: DynamicPageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DynamicPageService,
        {
          provide: PrismaService,
          useValue: {
            dynamicPage: {
              findUnique: jest.fn(),
              create: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<DynamicPageService>(DynamicPageService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
