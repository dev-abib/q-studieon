import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RegisterDto } from '../dto/register.dto';
import bcrypt from 'bcrypt';
import { User } from '@prisma/client';
import { EmailService } from 'src/infra/mail/mail.service';
import { accountVerificationTemplate } from 'src/infra/mail/templates/auth/account-verification.template';
import { randomBytes, createHash } from 'crypto';
import { VerifyDto } from '../dto/verify-otp.dto';
import { LoginDto } from '../dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    // private readonly jwt: JwtService,
  ) {}

  // otp generator helper
  private generateOtp(length: number = 4): string {
    const digits: string = '0123456789';
    const bytes = randomBytes(length);
    let otp: string = '';
    for (let i: number = 0; i < bytes.length; i++) {
      const index = bytes.readUInt8(i) % 10;
      otp += digits[index];
    }
    return otp;
  }

  // otp hash helper
  private hashOtp(otp: string): string {
    return createHash('sha256').update(otp).digest('hex');
  }

  // verify otp helper
  private compareOtp(otp: string, hashOtp: string) {
    const inputHashOtp: string = createHash('sha256').update(otp).digest('hex');
    return inputHashOtp === hashOtp;
  }

  //  otp expiry date generator helper
  private getOtpExpiry(time: number = 15): Date {
    return new Date(Date.now() + time * 60 * 1000);
  }

  // password hashing helper
  private async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, 10);
  }

  // password compare helper
  private async comparePassword(
    password: string,
    hashPassword: string,
  ): Promise<boolean> {
    return await bcrypt.compare(password, hashPassword);
  }

  // find user helper
  private async findUser(
    type: 'email' | 'id' = 'email',
    payload: string,
  ): Promise<User | null> {
    return await this.prisma.user.findUnique({
      where: type === 'email' ? { email: payload } : { id: payload },
    });
  }

  // register account service
  async register(dto: RegisterDto) {
    const existing = await this.findUser('email', dto.email);

    if (!existing) {
      throw new ConflictException('Email already in use.');
    }

    const otp = this.generateOtp();
    const otpExpiry = this.getOtpExpiry();
    const hashOtp = this.hashOtp(otp);
    const hashPassword = await this.hashPassword(dto.password);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        password: hashPassword,
        authProvider: 'local',
        otp: hashOtp,
        otpExpires: otpExpiry,
        termsAndConditions: dto.termsAndConditions,
        role: 'user',
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
        email: true,
      },
    });

    await this.email.sendEmail({
      to: user.email as string,
      subject: `Account verification confirmation ${process.env.MAIL_FROM_NAME as string}`,
      html: accountVerificationTemplate({
        name: user.name as string,
        email: user.email as string,
        otp: otp,
      }),
    });

    return {
      message:
        'Account created successfully and sent account verification mail.',
      data: user,
    };
  }

  // verify account service
  async verifyAccount(dto: VerifyDto) {
    const user = await this.findUser('email', dto.email);

    if (!user) throw new BadRequestException('User not found');
    if (user.isOtpVerified)
      throw new BadRequestException('Account already verified');
    if (user.otpAttempts ?? 0 > 3) {
      await this.prisma.user.delete({
        where: { email: dto.email },
      });

      throw new BadRequestException(
        'Max otp attempts exceeded, please register again',
      );
    }
    if (user.otpExpires && user.otpExpires < new Date())
      throw new BadRequestException('Otp expired');

    const isMatch = this.compareOtp(dto.otp, user.otp as string);
    if (!isMatch) {
      await this.prisma.user.update({
        where: { email: dto.email },
        data: { otpAttempts: { increment: 1 }, otpExpires: null, otp: null },
      });
      throw new BadRequestException('Invalid otp');
    }

    await this.prisma.user.update({
      where: { email: dto.email },
      data: {
        isOtpVerified: true,
        otp: null,
        otpExpires: null,
        otpAttempts: 0,
      },
    });

    return {
      message: 'Email verified successfully',
    };
  }

  // login account service
  async loginAccount(dto: LoginDto) {
    const user = await this.findUser('email', dto.email);
    if (!user) throw new UnauthorizedException('Invalid email or password');

    const isValidPass = await this.comparePassword(
      dto.password,
      user.password as string,
    );

    if (!isValidPass)
      throw new UnauthorizedException('Invalid email or password');
  }
}
