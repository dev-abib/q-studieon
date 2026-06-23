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
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Auth } from '../auth/decorators/auth.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { QuestionsService } from './questions.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { GetAllQuestionsDto } from './dto/get-all-questions.dto';

@ApiTags('Questions')
@Controller('questions')
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  // create question controller
  @Post('create-questions')
  @Auth('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new question (requires categoryId)' })
  createQuestion(@Body() dto: CreateQuestionDto) {
    return this.questionsService.createQuestion(dto);
  }

  // get all questions controller (literal path before :id)
  @Get('get-all-questions')
  @Public()
  @ApiOperation({ summary: 'Get all questions with pagination & optional categoryId filter' })
  getAllQuestions(@Query() dto: GetAllQuestionsDto) {
    return this.questionsService.getAllQuestions(dto);
  }

  // get question by ID controller
  @Get(':id')
  @Auth('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a question by ID' })
  @ApiParam({ name: 'id', description: 'Question ID' })
  getQuestionById(@Param('id') id: string) {
    return this.questionsService.getQuestionById(id);
  }

  // update question by ID controller
  @Put(':id')
  @Auth('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a question by ID' })
  @ApiParam({ name: 'id', description: 'Question ID' })
  updateQuestionById(@Param('id') id: string, @Body() dto: UpdateQuestionDto) {
    return this.questionsService.updateQuestionById(id, dto);
  }

  // delete question by ID controller
  @Delete(':id')
  @Auth('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a question by ID' })
  @ApiParam({ name: 'id', description: 'Question ID' })
  deleteQuestionById(@Param('id') id: string) {
    return this.questionsService.deleteQuestionById(id);
  }
}
