import {
  Controller,
  Body,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  HttpCode,
  Query,
  ParseEnumPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { CollectionService } from './collection.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/types/jwt.types';
import { Auth } from '../auth/decorators/auth.decorator';
import {
  CreateCollectionDto,
  CollectionTypeEnum,
} from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { RenameCollectionDto } from './dto/rename-collection.dto';
import { AddReportToCollectionDto } from './dto/add-report-to-collection.dto';
import { CompareReportsDto } from './dto/compare-reports.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('Collection')
@ApiBearerAuth()
@Controller('collection')
export class CollectionController {
  constructor(private readonly collectionService: CollectionService) {}

  @Post()
  @Auth('user')
  @ApiOperation({ summary: 'Create a new collection (remote or onsite)' })
  @ApiCreatedResponse({
    description:
      'Collection created successfully. Returns the new collection object.',
  })
  @ApiBadRequestResponse({
    description:
      'Collection with the same name and type already exists, or invalid input.',
  })
  create(@Body() dto: CreateCollectionDto, @CurrentUser() user: JwtPayload) {
    return this.collectionService.create(dto, user.id);
  }

  @Get()
  @Auth('user')
  @ApiOperation({ summary: 'Get all collections for the current user' })
  @ApiOkResponse({
    description:
      'Returns collections grouped by type and recent standalone reports ' +
      'on top. Includes pagination metadata for recentReports.',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: CollectionTypeEnum,
    description:
      'Filter by collection type (remote or onsite). When set, both ' +
      'collections and recentReports are filtered to match the type.',
  })
  findAll(
    @Query('type', new ParseEnumPipe(CollectionTypeEnum, { optional: true }))
    type: CollectionTypeEnum | undefined,
    @Query() pagination: PaginationDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.collectionService.findAll(user.id, pagination, type);
  }

  @Post('reports/compare')
  @Auth('user')
  @ApiOperation({
    summary: 'Compare two reports (remote or onsite) side by side',
    description:
      'Takes two report IDs and returns both reports with their full data, ' +
      "respecting the user's access level. Works for both onsite_property_report " +
      'and property_report types.',
  })
  @ApiOkResponse({
    description:
      'Both reports returned successfully. The accessLevel indicates whether ' +
      'data is paid_full, free_preview, or guest_preview.',
  })
  @ApiBadRequestResponse({
    description:
      'Invalid request. This can happen if the two report IDs are the same ' +
      '(cannot compare a report with itself).',
  })
  @ApiNotFoundResponse({
    description:
      'One or both of the requested reports were not found or do not ' +
      'belong to the current user.',
  })
  compareReports(
    @Body() dto: CompareReportsDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.collectionService.compareReports(dto, user);
  }

  @Get('reports/recent')
  @Auth('user')
  @ApiOperation({
    summary:
      'Get the most recently generated reports with full data (paginated)',
    description:
      'Returns the last generated reports across all collections ' +
      'or filtered by type (remote/onsite). Includes collection info if the report belongs to one. ' +
      'Supports pagination via page and limit query params.',
  })
  @ApiOkResponse({
    description:
      'Paginated list of the most recent reports. Each report includes ' +
      'its collection membership if it belongs to one. Pagination metadata ' +
      'is returned at the top level.',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: CollectionTypeEnum,
    description: 'Filter by report type (remote or onsite)',
  })
  getRecentReports(
    @Query('type', new ParseEnumPipe(CollectionTypeEnum, { optional: true }))
    type: CollectionTypeEnum | undefined,
    @Query() pagination: PaginationDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.collectionService.findRecentReports(user.id, pagination, type);
  }

  @Get(':collectionId/reports')
  @Auth('user')
  @ApiOperation({
    summary: 'Get all reports under a specific collection',
  })
  @ApiOkResponse({
    description:
      'Returns the collection metadata and all reports within it, ordered ' +
      'by when they were added (most recent first).',
  })
  @ApiNotFoundResponse({
    description: 'Collection not found or access denied.',
  })
  @ApiParam({
    name: 'collectionId',
    description: 'Collection ID',
    example: 'cmqr3abc123',
  })
  getReports(
    @Param('collectionId') collectionId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.collectionService.findReportsByCollection(
      collectionId,
      user.id,
    );
  }

  @Post(':collectionId/reports')
  @Auth('user')
  @ApiOperation({ summary: 'Add a report to a collection' })
  @ApiCreatedResponse({
    description:
      'Report added to collection. Validates that the report type matches ' +
      'the collection type (onsite_property_report for onsite collections, ' +
      'property_report for remote collections).',
  })
  @ApiBadRequestResponse({
    description:
      'Report type does not match the collection type, or report is ' +
      'already in the collection.',
  })
  @ApiNotFoundResponse({
    description: 'Report or collection not found or access denied.',
  })
  @ApiParam({
    name: 'collectionId',
    description: 'Collection ID',
    example: 'cmqr3abc123',
  })
  addReport(
    @Param('collectionId') collectionId: string,
    @Body() dto: AddReportToCollectionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.collectionService.addReport(
      collectionId,
      dto.reportId,
      user.id,
    );
  }

  @Patch(':collectionId')
  @Auth('user')
  @ApiOperation({ summary: 'Update a collection name and/or description' })
  @ApiOkResponse({
    description:
      'Collection updated successfully. Checks for name uniqueness ' +
      'within the same type before updating.',
  })
  @ApiNotFoundResponse({
    description: 'Collection not found or access denied.',
  })
  @ApiParam({
    name: 'collectionId',
    description: 'Collection ID',
    example: 'cmqr3abc123',
  })
  update(
    @Param('collectionId') collectionId: string,
    @Body() dto: UpdateCollectionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.collectionService.update(collectionId, user.id, dto);
  }

  @Patch(':collectionId/rename')
  @Auth('user')
  @ApiOperation({ summary: 'Rename a collection (change only the name)' })
  @ApiOkResponse({
    description:
      'Collection renamed successfully. Only updates the name field. ' +
      'Checks for name uniqueness within the same type.',
  })
  @ApiNotFoundResponse({
    description: 'Collection not found or access denied.',
  })
  @ApiParam({
    name: 'collectionId',
    description: 'Collection ID to rename',
    example: 'cmqr3abc123',
  })
  rename(
    @Param('collectionId') collectionId: string,
    @Body() dto: RenameCollectionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.collectionService.rename(collectionId, user.id, dto);
  }

  @Delete(':collectionId')
  @Auth('user')
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete a collection by ID' })
  @ApiOkResponse({
    description:
      'Collection deleted successfully. Also removes all report ' +
      'associations (cascade delete).',
  })
  @ApiNotFoundResponse({
    description: 'Collection not found or access denied.',
  })
  @ApiParam({
    name: 'collectionId',
    description: 'Collection ID',
    example: 'cmqr3abc123',
  })
  remove(
    @Param('collectionId') collectionId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.collectionService.remove(collectionId, user.id);
  }

  @Delete(':collectionId/reports/:reportId')
  @Auth('user')
  @HttpCode(200)
  @ApiOperation({ summary: 'Remove a report from a collection' })
  @ApiOkResponse({
    description:
      'Report removed from collection. Removes only the association, ' +
      'the report itself is not deleted.',
  })
  @ApiNotFoundResponse({
    description:
      'Collection not found, report not found in collection, or access denied.',
  })
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
  removeReport(
    @Param('collectionId') collectionId: string,
    @Param('reportId') reportId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.collectionService.removeReport(collectionId, reportId, user.id);
  }
}
