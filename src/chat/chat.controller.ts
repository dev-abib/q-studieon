import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '../auth/guards/auth-guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Auth } from '../auth/decorators/auth.decorator';
import { ChatService } from './chat.service';
import { CloudinaryService } from '../common/services/cloudinary.service';
import type { MulterFile } from '../common/pipes/file-validation.pipe';
import { JwtPayload } from '../auth/types/jwt.types';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@ApiTags('Chat')
@Auth('admin')
@UseGuards(AuthGuard, RolesGuard)
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  // ─── Staff list for DM / mentions ─────────────────────────────────────────
  @Get('staff')
  @ApiOperation({ summary: 'Get all staff for DM / mention autocomplete' })
  getStaff(@Request() req: RequestWithUser) {
    return this.chatService.getStaffList(req.user.id);
  }

  // ─── Groups ────────────────────────────────────────────────────────────────
  @Get('groups')
  @ApiOperation({ summary: 'List my chat groups' })
  getGroups(@Request() req: RequestWithUser) {
    return this.chatService.getMyGroups(req.user.id);
  }

  @Post('groups')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Create a group (super_admin only)' })
  createGroup(
    @Request() req: RequestWithUser,
    @Body()
    body: {
      name: string;
      description?: string;
      avatarColor?: string;
      avatarUrl?: string;
      memberIds: string[];
    },
  ) {
    return this.chatService.createGroup(req.user.id, body);
  }

  @Patch('groups/:id')
  @ApiOperation({ summary: 'Update a group' })
  updateGroup(
    @Request() req: RequestWithUser,
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      description?: string;
      avatarColor?: string;
      avatarUrl?: string;
      memberIds?: string[];
    },
  ) {
    return this.chatService.updateGroup(id, req.user.id, body);
  }

  @Post('groups/:id/leave')
  @ApiOperation({ summary: 'Leave a group' })
  leaveGroup(@Request() req: RequestWithUser, @Param('id') id: string) {
    return this.chatService.leaveGroup(id, req.user.id);
  }

  @Delete('groups/:id')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Archive a group (super_admin only)' })
  archiveGroup(@Request() req: RequestWithUser, @Param('id') id: string) {
    return this.chatService.archiveGroup(id, req.user.id);
  }

  // ─── Group messages ────────────────────────────────────────────────────────
  @Get('groups/:id/messages')
  @ApiOperation({ summary: 'Paginated group message history' })
  getGroupMessages(
    @Request() req: RequestWithUser,
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.chatService.getGroupMessages(id, req.user.id, cursor);
  }

  // ─── DM threads ────────────────────────────────────────────────────────────
  @Get('dms')
  @ApiOperation({ summary: 'List my DM conversations' })
  getDmThreads(@Request() req: RequestWithUser) {
    return this.chatService.getMyDmThreads(req.user.id);
  }

  @Get('dms/:partnerId/messages')
  @ApiOperation({ summary: 'Paginated DM history with a partner' })
  getDmMessages(
    @Request() req: RequestWithUser,
    @Param('partnerId') partnerId: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.chatService.getDmMessages(req.user.id, partnerId, cursor);
  }

  // ─── Unread counts ─────────────────────────────────────────────────────────
  @Get('unread')
  @ApiOperation({ summary: 'Unread mention counts' })
  getUnread(@Request() req: RequestWithUser) {
    return this.chatService.getUnreadCounts(req.user.id);
  }

  // ─── Surveillance (super_admin) ────────────────────────────────────────────
  @Get('surveillance')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Super admin: view all messages with filters' })
  getSurveillance(
    @Query('page') page?: string,
    @Query('search') search?: string,
    @Query('isFlagged') isFlagged?: string,
    @Query('isAutoFlagged') isAutoFlagged?: string,
    @Query('senderId') senderId?: string,
  ) {
    return this.chatService.getSurveillanceMessages({
      page: page ? parseInt(page) : undefined,
      search,
      isFlagged: isFlagged === 'true',
      isAutoFlagged: isAutoFlagged === 'true',
      senderId,
    });
  }

  @Patch('messages/:id/flag')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Super admin: manually flag a message' })
  flagMessage(
    @Request() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    return this.chatService.flagMessage(id, req.user.id, body.reason);
  }

  // ─── File upload ───────────────────────────────────────────────────────────
  @Post('upload')
  @ApiOperation({ summary: 'Upload a file attachment for a chat message' })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
    }),
  )
  async uploadAttachment(
    @UploadedFile() file: MulterFile | undefined,
  ) {
    if (!file) throw new BadRequestException('No file provided');

    const result = await this.cloudinary.uploadFile(file, 'chat-attachments');

    const mime = file.mimetype;
    let attachmentType: string;
    if (mime.startsWith('image/')) attachmentType = 'image';
    else if (mime.startsWith('video/')) attachmentType = 'video';
    else if (mime.startsWith('audio/')) attachmentType = 'audio';
    else attachmentType = 'document';

    return {
      success: true,
      data: {
        url: result.url,
        publicId: result.publicId,
        name: file.originalname,
        type: attachmentType,
        sizeBytes: file.size,
        mimeType: mime,
      },
    };
  }
}

