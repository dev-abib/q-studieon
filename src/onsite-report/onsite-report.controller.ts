import { Controller, Body, Post, Get, Param } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { OnsiteReportService } from './onsite-report.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/types/jwt.types';
import { Auth } from '../auth/decorators/auth.decorator';
import { SubmitOnsiteReportDto } from './helpers/dto/submit-report.dto';
import {
  AddReportToCollectionDto,
  CreateCollectionDto,
} from './helpers/dto/collection.dto';

@ApiExcludeController()
@Controller('onsite-report')
export class OnsiteReportController {
  constructor(private readonly onsiteReportService: OnsiteReportService) {}
  @Post('submit')
  @Auth('user')
  submit(@Body() body: SubmitOnsiteReportDto, @CurrentUser() user: JwtPayload) {
    return this.onsiteReportService.submitReport(body, user.id);
  }

  /**
   * List all on-site reports for the current user (lightweight — no blobs).
   *
   * GET /onsite-report/my-reports
   */
  @Get('my-reports')
  @Auth('user')
  getMyReports(@CurrentUser() user: JwtPayload) {
    return this.onsiteReportService.getMyReports(user.id);
  }

  @Post('create-collection')
  @Auth('user')
  createCollection(
    @Body() dto: CreateCollectionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.onsiteReportService.createCollection(dto, user.id);
  }

  @Get('get-all-collections')
  @Auth('user')
  getMyCollections(@CurrentUser() user: JwtPayload) {
    return this.onsiteReportService.getCollections(user.id);
  }

  @Post('add-report-to-collection/:collectionId')
  @Auth('user')
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
  getCollectionsWithReports(@CurrentUser() user: JwtPayload) {
    return this.onsiteReportService.getCollectionsWithReports(user.id);
  }

  // ==================== DYNAMIC ROUTE - MUST BE LAST ====================
  /**
   * Fetch a single full report by ID.
   *
   * GET /onsite-report/:reportId
   */
  @Get(':reportId')
  @Auth('user')
  getOne(@Param('reportId') reportId: string, @CurrentUser() user: JwtPayload) {
    return this.onsiteReportService.getReportById(reportId, user.id);
  }
}
