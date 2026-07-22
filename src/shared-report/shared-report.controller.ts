import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { SharedReportService } from './shared-report.service';
import { ShareReportDto } from './dto/share-report.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Auth } from '../auth/decorators/auth.decorator';
import { Public } from '../auth/decorators/public.decorator';
import type { JwtPayload } from '../auth/types/jwt.types';

@ApiTags('Shared Report')
@Controller('shared-report')
export class SharedReportController {
  constructor(private readonly sharedReportService: SharedReportService) {}

  // ── Generate share link (auth required) ──────────────────────────────────

  @Post('share/:reportId')
  @Auth('user')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate a shareable link for a report' })
  @ApiParam({
    name: 'reportId',
    description: 'Report ID (onsite or remote)',
    example: 'cmqr3abc123',
  })
  async shareReport(
    @Param('reportId') reportId: string,
    @Body() dto: ShareReportDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.sharedReportService.generateShareLink(reportId, user, dto);
  }

  // ── View full shared report (auth required) ──────────────────────────────
  // IMPORTANT: specific routes must be declared BEFORE the dynamic :token route

  @Get(':token/full')
  @Auth('user')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Get full shared report (auth required) — returns report based on viewer access level',
    description:
      'Returns the full report with access-level filtering.\n\n' +
      'For **onsite property reports** viewed with `paid_full` access, the response includes:\n' +
      '- `totalLevels` (number) — total number of levels surveyed\n' +
      '- `totalCaptures` (number) — total number of captures/elements\n' +
      '- `captures` (array) — each capture includes `photoUrls` (string[]) mapping the uploaded photos to that specific capture/element\n\n' +
      'For non-onsite reports or lower access levels, these fields are omitted.',
  })
  @ApiParam({
    name: 'token',
    description: 'Unique share token',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  async getSharedReportFull(
    @Param('token') token: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.sharedReportService.getSharedReportFull(token, user);
  }

  // ── Check if a share token is valid ─────────────────────────────────────

  @Get(':token/check')
  @Public()
  @ApiOperation({ summary: 'Check if a share token is valid' })
  @ApiParam({
    name: 'token',
    description: 'Unique share token',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  async checkToken(@Param('token') token: string) {
    return this.sharedReportService.checkSharedReport(token);
  }

  // ── Preview shared report (public — no auth) ────────────────────────────
  // WARNING: dynamic :token route MUST be declared LAST to avoid catching
  // specific routes like :token/full and :token/check

  @Get(':token')
  @Public()
  @ApiOperation({
    summary:
      'Get shared report preview (public) — shows sharer info, property details, entrance direction',
  })
  @ApiParam({
    name: 'token',
    description: 'Unique share token',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  async getSharedPreview(@Param('token') token: string) {
    return this.sharedReportService.getSharedReportPreview(token);
  }
}
