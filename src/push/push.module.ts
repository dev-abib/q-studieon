// src/push/push.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { PushService } from './push.service';
import { PushController } from './push.controller';
import { PrismaService } from '../prisma/prisma.service';
import { AuthGuard } from '../auth/guards/auth-guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@Module({
  imports: [JwtModule.register({})],
  controllers: [PushController],
  providers: [PushService, PrismaService, AuthGuard, RolesGuard, Reflector],
  exports: [PushService],
})
export class PushModule {}
