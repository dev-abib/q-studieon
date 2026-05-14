import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { bilingCycle, subscriptionStatus } from '@prisma/client';
import { UserRepository } from 'src/common/repositories/user.repository';
import { PrismaService } from 'src/prisma/prisma.service';
import Stripe from 'stripe';
import { SubscriptionDto, PlanType } from './dto/subscreption.dto';

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

  //  get price id helper
  private getPriceId(plan: PlanType | bilingCycle): string {
    const priceId =
      plan === 'monthly'
        ? process.env.STRIPE_MONTHLY_PRICE_ID
        : process.env.STRIPE_YEARLY_PRICE_ID;

    if (!priceId) throw new Error(`Missing Stripe price ID for plan: ${plan}`);
    return priceId;
  }

  //  get customer helper
  private async getOrCreateStripeCustomer(userId: string): Promise<string> {
    const user = await this.userRepo.findUser('id', userId);

    if (user.stripeCustomerId) return user.stripeCustomerId;

    const customer = await this.stripe.customers.create({
      email: user.email as string,
      name: user.name as string,
      metadata: { userId },
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        stripeCustomerId: customer.id,
      },
    });

    return customer.id;
  }

  // checkout session service
  async crateCheckoutSession(
    userId: string,
    body: SubscriptionDto,
  ): Promise<{ url: string }> {
    const user = await this.userRepo.findUser('id', userId);

    if (user.isGuest) {
      throw new ForbiddenException(
        'Guests must create an account before subscribing',
      );
    }

    if (user.status === 'active') {
      throw new BadRequestException(
        'You already have an active subscription. Cancel it first to change plans.',
      );
    }

    const customerId = await this.getOrCreateStripeCustomer(user.id);
    const priceId = this.getPriceId(body.plan);
    const scheme = process.env.APP_SCHEME ?? 'myapp';

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${scheme}://subscription/success`,
      cancel_url: `${scheme}://subscription/cancel`,
      metadata: { userId, plan: body.plan },
    });

    return {
      url: session.url as string,
    };
  }

  // cancel subscription status service
  async cancelSubscription(userId: string): Promise<{ message: string }> {
    const user = await this.userRepo.findUser('id', userId);

    if (!user.stripeSubscriptionId) {
      throw new BadRequestException('No active subscription found.');
    }

    if (user.status !== 'active' && user.status !== 'trailing') {
      throw new BadRequestException('Subscription is not active');
    }

    const subscription = await this.stripe.subscriptions.update(
      user.stripeSubscriptionId,
      { cancel_at_period_end: true },
    );

    const periodEnd = new Date(
      (subscription as unknown as { current_period_end: number })
        .current_period_end * 1000,
    );

    return {
      message: `Your subscription will be cancelled on ${periodEnd.toDateString()}. You keep Pro access until then.`,
    };
  }

  // reactivate subscription service
  async reactivateSubscription(userId: string): Promise<{ message: string }> {
    const user = await this.userRepo.findUser('id', userId);

    if (!user.stripeSubscriptionId) {
      throw new BadRequestException('No active subscription found.');
    }

    const stripeSub = await this.stripe.subscriptions.retrieve(
      user.stripeSubscriptionId,
    );

    if (!stripeSub.cancel_at_period_end) {
      throw new BadRequestException(
        'Subscription is not pending cancellation — nothing to reactivate',
      );
    }

    await this.stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });

    return {
      message: `Subscription reactivated successfully`,
    };
  }

  async handleWebHook(rawBody: Buffer, signature: string): Promise<void> {
    let event: unknown;
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET as string,
      );
    } catch {
      throw new BadRequestException('Invalid Stripe webhook signature');
    }

    const eventType =
      typeof event === 'object' && event !== null && 'type' in event
        ? (event as { type: string }).type
        : undefined;

    const payload =
      typeof event === 'object' && event !== null && 'data' in event
        ? (event as { data: { object?: unknown } }).data.object
        : undefined;

    if (!eventType) return;

    switch (eventType) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.onSubscriptionUpsert(payload);
        break;

      case 'customer.subscription.deleted':
        await this.onSubscriptionDeleted(payload);
        break;

      case 'invoice.payment_failed':
        await this.onPaymentFailed(payload);
        break;

      case 'invoice.payment_succeeded':
        await this.onPaymentSucceeded(payload);
        break;

      default:
        break;
    }
  }

  // ── Webhook: subscription created or updated ──────────────────────────────
  private async onSubscriptionUpsert(stripeSub: unknown) {
    if (typeof stripeSub !== 'object' || stripeSub === null) return;

    // stripeSub.customer is the "cus_xxx" string stored in user.stripeCustomerId
    const customerId =
      'customer' in stripeSub
        ? (stripeSub as { customer?: string }).customer
        : undefined;
    if (!customerId) return;

    const items =
      'items' in stripeSub
        ? (stripeSub as { items?: { data?: unknown[] } }).items?.data
        : undefined;
    const firstItem = Array.isArray(items) ? items[0] : undefined;
    const interval =
      typeof firstItem === 'object' && firstItem !== null && 'plan' in firstItem
        ? (firstItem as { plan?: { interval?: string } }).plan?.interval
        : undefined;
    const plan: bilingCycle = interval === 'year' ? 'yearly' : 'monthly';

    const statusMap: Record<string, subscriptionStatus> = {
      active: 'active',
      trialing: 'trailing',
      past_due: 'past_due',
      incomplete: 'incomplete',
      canceled: 'cancelled',
      unpaid: 'past_due',
    };
    const rawStatus =
      'status' in stripeSub
        ? (stripeSub as { status?: string }).status
        : undefined;
    const status: subscriptionStatus =
      rawStatus && statusMap[rawStatus] ? statusMap[rawStatus] : 'incomplete';

    const isPaid = status === 'active' || status === 'trailing';

    // If cancel_at_period_end = true, user is still paid till period end
    const cancelAtPeriodEnd =
      'cancel_at_period_end' in stripeSub
        ? Boolean(
            (stripeSub as { cancel_at_period_end?: unknown })
              .cancel_at_period_end,
          )
        : false;
    const resolvedStatus: subscriptionStatus = cancelAtPeriodEnd
      ? 'cancelled'
      : status;

    const subscriptionId =
      'id' in stripeSub ? (stripeSub as { id?: string }).id : undefined;
    const currentPeriodEnd =
      'current_period_end' in stripeSub
        ? (stripeSub as { current_period_end?: number }).current_period_end
        : undefined;

    // Find user by stripeCustomerId and update subscription fields
    await this.prisma.user.updateMany({
      where: { stripeCustomerId: customerId },
      data: {
        stripeSubscriptionId: subscriptionId ?? undefined,
        status: resolvedStatus,
        billingCycle: plan,
        isPaid: cancelAtPeriodEnd ? true : isPaid,
        currentPeriodEnd: currentPeriodEnd ?? undefined,
        planKey: `pro_${plan}`,
      },
    });
  }

  // ── Webhook: subscription hard deleted ────────────────────────────────────
  private async onSubscriptionDeleted(stripeSub: unknown) {
    if (typeof stripeSub !== 'object' || stripeSub === null) return;
    const customerId =
      'customer' in stripeSub
        ? (stripeSub as { customer?: string }).customer
        : undefined;
    if (!customerId) return;

    await this.prisma.user.updateMany({
      where: { stripeCustomerId: customerId },
      data: {
        stripeSubscriptionId: null,
        status: 'cancelled',
        isPaid: false,
        currentPeriodEnd: null,
        planKey: null,
      },
    });
  }

  // ── Webhook: payment failed ───────────────────────────────────────────────
  private async onPaymentFailed(invoice: unknown) {
    if (typeof invoice !== 'object' || invoice === null) return;
    const customerId =
      'customer' in invoice
        ? (invoice as { customer?: string }).customer
        : undefined;
    if (!customerId) return;

    await this.prisma.user.updateMany({
      where: { stripeCustomerId: customerId },
      data: {
        status: 'past_due',
        isPaid: false,
      },
    });
  }

  // ── Webhook: payment succeeded (monthly/yearly renewal) ───────────────────
  private async onPaymentSucceeded(invoice: unknown) {
    if (typeof invoice !== 'object' || invoice === null) return;
    const billingReason =
      'billing_reason' in invoice
        ? (invoice as { billing_reason?: string }).billing_reason
        : undefined;
    if (billingReason !== 'subscription_cycle') return;

    const subscriptionId =
      'subscription' in invoice
        ? (invoice as { subscription?: string }).subscription
        : undefined;
    const customerId =
      'customer' in invoice
        ? (invoice as { customer?: string }).customer
        : undefined;
    if (!subscriptionId || !customerId) return;

    const stripeSub = await this.stripe.subscriptions.retrieve(subscriptionId);
    const currentPeriodEnd =
      typeof stripeSub === 'object' &&
      stripeSub !== null &&
      'current_period_end' in stripeSub
        ? (stripeSub as { current_period_end?: number }).current_period_end
        : undefined;

    await this.prisma.user.updateMany({
      where: { stripeCustomerId: customerId },
      data: {
        status: 'active',
        isPaid: true,
        currentPeriodEnd: currentPeriodEnd ?? undefined,
      },
    });
  }
}
