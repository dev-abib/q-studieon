import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { Auth } from '../auth/decorators/auth.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { FaqService } from './faq.service';
import { CreateFaqDto } from './dto/create-faq.dto';
import { UpdateFaqDto } from './dto/update-faq.dto';
import { GetAllFaqsDto } from './dto/get-all-faqs.dto';
import { createFileUploadInterceptor } from '../common/interceptors/file-upload.interceptor';
import { FileValidationPipe } from '../common/pipes/file-validation.pipe';
import type { MulterFile } from '../common/pipes/file-validation.pipe';

@ApiTags('FAQ')
@Controller('faq')
export class FaqController {
  constructor(private readonly faqService: FaqService) {}

  @Post('create')
  @Auth('admin')
  @ApiBearerAuth()
  @UseInterceptors(createFileUploadInterceptor({ fieldName: 'image' }))
  @ApiOperation({
    summary: 'Create a new FAQ (multipart: text fields + required image file)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'FAQ creation payload',
    required: true,
    schema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          example: 'How do I generate a report?',
        },
        description: {
          type: 'string',
          example:
            'Open the Reports tab, tap "Generate", and follow the steps...',
        },
        sortOrder: {
          type: 'number',
          example: 1,
          description: 'Display order (lower numbers appear first)',
        },
        image: {
          type: 'string',
          format: 'binary',
          description: 'FAQ image',
        },
      },
      required: ['title', 'description', 'image'],
    },
  })
  createFaq(
    @UploadedFile(new FileValidationPipe({ required: true }))
    file: MulterFile,
    @Body() dto: CreateFaqDto,
  ) {
    return this.faqService.createFaq(dto, file);
  }

  @Get('get-all')
  @Public()
  @ApiOperation({ summary: 'Get all FAQs with pagination' })
  getAllFaqs(@Query() dto: GetAllFaqsDto) {
    return this.faqService.getAllFaqs(dto);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get a FAQ by ID' })
  @ApiParam({ name: 'id', description: 'FAQ ID' })
  getFaqById(@Param('id') id: string) {
    return this.faqService.getFaqById(id);
  }

  @Put(':id')
  @Auth('admin')
  @ApiBearerAuth()
  @UseInterceptors(createFileUploadInterceptor({ fieldName: 'image' }))
  @ApiOperation({
    summary:
      'Update a FAQ (multipart: optional text fields + optional image file)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'FAQ update payload',
    required: true,
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', example: 'How do I generate a report?' },
        description: {
          type: 'string',
          example:
            'Open the Reports tab, tap "Generate", and follow the steps...',
        },
        sortOrder: {
          type: 'number',
          example: 1,
          description: 'Display order (lower numbers appear first)',
        },
        image: {
          type: 'string',
          format: 'binary',
          description: 'FAQ image',
        },
      },
    },
  })
  updateFaq(
    @Param('id') id: string,
    @UploadedFile(new FileValidationPipe({ required: false }))
    file: MulterFile | undefined,
    @Body() dto: UpdateFaqDto,
  ) {
    return this.faqService.updateFaq(id, dto, file);
  }

  @Delete(':id')
  @Auth('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a FAQ by ID' })
  @ApiParam({ name: 'id', description: 'FAQ ID' })
  deleteFaq(@Param('id') id: string) {
    return this.faqService.deleteFaq(id);
  }
}
