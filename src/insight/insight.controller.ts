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
import { InsightService } from './insight.service';
import { CreateInsightDto } from './dto/create-insight.dto';
import { UpdateInsightDto } from './dto/update-insight.dto';
import { GetAllInsightsDto } from './dto/get-all-insights.dto';
import { createFileUploadInterceptor } from '../common/interceptors/file-upload.interceptor';
import { FileValidationPipe } from '../common/pipes/file-validation.pipe';
import type { MulterFile } from '../common/pipes/file-validation.pipe';

@ApiTags('Insight')
@Controller('insight')
export class InsightController {
  constructor(private readonly insightService: InsightService) {}

  @Post('create')
  @Auth('admin')
  @ApiBearerAuth()
  @UseInterceptors(createFileUploadInterceptor({ fieldName: 'icon' }))
  @ApiOperation({
    summary: 'Create a new insight (multipart: text fields + optional icon file)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Insight creation payload',
    required: true,
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', example: 'Property Insights' },
        subTitle: { type: 'string', example: 'Understand your property value' },
        description: {
          type: 'string',
          example: 'Get detailed analysis of your property...',
        },
        redirectLink: {
          type: 'string',
          example: '/properties/analysis',
        },
        icon: {
          type: 'string',
          format: 'binary',
          description: 'Insight icon image',
        },
      },
    },
  })
  createInsight(
    @UploadedFile(new FileValidationPipe({ required: false }))
    file: MulterFile | undefined,
    @Body() dto: CreateInsightDto,
  ) {
    return this.insightService.createInsight(dto, file);
  }

  @Get('get-all')
  @Public()
  @ApiOperation({ summary: 'Get all insights with pagination' })
  getAllInsights(@Query() dto: GetAllInsightsDto) {
    return this.insightService.getAllInsights(dto);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get an insight by ID' })
  @ApiParam({ name: 'id', description: 'Insight ID' })
  getInsightById(@Param('id') id: string) {
    return this.insightService.getInsightById(id);
  }

  @Put(':id')
  @Auth('admin')
  @ApiBearerAuth()
  @UseInterceptors(createFileUploadInterceptor({ fieldName: 'icon' }))
  @ApiOperation({
    summary: 'Update an insight (multipart: optional text fields + optional icon file)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Insight update payload',
    required: true,
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', example: 'Property Insights' },
        subTitle: { type: 'string', example: 'Understand your property value' },
        description: {
          type: 'string',
          example: 'Get detailed analysis of your property...',
        },
        redirectLink: {
          type: 'string',
          example: '/properties/analysis',
        },
        icon: {
          type: 'string',
          format: 'binary',
          description: 'Insight icon image',
        },
      },
    },
  })
  updateInsight(
    @Param('id') id: string,
    @UploadedFile(new FileValidationPipe({ required: false }))
    file: MulterFile | undefined,
    @Body() dto: UpdateInsightDto,
  ) {
    return this.insightService.updateInsight(id, dto, file);
  }

  @Delete(':id')
  @Auth('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an insight by ID' })
  @ApiParam({ name: 'id', description: 'Insight ID' })
  deleteInsight(@Param('id') id: string) {
    return this.insightService.deleteInsight(id);
  }
}
