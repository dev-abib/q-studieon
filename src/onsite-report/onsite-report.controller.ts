import { Controller, Body, Post, Get, Param } from '@nestjs/common';
import { OnsiteReportService } from './onsite-report.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/types/jwt.types';
import { Auth } from '../auth/decorators/auth.decorator';
import { SubmitOnsiteReportDto } from './helpers/dto/submit-report.dto';

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
