import { Module } from '@nestjs/common';
import { InsightController } from './insight.controller';
import { InsightService } from './insight.service';
import { CloudinaryService } from '../common/services/cloudinary.service';

@Module({
  controllers: [InsightController],
  providers: [InsightService, CloudinaryService],
})
export class InsightModule {}
