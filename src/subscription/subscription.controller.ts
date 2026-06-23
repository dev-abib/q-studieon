import {
  Body,
  Controller,
  Delete,
  Headers,
  HttpCode,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SubscriptionService } from './subscription.service';
import type { JwtPayload } from '../auth/types/jwt.types';
import { SubscriptionDto } from './dto/subscreption.dto';
import { NoGuest } from '../auth/decorators/no-guest.decorator';
import { Auth } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { RawResponse } from '../common/decorators/raw-response.decorator';

@ApiTags('Subscription')
@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  // checkout controller
  @Post('checkout')
  @NoGuest()
  @Auth('user')
  @ApiOperation({ summary: 'Create a Stripe checkout session' })
  @ApiBearerAuth()
  async createCheckout(
    @CurrentUser() user: JwtPayload,
    @Body() body: SubscriptionDto,
  ) {
    return this.subscriptionService.crateCheckoutSession(user.id, body);
  }

  // cancel subscription controller
  @Delete('cancel')
  @NoGuest()
  @Auth('user')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel a subscription' })
  async cancel(@CurrentUser() user: JwtPayload) {
    return this.subscriptionService.cancelSubscription(user.id);
  }

  // reactivate subscription controller
  @Post('reactivate')
  @NoGuest()
  @Auth('user')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reactivate a cancelled subscription' })
  async reactivate(@CurrentUser() user: JwtPayload) {
    return this.subscriptionService.reactivateSubscription(user.id);
  }

  @Post('webhook')
  @Public()
  @HttpCode(200)
  @RawResponse()
  @ApiOperation({ summary: 'Stripe webhook handler' })
  async stripeWebhook(
    @Req() req: Request & { rawBody: Buffer },
    @Headers('stripe-signature') sig: string,
  ) {
    await this.subscriptionService.handleWebHook(req.rawBody, sig);
    return { received: true };
  }
}
