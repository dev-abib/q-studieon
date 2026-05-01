// src/infra/emails/email.service.ts
import {
  Injectable,
  InternalServerErrorException,
  OnModuleInit,
} from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { SendMailOptions } from './mail.types';

@Injectable()
export class EmailService implements OnModuleInit {
  private transporter: nodemailer.Transporter;

  onModuleInit() {
    const requiredEnv = [
      'MAIL_HOST',
      'MAIL_PORT',
      'MAIL_USERNAME',
      'MAIL_PASSWORD',
      'MAIL_FROM_NAME',
      'MAIL_FROM_ADDRESS',
    ];

    requiredEnv.forEach((key) => {
      if (!process.env[key]) {
        throw new Error(`Missing environment variable: ${key}`);
      }
    });

    this.transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST!,
      port: Number(process.env.MAIL_PORT),
      secure: Number(process.env.MAIL_PORT) === 465,
      auth: {
        user: process.env.MAIL_USERNAME!,
        pass: process.env.MAIL_PASSWORD!,
      },
      connectionTimeout: 10000,
      debug: false,
      logger: false,
    } as nodemailer.TransportOptions);
  }

  async sendEmail(options: SendMailOptions): Promise<boolean> {
    try {
      await this.transporter.sendMail({
        from: `${process.env.MAIL_FROM_NAME as string} <${process.env.MAIL_FROM_ADDRESS as string}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
      });
      return true;
    } catch (error) {
      console.error('Email send failed:', error);
      throw new InternalServerErrorException('Failed to send email');
    }
  }
}
