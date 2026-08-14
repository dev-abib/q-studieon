import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Auth } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/types/jwt.types';
import { AdminService } from './admin.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { createFileUploadInterceptor } from '../common/interceptors/file-upload.interceptor';
import {
  FileValidationPipe,
  type MulterFile,
} from '../common/pipes/file-validation.pipe';
import { UserService } from '../user/user.service';
import { AdminMailDto } from '../auth/dto/admin.mail.dto';
import { Public } from '../auth/decorators/public.decorator';
import { InviteAdminDto } from './dto/invite-admin.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import {
  AdminForgotPasswordDto,
  AdminResetPasswordDto,
} from './dto/admin-password.dto';
import { BlockUserDto } from './dto/block-user.dto';
import { SoftDeleteUserDto } from './dto/soft-delete-user.dto';
import { FlagUserDto } from './dto/flag-user.dto';
import { ResolveFlagDto } from './dto/resolve-flag.dto';
import { GrantAccessDto, RevokeAccessDto } from './dto/grant-access.dto';

import { AuditService } from './audit.service';
import { PresenceService, PresenceHeartbeatDto } from './presence.service';
import { SecurityAlertService } from './security-alert.service';
import { InternalNotesService, CreateInternalNoteDto } from './internal-notes.service';
import { SystemStatusService } from './system-status.service';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly user: UserService,
    private readonly auditService: AuditService,
    private readonly presenceService: PresenceService,
    private readonly securityAlertService: SecurityAlertService,
    private readonly internalNotesService: InternalNotesService,
    private readonly systemStatusService: SystemStatusService,
  ) {}

  // ─── Real-Time Presence & Collision Prevention ────────────────────────────
  @Post('presence/heartbeat')
  @Auth('admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Update active presence heartbeat and current location' })
  recordPresenceHeartbeat(
    @CurrentUser() admin: JwtPayload,
    @Body() dto: PresenceHeartbeatDto,
  ) {
    return this.presenceService.recordHeartbeat(
      admin.id,
      admin.name,
      admin.email,
      admin.role,
      undefined,
      dto,
    );
  }

  @Get('presence/active')
  @Auth('admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get all active online staff and collision detection' })
  getActivePresence(
    @CurrentUser() admin: JwtPayload,
    @Query('targetId') targetId?: string,
  ) {
    return this.presenceService.getActivePresences(admin.id, targetId);
  }

  // ─── Private Internal Staff Notes ─────────────────────────────────────────
  @Get('internal-notes/:targetType/:targetId')
  @Auth('admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get internal staff notes for a user or query' })
  getInternalNotes(
    @Param('targetType') targetType: string,
    @Param('targetId') targetId: string,
  ) {
    return this.internalNotesService.getNotes(targetType, targetId);
  }

  @Post('internal-notes')
  @Auth('admin')
  @HttpCode(201)
  @ApiOperation({ summary: 'Add a private internal note' })
  createInternalNote(
    @Body() dto: CreateInternalNoteDto,
    @CurrentUser() admin: JwtPayload,
  ) {
    return this.internalNotesService.createNote(dto, admin);
  }

  @Patch('internal-notes/:id/pin')
  @Auth('admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Pin/unpin an internal note' })
  togglePinInternalNote(@Param('id') id: string) {
    return this.internalNotesService.togglePin(id);
  }

  @Delete('internal-notes/:id')
  @Auth('admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete an internal note' })
  deleteInternalNote(
    @Param('id') id: string,
    @CurrentUser() admin: JwtPayload,
  ) {
    return this.internalNotesService.deleteNote(id, admin);
  }

  // ─── Security & Anomaly Detection ─────────────────────────────────────────
  @Get('security-alerts')
  @Auth('admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get active security & anomaly alerts' })
  getSecurityAlerts(@Query('isResolved') isResolved?: string) {
    return this.securityAlertService.getAlerts(isResolved === 'true');
  }

  @Patch('security-alerts/:id/resolve')
  @Auth('super_admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Resolve a security alert (super admin only)' })
  resolveSecurityAlert(
    @Param('id') id: string,
    @CurrentUser() admin: JwtPayload,
  ) {
    return this.securityAlertService.resolveAlert(id, admin.name || admin.email || 'Admin');
  }

  // ─── Super Admin: Impersonate User ────────────────────────────────────────
  @Post('impersonate-user/:userId')
  @Auth('super_admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Start safe user impersonation mode' })
  impersonateUser(
    @Param('userId') userId: string,
    @CurrentUser() admin: JwtPayload,
  ) {
    return this.adminService.impersonateUser(userId, admin);
  }

  // ─── VIP Grant Expiry Check Trigger ───────────────────────────────────────
  @Post('trigger-grant-expiry-check')
  @Auth('super_admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Trigger VIP grant expiry notifications and conversion' })
  triggerGrantExpiryCheck() {
    return this.adminService.checkExpiringGrants();
  }

  // ─── 1-Click CSV Exports ──────────────────────────────────────────────────
  @Get('export/work-time-csv')
  @Auth('admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Export team work time spreadsheet as CSV' })
  exportWorkTimeCsv() {
    return this.adminService.exportWorkTimeCsv();
  }

  @Get('export/audit-logs-csv')
  @Auth('admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Export site modification audit logs as CSV' })
  exportAuditLogsCsv() {
    return this.adminService.exportAuditLogsCsv();
  }

  // get me admin controller
  @Get('get-me-admin')
  @Auth('admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get current admin profile' })
  getMeAdmin(@CurrentUser() user: JwtPayload) {
    return this.adminService.getMeAdmin(user);
  }

  @Get('staff-profile/:id')
  @Auth('admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get staff member profile, duties, stats, and audit trail' })
  @ApiParam({ name: 'id', description: 'Staff user ID or "me"' })
  getStaffProfile(
    @Param('id') id: string,
    @CurrentUser() admin: JwtPayload,
  ) {
    return this.adminService.getStaffProfile(id, admin);
  }

  @Get('audit-logs')
  @Auth('admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get paginated staff audit logs and site changes' })
  getAuditLogs(@Query() query: any) {
    return this.auditService.getAuditLogs(query);
  }

  @Get('work-time-summary')
  @Auth('admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get team working hours and session analytics' })
  getTeamWorkTimeSummary() {
    return this.auditService.getTeamWorkTimeSummary();
  }

  @Get('staff-work-time/:id')
  @Auth('admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get individual staff working hours and session breakdown' })
  @ApiParam({ name: 'id', description: 'Staff user ID or "me"' })
  getStaffWorkTime(
    @Param('id') id: string,
    @CurrentUser() admin: JwtPayload,
  ) {
    const targetId = !id || id === 'me' ? admin.id : id;
    return this.auditService.getStaffWorkTimeDetails(targetId);
  }

  // get all admin controller
  @Get('get-all-admins')
  @Auth('super_admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get all admins (super admin only)' })
  getAllAdmin(@Query() query: PaginationDto) {
    return this.adminService.getAllAdminsUsers(query);
  }

  //  create admin controller
  @Post('create-admin')
  @Auth('super_admin')
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a new admin (super admin only)' })
  createAdmin(@Body() dto: CreateAdminDto, @CurrentUser() admin: JwtPayload) {
    return this.adminService.createAdmin(dto, admin);
  }

  // update admin controller
  @Put('update-admin')
  @Auth('admin')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Update admin profile with optional profile picture',
  })
  @UseInterceptors(createFileUploadInterceptor({ fieldName: 'profilePicture' }))
  updateAdmin(
    @Body() dto: UpdateAdminDto,
    @UploadedFile(new FileValidationPipe({ required: false, maxSizeMB: 5 }))
    profilePicture: MulterFile,
    @CurrentUser() user: JwtPayload,
  ) {
    const hasBodyField = Object.keys(dto).some(
      (key) => dto[key as keyof UpdateAdminDto] !== undefined,
    );

    if (!hasBodyField && !profilePicture) {
      throw new BadRequestException('At least one field must be provided');
    }
    return this.adminService.updateAdmin(dto, profilePicture, user);
  }

  // get all users controller
  @Get('get-all-users')
  @Auth('admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get all users (admin only)' })
  getAllUsers(@Query() query: PaginationDto) {
    return this.adminService.getAllAdminsUsers(query, false);
  }

  // get user by id controller
  @Get('user/:id')
  @HttpCode(200)
  @Auth('admin')
  @ApiOperation({ summary: 'Get a user by ID' })
  @ApiParam({ name: 'id', description: 'User ID' })
  getUserById(@Param('id') id: string, @CurrentUser() admin: JwtPayload) {
    return this.user.getMe(id, admin);
  }

  @Delete('delete-admin/:id')
  @Auth('admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete an admin by ID (super admin only)' })
  @ApiParam({ name: 'id', description: 'Admin ID' })
  deleteAdmin(@Param('id') id: string, @CurrentUser() admin: JwtPayload) {
    return this.adminService.deleteAdminOrUser(id, true, admin);
  }

  @Delete('delete-user/:id')
  @Auth('admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Soft delete a user with 60-day recovery retention (or hard delete if requested by super admin)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  deleteUser(
    @Param('id') id: string,
    @Body() dto: SoftDeleteUserDto,
    @CurrentUser() admin: JwtPayload,
  ) {
    if (admin.role === 'customer_support') {
      throw new UnauthorizedException(
        'Customer support members cannot delete users',
      );
    }
    return this.adminService.softDeleteUser(id, dto, admin);
  }

  @Post('soft-delete-user/:id')
  @Auth('admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Soft delete a user with 60-day recovery retention' })
  @ApiParam({ name: 'id', description: 'User ID' })
  softDeleteUser(
    @Param('id') id: string,
    @Body() dto: SoftDeleteUserDto,
    @CurrentUser() admin: JwtPayload,
  ) {
    if (admin.role === 'customer_support') {
      throw new UnauthorizedException(
        'Customer support members cannot delete users',
      );
    }
    return this.adminService.softDeleteUser(id, dto, admin);
  }

  @Patch('restore-user/:id')
  @Auth('admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Restore and retain a soft-deleted user account' })
  @ApiParam({ name: 'id', description: 'User ID' })
  restoreUser(
    @Param('id') id: string,
    @CurrentUser() admin: JwtPayload,
  ) {
    return this.adminService.restoreUser(id, admin);
  }

  @Patch('block-user/:id')
  @Auth('admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Soft block a user for a custom time range' })
  @ApiParam({ name: 'id', description: 'User ID' })
  blockUser(
    @Param('id') id: string,
    @Body() dto: BlockUserDto,
    @CurrentUser() admin: JwtPayload,
  ) {
    return this.adminService.blockUser(id, dto, admin);
  }

  @Patch('unblock-user/:id')
  @Auth('admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Unblock a soft-blocked user immediately' })
  @ApiParam({ name: 'id', description: 'User ID' })
  unblockUser(
    @Param('id') id: string,
    @CurrentUser() admin: JwtPayload,
  ) {
    return this.adminService.unblockUser(id, admin);
  }

  @Post('flag-user/:id')
  @Auth('admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Flag user to Super Admin with reason and notes for block/delete review' })
  @ApiParam({ name: 'id', description: 'User ID' })
  flagUser(
    @Param('id') id: string,
    @Body() dto: FlagUserDto,
    @CurrentUser() admin: JwtPayload,
  ) {
    return this.adminService.flagUser(id, dto, admin);
  }

  @Patch('resolve-flag/:flagId')
  @Auth('admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Resolve a moderation flag (Super Admin only)' })
  @ApiParam({ name: 'flagId', description: 'Flag ID' })
  resolveFlag(
    @Param('flagId') flagId: string,
    @Body() dto: ResolveFlagDto,
    @CurrentUser() admin: JwtPayload,
  ) {
    return this.adminService.resolveFlag(flagId, dto, admin);
  }

  @Patch('grant-access/:userId')
  @Auth('admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Grant complimentary subscription access to a user (Admin)' })
  @ApiParam({ name: 'userId', description: 'Target user ID' })
  grantUserAccess(
    @Param('userId') userId: string,
    @Body() dto: GrantAccessDto,
    @CurrentUser() admin: JwtPayload,
  ) {
    return this.adminService.grantUserAccess(userId, dto, admin);
  }

  @Patch('revoke-access/:userId')
  @Auth('admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Revoke subscription access from a user (Admin)' })
  @ApiParam({ name: 'userId', description: 'Target user ID' })
  revokeUserAccess(
    @Param('userId') userId: string,
    @Body() dto: RevokeAccessDto,
    @CurrentUser() admin: JwtPayload,
  ) {
    return this.adminService.revokeUserAccess(userId, dto, admin);
  }

  // get dashboard analytics
  @Get('dashboard-analytics')
  @Auth('admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get dashboard analytics (admin only)' })
  getDashboardAnalytics(@CurrentUser() user: JwtPayload) {
    return this.adminService.getDashboardAnalytics(user);
  }

  // send admin mail
  @Post('admin-mail')
  @HttpCode(200)
  @Auth('admin')
  @ApiOperation({ summary: 'Send an email from admin to a user' })
  sendAdminMail(@Body() dto: AdminMailDto, @CurrentUser() admin: JwtPayload) {
    return this.adminService.sendAdminMail(dto, admin);
  }

  @Post('invite-member')
  @HttpCode(201)
  @Auth('super_admin')
  @ApiOperation({
    summary: 'Invite a new team member via email (super admin only)',
  })
  inviteMember(@Body() dto: InviteAdminDto, @CurrentUser() admin: JwtPayload) {
    return this.adminService.inviteTeamMember(dto, admin);
  }

  @Get('verify-invite')
  @HttpCode(200)
  @Public()
  @ApiOperation({ summary: 'Verify invitation token' })
  verifyInviteToken(@Query('token') token: string) {
    return this.adminService.verifyInviteToken(token);
  }

  @Post('accept-invite')
  @HttpCode(200)
  @Public()
  @ApiOperation({ summary: 'Accept invitation and create password' })
  acceptInvite(@Body() dto: AcceptInviteDto) {
    return this.adminService.acceptInvite(dto);
  }

  @Post('forgot-password')
  @HttpCode(200)
  @Public()
  @ApiOperation({ summary: 'Request admin password reset link' })
  forgotPassword(@Body() dto: AdminForgotPasswordDto) {
    return this.adminService.adminForgotPassword(dto);
  }

  @Post('reset-password')
  @HttpCode(200)
  @Public()
  @ApiOperation({ summary: 'Reset admin password using token' })
  resetPassword(@Body() dto: AdminResetPasswordDto) {
    return this.adminService.adminResetPassword(dto);
  }

  @Patch('toggle-password-permission/:staffId')
  @Auth('admin')
  @ApiOperation({ summary: 'Toggle staff manual password change permission (Super Admin only)' })
  togglePasswordPermission(
    @Param('staffId') staffId: string,
    @Body('canChangePassword') canChangePassword: boolean,
    @CurrentUser() admin: JwtPayload,
  ) {
    return this.adminService.togglePasswordPermission(staffId, Boolean(canChangePassword), admin);
  }

  // ─── System Health, OpenAI Tokens, and Infrastructure Status ───────────────
  @Get('system/status')
  @Auth('admin')
  @ApiOperation({ summary: 'Get real-time infrastructure, OpenAI token usage, and database health metrics' })
  getSystemStatus() {
    return this.systemStatusService.getSystemStatus();
  }
}
