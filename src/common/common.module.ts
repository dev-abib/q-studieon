// src/common/common.module.ts
import { Module, Global } from '@nestjs/common';
import { UserRepository } from './repositories/user.repository';
import { PrismaService } from '../prisma/prisma.service';

@Global()
@Module({
  providers: [UserRepository, PrismaService],
  exports: [UserRepository],
})
export class CommonModule {}
