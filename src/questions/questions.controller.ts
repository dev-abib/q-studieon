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

  // get all questions controller (literal path before :id)
  @Get('get-all-questions')
  @Auth('admin')
  getAllQuestions(@Query() dto: GetAllQuestionsDto) {
    return this.questionsService.getAllQuestions(dto);
  }

  // get questions by slug controller (literal+param path before bare :id)
  @Get('by-slug/:slug')
  @Auth('admin')
  getQuestionsBySlug(@Param('slug') slug: string) {
    return this.questionsService.getQuestionsBySlug(slug);
  }

  // get question by ID controller
  @Get(':id')
  @Auth('admin')
  getQuestionById(@Param('id') id: string) {
    return this.questionsService.getQuestionById(id);
  }

  // update question by ID controller
  @Put(':id')
  @Auth('admin')
  updateQuestionById(@Param('id') id: string, @Body() dto: UpdateQuestionDto) {
    return this.questionsService.updateQuestionById(id, dto);
  }

  // delete question by ID controller
  @Delete(':id')
  @Auth('admin')
  deleteQuestionById(@Param('id') id: string) {
    return this.questionsService.deleteQuestionById(id);
  }
}
