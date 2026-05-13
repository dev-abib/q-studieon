// src/app.module.ts
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { MailModule } from './infra/mail/mail.module';
import { UserModule } from './user/user.module';
import { CommonModule } from './common/common.module';
import { AdminModule } from './admin/admin.module';
import { NumerologyController } from './numerology/numerology.controller';
import { NumerologyService } from './numerology/numerology.service';
import { SubscriptionService } from './subscription/subscription.service';
import { SubscriptionController } from './subscription/subscription.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CommonModule,
    PrismaModule,
    AuthModule,
    MailModule,
    UserModule,
    AdminModule,
  ],
  controllers: [AppController, NumerologyController, SubscriptionController],
  providers: [AppService, NumerologyService, SubscriptionService],
})
export class AppModule {}
