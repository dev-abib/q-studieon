// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt'; // ✅
import { AuthGuard } from './guards/auth-guard';
import { RolesGuard } from './guards/roles.guard';
import { UserModule } from './user/user.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [JwtModule.register({}), UserModule, AdminModule],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AuthModule {}
