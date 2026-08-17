// src/chat/chat.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';
import { ChatService } from './chat.service';
import { SuspiciousScanService } from './suspicious-scan.service';
import { PushService } from '../push/push.service';
import { JwtPayload } from '../auth/types/jwt.types';

interface AuthenticatedSocket extends Socket {
  user: JwtPayload;
}

@WebSocketGateway({
  cors: {
    origin: [
      'https://q-studieon-dashboard-next.vercel.app',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:3003',
      'http://localhost:4000',
      'http://localhost:4923',
      'https://admin.dwellr.tech',
    ],
    credentials: true,
  },
  namespace: '/chat',
  pingInterval: 60000,
  pingTimeout: 60000,
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);
  // staffId → Set of socket IDs
  private readonly onlineStaff = new Map<string, Set<string>>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly chatService: ChatService,
    private readonly scanner: SuspiciousScanService,
    private readonly pushService: PushService,
  ) {}

  // ─── Connection lifecycle ──────────────────────────────────────────────────

  async handleConnection(client: Socket) {
    try {
      // Support both: auth.token (explicit) and httpOnly cookie
      const authToken = client.handshake.auth?.token as string | undefined;
      const cookieHeader = client.handshake.headers?.cookie as string | undefined;
      const cookieToken = cookieHeader
        ?.split(';')
        .map((c) => c.trim())
        .find((c) => c.startsWith('accessToken='))
        ?.split('=')[1];

      const token = authToken || cookieToken;
      if (!token) throw new Error('No token');

      const secret = process.env.JWT_ADMIN_SECRET;
      const payload = this.jwtService.verify<JwtPayload>(token, { secret });

      (client as AuthenticatedSocket).user = payload;

      // Track online staff
      if (!this.onlineStaff.has(payload.id)) {
        this.onlineStaff.set(payload.id, new Set());
      }
      this.onlineStaff.get(payload.id)!.add(client.id);

      // Auto-join personal room (for DM delivery)
      await client.join(`user:${payload.id}`);

      // Auto-join every group the user is a member of. socket.io clears ALL
      // rooms when a socket disconnects, and on reconnect only the personal
      // room above would be restored — leaving group broadcasts dead until the
      // client re-emits joinGroup. Joining from the DB here makes real-time
      // group delivery reliable across reconnects.
      try {
        const groupIds = await this.chatService.getMyGroupIds(payload.id);
        await Promise.all(groupIds.map((id) => client.join(`group:${id}`)));
      } catch (err) {
        this.logger.warn(
          `Could not auto-join groups for ${payload.email}: ${(err as Error).message}`,
        );
      }

      // Broadcast updated online list to everyone
      this.broadcastOnlineList();

      this.logger.log(`Staff connected: ${payload.email} (${client.id})`);
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const user = (client as AuthenticatedSocket).user;
    if (user) {
      const sockets = this.onlineStaff.get(user.id);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) this.onlineStaff.delete(user.id);
      }
      this.broadcastOnlineList();
      this.logger.log(`Staff disconnected: ${user.email} (${client.id})`);
    }
  }

  private broadcastOnlineList() {
    const online = Array.from(this.onlineStaff.keys());
    this.server.emit('onlineList', { onlineStaffIds: online });
  }

  sendNotificationToUser(userId: string, title: string, body: string, data?: any) {
    const payload = {
      title,
      body,
      type: data?.type || 'inquiry',
      url: data?.url || '/dashboard/queries',
      data: { ...data, targetUserId: userId },
    };

    if (this.server) {
      this.server.to(`user:${userId}`).emit('systemNotification', payload);
      this.server.emit('systemNotification', payload);
    }
    // OS-level push even when recipient is not in browser
    void this.pushService.sendToUser(userId, {
      title,
      body,
      url: data?.url || '/dashboard/queries',
      data,
    });
  }

  sendNotificationToAdmins(title: string, body: string, data?: any) {
    const payload = {
      title,
      body,
      type: data?.type || 'inquiry',
      url: data?.url || '/dashboard/queries',
      data,
    };

    if (this.server) {
      this.server.emit('systemNotification', payload);
    }
    // OS-level push to all staff, regardless of whether their tab is open
    void this.pushService.sendToRole(
      ['super_admin', 'admin', 'customer_support', 'content_manager', 'finance'],
      {
        title,
        body,
        url: data?.url || '/dashboard/queries',
        data,
      },
    );
  }

  // ─── Room management ───────────────────────────────────────────────────────

  @SubscribeMessage('joinGroup')
  async handleJoinGroup(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { groupId: string },
  ) {
    await client.join(`group:${data.groupId}`);
    return { success: true };
  }

  @SubscribeMessage('leaveGroup')
  async handleLeaveGroup(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { groupId: string },
  ) {
    await client.leave(`group:${data.groupId}`);
    return { success: true };
  }

  // ─── Send Message ──────────────────────────────────────────────────────────

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    data: {
      content: string;
      groupId?: string;
      dmPartnerId?: string;
      mentionedIds?: string[];
      // Optional file attachment (uploaded separately via REST, URL passed here)
      attachmentUrl?: string;
      attachmentType?: string;
      attachmentName?: string;
      attachmentSizeBytes?: number;
      attachmentPublicId?: string;
    },
  ) {
    const user = (client as AuthenticatedSocket).user;
    if (!user) throw new WsException('Unauthorized');

    const {
      content,
      groupId,
      dmPartnerId,
      mentionedIds,
      attachmentUrl,
      attachmentType,
      attachmentName,
      attachmentSizeBytes,
      attachmentPublicId,
    } = data;

    const hasContent = content?.trim();
    const hasAttachment = !!attachmentUrl;

    if (!hasContent && !hasAttachment) return { error: 'Empty message' };
    if (!groupId && !dmPartnerId) return { error: 'Specify groupId or dmPartnerId' };

    // Scan for suspicious content (only text)
    const roomLabel = groupId ? `Group:${groupId}` : `DM with ${dmPartnerId}`;
    const scanResult = await this.scanner.scanAndAlert({
      content: content ?? '',
      messageId: 'pending',
      senderId: user.id,
      senderEmail: user.email,
      roomLabel,
    });

    // Persist message
    const message = await this.chatService.saveMessage({
      senderId: user.id,
      content: content ?? '',
      groupId,
      dmPartnerId,
      mentionedIds,
      isAutoFlagged: scanResult.flagged,
      autoFlagReason: scanResult.reason,
      attachmentUrl,
      attachmentType,
      attachmentName,
      attachmentSizeBytes,
      attachmentPublicId,
    });

    // Broadcast to room
    if (groupId) {
      this.server.to(`group:${groupId}`).emit('newMessage', { message });
    } else if (dmPartnerId) {
      this.server.to(`user:${user.id}`).emit('newMessage', { message });
      this.server.to(`user:${dmPartnerId}`).emit('newMessage', { message });

      // OS push for DM recipients (even if their tab is closed / they are in another app)
      if (dmPartnerId !== user.id) {
        const senderName = user.name || 'A teammate';
        const snippet =
          (content ?? '').slice(0, 80) || '📎 Sent an attachment';
        void this.pushService.sendToUser(dmPartnerId, {
          title: `💬 ${senderName}`,
          body: snippet,
          url: '/dashboard/team-chat',
          tag: `dm-${user.id}`,
          data: { senderId: user.id },
        });
      }
    }

    // Notify mentioned users (socket + OS push)
    let finalMentionedIds = mentionedIds ? [...mentionedIds] : [];
    const mentionsEveryone = /(^|\s)@(everyone|all|channel)(?=\s|$|[.,!?;:])/i.test(content ?? '');
    if (groupId && mentionsEveryone) {
      try {
        const memberIds = await this.chatService.getGroupMemberIds(groupId);
        finalMentionedIds = [...new Set([...finalMentionedIds, ...memberIds])];
      } catch (err) {
        this.logger.warn(`Failed to fetch group member IDs for @everyone: ${err}`);
      }
    }

    if (finalMentionedIds.length > 0) {
      const uniqueMentioned = [...new Set(finalMentionedIds)].filter((id) => id !== user.id);
      for (const mentionedId of uniqueMentioned) {
        this.server.to(`user:${mentionedId}`).emit('mentionNotification', {
          messageId: message.id,
          senderName: user.name,
          groupId,
          dmPartnerId: groupId ? undefined : user.id,
          contentSnippet: (content ?? '').slice(0, 80),
        });

        void this.pushService.sendToUser(mentionedId, {
          title: `🔔 ${user.name || 'Someone'} mentioned you`,
          body: `"${(content ?? '').slice(0, 80)}"`,
          url: '/dashboard/team-chat',
          tag: `mention-${message.id}`,
          data: { messageId: message.id, groupId, senderId: user.id },
        });
      }
    }

    // Alert super_admin room if auto-flagged (+ OS push & system notification to admins)
    if (scanResult.flagged) {
      this.server.to('super_admin_room').emit('suspiciousMessage', {
        messageId: message.id,
        senderId: user.id,
        senderEmail: user.email,
        reason: scanResult.reason,
        roomLabel,
      });

      this.sendNotificationToAdmins(
        '⚠️ SUSPICIOUS ACTIVITY DETECTED',
        `${user.email} flagged in ${roomLabel} for "${scanResult.reason}"`,
        { messageId: message.id, senderId: user.id, type: 'alert', url: '/dashboard/team-chat' }
      );

      void this.pushService.sendToRole(['super_admin'], {
        title: '⚠️ SUSPICIOUS ACTIVITY DETECTED',
        body: `${user.email} flagged in ${roomLabel} for "${scanResult.reason}"`,
        url: '/dashboard/team-chat',
        tag: `suspicious-${message.id}`,
        data: { messageId: message.id, senderId: user.id },
      });
    }

    return { success: true, message };
  }


  // ─── Typing indicator ──────────────────────────────────────────────────────

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { groupId?: string; dmPartnerId?: string; isTyping: boolean },
  ) {
    const user = (client as AuthenticatedSocket).user;
    const payload = {
      staffId: user.id,
      staffName: user.name,
      isTyping: data.isTyping,
    };

    if (data.groupId) {
      client.to(`group:${data.groupId}`).emit('typingIndicator', {
        ...payload,
        groupId: data.groupId,
      });
    } else if (data.dmPartnerId) {
      this.server.to(`user:${data.dmPartnerId}`).emit('typingIndicator', {
        ...payload,
        dmPartnerId: data.dmPartnerId,
      });
    }
  }

  // ─── Edit message ──────────────────────────────────────────────────────────

  @SubscribeMessage('editMessage')
  async handleEditMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { messageId: string; content: string; groupId?: string; dmPartnerId?: string },
  ) {
    const user = (client as AuthenticatedSocket).user;
    const updated = await this.chatService.editMessage(data.messageId, user.id, data.content);

    if (data.groupId) {
      this.server.to(`group:${data.groupId}`).emit('messageEdited', { message: updated });
    } else if (data.dmPartnerId) {
      this.server.to(`user:${user.id}`).emit('messageEdited', { message: updated });
      this.server.to(`user:${data.dmPartnerId}`).emit('messageEdited', { message: updated });
    }

    return { success: true, message: updated };
  }

  // ─── Delete message ────────────────────────────────────────────────────────

  @SubscribeMessage('deleteMessage')
  async handleDeleteMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { messageId: string; groupId?: string; dmPartnerId?: string },
  ) {
    const user = (client as AuthenticatedSocket).user;
    const isSuperAdmin = user.role === 'super_admin' || !!user.isOwner;
    await this.chatService.deleteMessage(data.messageId, user.id, isSuperAdmin);

    const deleteEvent = { messageId: data.messageId };
    if (data.groupId) {
      this.server.to(`group:${data.groupId}`).emit('messageDeleted', deleteEvent);
    } else if (data.dmPartnerId) {
      this.server.to(`user:${user.id}`).emit('messageDeleted', deleteEvent);
      this.server.to(`user:${data.dmPartnerId}`).emit('messageDeleted', deleteEvent);
    }

    return { success: true };
  }

  // ─── Mark read ─────────────────────────────────────────────────────────────

  @SubscribeMessage('markRead')
  async handleMarkRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { groupId?: string; dmPartnerId?: string },
  ) {
    const user = (client as AuthenticatedSocket).user;
    const roomKey = data.groupId || data.dmPartnerId || '';
    await this.chatService.markMentionsRead(user.id, roomKey);
    return { success: true };
  }

  // ─── Toggle Reaction ───────────────────────────────────────────────────────

  @SubscribeMessage('toggleReaction')
  async handleToggleReaction(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    data: {
      messageId: string;
      emoji: string;
      groupId?: string;
      dmPartnerId?: string;
    },
  ) {
    const user = (client as AuthenticatedSocket).user;
    const result = await this.chatService.toggleReaction(
      data.messageId,
      user.id,
      data.emoji,
    );

    const eventPayload = {
      messageId: data.messageId,
      reactions: result.reactions,
      groupId: result.groupId,
      dmPartnerId: result.dmPartnerId,
    };

    if (result.groupId) {
      this.server.to(`group:${result.groupId}`).emit('messageReactionUpdated', eventPayload);
    } else if (result.dmPartnerId || result.senderId) {
      this.server.to(`user:${user.id}`).emit('messageReactionUpdated', eventPayload);
      if (result.dmPartnerId) {
        this.server.to(`user:${result.dmPartnerId}`).emit('messageReactionUpdated', eventPayload);
      }
      if (result.senderId && result.senderId !== user.id) {
        this.server.to(`user:${result.senderId}`).emit('messageReactionUpdated', eventPayload);
      }
    }

    return { success: true, ...result };
  }

  // ─── Super admin joins surveillance room ───────────────────────────────────

  @SubscribeMessage('joinSurveillance')
  async handleJoinSurveillance(@ConnectedSocket() client: AuthenticatedSocket) {
    const user = (client as AuthenticatedSocket).user;
    if (user.role !== 'super_admin' && !user.isOwner) {
      throw new WsException('Forbidden');
    }
    await client.join('super_admin_room');
    return { success: true };
  }

  // ─── Group Member Management Socket Events ─────────────────────────────────

  @SubscribeMessage('addGroupMember')
  async handleAddGroupMember(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { groupId: string; staffId: string },
  ) {
    const user = (client as AuthenticatedSocket).user;
    const updatedGroup = await this.chatService.addMember(
      data.groupId,
      user.id,
      data.staffId,
    );

    // Notify room and added member
    this.server.to(`group:${data.groupId}`).emit('groupMemberAdded', {
      groupId: data.groupId,
      group: updatedGroup,
      addedStaffId: data.staffId,
    });
    this.server.to(`user:${data.staffId}`).emit('groupMemberAdded', {
      groupId: data.groupId,
      group: updatedGroup,
      addedStaffId: data.staffId,
    });

    return { success: true, group: updatedGroup };
  }

  @SubscribeMessage('removeGroupMember')
  async handleRemoveGroupMember(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { groupId: string; staffId: string },
  ) {
    const user = (client as AuthenticatedSocket).user;
    const updatedGroup = await this.chatService.removeMember(
      data.groupId,
      user.id,
      data.staffId,
    );

    // Notify room and removed member
    this.server.to(`group:${data.groupId}`).emit('groupMemberRemoved', {
      groupId: data.groupId,
      group: updatedGroup,
      removedStaffId: data.staffId,
    });
    this.server.to(`user:${data.staffId}`).emit('groupMemberRemoved', {
      groupId: data.groupId,
      group: updatedGroup,
      removedStaffId: data.staffId,
    });

    return { success: true, group: updatedGroup };
  }
}
