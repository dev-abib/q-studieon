import { Test, TestingModule } from '@nestjs/testing';
import { DynamicPageService } from './dynamic-page.service';

describe('DynamicPageService', () => {
  let service: DynamicPageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DynamicPageService],
    }).compile();

    service = module.get<DynamicPageService>(DynamicPageService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
