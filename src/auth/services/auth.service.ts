import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RegisterDto } from '../dto/register.dto';
import bcrypt from 'bcrypt';
import { User } from '@prisma/client';
import { EmailService } from 'src/infra/mail/mail.service';
import { accountVerificationTemplate } from 'src/infra/mail/templates/auth/account-verification.template';
import { randomBytes, createHash } from 'crypto';
import { LoginDto } from '../dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import { StringValue } from 'ms';
import { JwtPayload } from '../types/jwt.types';
import { VerifyAccountDto } from '../dto/verify-account.dto';
import { ResendOtpDto } from '../dto/resend-otp';
import { accountVerificationConfirmationTemplate } from 'src/infra/mail/templates/system/account-verification-confirmation.template';
import { resetPasswordTemplate } from 'src/infra/mail/templates/auth/reset-password.template';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { resetPasswordConfirmationTemplate } from 'src/infra/mail/templates/auth/reset-password-confirmation.template';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { changePasswordConfirmationTemplate } from 'src/infra/mail/templates/auth/change-password-confirmation.template';
import crypto from 'crypto';
import { getuid } from 'process';
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly jwt: JwtService,
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

  // validate env
  private env(value: string | undefined, name: string): string {
    if (!value) {
      throw new Error(`Missing env: ${name}`);
    }
    return value;
  }

  // find user helper
  private async findUser(
    type: 'email' | 'id' = 'email',
    payload: string,
  ): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: type === 'email' ? { email: payload } : { id: payload },
    });

    if (!user)
      throw new NotFoundException(
        ' User not found, account removed or deleted,',
      );

    return user;
  }

  private getJwtConfig(
    type: 'user' | 'admin' | 'reset',
    token: 'access' | 'refresh',
  ): { secret: string; expiresIn: StringValue } {
    if (type === 'user') {
      return {
        secret:
          token === 'access'
            ? this.env(process.env.JWT_ACCESS_SECRET, 'JWT_ACCESS_SECRET')
            : this.env(process.env.JWT_REFRESH_SECRET, 'JWT_REFRESH_SECRET'),

        expiresIn:
          token === 'access'
            ? (this.env(
                process.env.JWT_ACCESS_EXPIRES_IN,
                'JWT_ACCESS_EXPIRES_IN',
              ) as StringValue)
            : (this.env(
                process.env.JWT_REFRESH_EXPIRES_IN,
                'JWT_REFRESH_EXPIRES_IN',
              ) as StringValue),
      };
    }

    if (type === 'admin') {
      return {
        secret:
          token === 'access'
            ? this.env(process.env.JWT_ADMIN_SECRET, 'JWT_ADMIN_SECRET')
            : this.env(
                process.env.JWT_ADMIN_REFRESH_SECRET,
                'JWT_ADMIN_REFRESH_SECRET',
              ),

        expiresIn:
          token === 'access'
            ? (this.env(
                process.env.JWT_ADMIN_EXPIRES_IN,
                'JWT_ADMIN_EXPIRES_IN',
              ) as StringValue)
            : (this.env(
                process.env.JWT_ADMIN_REFRESH_EXPIRES_IN,
                'JWT_ADMIN_REFRESH_EXPIRES_IN',
              ) as StringValue),
      };
    }

    return {
      secret: this.env(process.env.JWT_RESET_SECRET, 'JWT_RESET_SECRET'),
      expiresIn: this.env(
        process.env.JWT_RESET_EXPIRES_IN,
        'JWT_RESET_EXPIRES_IN',
      ) as StringValue,
    };
  }

  // token generate helper
  private generateToken(
    payload: JwtPayload,
    userType: 'user' | 'admin' | 'reset',
    tokenType: 'access' | 'refresh',
  ): string {
    const config = this.getJwtConfig(userType, tokenType);

    return this.jwt.sign(payload, {
      secret: config.secret,
      expiresIn: config.expiresIn,
    });
  }

  // verify token helper
  private verifyToken(
    token: string,
    type: 'user' | 'admin' | 'reset',
    tokenType: 'access' | 'refresh',
  ): any {
    const config = this.getJwtConfig(type, tokenType);

    try {
      return this.jwt.verify(token, {
        secret: config.secret,
      });
    } catch {
      throw new BadRequestException('Invalid or expired token');
    }
  }

  // register account service
  async register(dto: RegisterDto) {
    const isExisting = await this.prisma.user.findUnique({
      where: {
        email: dto.email,
      },
    });

    if (isExisting) throw new ConflictException('Account already exists');

    const otp = this.generateOtp();
    const otpExpiry = this.getOtpExpiry();
    const hashOtp = this.hashOtp(otp);
    const hashPassword = await this.hashPassword(dto.password);

    let user: User;

    if (dto.guestId) {
      user = await this.prisma.user.update({
        where: { id: dto.guestId },
        data: {
          email: dto.email,
          name: dto.name,
          password: hashPassword,
          authProvider: 'local',
          otp: hashOtp,
          otpExpires: otpExpiry,
          termsAndConditions: dto.termsAndConditions,
          role: 'user',
          otpAttempts: 0,
          isGuest: false,
          guestIp: null,
          guestDeviceId: null,
          guestExpiresAt: null,
        },
      });
    } else {
      user = await this.prisma.user.create({
        data: {
          email: dto.email,
          name: dto.name,
          password: hashPassword,
          authProvider: 'local',
          otp: hashOtp,
          otpExpires: otpExpiry,
          termsAndConditions: dto.termsAndConditions,
          role: 'user',
          otpAttempts: 0,
        },
      });
    }

    const payload = {
      name: user.name as string,
      email: user.email as string,
      id: user.id,
      isGuest: user.isGuest as boolean,
      isPaid: user.isPaid as boolean,
      role: user.role,
    };

    const accessToken = this.generateToken(payload, 'user', 'access');
    const refreshToken = this.generateToken(payload, 'user', 'refresh');

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken: refreshToken,
      },
    });

    let isMailSent: boolean = false;

    if (!user.isGuest) {
      isMailSent = await this.email.sendEmail({
        to: user.email as string,
        subject: `Account verification otp ${process.env.MAIL_FROM_NAME as string}`,
        html: accountVerificationTemplate({
          name: user.name as string,
          email: user.email as string,
          otp: otp,
        }),
      });
    }

    return {
      message: isMailSent
        ? 'Account created successfully and sent account verification mail.'
        : `Account created successfully, can't send otp at the moment. Please try again later`,
      data: {
        name: user.name,
        email: user.email,
        profilePicture: user.profilePictureURL,
        id: user.id,
        isGuest: user.isGuest,
        token: {
          accessToken,
          refreshToken,
        },
      },
    };
  }

  // verify account service
  async verifyAccount(dto: VerifyAccountDto) {
    const user = await this.findUser('email', dto.email);

    if (user.isOtpVerified)
      throw new BadRequestException('Account already verified');

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

    await this.email.sendEmail({
      to: user.email as string,
      subject: `Account verification confirmation ${process.env.MAIL_FROM_NAME as string}`,
      html: accountVerificationConfirmationTemplate({
        name: user.name as string,
      }),
    });

    return {
      message: 'Email verified successfully',
    };
  }

  // login account service
  async loginAccount(dto: LoginDto) {
    const user = await this.findUser('email', dto.email);

    const isValidPass = await this.comparePassword(
      dto.password,
      user.password as string,
    );
    if (!isValidPass)
      throw new UnauthorizedException('Invalid email or password');

    const isVerified = user.isOtpVerified;
    if (!isVerified)
      throw new UnauthorizedException(
        'Before login , please verify you account',
      );

    const payload = {
      name: user.name as string,
      email: user.email as string,
      id: user.id,
      isGuest: user.isGuest as boolean,
      isPaid: user.isPaid as boolean,
      role: user.role,
    };

    const accessToken = this.generateToken(payload, 'user', 'access');
    const refreshToken = this.generateToken(payload, 'user', 'refresh');

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken: refreshToken,
      },
    });

    const data = {
      name: user.name,
      email: user.email,
      profilePictureURL: user.profilePictureURL,
    };

    return {
      message: 'Logged in successfully',
      data: {
        token: {
          accessToken,
          refreshToken,
        },
        user: data,
      },
    };
  }

  // resend otp service
  async resendOtp(dto: ResendOtpDto) {
    const user = await this.findUser('email', dto.email);
    const otp = this.generateOtp(4);
    const hashOtp = this.hashOtp(otp);
    const otpExpiry = this.getOtpExpiry();

    if (user.isOtpVerified)
      throw new BadRequestException('Account already verified');

    if (!user.isOtpVerified && (user.otpAttempts ?? 0) === 3) {
      await this.prisma.user.delete({ where: { email: dto.email } });
      throw new BadRequestException(
        'Max OTP attempts exceeded, please register again',
      );
    }

    await this.prisma.user.update({
      where: { email: dto.email },
      data: {
        otp: hashOtp,
        otpAttempts: { increment: 1 },
        otpExpires: otpExpiry,
      },
    });

    const isMailSent = await this.email.sendEmail({
      to: user.email as string,
      subject: `Account verification otp  ${process.env.MAIL_FROM_NAME as string}`,
      html: accountVerificationTemplate({
        name: user.name as string,
        email: user.email as string,
        otp: otp,
      }),
    });

    if (!isMailSent) {
      throw new InternalServerErrorException(
        "Something went wrong, can't sent resend otp at the moment",
      );
    }

    return {
      message: 'Email otp sent successfully, please check your mailbox',
      data: null,
    };
  }

  // forgot password service
  async forgotPassword(dto: ResendOtpDto) {
    const user = await this.findUser('email', dto.email);

    const otp = this.generateOtp(4);
    const hashOtp = this.hashOtp(otp);
    const otpExpiry = this.getOtpExpiry();

    if (!user.isOtpVerified) {
      throw new UnauthorizedException(
        'To reset your password , you must have to verify you account at first',
      );
    }

    if ((user.otpAttempts ?? 0) >= 3) {
      const blockedUntil = new Date(Date.now() + 15 * 60 * 1000);

      await this.prisma.user.update({
        where: { email: dto.email },
        data: {
          blockedUntil,
          otpAttempts: 0,
        },
      });

      throw new BadRequestException(
        'Too many attempts. Your account is blocked for 15 minutes.',
      );
    }

    await this.prisma.user.update({
      where: { email: dto.email },
      data: {
        otp: hashOtp,
        otpAttempts: { increment: 1 },
        otpExpires: otpExpiry,
        blockedUntil: null,
      },
    });

    const isMailSent = await this.email.sendEmail({
      to: user.email as string,
      subject: `Forgot password otp  ${process.env.MAIL_FROM_NAME as string}`,
      html: resetPasswordTemplate({
        name: user.name as string,
        email: user.email as string,
        otp: otp,
      }),
    });

    if (!isMailSent) {
      throw new InternalServerErrorException(
        "Something went wrong, can't sent otp at the moment",
      );
    }

    return {
      message:
        'Forgot password otp sent successfully, please check your mailbox',
      data: null,
    };
  }

  // verify otp service
  async verifyOtp(dto: VerifyAccountDto) {
    const user = await this.findUser('email', dto.email);

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

    const token = this.generateToken(
      {
        name: user.name as string,
        email: user.email as string,
        id: user.id,
        isGuest: user.isGuest as boolean,
        isPaid: user.isPaid as boolean,
        role: user.role,
      },
      'reset',
      'refresh',
    );

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: token,
        otp: null,
        otpExpires: null,
        otpAttempts: 0,
      },
    });

    return {
      message: 'otp verified successfully',
      data: {
        token,
      },
    };
  }

  // reset password service
  async resetPassword(dto: ResetPasswordDto, user: JwtPayload) {
    await this.findUser('id', user.id);

    const hashedPassword = await this.hashPassword(dto.password);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
      },
    });

    const isMailSent = await this.email.sendEmail({
      to: user.email,
      subject: `Password reset confirmation  ${process.env.MAIL_FROM_NAME as string}`,
      html: resetPasswordConfirmationTemplate({
        name: user.name,
      }),
    });

    if (!isMailSent) {
      throw new InternalServerErrorException(
        "Something went wrong, can't sent otp at the moment",
      );
    }

    return {
      message: 'Password reset successful.',
      data: null,
    };
  }

  // change password service
  async changePassword(dto: ChangePasswordDto, user: JwtPayload) {
    const existingUser = await this.findUser('id', user.id);

    if (!existingUser.password) {
      throw new BadRequestException('No password set for this account');
    }

    const isValidPass = await this.comparePassword(
      dto.oldPassword,
      existingUser.password,
    );

    if (!isValidPass) {
      throw new BadRequestException('Old password is incorrect');
    }

    const hashPassword = await this.hashPassword(dto.password);

    await this.prisma.user.update({
      where: { id: existingUser.id },
      data: {
        password: hashPassword,
      },
    });

    const isMailSent = await this.email.sendEmail({
      to: user.email,
      subject: `Password change confirmation  ${process.env.MAIL_FROM_NAME as string}`,
      html: changePasswordConfirmationTemplate({
        name: user.name,
      }),
    });

    if (!isMailSent) {
      throw new InternalServerErrorException(
        "Something went wrong, can't sent otp at the moment",
      );
    }

    return {
      message: 'Password changed successfully.',
      data: null,
    };
  }
  // guest login service
  async guestLogin(ip: string, deviceId: string) {
    if (!deviceId) {
      throw new BadRequestException('Device ID is required');
    }

    const normalizedIp = ip === '::1' ? '127.0.0.1' : ip;

    // find by deviceId instead of IP
    const existingGuest = await this.prisma.user.findFirst({
      where: {
        isGuest: true,
        guestDeviceId: deviceId,
        guestExpiresAt: { gt: new Date() },
      },
    });

    if (existingGuest) {
      const payload: JwtPayload = {
        id: existingGuest.id,
        email: existingGuest.email as string,
        name: existingGuest.name as string,
        role: existingGuest.role,
        isGuest: true,
        isPaid: false,
      };

      const accessToken = this.generateToken(payload, 'user', 'access');
      const refreshToken = this.generateToken(payload, 'user', 'refresh');

      await this.prisma.user.update({
        where: { id: existingGuest.id },
        data: { refreshToken },
      });

      return {
        message: 'Guest session restored',
        data: {
          accessToken,
          refreshToken,
          expiresAt: existingGuest.guestExpiresAt,
          id: existingGuest.id,
        },
      };
    }

    const guestId = crypto.randomBytes(8).toString('hex');

    const user = await this.prisma.user.create({
      data: {
        email: `guest_${guestId}@guest.local`,
        name: `Guest_${guestId.slice(0, 6)}`,
        isGuest: true,
        isPaid: false,
        isOtpVerified: false,
        authProvider: 'guest',
        guestIp: normalizedIp,
        guestDeviceId: deviceId,
        guestExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const payload: JwtPayload = {
      id: user.id,
      email: user.email as string,
      name: user.name as string,
      role: user.role,
      isGuest: true,
      isPaid: false,
    };

    const accessToken = this.generateToken(payload, 'user', 'access');
    const refreshToken = this.generateToken(payload, 'user', 'refresh');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    return {
      message: 'Guest login successful',
      data: {
        accessToken,
        refreshToken,
        expiresAt: user.guestExpiresAt,
        id: user.id,
      },
    };
  }

  // get me service
  async getMe(id: string) {
    const user = await this.findUser('id', id);

    const {
      password,
      otp,
      otpAttempts,
      otpExpires,
      refreshToken,
      resetToken,
      ...safeUser
    } = user;

    return {
      message: 'User extracted successfully',
      data: safeUser,
    };
  }
}
