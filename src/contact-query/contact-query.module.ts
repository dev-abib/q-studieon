import { Module } from '@nestjs/common';
import { ContactQueryService } from './contact-query.service';
import { ContactQueryController } from './contact-query.controller';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../infra/mail/mail.service';

@Module({
  controllers: [ContactQueryController],
  providers: [ContactQueryService, PrismaService, EmailService],
  exports: [ContactQueryService],
})
export class ContactQueryModule {}
