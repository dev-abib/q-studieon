import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { CloudinaryService } from '../common/services/cloudinary.service';
import { EmailService } from '../infra/mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [UserController],
  providers: [UserService, CloudinaryService, EmailService, PrismaService],
})
export class UserModule {}
