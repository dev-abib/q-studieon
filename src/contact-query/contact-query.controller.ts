import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { ContactQueryService } from './contact-query.service';
import { CreateContactQueryDto } from './dto/create-contact-query.dto';
import { GetAllContactQueriesDto } from './dto/get-all-contact-queries.dto';
import { ReplyContactQueryDto } from './dto/reply-contact-query.dto';
import { AssignContactQueryDto } from './dto/assign-contact-query.dto';
import { UpdateContactQueryStatusDto } from './dto/update-contact-query-status.dto';
import { UpdateContactQueryPriorityDto } from './dto/update-contact-query-priority.dto';
import { AddInternalNoteDto } from './dto/add-internal-note.dto';
import { BulkActionContactQueriesDto } from './dto/bulk-action-contact-queries.dto';
import { ToggleDeletePermissionDto } from './dto/toggle-delete-permission.dto';
import { ToggleUserDetailsPermissionDto } from './dto/toggle-user-details-permission.dto';
import { Public } from '../auth/decorators/public.decorator';
import { Auth } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/types/jwt.types';

@ApiTags('Contact Queries & Inquiries')
@Controller('contact-query')
export class ContactQueryController {
  constructor(private readonly contactQueryService: ContactQueryService) {}

  // ─── 1. Public Endpoint: Submit User Inquiry ───────────────────────────────
  @Post()
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Submit a user contact inquiry (public: saves to DB, checks user status, notifies site owner)',
  })
  submitQuery(@Body() dto: CreateContactQueryDto) {
    return this.contactQueryService.submitQuery(dto);
  }

  // ─── 2. Admin: Get Stats ───────────────────────────────────────────────────
  @Get('stats')
  @Auth('admin')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get summary statistics of inquiries for dashboard' })
  getStats() {
    return this.contactQueryService.getStats();
  }

  // ─── 3. Admin: Get Available Staff Members for Delegation ──────────────────
  @Get('staff-members')
  @Auth('admin')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get list of staff/admin members for case assignment' })
  getStaffMembers() {
    return this.contactQueryService.getStaffMembers();
  }

  // ─── 4. Admin: Get All Inquiries with Pagination & Filters ─────────────────
  @Get('all')
  @Auth('admin')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Get paginated inquiries with searching, sorting, and status filtering',
  })
  getAllQueries(@Query() dto: GetAllContactQueriesDto) {
    return this.contactQueryService.getAllQueries(dto);
  }

  // ─── 5. Admin: Get Single Inquiry ──────────────────────────────────────────
  @Get(':id')
  @Auth('admin')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a single inquiry details by ID' })
  @ApiParam({ name: 'id', description: 'Inquiry ID' })
  getQueryById(@Param('id') id: string) {
    return this.contactQueryService.getQueryById(id);
  }

  // ─── 6. Admin: Reply to Inquiry ────────────────────────────────────────────
  @Post(':id/reply')
  @Auth('admin')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Send email response to inquirer and record admin reply metadata in DB',
  })
  @ApiParam({ name: 'id', description: 'Inquiry ID' })
  replyToQuery(
    @Param('id') id: string,
    @Body() dto: ReplyContactQueryDto,
    @CurrentUser() admin: JwtPayload,
  ) {
    return this.contactQueryService.replyToQuery(id, dto, admin);
  }

  // ─── 7. Admin: Assign / Transfer Inquiry ───────────────────────────────────
  @Post(':id/assign')
  @Auth('admin')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Assign or transfer inquiry case to another staff member',
  })
  @ApiParam({ name: 'id', description: 'Inquiry ID' })
  assignQuery(
    @Param('id') id: string,
    @Body() dto: AssignContactQueryDto,
    @CurrentUser() admin: JwtPayload,
  ) {
    return this.contactQueryService.assignQuery(id, dto, admin);
  }

  // ─── 8. Admin: Bulk Operations ─────────────────────────────────────────────
  @Post('bulk')
  @Auth('admin')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Perform bulk action on multiple inquiries' })
  bulkAction(
    @Body() dto: BulkActionContactQueriesDto,
    @CurrentUser() admin: JwtPayload,
  ) {
    return this.contactQueryService.bulkAction(dto, admin);
  }

  // ─── 9. Admin: Update Priority ─────────────────────────────────────────────
  @Patch(':id/priority')
  @Auth('admin')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update priority of an inquiry' })
  @ApiParam({ name: 'id', description: 'Inquiry ID' })
  updatePriority(
    @Param('id') id: string,
    @Body() dto: UpdateContactQueryPriorityDto,
    @CurrentUser() admin: JwtPayload,
  ) {
    return this.contactQueryService.updatePriority(id, dto.priority, admin);
  }

  // ─── 10. Admin: Add Internal Note ──────────────────────────────────────────
  @Post(':id/notes')
  @Auth('admin')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Add internal staff note to inquiry' })
  @ApiParam({ name: 'id', description: 'Inquiry ID' })
  addInternalNote(
    @Param('id') id: string,
    @Body() dto: AddInternalNoteDto,
    @CurrentUser() admin: JwtPayload,
  ) {
    return this.contactQueryService.addInternalNote(id, dto.note, admin);
  }

  // ─── 11. Admin: Update Status ──────────────────────────────────────────────
  @Patch(':id/status')
  @Auth('admin')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update status of an inquiry' })
  @ApiParam({ name: 'id', description: 'Inquiry ID' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateContactQueryStatusDto,
  ) {
    return this.contactQueryService.updateStatus(id, dto.status);
  }

  // ─── 12. Super Admin: Toggle Delete Privilege for Staff ────────────────────
  @Patch('staff/:id/delete-permission')
  @Auth('super_admin')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Grant or revoke inquiry deletion privilege for a staff member (Super Admin only)',
  })
  @ApiParam({ name: 'id', description: 'Staff User ID' })
  toggleStaffDeletePermission(
    @Param('id') id: string,
    @Body() dto: ToggleDeletePermissionDto,
    @CurrentUser() admin: JwtPayload,
  ) {
    return this.contactQueryService.toggleStaffDeletePermission(
      id,
      dto.canDelete,
      admin,
    );
  }

  // ─── 12. Super Admin: Toggle User Details Privilege for Staff ───────────────
  @Patch('staff/:id/user-details-permission')
  @Auth('super_admin')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Grant or revoke user details viewing privilege for a staff member (Super Admin only)',
  })
  @ApiParam({ name: 'id', description: 'Staff User ID' })
  toggleStaffViewUserDetailsPermission(
    @Param('id') id: string,
    @Body() dto: ToggleUserDetailsPermissionDto,
    @CurrentUser() admin: JwtPayload,
  ) {
    return this.contactQueryService.toggleStaffViewUserDetailsPermission(
      id,
      dto.canViewUserDetails,
      admin,
    );
  }

  // ─── 13. Admin: Delete Inquiry ─────────────────────────────────────────────
  @Delete(':id')
  @Auth('admin')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete an inquiry by ID (Requires Super Admin or Delete Privilege)' })
  @ApiParam({ name: 'id', description: 'Inquiry ID' })
  deleteQuery(
    @Param('id') id: string,
    @CurrentUser() admin: JwtPayload,
  ) {
    return this.contactQueryService.deleteQuery(id, admin);
  }
}
