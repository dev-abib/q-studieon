import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuthHelper } from 'src/auth/helpers/auth.helper';

@Module({
  imports: [JwtModule.register({})],

  controllers: [AdminController],
  providers: [AdminService, AuthHelper],
  exports: [AdminService],
})
export class AdminModule {}
