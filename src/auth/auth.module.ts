import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './services/auth.services';

@Module({
  imports: [JwtModule.register({})],
  providers: [AuthService],
})
export class AuthModule {}
