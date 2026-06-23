import { Controller, Body, Post, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReportService } from './report.service';
import { CreateReportDto } from './dto/create-report.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/types/jwt.types';
import { Auth } from '../auth/decorators/auth.decorator';

@ApiTags('Report')
@ApiBearerAuth()
@Controller('report')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Post('create-report')
  @Auth('user')
  @ApiOperation({ summary: 'Create a new remote property report' })
  async createReportDto(
    @Body() body: CreateReportDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.reportService.createReport(body, user);
  }

  @Get('get-my-reports')
  @Auth('user')
  @ApiOperation({ summary: 'Get all reports for the current user' })
  getMyReports(@CurrentUser() user: JwtPayload) {
    return this.reportService.getMyReports(user.id);
  }
}
