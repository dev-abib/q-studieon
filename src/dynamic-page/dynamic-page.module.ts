import { Module } from '@nestjs/common';
import { DynamicPageController } from './dynamic-page.controller';
import { DynamicPageService } from './dynamic-page.service';

@Module({
  controllers: [DynamicPageController],
  providers: [DynamicPageService],
})
export class DynamicPageModule {}
