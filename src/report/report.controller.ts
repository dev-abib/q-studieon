import { Controller, Body, Post } from '@nestjs/common';
import { ReportService } from './report.service';
import { Public } from '../auth/decorators/public.decorator';
import { CreateReportDto } from './dto/create-report.dto';

@Controller('report')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Post('create-report')
  @Public()
  async createReportDto(@Body() body: CreateReportDto) {
    return this.reportService.createReport(body);
  }
}
