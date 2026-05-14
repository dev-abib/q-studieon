import { Injectable } from '@nestjs/common';
import { bilingCycle, subscriptionStatus } from '@prisma/client';
import { UserRepository } from 'src/common/repositories/user.repository';
import { PrismaService } from 'src/prisma/prisma.service';
import Stripe from 'stripe';

@Injectable()
export class SubscriptionService {
  private readonly stripe: InstanceType<typeof Stripe>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly userRepo: UserRepository,
  ) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
      apiVersion: '2026-04-22.dahlia',
    });
  }

  private getPriceId(plan: bilingCycle): string {
    const priceId =
      plan === 'monthly'
        ? process.env.STRIPE_MONTHLY_PRICE_ID
        : process.env.STRIPE_YEARLY_PRICE_ID;

    if (!priceId) throw new Error(`Missing Stripe price ID for plan: ${plan}`);
    return priceId;
  }

  private async getOrCreateStripeCustomer(userId: string): Promise<string> {
    const user = await this.userRepo.findUser('id', userId);

    if (user.stripeCustomerId) return user.stripeCustomerId;

    const customer = this.stripe.customers.create({
      email: user.email as string,
      name: user.name as string,
      metadata: { userId },
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        stripeCustomerId: (await customer).id,
      },
    });
  }
}
