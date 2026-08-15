import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { SuspiciousScanService } from './suspicious-scan.service';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityAlertService } from '../admin/security-alert.service';
import { AuditService } from '../admin/audit.service';
import { AuthGuard } from '../auth/guards/auth-guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CloudinaryService } from '../common/services/cloudinary.service';
import { PushModule } from '../push/push.module';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

@Module({
  imports: [
    JwtModule.register({}),
    MulterModule.register({ storage: memoryStorage() }),
    PushModule,
  ],
  providers: [
    ChatGateway,
    ChatService,
    SuspiciousScanService,
    SecurityAlertService,
    AuditService,
    AuthGuard,
    RolesGuard,
    Reflector,
    CloudinaryService,
    PrismaService,
  ],
  controllers: [ChatController],
  exports: [ChatService, ChatGateway],
})
export class ChatModule {}
