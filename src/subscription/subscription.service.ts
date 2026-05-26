import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { bilingCycle, subscriptionStatus } from '@prisma/client';
import { UserRepository } from '../common/repositories/user.repository';
import { PrismaService } from '../prisma/prisma.service';
import Stripe from 'stripe';
import { SubscriptionDto, PlanType } from './dto/subscreption.dto';

type RawStripeObject = Record<string, unknown>;

@Injectable()
export class SubscriptionService {
  private readonly stripe: InstanceType<typeof Stripe>;
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly userRepo: UserRepository,
  ) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
      apiVersion: '2026-04-22.dahlia',
    });
  }

  private extractStripeId(value: unknown): string | undefined {
    if (!value) return undefined;
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value !== null) {
      const obj = value as RawStripeObject;
      if (typeof obj.id === 'string') return obj.id;
    }
    return undefined;
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

  private getBillingCycleFromSub(rawSub: RawStripeObject): bilingCycle {
    const items = Array.isArray(
      (rawSub.items as RawStripeObject | undefined)?.data,
    )
      ? ((rawSub.items as RawStripeObject).data as unknown[])
      : [];
    const firstItem =
      typeof items[0] === 'object' && items[0] !== null
        ? (items[0] as RawStripeObject)
        : null;
    const interval =
      typeof (firstItem?.plan as RawStripeObject | undefined)?.interval ===
      'string'
        ? ((firstItem!.plan as RawStripeObject).interval as string)
        : undefined;
    return interval === 'year' ? 'yearly' : 'monthly';
  }

  private getNumber(obj: RawStripeObject, key: string): number | null {
    const val = obj[key];
    return typeof val === 'number' ? val : null;
  }

  private getString(obj: RawStripeObject, key: string, fallback = ''): string {
    const val = obj[key];
    return typeof val === 'string' ? val : fallback;
  }

  private async retrieveSubscription(id: string): Promise<RawStripeObject> {
    return (await this.stripe.subscriptions.retrieve(
      id,
    )) as unknown as RawStripeObject;
  }

  private async retrieveInvoice(id: string): Promise<RawStripeObject> {
    return (await this.stripe.invoices.retrieve(
      id,
    )) as unknown as RawStripeObject;
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

    const rawSub = await this.retrieveSubscription(user.stripeSubscriptionId);
    const currentPeriodEnd = this.getNumber(rawSub, 'current_period_end');

    await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'cancelled', currentPeriodEnd },
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

    const rawSub = await this.retrieveSubscription(user.stripeSubscriptionId);

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

    return { message: `Subscription reactivated successfully` };
  }

  async handleWebHook(rawBody: Buffer, signature: string): Promise<void> {
    let event: unknown;

    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET as string,
      );
      this.logger.log(
        `✅ Webhook received: ${String((event as RawStripeObject).type)}`,
      );
    } catch (err) {
      this.logger.error(`❌ Webhook signature failed: ${err}`);
      throw new BadRequestException('Invalid Stripe webhook signature');
    }

    const eventType =
      typeof event === 'object' && event !== null && 'type' in event
        ? ((event as RawStripeObject).type as string)
        : undefined;

    if (!eventType) return;

    const payload =
      typeof event === 'object' && event !== null && 'data' in event
        ? ((event as RawStripeObject).data as RawStripeObject).object
        : undefined;

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

      // invoice.paid / invoice.payment_succeeded = full Invoice object
      case 'invoice.payment_succeeded':
      case 'invoice.paid':
        await this.onInvoicePaid(payload);
        break;

      // invoice_payment.paid = InvoicePayment object (2025+ API versions)
      // No customer/subscription on payload — must fetch the invoice
      case 'invoice_payment.paid':
        await this.onInvoicePaymentPaid(payload);
        break;

      // Only links subscriptionId to user — payment row created by invoice_payment.paid
      case 'checkout.session.completed':
        await this.onCheckoutSessionCompleted(payload);
        break;

      case 'payment_intent.succeeded':
        this.logger.log(
          'ℹ️ payment_intent.succeeded — ignored, handled via invoice events',
        );
        break;

      default:
        this.logger.log(`⚠️ Unhandled webhook event: ${eventType}`);
        break;
    }
  }

  // ─── invoice_payment.paid ────────────────────────────────────────────────────
  // Payload: { invoice: "in_xxx", amount_paid, currency, payment: { payment_intent } }
  // No customer/subscription directly — fetch the invoice to get them.
  private async onInvoicePaymentPaid(payload: unknown) {
    this.logger.log('💳 onInvoicePaymentPaid triggered');
    if (typeof payload !== 'object' || payload === null) return;

    const raw = payload as RawStripeObject;
    const invoiceId = this.extractStripeId(raw.invoice);
    this.logger.log(`📄 invoiceId: ${invoiceId}`);

    if (!invoiceId) {
      this.logger.warn('⚠️ invoice_payment.paid — no invoiceId, skipping');
      return;
    }

    const invoice = await this.retrieveInvoice(invoiceId);
    const customerId = this.extractStripeId(invoice.customer);
    const subscriptionId = this.extractStripeId(invoice.subscription);

    this.logger.log(
      `💳 invoice_payment.paid — customerId: ${customerId}, subscriptionId: ${subscriptionId}`,
    );

    if (!customerId) {
      this.logger.warn('⚠️ invoice_payment.paid — no customerId on invoice');
      return;
    }

    const existingUser = await this.findUserByStripeIds(
      customerId,
      subscriptionId,
    );
    this.logger.log(`👤 Found user: ${existingUser?.id ?? 'NOT FOUND'}`);
    if (!existingUser) return;

    let rawSub: RawStripeObject | null = null;
    if (subscriptionId) {
      rawSub = await this.retrieveSubscription(subscriptionId);
    }

    const billingCycle: bilingCycle = rawSub
      ? this.getBillingCycleFromSub(rawSub)
      : (existingUser.billingCycle ?? 'monthly');

    const currentPeriodEnd = rawSub
      ? this.getNumber(rawSub, 'current_period_end')
      : null;

    const amountPaid =
      this.getNumber(invoice, 'amount_paid') ??
      this.getNumber(raw, 'amount_paid') ??
      0;

    const currency =
      this.getString(invoice, 'currency') ||
      this.getString(raw, 'currency') ||
      'usd';

    const paymentIntentId =
      this.extractStripeId(invoice.payment_intent) ??
      this.extractStripeId(
        (raw.payment as RawStripeObject | undefined)?.payment_intent,
      );

    await this.prisma.user.update({
      where: { id: existingUser.id },
      data: { status: 'active', isPaid: true, currentPeriodEnd },
    });

    await this.prisma.payment.create({
      data: {
        userId: existingUser.id,
        amount: amountPaid,
        currency,
        status: 'succeeded',
        billingCycle,
        stripeInvoiceId: invoiceId,
        stripePaymentIntentId: paymentIntentId,
        paidAt: new Date(),
      },
    });

    await this.prisma.subscriptionEvent.create({
      data: {
        userId: existingUser.id,
        event: 'renewed',
        status: 'active',
        billingCycle,
        previousStatus: existingUser.status ?? undefined,
        previousBillingCycle: existingUser.billingCycle ?? undefined,
      },
    });

    this.logger.log(`✅ Payment created for userId: ${existingUser.id}`);
  }

  // ─── invoice.paid / invoice.payment_succeeded ────────────────────────────────
  // Payload IS a full Invoice — customer + subscription are directly on it.
  private async onInvoicePaid(payload: unknown) {
    this.logger.log('💳 onInvoicePaid triggered');
    if (typeof payload !== 'object' || payload === null) return;

    const invoice = payload as RawStripeObject;
    const customerId = this.extractStripeId(invoice.customer);
    const subscriptionId = this.extractStripeId(invoice.subscription);

    this.logger.log(
      `💳 onInvoicePaid — customerId: ${customerId}, subscriptionId: ${subscriptionId}`,
    );

    if (!customerId) {
      this.logger.warn('⚠️ onInvoicePaid — no customerId');
      return;
    }

    const existingUser = await this.findUserByStripeIds(
      customerId,
      subscriptionId,
    );
    this.logger.log(`👤 Found user: ${existingUser?.id ?? 'NOT FOUND'}`);
    if (!existingUser) return;

    let rawSub: RawStripeObject | null = null;
    if (subscriptionId) {
      rawSub = await this.retrieveSubscription(subscriptionId);
    }

    const billingCycle: bilingCycle = rawSub
      ? this.getBillingCycleFromSub(rawSub)
      : (existingUser.billingCycle ?? 'monthly');

    const currentPeriodEnd = rawSub
      ? this.getNumber(rawSub, 'current_period_end')
      : null;

    await this.prisma.user.update({
      where: { id: existingUser.id },
      data: { status: 'active', isPaid: true, currentPeriodEnd },
    });

    await this.prisma.payment.create({
      data: {
        userId: existingUser.id,
        amount: this.getNumber(invoice, 'amount_paid') ?? 0,
        currency: this.getString(invoice, 'currency', 'usd'),
        status: 'succeeded',
        billingCycle,
        stripeInvoiceId: this.getString(invoice, 'id') || undefined,
        stripePaymentIntentId: this.extractStripeId(invoice.payment_intent),
        paidAt: new Date(),
      },
    });

    await this.prisma.subscriptionEvent.create({
      data: {
        userId: existingUser.id,
        event: 'renewed',
        status: 'active',
        billingCycle,
        previousStatus: existingUser.status ?? undefined,
        previousBillingCycle: existingUser.billingCycle ?? undefined,
      },
    });

    this.logger.log(`✅ Payment created for userId: ${existingUser.id}`);
  }

  // ─── checkout.session.completed ──────────────────────────────────────────────
  // Only links subscriptionId to user — NO payment row created here.
  // Payment row is created by invoice_payment.paid which fires right after.
  private async onCheckoutSessionCompleted(session: unknown) {
    if (typeof session !== 'object' || session === null) return;
    const rawSession = session as RawStripeObject;

    const subscriptionId = this.extractStripeId(rawSession.subscription);
    const customerId = this.extractStripeId(rawSession.customer);

    this.logger.log(
      `🔔 Checkout completed — customerId: ${customerId}, subscriptionId: ${subscriptionId}`,
    );

    if (!subscriptionId || !customerId) {
      this.logger.warn('⚠️ checkout.session.completed — missing ids');
      return;
    }

    const existingUser = await this.findUserByStripeIds(
      customerId,
      subscriptionId,
    );
    this.logger.log(`👤 Found user: ${existingUser?.id ?? 'NOT FOUND'}`);
    if (!existingUser) return;

    const rawSub = await this.retrieveSubscription(subscriptionId);
    const currentPeriodEnd = this.getNumber(rawSub, 'current_period_end');

    await this.prisma.user.update({
      where: { id: existingUser.id },
      data: {
        status: 'active',
        isPaid: true,
        stripeSubscriptionId: subscriptionId,
        currentPeriodEnd,
      },
    });

    this.logger.log(
      `✅ User updated for checkout — userId: ${existingUser.id}`,
    );
  }

  // ─── onSubscriptionUpsert ────────────────────────────────────────────────────
  private async onSubscriptionUpsert(stripeSub: unknown) {
    if (typeof stripeSub !== 'object' || stripeSub === null) return;
    const rawSub = stripeSub as RawStripeObject;

    const customerId = this.extractStripeId(rawSub.customer);
    if (!customerId) return;

    this.logger.log(`🔄 Subscription upsert — customerId: ${customerId}`);

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
    const currentPeriodEnd = this.getNumber(rawSub, 'current_period_end');

    const existingUser = await this.findUserByStripeIds(
      customerId,
      subscriptionId,
    );
    this.logger.log(`👤 Found user: ${existingUser?.id ?? 'NOT FOUND'}`);

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
        currentPeriodEnd,
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

  // ─── onSubscriptionDeleted ───────────────────────────────────────────────────
  private async onSubscriptionDeleted(stripeSub: unknown) {
    if (typeof stripeSub !== 'object' || stripeSub === null) return;
    const rawSub = stripeSub as RawStripeObject;

    const customerId = this.extractStripeId(rawSub.customer);
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

  // ─── onPaymentFailed ─────────────────────────────────────────────────────────
  private async onPaymentFailed(invoice: unknown) {
    if (typeof invoice !== 'object' || invoice === null) return;
    const rawInvoice = invoice as RawStripeObject;

    const customerId = this.extractStripeId(rawInvoice.customer);
    if (!customerId) return;

    const subscriptionId = this.extractStripeId(rawInvoice.subscription);

    let billingCycle: bilingCycle = 'monthly';
    if (subscriptionId) {
      const rawSub = await this.retrieveSubscription(subscriptionId);
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
      data: { status: 'past_due', isPaid: false },
    });

    if (existingUser) {
      await Promise.all([
        this.prisma.payment.create({
          data: {
            userId: existingUser.id,
            amount: this.getNumber(rawInvoice, 'amount_due') ?? 0,
            currency: this.getString(rawInvoice, 'currency', 'usd'),
            status: 'failed',
            billingCycle,
            stripeInvoiceId: this.getString(rawInvoice, 'id') || undefined,
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
}
