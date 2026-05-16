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
import { ScheduleModule } from '@nestjs/schedule';
import { TasksService } from './tasks/tasks.service';
import { TasksModule } from './tasks/tasks.module';
import { DynamicPageController } from './dynamic-page/dynamic-page.controller';
import { DynamicPageService } from './dynamic-page/dynamic-page.service';
import { DynamicPageModule } from './dynamic-page/dynamic-page.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    CommonModule,
    PrismaModule,
    AuthModule,
    MailModule,
    UserModule,
    AdminModule,
    TasksModule,
    DynamicPageModule,
  ],
  controllers: [AppController, NumerologyController, SubscriptionController, DynamicPageController],
  providers: [AppService, NumerologyService, SubscriptionService, TasksService, DynamicPageService],
})
export class AppModule {}
