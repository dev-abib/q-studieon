import { Module } from '@nestjs/common';
import { QuestionsController } from './questions.controller';
import { QuestionsService } from './questions.service';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';
import { CloudinaryService } from '../common/services/cloudinary.service';

@Module({
  controllers: [QuestionsController, CategoryController],
  providers: [QuestionsService, CategoryService, CloudinaryService],
})
export class QuestionsModule {}
