import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserRepository } from '../common/repositories/user.repository';
import { AuthHelper } from '../auth/helpers/auth.helper';
import { CloudinaryService } from '../common/services/cloudinary.service';
import { EmailService } from '../infra/mail/mail.service';

// Mock Stripe so AdminService constructor doesn't need a real API key
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    subscriptions: {
      retrieve: jest.fn(),
      cancel: jest.fn(),
    },
    customers: {
      create: jest.fn(),
    },
    checkout: {
      sessions: {
        create: jest.fn(),
      },
    },
    webhooks: {
      constructEvent: jest.fn(),
    },
  }));
});

describe('AdminService', () => {
  let service: AdminService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            report: { count: jest.fn() },
            payment: { aggregate: jest.fn(), create: jest.fn() },
            subscriptionEvent: { create: jest.fn() },
            $transaction: jest.fn(),
          },
        },
        { provide: UserRepository, useValue: { findUser: jest.fn() } },
        { provide: AuthHelper, useValue: { hashPassword: jest.fn() } },
        {
          provide: CloudinaryService,
          useValue: { uploadFile: jest.fn(), deleteFile: jest.fn() },
        },
        { provide: EmailService, useValue: { sendEmail: jest.fn() } },
        {
          provide: JwtService,
          useValue: { sign: jest.fn(), verify: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
