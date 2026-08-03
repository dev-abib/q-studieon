import { Module } from '@nestjs/common';
import { FaqController } from './faq.controller';
import { FaqService } from './faq.service';
import { CloudinaryService } from '../common/services/cloudinary.service';

@Module({
  controllers: [FaqController],
  providers: [FaqService, CloudinaryService],
})
export class FaqModule {}
