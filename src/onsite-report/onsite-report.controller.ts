import {
  Controller,
  Body,
  Post,
  Get,
  Param,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { OnsiteReportService } from './onsite-report.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/types/jwt.types';
import { Auth } from '../auth/decorators/auth.decorator';
import { SubmitOnsiteReportDto } from './helpers/dto/submit-report.dto';
import {
  AddReportToCollectionDto,
  CreateCollectionDto,
} from './helpers/dto/collection.dto';
import type { MulterFile } from '../common/pipes/file-validation.pipe';

@ApiTags('Onsite Report')
@ApiBearerAuth()
@Controller('onsite-report')
export class OnsiteReportController {
  constructor(private readonly onsiteReportService: OnsiteReportService) {}

  @Post('submit')
  @Auth('user')
  @ApiOperation({ summary: 'Submit an on-site property report with photos' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description:
      'Multipart form-data: address, latitude, longitude, levels (JSON string), optional photos',
    schema: {
      type: 'object',
      properties: {
        address: { type: 'string', example: '123 Main St, New York, NY' },
        latitude: { type: 'number', example: 40.7128 },
        longitude: { type: 'number', example: -74.006 },
        levels: {
          type: 'string',
          description:
            'JSON stringified array of LevelDto (levelName, levelNumber, elements[])',
          example:
            '[{"levelName":"Ground Floor","levelNumber":0,"elements":[{"categorySlug":"front_entrance","answers":[{"question":"Condition?","selectedOption":"Good"}],"bearingDegrees":180}]}]',
        },
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'Optional photos (JPEG, PNG, WebP)',
        },
      },
    },
  })
  @UseInterceptors(AnyFilesInterceptor())
  submit(
    @Body() body: SubmitOnsiteReportDto,
    @UploadedFiles() files: MulterFile[],
    @CurrentUser() user: JwtPayload,
  ) {
    return this.onsiteReportService.submitReport(body, user, files);
  }

  @Get('my-reports')
  @Auth('user')
  @ApiOperation({ summary: 'List all on-site reports for the current user' })
  getMyReports(@CurrentUser() user: JwtPayload) {
    return this.onsiteReportService.getMyReports(user.id);
  }

  @Post('create-collection')
  @Auth('user')
  @ApiOperation({ summary: 'Create a new collection for organizing reports' })
  createCollection(
    @Body() dto: CreateCollectionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.onsiteReportService.createCollection(dto, user.id);
  }

  @Get('get-all-collections')
  @Auth('user')
  @ApiOperation({ summary: 'Get all collections for the current user' })
  getMyCollections(@CurrentUser() user: JwtPayload) {
    return this.onsiteReportService.getCollections(user.id);
  }

  @Post('add-report-to-collection/:collectionId')
  @Auth('user')
  @ApiOperation({ summary: 'Add a report to a collection' })
  addToCollection(
    @Param('collectionId') collectionId: string,
    @Body() dto: AddReportToCollectionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.onsiteReportService.addReportToCollection(
      collectionId,
      dto.reportId,
      user.id,
    );
  }

  @Get('collections-with-reports')
  @Auth('user')
  @ApiOperation({
    summary: 'Get collections with their reports + recent standalone reports',
  })
  getCollectionsWithReports(@CurrentUser() user: JwtPayload) {
    return this.onsiteReportService.getCollectionsWithReports(user.id);
  }

  // ==================== DYNAMIC ROUTE - MUST BE LAST ====================
  @Get(':reportId')
  @Auth('user')
  @ApiOperation({ summary: 'Get a single on-site report by ID' })
  @ApiParam({
    name: 'reportId',
    description: 'On-site report ID',
    example: 'cmqr3abc123',
  })
  getOne(@Param('reportId') reportId: string, @CurrentUser() user: JwtPayload) {
    return this.onsiteReportService.getReportById(reportId, user);
  }
}
