import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { CloudinaryService } from 'src/common/services/cloudinary.service';
import { EmailService } from 'src/infra/mail/mail.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [UserController],
  providers: [UserService, CloudinaryService, EmailService, PrismaService],
})
export class UserModule {}
