import {
  Injectable,
  InternalServerErrorException,
  OnModuleInit,
} from '@nestjs/common';
import { Resend } from 'resend';
import { SendMailOptions } from './mail.types';

@Injectable()
export class EmailService implements OnModuleInit {
  private resend: Resend;

  onModuleInit() {
    const requiredEnv = [
      'RESEND_API_KEY',
      'RESEND_FROM_EMAIL',
      'RESEND_FROM_NAME',
    ];

    requiredEnv.forEach((key) => {
      if (!process.env[key]) {
        throw new Error(`Missing environment variable: ${key}`);
      }
    });

    this.resend = new Resend(process.env.RESEND_API_KEY);
  }

  async sendEmail(options: SendMailOptions): Promise<boolean> {
    try {
      const { error } = await this.resend.emails.send({
        from: `${process.env.RESEND_FROM_NAME as string} <${process.env.RESEND_FROM_EMAIL as string}>`,
        to: [options.to],
        subject: options.subject,
        html: options.html,
      });

      if (error) {
        console.error('Email send failed:', error);
        throw new InternalServerErrorException('Failed to send email');
      }

      return true;
    } catch (error) {
      console.error('Email send failed:', error);
      throw new InternalServerErrorException('Failed to send email');
    }
  }
}
