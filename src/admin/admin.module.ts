import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuthHelper } from '../auth/helpers/auth.helper';
import { UserRepository } from '../common/repositories/user.repository';
import { PrismaService } from '../prisma/prisma.service';
import { JwtModule } from '@nestjs/jwt';
import { CloudinaryService } from '../common/services/cloudinary.service';
import { UserService } from 'src/user/user.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AdminController],
  providers: [
    AdminService,
    AuthHelper,
    PrismaService,
    UserRepository,
    CloudinaryService,
    UserService,
  ],
})
export class AdminModule {}
