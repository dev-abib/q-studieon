import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuthHelper } from '../auth/helpers/auth.helper';
import { UserRepository } from '../common/repositories/user.repository';
import { PrismaService } from '../prisma/prisma.service';
import { JwtModule } from '@nestjs/jwt';
import { CloudinaryService } from '../common/services/cloudinary.service';
import { UserService } from '../user/user.service';

import { AuditService } from './audit.service';
import { PresenceService } from './presence.service';
import { SecurityAlertService } from './security-alert.service';
import { InternalNotesService } from './internal-notes.service';
import { SystemStatusService } from './system-status.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AdminController],
  providers: [
    AdminService,
    AuditService,
    PresenceService,
    SecurityAlertService,
    InternalNotesService,
    SystemStatusService,
    AuthHelper,
    PrismaService,
    UserRepository,
    CloudinaryService,
    UserService,
  ],
  exports: [
    AuditService,
    AdminService,
    PresenceService,
    SecurityAlertService,
    InternalNotesService,
    SystemStatusService,
  ],
})
export class AdminModule {}
