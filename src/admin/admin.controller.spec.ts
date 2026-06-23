import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { UserService } from '../user/user.service';

describe('AdminController', () => {
  let controller: AdminController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: AdminService, useValue: { getMeAdmin: jest.fn(), getAllAdminsUsers: jest.fn(), createAdmin: jest.fn(), updateAdmin: jest.fn(), deleteAdminOrUser: jest.fn(), getDashboardAnalytics: jest.fn(), sendAdminMail: jest.fn() } },
        { provide: UserService, useValue: { getMe: jest.fn() } },
      ],
    }).compile();

    controller = module.get<AdminController>(AdminController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
