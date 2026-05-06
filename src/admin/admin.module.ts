import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuthHelper } from 'src/auth/helpers/auth.helper';
import { UserRepository } from 'src/common/repositories/user.repository';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AdminController],
  providers: [AdminService, AuthHelper, PrismaService, UserRepository],
})
export class AdminModule {}
