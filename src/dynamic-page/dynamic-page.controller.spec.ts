import { Test, TestingModule } from '@nestjs/testing';
import { DynamicPageController } from './dynamic-page.controller';

describe('DynamicPageController', () => {
  let controller: DynamicPageController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DynamicPageController],
    }).compile();

    controller = module.get<DynamicPageController>(DynamicPageController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
