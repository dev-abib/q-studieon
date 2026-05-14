import {
  Body,
  Controller,
  Delete,
  Headers,
  HttpCode,
  Post,
  Req,
} from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import type { JwtPayload } from 'src/auth/types/jwt.types';
import { SubscriptionDto } from './dto/subscreption.dto';
import { NoGuest } from 'src/auth/decorators/no-guest.decorator';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { Public } from 'src/auth/decorators/public.decorator';

@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  // checkout controller
  @Post('checkout')
  @NoGuest()
  @Auth('user')
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
  async cancel(@CurrentUser() user: JwtPayload) {
    return this.subscriptionService.cancelSubscription(user.id);
  }

  // reactivate subscription controller
  @Post('reactivate')
  @NoGuest()
  async reactivate(@CurrentUser() user: JwtPayload) {
    return this.subscriptionService.reactivateSubscription(user.id);
  }

  // webhook controller
  @Post('webhook')
  @Public()
  @HttpCode(200)
  async stripeWebhook(
    @Req() req: Request & { rawBody: Buffer },
    @Headers('stripe-signature') sig: string,
  ) {
    await this.subscriptionService.handleWebHook(req.rawBody, sig);
    return { received: true };
  }
}
