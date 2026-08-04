import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { SharedReportService } from './shared-report.service';
import { ShareReportDto } from './dto/share-report.dto';
import { ShareComparisonDto } from './dto/share-comparison.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Auth } from '../auth/decorators/auth.decorator';
import { Public } from '../auth/decorators/public.decorator';
import type { JwtPayload } from '../auth/types/jwt.types';

@ApiTags('Shared Report')
@Controller('shared-report')
export class SharedReportController {
  constructor(private readonly sharedReportService: SharedReportService) {}

  // ── Generate share link for a single report (auth required) ─────────────

  @Post('share/:reportId')
  @Auth('user')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate a shareable link for a report' })
  @ApiCreatedResponse({
    description:
      'Share link generated or already exists. Returns the token and full share URL.',
  })
  @ApiNotFoundResponse({ description: 'Report not found.' })
  @ApiForbiddenResponse({
    description: 'You can only share your own reports.',
  })
  @ApiBody({ type: ShareReportDto })
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

  // ── Generate share link for a collection (auth required) ────────────────

  @Post('share-collection/:collectionId')
  @Auth('user')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Generate a shareable link for a collection',
    description:
      'Creates a share link for an entire collection. All reports within ' +
      'the collection will be accessible via the shared link. The collection ' +
      'must belong to the authenticated user.',
  })
  @ApiCreatedResponse({
    description:
      'Collection share link generated or already exists. Returns the token and share URL.',
  })
  @ApiNotFoundResponse({
    description: 'Collection not found or access denied.',
  })
  @ApiParam({
    name: 'collectionId',
    description: 'Collection ID',
    example: 'cmqr3abc123',
  })
  async shareCollection(
    @Param('collectionId') collectionId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.sharedReportService.generateCollectionShareLink(
      collectionId,
      user,
    );
  }

  // ── Generate share link for a comparison (auth required) ────────────────

  @Post('share-comparison')
  @Auth('user')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Generate a shareable link comparing two reports side by side',
    description:
      'Creates a share link that compares two reports. Both reports must ' +
      'belong to the authenticated user, and they cannot be the same report.',
  })
  @ApiCreatedResponse({
    description:
      'Comparison share link generated or already exists. Returns the token and share URL.',
  })
  @ApiBadRequestResponse({
    description:
      'Invalid request. Cannot share a comparison of a report with itself.',
  })
  @ApiNotFoundResponse({
    description:
      'One or both reports not found or access denied.',
  })
  @ApiBody({ type: ShareComparisonDto })
  async shareComparison(
    @Body() dto: ShareComparisonDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.sharedReportService.generateComparisonShareLink(dto, user);
  }

  // ── View full shared report (auth required) ──────────────────────────────
  // IMPORTANT: specific routes must be declared BEFORE the dynamic :token route

  @Get(':token/full')
  @Auth('user')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Get full shared report/collection/comparison (auth required) — returns data based on viewer access level',
    description:
      'Returns the full content with access-level filtering.\n\n' +
      'For **report** shares: returns the single report.\n' +
      'For **collection** shares: returns all reports in the collection.\n' +
      'For **comparison** shares: returns both compared reports.\n\n' +
      'For **onsite property reports**, the response includes (for all users):\n' +
      '- `totalLevels` (number) — total number of levels surveyed\n' +
      '- `totalCaptures` (number) — total number of captures/elements\n' +
      '- `captures` (array) — each capture includes `photoUrls` (string[])\n\n' +
      'For non-onsite reports, these fields are omitted.',
  })
  @ApiOkResponse({
    description:
      'Returns the full shared data. The response structure depends on the share type ' +
      '(report, collection, or comparison) and the viewer\'s access level.',
  })
  @ApiNotFoundResponse({
    description: 'Shared report not found or link is invalid.',
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
  @ApiOperation({
    summary: 'Check if a share token is valid',
    description:
      'Returns whether a share token exists and is still valid. ' +
      'Works for all share types (report, collection, comparison). No authentication required.',
  })
  @ApiOkResponse({
    description:
      'Returns isValid: true if the token exists, false otherwise.',
  })
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
      'Get shared report/collection/comparison preview (public) — shows sharer info, property/collection details',
    description:
      'Returns a public preview of the shared content without requiring authentication.\n\n' +
      'For **report** shares: returns property details, entrance direction, and score.\n' +
      'For **collection** shares: returns collection name, description, and report count.\n' +
      'For **comparison** shares: returns basic info about both compared reports.',
  })
  @ApiOkResponse({
    description:
      'Preview data returned successfully. The response structure depends on the share type.',
  })
  @ApiNotFoundResponse({
    description: 'Shared report not found or link is invalid.',
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
