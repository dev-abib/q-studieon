import { Controller, Body, Post, Get } from '@nestjs/common';
import { ReportService } from './report.service';
import { CreateReportDto } from './dto/create-report.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/types/jwt.types';
import { Auth } from '../auth/decorators/auth.decorator';

@Controller('report')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Post('create-report')
  @Auth('user')
  async createReportDto(
    @Body() body: CreateReportDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.reportService.createReport(body, user.id);
  }

  @Get('get-my-reports')
  @Auth('user')
  getMyReports(@CurrentUser() user: JwtPayload) {
    return this.reportService.getMyReports(user.id);
  }
}
