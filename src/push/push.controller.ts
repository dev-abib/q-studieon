// src/push/push.controller.ts
import {
  Controller,
  Post,
  Delete,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '../auth/guards/auth-guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Auth } from '../auth/decorators/auth.decorator';
import { PushService } from './push.service';
import type { PushSubscriptionInput } from './push.service';
import type { Request } from 'express';
import { JwtPayload } from '../auth/types/jwt.types';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@ApiTags('Push Notifications')
@Auth('admin')
@UseGuards(AuthGuard, RolesGuard)
@Controller('push')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  // Register this browser/device for OS push notifications
  @Post('subscribe')
  @ApiOperation({ summary: 'Register a device for OS push notifications' })
  subscribe(
    @Req() req: RequestWithUser,
    @Body() body: PushSubscriptionInput,
  ) {
    return this.pushService.subscribe(
      req.user.id,
      body,
      req.headers['user-agent'],
    );
  }

  // Remove a device from OS push notifications
  @Delete('subscribe')
  @ApiOperation({ summary: 'Unregister a device from OS push notifications' })
  unsubscribe(@Req() req: RequestWithUser, @Body() body: { endpoint: string }) {
    return this.pushService.unsubscribe(req.user.id, body.endpoint);
  }
}
