import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AdminService } from './admin.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthHelper } from '../helpers/auth.helper';
import { UserRepository } from '../../common/repositories/user.repository';

describe('AdminService', () => {
  let service: AdminService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: { user: { update: jest.fn(), updateMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn() } } },
        { provide: AuthHelper, useValue: { comparePassword: jest.fn(), hashPassword: jest.fn(), generateToken: jest.fn(), verifyToken: jest.fn(), hashToken: jest.fn(), getJwtConfig: jest.fn() } },
        { provide: UserRepository, useValue: { findUser: jest.fn(), comparePassword: jest.fn(), logOut: jest.fn() } },
        { provide: JwtService, useValue: { sign: jest.fn(), verify: jest.fn() } },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
