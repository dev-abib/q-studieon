import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { Auth } from '../auth/decorators/auth.decorator';
import { QuestionsService } from './questions.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { GetAllQuestionsDto } from './dto/get-all-questions.dto';

@Controller('questions')
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  // create question controller
  @Post('create-questions')
  @Auth('admin')
  createQuestion(@Body() dto: CreateQuestionDto) {
    return this.questionsService.createQuestion(dto);
  }

  // get all questions controller
  @Get('get-all-questions')
  @Auth('admin')
  getAllQuestions(@Query() dto: GetAllQuestionsDto) {
    return this.questionsService.getAllQuestions(dto);
  }

  // get question by slug controller
  @Get('question/:slug')
  @Auth('admin')
  getQuestionBySlug(@Param('slug') slug: string) {
    return this.questionsService.getQuestionBySlug(slug);
  }

  // update question by slug controller
  @Put('update-question/:slug')
  @Auth('admin')
  updateQuestionBySlug(
    @Param('slug') slug: string,
    @Body() dto: UpdateQuestionDto,
  ) {
    return this.questionsService.updateQuestionBySlug(slug, dto);
  }

  // delete question by slug controller
  @Delete('delete-question/:slug')
  @Auth('admin')
  deleteQuestion(@Param('slug') slug: string) {
    return this.questionsService.deleteQuestion(slug);
  }
}
