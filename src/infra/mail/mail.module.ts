import { Global, Module } from '@nestjs/common';
import { EmailService } from './mail.service';

@Global()
@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class MailModule {}
