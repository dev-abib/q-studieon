import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { EmailService } from 'src/infra/mail/mail.service';
import { UserRepository } from 'src/common/repositories/user.repository';
import { CloudinaryService } from 'src/common/services/cloudinary.service';

describe('UserService', () => {
  let service: UserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaService, useValue: {} },
        { provide: EmailService, useValue: {} },
        { provide: UserRepository, useValue: {} },
        { provide: CloudinaryService, useValue: {} },
      ],
    }).compile();
    service = module.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
