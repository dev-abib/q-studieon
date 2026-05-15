import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionService } from './subscription.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserRepository } from '../common/repositories/user.repository';

describe('SubscriptionService', () => {
  let service: SubscriptionService;

  beforeEach(async () => {
    // ensure Stripe constructor doesn't throw during tests
    process.env.STRIPE_SECRET_KEY =
      process.env.STRIPE_SECRET_KEY ?? 'sk_test_key';
    process.env.STRIPE_MONTHLY_PRICE_ID =
      process.env.STRIPE_MONTHLY_PRICE_ID ?? 'price_monthly';
    process.env.STRIPE_YEARLY_PRICE_ID =
      process.env.STRIPE_YEARLY_PRICE_ID ?? 'price_yearly';
    process.env.STRIPE_WEBHOOK_SECRET =
      process.env.STRIPE_WEBHOOK_SECRET ?? 'whsec_test';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        { provide: PrismaService, useValue: {} },
        { provide: UserRepository, useValue: {} },
      ],
    }).compile();

    service = module.get<SubscriptionService>(SubscriptionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
