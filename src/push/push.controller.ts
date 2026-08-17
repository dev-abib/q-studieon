import {
  Controller,
  Get,
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
import { Public } from '../auth/decorators/public.decorator';
import { PushService } from './push.service';
import type { PushSubscriptionInput } from './push.service';
import type { Request } from 'express';
import { JwtPayload } from '../auth/types/jwt.types';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@ApiTags('Push Notifications')
@Controller('push')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  // Get VAPID public key for Web Push client subscription
  @Get('vapid-public-key')
  @Public()
  @ApiOperation({ summary: 'Get VAPID public key for Web Push subscription' })
  getVapidPublicKey() {
    return {
      publicKey: process.env.VAPID_PUBLIC_KEY || '',
    };
  }

  // Register this browser/device for OS push notifications
  @Post('subscribe')
  @Auth('admin')
  @UseGuards(AuthGuard, RolesGuard)
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
