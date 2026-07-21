import {
  Controller,
  Body,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  HttpCode,
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
  UpdateCollectionDto,
  RenameCollectionDto,
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
      'Multipart form-data: address, latitude, longitude, levels (JSON string), photos (image files)',
    schema: {
      type: 'object',
      required: ['address', 'latitude', 'longitude', 'levels'],
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
        photos: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'Upload photos (JPEG, PNG, WebP - max 10MB each)',
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
  @ApiParam({
    name: 'collectionId',
    description: 'Collection ID',
    example: 'cmqr3abc123',
  })
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

  @Patch('collection/:collectionId')
  @Auth('user')
  @ApiOperation({ summary: 'Update a collection name and/or description' })
  @ApiParam({
    name: 'collectionId',
    description: 'Collection ID',
    example: 'cmqr3abc123',
  })
  updateCollection(
    @Param('collectionId') collectionId: string,
    @Body() dto: UpdateCollectionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.onsiteReportService.updateCollection(
      collectionId,
      user.id,
      dto,
    );
  }

  @Patch('rename-collection/:collectionId')
  @Auth('user')
  @ApiOperation({ summary: 'Rename a collection (change only the name)' })
  @ApiParam({
    name: 'collectionId',
    description: 'Collection ID to rename',
    example: 'cmqr3abc123',
  })
  renameCollection(
    @Param('collectionId') collectionId: string,
    @Body() dto: RenameCollectionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.onsiteReportService.renameCollection(
      collectionId,
      user.id,
      dto,
    );
  }

  @Delete('collection/:collectionId')
  @Auth('user')
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete a collection by ID' })
  @ApiParam({
    name: 'collectionId',
    description: 'Collection ID',
    example: 'cmqr3abc123',
  })
  deleteCollection(
    @Param('collectionId') collectionId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.onsiteReportService.deleteCollection(collectionId, user.id);
  }

  @Delete('collection/:collectionId/report/:reportId')
  @Auth('user')
  @HttpCode(200)
  @ApiOperation({ summary: 'Remove a report from a collection' })
  @ApiParam({
    name: 'collectionId',
    description: 'Collection ID',
    example: 'cmqr3abc123',
  })
  @ApiParam({
    name: 'reportId',
    description: 'Report ID to remove from the collection',
    example: 'cmqr3def456',
  })
  removeReportFromCollection(
    @Param('collectionId') collectionId: string,
    @Param('reportId') reportId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.onsiteReportService.removeReportFromCollection(
      collectionId,
      reportId,
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

  // -------------------------------------------------------------------------
  // DELETE /onsite-report/:reportId
  // -------------------------------------------------------------------------
  @Delete(':reportId')
  @Auth('user')
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete an on-site report by ID' })
  @ApiParam({
    name: 'reportId',
    description: 'On-site report ID to delete',
    example: 'cmqr3abc123',
  })
  deleteOne(
    @Param('reportId') reportId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ success: boolean; message: string }> {
    return this.onsiteReportService.deleteReport(reportId, user);
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
