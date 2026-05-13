import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';

@Injectable()
export class SubscriptionService {
  private readonly stripe: Stripe;
}
