import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { bilingCycle, subscriptionStatus } from '@prisma/client';
import { UserRepository } from '../common/repositories/user.repository';
import { PrismaService } from '../prisma/prisma.service';
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

  private getPriceId(plan: PlanType | bilingCycle): string {
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

    const customer = await this.stripe.customers.create({
      email: user.email as string,
      name: user.name as string,
      metadata: { userId },
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { stripeCustomerId: customer.id },
    });

    return customer.id;
  }

  private getBillingCycleFromSub(rawSub: Record<string, unknown>): bilingCycle {
    const items = Array.isArray(
      (rawSub.items as Record<string, unknown> | undefined)?.data,
    )
      ? ((rawSub.items as Record<string, unknown>).data as unknown[])
      : [];
    const firstItem =
      typeof items[0] === 'object' && items[0] !== null
        ? (items[0] as Record<string, unknown>)
        : null;
    const interval =
      typeof (firstItem?.plan as Record<string, unknown> | undefined)
        ?.interval === 'string'
        ? ((firstItem!.plan as Record<string, unknown>).interval as string)
        : undefined;
    return interval === 'year' ? 'yearly' : 'monthly';
  }

  private async findUserByStripeIds(
    customerId: string,
    subscriptionId?: string,
  ) {
    const byCustomer = await this.prisma.user.findFirst({
      where: { stripeCustomerId: customerId },
    });
    if (byCustomer) return byCustomer;

    if (subscriptionId) {
      return this.prisma.user.findFirst({
        where: { stripeSubscriptionId: subscriptionId },
      });
    }

    return null;
  }

  async crateCheckoutSession(
    userId: string,
    body: SubscriptionDto,
  ): Promise<{ message: string; data: { url: string } }> {
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
      message: 'Checkout session created successfully',
      data: { url: session.url as string },
    };
  }

  async cancelSubscription(userId: string): Promise<{ message: string }> {
    const user = await this.userRepo.findUser('id', userId);

    if (!user.stripeSubscriptionId) {
      throw new BadRequestException('No active subscription found.');
    }

    if (user.status !== 'active' && user.status !== 'trialing') {
      throw new BadRequestException('Subscription is not active');
    }

    await this.stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    const rawSub = (await this.stripe.subscriptions.retrieve(
      user.stripeSubscriptionId,
    )) as unknown as Record<string, unknown>;

    const currentPeriodEnd =
      typeof rawSub.current_period_end === 'number'
        ? rawSub.current_period_end
        : null;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        status: 'cancelled',
        currentPeriodEnd: currentPeriodEnd,
      },
    });

    await this.prisma.subscriptionEvent.create({
      data: {
        userId: user.id,
        event: 'cancelled',
        status: 'cancelled',
        billingCycle: user.billingCycle ?? undefined,
        previousStatus: user.status ?? undefined,
        previousBillingCycle: user.billingCycle ?? undefined,
      },
    });

    const periodEnd = currentPeriodEnd
      ? new Date(currentPeriodEnd * 1000)
      : null;

    return {
      message: periodEnd
        ? `Your subscription will be cancelled on ${periodEnd.toDateString()}. You keep Pro access until then.`
        : `Your subscription has been scheduled for cancellation. You keep Pro access until the end of your billing period.`,
    };
  }

  async reactivateSubscription(userId: string): Promise<{ message: string }> {
    const user = await this.userRepo.findUser('id', userId);

    if (!user.stripeSubscriptionId) {
      throw new BadRequestException('No active subscription found.');
    }

    const rawSub = (await this.stripe.subscriptions.retrieve(
      user.stripeSubscriptionId,
    )) as unknown as Record<string, unknown>;

    if (!rawSub.cancel_at_period_end) {
      throw new BadRequestException(
        'Subscription is not pending cancellation — nothing to reactivate',
      );
    }

    await this.stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });

    await this.prisma.subscriptionEvent.create({
      data: {
        userId: user.id,
        event: 'reactivated',
        status: 'active',
        billingCycle: user.billingCycle ?? undefined,
        previousStatus: 'cancelled',
        previousBillingCycle: user.billingCycle ?? undefined,
      },
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

    if (!eventType || !payload) return;

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

  private async onSubscriptionUpsert(stripeSub: unknown) {
    if (typeof stripeSub !== 'object' || stripeSub === null) return;
    const rawSub = stripeSub as Record<string, unknown>;

    const customerId =
      typeof rawSub.customer === 'string' ? rawSub.customer : undefined;
    if (!customerId) return;

    const plan: bilingCycle = this.getBillingCycleFromSub(rawSub);

    const statusMap: Record<string, subscriptionStatus> = {
      active: 'active',
      trialing: 'trialing',
      past_due: 'past_due',
      incomplete: 'incomplete',
      canceled: 'cancelled',
      unpaid: 'past_due',
    };
    const rawStatus =
      typeof rawSub.status === 'string' ? rawSub.status : undefined;
    const status: subscriptionStatus =
      rawStatus && statusMap[rawStatus] ? statusMap[rawStatus] : 'incomplete';

    const isPaid = status === 'active' || status === 'trialing';
    const cancelAtPeriodEnd = Boolean(rawSub.cancel_at_period_end);
    const resolvedStatus: subscriptionStatus = cancelAtPeriodEnd
      ? 'cancelled'
      : status;

    const subscriptionId =
      typeof rawSub.id === 'string' ? rawSub.id : undefined;
    const currentPeriodEnd =
      typeof rawSub.current_period_end === 'number'
        ? rawSub.current_period_end
        : null;

    const existingUser = await this.findUserByStripeIds(
      customerId,
      subscriptionId,
    );

    const shouldUpdateStatus = !(
      (existingUser?.status === 'active' ||
        existingUser?.status === 'trialing') &&
      resolvedStatus === 'incomplete'
    );

    await this.prisma.user.updateMany({
      where: {
        OR: [
          { stripeCustomerId: customerId },
          ...(subscriptionId ? [{ stripeSubscriptionId: subscriptionId }] : []),
        ],
      },
      data: {
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId ?? undefined,
        billingCycle: plan,
        isPaid: cancelAtPeriodEnd ? true : isPaid,
        currentPeriodEnd: currentPeriodEnd,
        ...(shouldUpdateStatus && { status: resolvedStatus }),
      },
    });

    if (existingUser) {
      const isUpgrade =
        existingUser.billingCycle === 'monthly' && plan === 'yearly';
      const isDowngrade =
        existingUser.billingCycle === 'yearly' && plan === 'monthly';

      const eventType = cancelAtPeriodEnd
        ? 'cancelled'
        : status === 'trialing'
          ? 'trial_started'
          : isUpgrade
            ? 'upgraded'
            : isDowngrade
              ? 'downgraded'
              : 'activated';

      await this.prisma.subscriptionEvent.create({
        data: {
          userId: existingUser.id,
          event: eventType,
          status: shouldUpdateStatus ? resolvedStatus : existingUser.status!,
          billingCycle: plan,
          previousStatus: existingUser.status ?? undefined,
          previousBillingCycle: existingUser.billingCycle ?? undefined,
        },
      });
    }
  }

  private async onSubscriptionDeleted(stripeSub: unknown) {
    if (typeof stripeSub !== 'object' || stripeSub === null) return;
    const rawSub = stripeSub as Record<string, unknown>;

    const customerId =
      typeof rawSub.customer === 'string' ? rawSub.customer : undefined;
    if (!customerId) return;

    const subscriptionId =
      typeof rawSub.id === 'string' ? rawSub.id : undefined;

    const existingUser = await this.findUserByStripeIds(
      customerId,
      subscriptionId,
    );

    await this.prisma.user.updateMany({
      where: {
        OR: [
          { stripeCustomerId: customerId },
          ...(subscriptionId ? [{ stripeSubscriptionId: subscriptionId }] : []),
        ],
      },
      data: {
        stripeSubscriptionId: null,
        status: 'cancelled',
        isPaid: false,
        currentPeriodEnd: null,
      },
    });

    if (existingUser) {
      await this.prisma.subscriptionEvent.create({
        data: {
          userId: existingUser.id,
          event: 'cancelled',
          status: 'cancelled',
          billingCycle: existingUser.billingCycle ?? undefined,
          previousStatus: existingUser.status ?? undefined,
          previousBillingCycle: existingUser.billingCycle ?? undefined,
        },
      });
    }
  }

  private async onPaymentFailed(invoice: unknown) {
    if (typeof invoice !== 'object' || invoice === null) return;
    const rawInvoice = invoice as Record<string, unknown>;

    const customerId =
      typeof rawInvoice.customer === 'string' ? rawInvoice.customer : undefined;
    if (!customerId) return;

    const subscriptionId =
      typeof rawInvoice.subscription === 'string'
        ? rawInvoice.subscription
        : undefined;

    let billingCycle: bilingCycle = 'monthly';
    if (subscriptionId) {
      const rawSub = (await this.stripe.subscriptions.retrieve(
        subscriptionId,
      )) as unknown as Record<string, unknown>;
      billingCycle = this.getBillingCycleFromSub(rawSub);
    }

    const existingUser = await this.findUserByStripeIds(
      customerId,
      subscriptionId,
    );

    await this.prisma.user.updateMany({
      where: {
        OR: [
          { stripeCustomerId: customerId },
          ...(subscriptionId ? [{ stripeSubscriptionId: subscriptionId }] : []),
        ],
      },
      data: {
        status: 'past_due',
        isPaid: false,
      },
    });

    if (existingUser) {
      await Promise.all([
        this.prisma.payment.create({
          data: {
            userId: existingUser.id,
            amount:
              typeof rawInvoice.amount_due === 'number'
                ? rawInvoice.amount_due
                : 0,
            currency:
              typeof rawInvoice.currency === 'string'
                ? rawInvoice.currency
                : 'usd',
            status: 'failed',
            billingCycle,
            stripeInvoiceId:
              typeof rawInvoice.id === 'string' ? rawInvoice.id : undefined,
            paidAt: null,
          },
        }),
        this.prisma.subscriptionEvent.create({
          data: {
            userId: existingUser.id,
            event: 'payment_failed',
            status: 'past_due',
            billingCycle,
            previousStatus: existingUser.status ?? undefined,
            previousBillingCycle: existingUser.billingCycle ?? undefined,
          },
        }),
      ]);
    }
  }

  private async onPaymentSucceeded(invoice: unknown) {
    if (typeof invoice !== 'object' || invoice === null) return;
    const rawInvoice = invoice as Record<string, unknown>;

    const billingReason =
      typeof rawInvoice.billing_reason === 'string'
        ? rawInvoice.billing_reason
        : undefined;

    if (
      billingReason !== 'subscription_cycle' &&
      billingReason !== 'subscription_create'
    )
      return;

    const subscriptionId =
      typeof rawInvoice.subscription === 'string'
        ? rawInvoice.subscription
        : undefined;
    const customerId =
      typeof rawInvoice.customer === 'string' ? rawInvoice.customer : undefined;
    if (!subscriptionId || !customerId) return;

    const rawSub = (await this.stripe.subscriptions.retrieve(
      subscriptionId,
    )) as unknown as Record<string, unknown>;

    const currentPeriodEnd =
      typeof rawSub.current_period_end === 'number'
        ? rawSub.current_period_end
        : null;

    const billingCycle = this.getBillingCycleFromSub(rawSub);

    const existingUser = await this.findUserByStripeIds(
      customerId,
      subscriptionId,
    );

    await this.prisma.user.updateMany({
      where: {
        OR: [
          { stripeCustomerId: customerId },
          { stripeSubscriptionId: subscriptionId },
        ],
      },
      data: {
        stripeCustomerId: customerId,
        status: 'active',
        isPaid: true,
        currentPeriodEnd: currentPeriodEnd,
      },
    });

    if (existingUser) {
      await Promise.all([
        this.prisma.payment.create({
          data: {
            userId: existingUser.id,
            amount:
              typeof rawInvoice.amount_paid === 'number'
                ? rawInvoice.amount_paid
                : 0,
            currency:
              typeof rawInvoice.currency === 'string'
                ? rawInvoice.currency
                : 'usd',
            status: 'succeeded',
            billingCycle,
            stripeInvoiceId:
              typeof rawInvoice.id === 'string' ? rawInvoice.id : undefined,
            stripePaymentIntentId:
              typeof rawInvoice.payment_intent === 'string'
                ? rawInvoice.payment_intent
                : undefined,
            paidAt: new Date(),
          },
        }),
        this.prisma.subscriptionEvent.create({
          data: {
            userId: existingUser.id,
            event:
              billingReason === 'subscription_create' ? 'activated' : 'renewed',
            status: 'active',
            billingCycle,
            previousStatus: existingUser.status ?? undefined,
            previousBillingCycle: existingUser.billingCycle ?? undefined,
          },
        }),
      ]);
    }
  }
}
