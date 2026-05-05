import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RegisterDto } from '../dto/register.dto';
import { User } from '@prisma/client';
import { EmailService } from 'src/infra/mail/mail.service';
import { accountVerificationTemplate } from 'src/infra/mail/templates/auth/account-verification.template';
import { randomBytes, createHash } from 'crypto';
import { LoginDto } from '../dto/login.dto';
import { JwtService } from '@nestjs/jwt';
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
import { GoogleUserInfo } from '../types/google-paylod';
import axios from 'axios';
import appleSignin from 'apple-signin-auth';
import { AppleUserInfo } from '../types/apple-user-info';
import { UserRepository } from 'src/common/repositories/user.repository';
import { AuthHelper } from 'src/auth/helpers/auth.helper';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly jwt: JwtService,
    private readonly userRepo: UserRepository,
    private readonly auth: AuthHelper,
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

  // verify google access token
  private async verifyGoogleAccessToken(
    access_token: string,
  ): Promise<GoogleUserInfo> {
    try {
      const res = await axios.get<GoogleUserInfo>(
        'https://www.googleapis.com/oauth2/v3/userinfo',
        {
          headers: {
            Authorization: `Bearer ${access_token}`,
          },
        },
      );
      return res.data;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException(
        `Something went wrong, can't login at the moment `,
      );
    }
  }

  // verify apple session
  private async verifyAppleToken(
    identityToken: string,
  ): Promise<AppleUserInfo> {
    try {
      const res = await appleSignin.verifyIdToken(identityToken, {
        audience: [process.env.APPLE_BUNDLE_ID!, process.env.APPLE_SERVICE_ID!],
        ignoreExpiration: false,
      });

      return {
        sub: res.sub,
        email: res.email ?? '',
        email_verified: res.email_verified === 'true',
      };
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException(
        ` Something went wrong, can't login at the moment `,
      );
    }
  }

  // services
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
    const hashPassword = await this.auth.hashPassword(dto.password);

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

    const accessToken = this.auth.generateToken(payload, 'user', 'access');
    const refreshToken = this.auth.generateToken(payload, 'user', 'refresh');

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken: this.auth.hashToken(refreshToken),
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
    const user = await this.userRepo.findUser('email', dto.email);

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
    const user = await this.userRepo.findUser('email', dto.email);

    const isValidPass = await this.userRepo.comparePassword(
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

    const accessToken = this.auth.generateToken(payload, 'user', 'access');
    const refreshToken = this.auth.generateToken(payload, 'user', 'refresh');

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken: this.auth.hashToken(refreshToken),
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
    const user = await this.userRepo.findUser('email', dto.email);
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
    const user = await this.userRepo.findUser('email', dto.email);

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
    const user = await this.userRepo.findUser('email', dto.email);

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

    const token = this.auth.generateToken(
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
    await this.userRepo.findUser('id', user.id);

    const hashedPassword = await this.auth.hashPassword(dto.password);

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
    const existingUser = await this.userRepo.findUser('id', user.id);

    if (!existingUser.password) {
      throw new BadRequestException('No password set for this account');
    }

    const isValidPass = await this.userRepo.comparePassword(
      dto.oldPassword,
      existingUser.password,
    );

    if (!isValidPass) {
      throw new BadRequestException('Old password is incorrect');
    }

    const hashPassword = await this.auth.hashPassword(dto.password);

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

      const accessToken = this.auth.generateToken(payload, 'user', 'access');
      const refreshToken = this.auth.generateToken(payload, 'user', 'refresh');

      await this.prisma.user.update({
        where: { id: existingGuest.id },
        data: { refreshToken: this.auth.hashToken(refreshToken) },
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

    const accessToken = this.auth.generateToken(payload, 'user', 'access');
    const refreshToken = this.auth.generateToken(payload, 'user', 'refresh');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: this.auth.hashToken(refreshToken) },
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

  //  google login service
  async googleLogin(token: string) {
    const res = await this.verifyGoogleAccessToken(token);
    const { name, email, picture } = res;

    let user = await this.prisma.user.findUnique({
      where: { email: email },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: email,
          name: name,
          profilePictureURL: picture,
          profilePicturePublicId: null,
          isOtpVerified: true,
          authProvider: 'google',
          termsAndConditions: true,
          role: 'user',
          otpAttempts: 0,
          password: crypto.randomBytes(32).toString('hex'),
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

    const accessToken = this.auth.generateToken(payload, 'user', 'access');
    const refreshToken = this.auth.generateToken(payload, 'user', 'refresh');

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken: this.auth.hashToken(refreshToken),
      },
    });

    const data = {
      name: user.name,
      email: user.email,
      profilePictureURL: user.profilePictureURL,
    };

    await this.email.sendEmail({
      to: user.email as string,
      subject: `Account verification confirmation ${process.env.MAIL_FROM_NAME as string}`,
      html: accountVerificationConfirmationTemplate({
        name: user.name as string,
      }),
    });

    return {
      message: 'Google log in successfull',
      data: {
        token: {
          accessToken,
          refreshToken,
        },
        user: data,
      },
    };
  }

  // apple login service
  async appleLogin(token: string) {
    const res = await this.verifyAppleToken(token);
    const { email } = res;

    let user = await this.prisma.user.findUnique({
      where: { email: email },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: email,
          name: 'apple user',
          profilePictureURL: null,
          profilePicturePublicId: null,
          isOtpVerified: true,
          authProvider: 'apple',
          termsAndConditions: true,
          role: 'user',
          otpAttempts: 0,
          password: crypto.randomBytes(32).toString('hex'),
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

    const accessToken = this.auth.generateToken(payload, 'user', 'access');
    const refreshToken = this.auth.generateToken(payload, 'user', 'refresh');

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken: this.auth.hashToken(refreshToken),
      },
    });

    const data = {
      name: user.name,
      email: user.email,
      profilePictureURL: user.profilePictureURL,
    };

    await this.email.sendEmail({
      to: user.email as string,
      subject: `Account verification confirmation ${process.env.MAIL_FROM_NAME as string}`,
      html: accountVerificationConfirmationTemplate({
        name: user.name as string,
      }),
    });

    return {
      message: 'Google log in successfull',
      data: {
        token: {
          accessToken,
          refreshToken,
        },
        user: data,
      },
    };
  }

  // log out service
  async logOut(id: string) {
    const user = await this.userRepo.findUser('id', id);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken: null,
      },
    });

    return {
      message: 'Log out successfully',
      data: {
        token: {
          accessToken: null,
          refreshToken: null,
        },
      },
    };
  }

  async refreshToken(refreshToken: string) {
    let payload: JwtPayload;
    try {
      payload = this.auth.verifyToken(refreshToken, 'user', 'refresh');
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.userRepo.findUser('id', payload.id);

    const hashedIncoming = this.auth.hashToken(refreshToken);
    if (!user.refreshToken || user.refreshToken !== hashedIncoming) {
      throw new UnauthorizedException('Refresh token revoked or mismatched');
    }

    const newPayload: JwtPayload = {
      id: user.id,
      email: user.email as string,
      name: user.name as string,
      role: user.role,
      isGuest: user.isGuest as boolean,
      isPaid: user.isPaid as boolean,
    };

    const newAccessToken = this.auth.generateToken(
      newPayload,
      'user',
      'access',
    );
    const newRefreshToken = this.auth.generateToken(
      newPayload,
      'user',
      'refresh',
    );

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: this.auth.hashToken(newRefreshToken) },
    });

    return {
      message: 'Token refreshed successfully',
      data: {
        token: {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
        },
      },
    };
  }
}
