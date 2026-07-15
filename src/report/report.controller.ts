import { Controller, Body, Post, Get, Param } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
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

  @Get(':reportId')
  @Auth('user')
  @ApiOperation({ summary: 'Get a single remote property report by ID' })
  @ApiParam({
    name: 'reportId',
    description: 'Remote property report ID',
    example: 'cmqr3abc123',
  })
  getOne(
    @Param('reportId') reportId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.reportService.getReportById(reportId, user);
  }
}
