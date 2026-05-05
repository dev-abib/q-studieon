import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { UserRepository } from 'src/common/repositories/user.repository';
import { AuthHelper } from 'src/auth/helpers/auth.helper';

@Module({
  imports: [JwtModule.register({})],
  providers: [UserService, AuthHelper, UserRepository],
  controllers: [UserController],
  exports: [UserService],
})
export class UserModule {}
