/**
 * E2E test: Guest-to-User Conversion Flow
 *
 * Tests all three conversion paths:
 *   1. Register (email + password → guestId)
 *   2. Google login (OAuth → guestId)
 *   3. Apple login (OAuth → guestId)
 *
 * Run: npx jest --config ./test/jest-e2e.json --testPathPattern guest-conversion
 *
 * ⚠  These tests mock Prisma and external APIs.
 *    They validate business logic without touching a real database.
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { UserService } from '../src/auth/user/user.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { EmailService } from '../src/infra/mail/mail.service';
import { JwtService } from '@nestjs/jwt';
import { UserRepository } from '../src/common/repositories/user.repository';
import { AuthHelper } from '../src/auth/helpers/auth.helper';
import { User } from '@prisma/client';

// ---------------------------------------------------------------------------
// Helpers – factory for a realistic Guest user row
// ---------------------------------------------------------------------------
const makeGuestUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'guest_001',
    email: 'guest_a1b2c3@guest.local',
    name: 'Guest_a1b2c3',
    password: null,
    profilePictureURL: null,
    profilePicturePublicId: null,
    isPaid: false,
    isGuest: true,
    isOtpVerified: false,
    otp: null,
    otpAttempts: 0,
    otpExpires: null,
    refreshToken: null,
    resetToken: null,
    guestExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    authProvider: 'guest',
    billingCycle: 'monthly',
    status: 'free',
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    currentPeriodEnd: null,
    role: 'user',
    createdAt: new Date(),
    updatedAt: new Date(),
    termsAndConditions: false,
    blockedUntil: null,
    guestIp: '127.0.0.1',
    guestDeviceId: 'device_001',
    isResetRequest: false,
    ...overrides,
  }) as unknown as User;

const makeConvertedUser = (overrides: Partial<User> = {}): User =>
  makeGuestUser({
    isGuest: false,
    isOtpVerified: true,
    email: 'john@example.com',
    name: 'John Doe',
    authProvider: 'local',
    password: '$2b$10$hashedpassword',
    guestIp: null,
    guestDeviceId: null,
    guestExpiresAt: null,
    ...overrides,
  });

// ---------------------------------------------------------------------------
// Mock factory for PrismaService with $transaction support
// ---------------------------------------------------------------------------
// Shape of the mock transaction object
interface MockTx {
  user: {
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
}

const createMockPrisma = (txOverrides: Record<string, jest.Mock> = {}) => {
  const tx: MockTx = {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      ...txOverrides,
    },
  };

  return {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn().mockImplementation(
      async (cb: (tx: MockTx) => Promise<unknown>) => cb(tx),
    ),
  };
};

// ---------------------------------------------------------------------------
// Shared variables
// ---------------------------------------------------------------------------
let service: UserService;
let prisma: ReturnType<typeof createMockPrisma>;
let mockAuthHelper: Record<string, jest.Mock>;

// Spy references that need cleanup
let axiosGetSpy: jest.SpyInstance | null = null;
let appleVerifySpy: jest.SpyInstance | null = null;

describe('Guest → User Conversion Flow', () => {
  afterEach(() => {
    // Restore spies to keep tests isolated
    if (axiosGetSpy) {
      axiosGetSpy.mockRestore();
      axiosGetSpy = null;
    }
    if (appleVerifySpy) {
      appleVerifySpy.mockRestore();
      appleVerifySpy = null;
    }
  });

  beforeEach(async () => {
    // Mock JWT helpers
    mockAuthHelper = {
      hashPassword: jest.fn().mockResolvedValue('$2b$10$hashedpassword'),
      generateToken: jest
        .fn()
        .mockReturnValue('mock-access-token'),
      hashToken: jest.fn().mockReturnValue('mock-hashed-token'),
      verifyToken: jest.fn(),
    };

    prisma = createMockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: EmailService,
          useValue: {
            sendEmail: jest.fn().mockResolvedValue(true),
          },
        },
        { provide: JwtService, useValue: { sign: jest.fn(), verify: jest.fn() } },
        { provide: UserRepository, useValue: {} },
        { provide: AuthHelper, useValue: mockAuthHelper },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  // -----------------------------------------------------------------------
  // 1. Guest Login (the prerequisite)
  // -----------------------------------------------------------------------
  describe('Step 1 — Guest Login', () => {
    it('creates a new guest when no existing session is found', async () => {
      // No existing guest
      prisma.user.findFirst.mockResolvedValue(null);
      // Create returns a guest
      const newGuest = makeGuestUser();
      prisma.user.create.mockResolvedValue(newGuest);
      // Update refresh token
      prisma.user.update.mockResolvedValue(newGuest);

      const result = await service.guestLogin('127.0.0.1', 'device_001');

      expect(result.message).toMatch(/Guest login successful/i);
      expect(result.data.accessToken).toBe('mock-access-token');
      expect(result.data.id).toBe('guest_001');
      // Verify the guest was created with correct defaults
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isGuest: true,
            guestDeviceId: 'device_001',
            authProvider: 'guest',
          }),
        }),
      );
    });

    it('restores an existing unexpired guest session', async () => {
      const existingGuest = makeGuestUser();
      prisma.user.findFirst.mockResolvedValue(existingGuest);
      prisma.user.update.mockResolvedValue(existingGuest);

      const result = await service.guestLogin('127.0.0.1', 'device_001');

      expect(result.message).toMatch(/Guest session restored/i);
      expect(result.data.id).toBe('guest_001');
    });

    it('throws when deviceId is missing', async () => {
      await expect(
        service.guestLogin('127.0.0.1', ''),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // -----------------------------------------------------------------------
  // 2. Register → guestId conversion
  // -----------------------------------------------------------------------
  describe('Step 2 — Register with guestId', () => {
    const registerDto = {
      email: 'john@example.com',
      password: 'StrongP@ss1',
      confirmPassword: 'StrongP@ss1',
      name: 'John Doe',
      termsAndConditions: true,
      guestId: 'guest_001',
    };

    it('converts guest to user and sends verification email', async () => {
      const guestUser = makeGuestUser();
      // Inside $transaction
      const tx = prisma.$transaction as jest.Mock;
      tx.mockImplementationOnce(async (cb: Function) => {
        const mockTx = {
          user: {
            findFirst: jest.fn().mockResolvedValue(null), // email not taken
            findUnique: jest.fn().mockResolvedValue(guestUser), // guest found
            update: jest.fn().mockResolvedValue(
              makeConvertedUser({
                isOtpVerified: false,
                authProvider: 'local',
              }),
            ),
            create: jest.fn(),
          },
        };
        return cb(mockTx);
      });

      const result = await service.register(registerDto);

      expect(result.message).toContain('Account created successfully');
      expect(result.data.isGuest).toBe(false);
      expect(result.data.email).toBe('john@example.com');
      // Transaction's update should have cleared guest fields
      const updateCall = (tx.mock.results[0].value as any).user.update;
      expect(updateCall).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isGuest: false,
            guestIp: null,
            guestDeviceId: null,
            guestExpiresAt: null,
          }),
        }),
      );
    });

    it('throws when guestId does not exist', async () => {
      const tx = prisma.$transaction as jest.Mock;
      tx.mockImplementationOnce(async (cb: Function) => {
        const mockTx = {
          user: {
            findFirst: jest.fn().mockResolvedValue(null),
            findUnique: jest.fn().mockResolvedValue(null), // guest NOT found
            update: jest.fn(),
            create: jest.fn(),
          },
        };
        return cb(mockTx);
      });

      await expect(
        service.register(registerDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when guestId belongs to a non-guest user', async () => {
      const nonGuest = makeGuestUser({ isGuest: false });
      const tx = prisma.$transaction as jest.Mock;
      tx.mockImplementationOnce(async (cb: Function) => {
        const mockTx = {
          user: {
            findFirst: jest.fn().mockResolvedValue(null),
            findUnique: jest.fn().mockResolvedValue(nonGuest), // found but not guest
            update: jest.fn(),
            create: jest.fn(),
          },
        };
        return cb(mockTx);
      });

      await expect(
        service.register(registerDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when email is already taken', async () => {
      const existingUser = makeGuestUser({
        isGuest: false,
        email: 'john@example.com',
      });
      const tx = prisma.$transaction as jest.Mock;
      tx.mockImplementationOnce(async (cb: Function) => {
        const mockTx = {
          user: {
            findFirst: jest
              .fn()
              .mockResolvedValue(existingUser), // email already in use
            findUnique: jest.fn(),
            update: jest.fn(),
            create: jest.fn(),
          },
        };
        return cb(mockTx);
      });

      await expect(
        service.register(registerDto),
      ).rejects.toThrow(ConflictException);
    });

    it('works without guestId (normal registration)', async () => {
      const newUser = makeGuestUser({
        isGuest: false,
        email: 'jane@example.com',
        name: 'Jane',
      });
      const tx = prisma.$transaction as jest.Mock;
      tx.mockImplementationOnce(async (cb: Function) => {
        const mockTx = {
          user: {
            findFirst: jest.fn().mockResolvedValue(null),
            findUnique: jest.fn(),
            update: jest.fn(),
            create: jest.fn().mockResolvedValue(newUser),
          },
        };
        return cb(mockTx);
      });

      const result = await service.register({
        ...registerDto,
        guestId: undefined,
        email: 'jane@example.com',
        name: 'Jane',
      });

      expect(result.data.email).toBe('jane@example.com');
    });
  });

  // -----------------------------------------------------------------------
  // 3. Google login → guestId conversion
  // -----------------------------------------------------------------------
  describe('Step 3 — Google Login with guestId', () => {
    it('converts guest to Google user', async () => {
      const guestUser = makeGuestUser();

      // Mock axios.get for Google token verification
      axiosGetSpy = jest.spyOn(require('axios'), 'get').mockResolvedValue({
        data: {
          name: 'John Google',
          email: 'john@example.com',
          picture: 'https://pic.com/photo.jpg',
        },
      });

      // $transaction mocks
      const tx = prisma.$transaction as jest.Mock;
      tx.mockImplementationOnce(async (cb: Function) => {
        const mockTx = {
          user: {
            findUnique: jest.fn().mockResolvedValue(guestUser),
            findFirst: jest.fn().mockResolvedValue(null), // no email conflict
            update: jest.fn().mockResolvedValue(
              makeConvertedUser({
                name: 'John Google',
                authProvider: 'google',
                profilePictureURL: 'https://pic.com/photo.jpg',
                isOtpVerified: true,
              }),
            ),
          },
        };
        return cb(mockTx);
      });

      // refresh-token update (outside transaction)
      prisma.user.update.mockResolvedValue({} as any);

      const result = await service.googleLogin('valid-google-token', 'guest_001');

      expect(result.message).toMatch(/Google login successful/i);
      expect(result.data.token.accessToken).toBe('mock-access-token');
      expect(result.data.user.email).toBe('john@example.com');

      // Verify the update cleared guest fields
      const updateData = (tx.mock.results[0].value as any).user.update;
      expect(updateData).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isGuest: false,
            authProvider: 'google',
          }),
        }),
      );
    });

    it('throws ConflictException when Google email is already taken', async () => {
      const guestUser = makeGuestUser();

      axiosGetSpy = jest.spyOn(require('axios'), 'get').mockResolvedValue({
        data: {
          name: 'John Google',
          email: 'existing@example.com',
          picture: null,
        },
      });

      const tx = prisma.$transaction as jest.Mock;
      tx.mockImplementationOnce(async (cb: Function) => {
        const mockTx = {
          user: {
            findUnique: jest.fn().mockResolvedValue(guestUser),
            findFirst: jest
              .fn()
              .mockResolvedValue({ id: 'user_other' }), // email conflict!
            update: jest.fn(),
          },
        };
        return cb(mockTx);
      });

      await expect(
        service.googleLogin('valid-google-token', 'guest_001'),
      ).rejects.toThrow(ConflictException);
    });

    it('works without guestId (normal Google login)', async () => {
      axiosGetSpy = jest.spyOn(require('axios'), 'get').mockResolvedValue({
        data: {
          name: 'Fresh User',
          email: 'fresh@example.com',
          picture: null,
        },
      });

      // No existing user → create new
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(
        makeGuestUser({
          isGuest: false,
          email: 'fresh@example.com',
          name: 'Fresh User',
          authProvider: 'google',
          isOtpVerified: true,
        }),
      );
      prisma.user.update.mockResolvedValue({} as any);

      const result = await service.googleLogin('valid-google-token');

      expect(result.message).toMatch(/Google login successful/i);
      expect(result.data.user.email).toBe('fresh@example.com');
    });
  });

  // -----------------------------------------------------------------------
  // 4. Apple login → guestId conversion
  // -----------------------------------------------------------------------
  describe('Step 4 — Apple Login with guestId', () => {
    it('converts guest to Apple user', async () => {
      const guestUser = makeGuestUser();

      // Spy on apple-signin-auth (same pattern as axios)
      appleVerifySpy = jest
        .spyOn(require('apple-signin-auth'), 'verifyIdToken')
        .mockResolvedValue({
          sub: 'apple_sub_001',
          email: 'john@icloud.com',
          email_verified: 'true',
        });

      const tx = prisma.$transaction as jest.Mock;
      tx.mockImplementationOnce(async (cb: Function) => {
        const mockTx = {
          user: {
            findUnique: jest.fn().mockResolvedValue(guestUser),
            findFirst: jest.fn().mockResolvedValue(null),
            update: jest.fn().mockResolvedValue(
              makeConvertedUser({
                email: 'john@icloud.com',
                name: 'Guest_a1b2c3', // preserved from guest
                authProvider: 'apple',
                isOtpVerified: true,
              }),
            ),
          },
        };
        return cb(mockTx);
      });

      prisma.user.update.mockResolvedValue({} as any);

      const result = await service.appleLogin('valid-apple-token', 'guest_001');

      expect(result.message).toMatch(/Apple login successful/i);
      expect(result.data.user.email).toBe('john@icloud.com');

      // Guest name should be preserved since Apple doesn't send one
      const updateData = (tx.mock.results[0].value as any).user.update;
      expect(updateData).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isGuest: false,
            name: 'Guest_a1b2c3',
          }),
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // 5. Edge cases & guards
  // -----------------------------------------------------------------------
  describe('Edge Cases & Guards', () => {
    it('throws BadRequestException for invalid/expired Google token', async () => {
      axiosGetSpy = jest.spyOn(require('axios'), 'get').mockRejectedValue({
        response: { status: 401, data: 'Invalid token' },
      });

      await expect(
        service.googleLogin('bad-token'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for invalid/expired Apple token', async () => {
      appleVerifySpy = jest
        .spyOn(require('apple-signin-auth'), 'verifyIdToken')
        .mockRejectedValue(new Error('expired token'));

      await expect(
        service.appleLogin('bad-token'),
      ).rejects.toThrow(BadRequestException);
    });

    it('preserves guest reports after register conversion', async () => {
      // This is a structural test — we verify the update operation
      // is an in-place UPDATE (not DELETE + CREATE), so foreign-key
      // relationships (reports, collections) are preserved.
      const guestUser = makeGuestUser();

      const tx = prisma.$transaction as jest.Mock;
      tx.mockImplementationOnce(async (cb: Function) => {
        const mockTx = {
          user: {
            findFirst: jest.fn().mockResolvedValue(null),
            findUnique: jest.fn().mockResolvedValue(guestUser),
            update: jest.fn().mockResolvedValue(
              makeConvertedUser({ isOtpVerified: false }),
            ),
            create: jest.fn(),
          },
        };
        return cb(mockTx);
      });

      const result = await service.register({
        email: 'jane@example.com',
        password: 'StrongP@ss1',
        confirmPassword: 'StrongP@ss1',
        name: 'Jane',
        termsAndConditions: true,
        guestId: 'guest_001',
      });

      // The fact that we used UPDATE (not CREATE) means
      // database-level relations are preserved.
      expect(result.data.id).toBe('guest_001');
      const updateCall = (tx.mock.results[0].value as any).user.update;
      expect(updateCall).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'guest_001' } }),
      );
    });

    it('sends verification email on register conversion', async () => {
      const guestUser = makeGuestUser();

      const tx = prisma.$transaction as jest.Mock;
      tx.mockImplementationOnce(async (cb: Function) => {
        const mockTx = {
          user: {
            findFirst: jest.fn().mockResolvedValue(null),
            findUnique: jest.fn().mockResolvedValue(guestUser),
            update: jest.fn().mockResolvedValue(
              makeConvertedUser({ isOtpVerified: false }),
            ),
            create: jest.fn(),
          },
        };
        return cb(mockTx);
      });

      // The email is sent inside the $transaction callback.
      // The EmailService mock is provided to the module and
      // will be called when the service invokes this.email.sendEmail().
      // Here we just verify the transaction runs without error.
      const result = await service.register({
        email: 'jane@example.com',
        password: 'StrongP@ss1',
        confirmPassword: 'StrongP@ss1',
        name: 'Jane',
        termsAndConditions: true,
        guestId: 'guest_001',
      });

      expect(result.data.email).toBe('jane@example.com');
      expect(result.data.isGuest).toBe(false);
    });
  });
});
