import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto } from '../dto/register.dto';
import { User } from '@prisma/client';
import { EmailService } from '../../infra/mail/mail.service';
import { accountVerificationTemplate } from '../../infra/mail/templates/auth/account-verification.template';
import { randomBytes, createHash } from 'crypto';
import { LoginDto } from '../dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from '../types/jwt.types';
import { VerifyAccountDto } from '../dto/verify-account.dto';
import { ResendOtpDto } from '../dto/resend-otp';
import { accountVerificationConfirmationTemplate } from '../../infra/mail/templates/system/account-verification-confirmation.template';
import { resetPasswordTemplate } from '../../infra/mail/templates/auth/reset-password.template';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { resetPasswordConfirmationTemplate } from '../../infra/mail/templates/auth/reset-password-confirmation.template';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { changePasswordConfirmationTemplate } from '../../infra/mail/templates/auth/change-password-confirmation.template';
import crypto from 'crypto';
import { GoogleUserInfo } from '../types/google-paylod';
import axios from 'axios';
import appleSignin from 'apple-signin-auth';
import { AppleUserInfo } from '../types/apple-user-info';
import { UserRepository } from '../../common/repositories/user.repository';
import { AuthHelper } from '../helpers/auth.helper';

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

  parseUserAgent(userAgent?: string) {
    if (!userAgent) return { browser: 'Unknown', os: 'Unknown', device: 'Desktop' };
    const ua = userAgent.toLowerCase();

    // OS
    let os = 'Unknown';
    if (ua.includes('windows nt 10.0')) os = 'Windows 10/11';
    else if (ua.includes('windows')) os = 'Windows';
    else if (ua.includes('macintosh') || ua.includes('mac os')) os = 'macOS';
    else if (ua.includes('android')) os = 'Android';
    else if (ua.includes('iphone')) os = 'iPhone';
    else if (ua.includes('ipad')) os = 'iPad';
    else if (ua.includes('linux')) os = 'Linux';

    // Browser
    let browser = 'Unknown';
    if (ua.includes('edg/')) browser = 'Edge';
    else if (ua.includes('chrome') && !ua.includes('edg')) browser = 'Chrome';
    else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';
    else if (ua.includes('firefox')) browser = 'Firefox';
    else if (ua.includes('opera') || ua.includes('opr/')) browser = 'Opera';

    // Device
    let device = 'Desktop';
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) device = 'Mobile';
    else if (ua.includes('ipad') || ua.includes('tablet')) device = 'Tablet';

    return { browser, os, device };
  }

  async recordLoginSession(userId: string, ip?: string, userAgent?: string) {
    const rawIp = ip || '127.0.0.1';
    const cleanIp = rawIp.replace('::ffff:', '');
    const { browser, os, device } = this.parseUserAgent(userAgent);

    try {
      // Mark previous active sessions as not current
      await this.prisma.userSession.updateMany({
        where: { userId, isCurrent: true },
        data: { isCurrent: false },
      });

      // Create new session record
      const session = await this.prisma.userSession.create({
        data: {
          userId,
          ipAddress: cleanIp,
          userAgent: userAgent || null,
          browser,
          os,
          device,
          loginAt: new Date(),
          lastActiveAt: new Date(),
          durationSeconds: 0,
          isCurrent: true,
        },
      });

      // Update User summary tracking fields
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          lastLoginAt: new Date(),
          lastActiveIp: cleanIp,
          loginCount: { increment: 1 },
        },
      });

      return session;
    } catch (e) {
      console.error('Failed to record user login session:', e);
      return null;
    }
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
      const axiosError = error as {
        response?: { status: number; data: unknown };
      };
      console.error(
        'Google token verification failed:',
        axiosError?.response?.data ||
          (error instanceof Error ? error.message : error),
      );
      if (axiosError?.response?.status === 401) {
        throw new UnauthorizedException(
          'Invalid or expired Google token. Please obtain a new one from the Google OAuth flow.',
        );
      }
      throw new InternalServerErrorException(
        `Something went wrong, can't login at the moment`,
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
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error('Apple token verification failed:', errorMessage);
      if (
        errorMessage?.includes('expired') ||
        errorMessage?.includes('invalid')
      ) {
        throw new UnauthorizedException(
          'Invalid or expired Apple identity token.',
        );
      }
      throw new InternalServerErrorException(
        `Something went wrong, can't login at the moment`,
      );
    }
  }

  // services
  // register account service
  async register(dto: RegisterDto) {
    const otp = this.generateOtp();
    const otpExpiry = this.getOtpExpiry();
    const hashOtp = this.hashOtp(otp);
    const hashPassword = await this.auth.hashPassword(dto.password);

    const user = await this.prisma.$transaction(async (tx) => {
      // Check for existing email (atomic with create to prevent race conditions)
      const isExisting = await tx.user.findFirst({
        where: { email: dto.email },
      });

      if (isExisting) throw new ConflictException('Account already exists');

      let newUser: User;

      if (dto.guestId) {
        const guestUser = await tx.user.findUnique({
          where: { id: dto.guestId },
        });

        if (!guestUser) {
          throw new BadRequestException(
            'Guest session not found or has expired. Please try registering without a guest ID.',
          );
        }

        if (!guestUser.isGuest) {
          throw new BadRequestException('Invalid guest session');
        }

        newUser = await tx.user.update({
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
            userRole: dto.userRole,
            otpAttempts: 0,
            isGuest: false,
            guestIp: null,
            guestDeviceId: null,
            guestExpiresAt: null,
          },
        });
      } else {
        newUser = await tx.user.create({
          data: {
            email: dto.email,
            name: dto.name,
            password: hashPassword,
            authProvider: 'local',
            otp: hashOtp,
            otpExpires: otpExpiry,
            termsAndConditions: dto.termsAndConditions,
            role: 'user',
            userRole: dto.userRole,
            otpAttempts: 0,
          },
        });
      }

      // Send verification email inside the transaction — rollback if it fails
      if (!newUser.isGuest && newUser.email) {
        try {
          await this.email.sendEmail({
            to: newUser.email,
            subject: `Account verification otp ${process.env.MAIL_FROM_NAME as string}`,
            html: accountVerificationTemplate({
              name: newUser.name as string,
              email: newUser.email,
              otp: otp,
            }),
          });
        } catch {
          throw new InternalServerErrorException(
            'Account created but failed to send verification email. Please try resending OTP.',
          );
        }
      }

      return newUser;
    });

    // If we reach here, both user creation and email sending succeeded
    return {
      message: user.isGuest
        ? 'Account created successfully'
        : 'Account created successfully and sent account verification mail.',
      data: {
        name: user.name,
        email: user.email,
        profilePicture: user.profilePictureURL,
        id: user.id,
        isGuest: user.isGuest,
        userRole: user.userRole,
      },
    };
  }

  // verify account service
  async verifyAccount(dto: VerifyAccountDto, ip?: string, userAgent?: string) {
    const user = await this.userRepo.findUser('email', dto.email);

    if (user.isOtpVerified)
      throw new BadRequestException('Account already verified');

    if (user.otpExpires && user.otpExpires < new Date())
      throw new BadRequestException('Otp expired');

    const isMatch = this.compareOtp(dto.otp, user.otp as string);
    if (!isMatch) {
      await this.prisma.user.update({
        where: { email: dto.email },
        data: { otpAttempts: { increment: 1 } },
      });
      throw new BadRequestException('Invalid otp');
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
      where: { email: dto.email },
      data: {
        isOtpVerified: true,
        otp: null,
        otpExpires: null,
        otpAttempts: 0,
        refreshToken: this.auth.hashToken(refreshToken),
      },
    });

    // Record login session & IP
    const session = await this.recordLoginSession(user.id, ip, userAgent);

    await this.email.sendEmail({
      to: user.email as string,
      subject: `Account verification confirmation ${process.env.MAIL_FROM_NAME as string}`,
      html: accountVerificationConfirmationTemplate({
        name: user.name as string,
      }),
    });

    const data = {
      name: user.name,
      email: user.email,
      profilePicture: user.profilePictureURL,
      id: user.id,
      isGuest: user.isGuest,
    };

    return {
      message: 'Email verified successfully',

      data: {
        token: {
          accessToken,
          refreshToken,
        },
        user: data,
        sessionId: session?.id,
      },
    };
  }

  // login account service
  async loginAccount(dto: LoginDto, ip?: string, userAgent?: string) {
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

    // Record login session & IP
    const session = await this.recordLoginSession(user.id, ip, userAgent);

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
        sessionId: session?.id,
      },
    };
  }

  async resendOtp(dto: ResendOtpDto) {
    const user = await this.userRepo.findUser('email', dto.email);
    const otp = this.generateOtp(4);
    const hashOtp = this.hashOtp(otp);
    const otpExpiry = this.getOtpExpiry();

    if (user.isOtpVerified && !user.isResetRequest)
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
      subject: `OTP ${process.env.MAIL_FROM_NAME as string}`,
      html: user.isResetRequest
        ? resetPasswordTemplate({
            name: user.name as string,
            email: user.email as string,
            otp,
          })
        : accountVerificationTemplate({
            name: user.name as string,
            email: user.email as string,
            otp,
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

    if (user.blockedUntil && user.blockedUntil > new Date()) {
      const minutesLeft = Math.ceil(
        (user.blockedUntil.getTime() - Date.now()) / 60000,
      );
      throw new BadRequestException(
        `Account is blocked. Try again in ${minutesLeft} minutes.`,
      );
    }

    if (!user.isOtpVerified) {
      throw new UnauthorizedException(
        'To reset your password, you must verify your account first',
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

    const otp = this.generateOtp(4);
    const hashOtp = this.hashOtp(otp);
    const otpExpiry = this.getOtpExpiry();

    await this.prisma.user.update({
      where: { email: dto.email },
      data: {
        otp: hashOtp,
        otpAttempts: { increment: 1 },
        otpExpires: otpExpiry,
        blockedUntil: null,
        isResetRequest: true,
      },
    });

    const isMailSent = await this.email.sendEmail({
      to: user.email as string,
      subject: `Forgot password otp ${process.env.MAIL_FROM_NAME as string}`,
      html: resetPasswordTemplate({
        name: user.name as string,
        email: user.email as string,
        otp,
      }),
    });

    if (!isMailSent) {
      throw new InternalServerErrorException(
        "Something went wrong, can't send otp at the moment",
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
        data: { otpAttempts: { increment: 1 } },
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
        isResetRequest: false,
        resetToken: null,
        otpAttempts: 0,
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

    // Record session
    await this.recordLoginSession(user.id, normalizedIp, undefined);

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
  async googleLogin(token: string, guestId?: string, ip?: string, userAgent?: string) {
    const res = await this.verifyGoogleAccessToken(token);
    const { name, email, picture } = res;

    let user: User;

    if (guestId) {
      // Guest conversion path: upgrade the guest record with Google info
      user = await this.prisma.$transaction(async (tx) => {
        const guestUser = await tx.user.findUnique({
          where: { id: guestId },
        });

        if (!guestUser) {
          throw new BadRequestException(
            'Guest session not found or has expired.',
          );
        }

        if (!guestUser.isGuest) {
          throw new BadRequestException('Invalid guest session');
        }

        // Check if the Google email is already taken by another user
        const existingEmailUser = await tx.user.findFirst({
          where: { email, id: { not: guestId } },
        });

        if (existingEmailUser) {
          throw new ConflictException(
            'An account with this email already exists. Please log in instead.',
          );
        }

        return tx.user.update({
          where: { id: guestId },
          data: {
            email,
            name: name ?? guestUser.name,
            profilePictureURL: picture,
            profilePicturePublicId: null,
            authProvider: 'google',
            isGuest: false,
            isOtpVerified: true,
            termsAndConditions: true,
            guestIp: null,
            guestDeviceId: null,
            guestExpiresAt: null,
            password: crypto.randomBytes(32).toString('hex'),
          },
        });
      });
    } else {
      // Normal path: find existing user by email or create new
      const existing = await this.prisma.user.findUnique({
        where: { email },
      });

      user =
        existing ??
        (await this.prisma.user.create({
          data: {
            email,
            name,
            profilePictureURL: picture,
            profilePicturePublicId: null,
            isOtpVerified: true,
            authProvider: 'google',
            termsAndConditions: true,
            role: 'user',
            otpAttempts: 0,
            password: crypto.randomBytes(32).toString('hex'),
          },
        }));
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

    // Record login session & IP
    const session = await this.recordLoginSession(user.id, ip, userAgent);

    const data = {
      name: user.name,
      email: user.email,
      profilePictureURL: user.profilePictureURL,
    };

    // Only send welcome email for new registrations, not for existing users logging in
    if (!guestId) {
      await this.email.sendEmail({
        to: user.email as string,
        subject: `Account verification confirmation ${process.env.MAIL_FROM_NAME as string}`,
        html: accountVerificationConfirmationTemplate({
          name: user.name as string,
        }),
      });
    }

    return {
      message: 'Google login successful',
      data: {
        token: {
          accessToken,
          refreshToken,
        },
        user: data,
        sessionId: session?.id,
      },
    };
  }

  // apple login service
  async appleLogin(token: string, guestId?: string, ip?: string, userAgent?: string) {
    const res = await this.verifyAppleToken(token);
    const { email } = res;

    let user: User;

    if (guestId) {
      // Guest conversion path: upgrade the guest record with Apple info
      user = await this.prisma.$transaction(async (tx) => {
        const guestUser = await tx.user.findUnique({
          where: { id: guestId },
        });

        if (!guestUser) {
          throw new BadRequestException(
            'Guest session not found or has expired.',
          );
        }

        if (!guestUser.isGuest) {
          throw new BadRequestException('Invalid guest session');
        }

        // Check if the Apple email is already taken by another user
        const existingEmailUser = await tx.user.findFirst({
          where: { email, id: { not: guestId } },
        });

        if (existingEmailUser) {
          throw new ConflictException(
            'An account with this email already exists. Please log in instead.',
          );
        }

        return tx.user.update({
          where: { id: guestId },
          data: {
            email,
            name: guestUser.name ?? 'apple user',
            profilePictureURL: null,
            profilePicturePublicId: null,
            authProvider: 'apple',
            isGuest: false,
            isOtpVerified: true,
            termsAndConditions: true,
            guestIp: null,
            guestDeviceId: null,
            guestExpiresAt: null,
            password: crypto.randomBytes(32).toString('hex'),
          },
        });
      });
    } else {
      // Normal path: find existing user by email or create new
      const existing = await this.prisma.user.findUnique({
        where: { email },
      });

      user =
        existing ??
        (await this.prisma.user.create({
          data: {
            email,
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
        }));
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

    // Record login session & IP
    const session = await this.recordLoginSession(user.id, ip, userAgent);

    const data = {
      name: user.name,
      email: user.email,
      profilePictureURL: user.profilePictureURL,
    };

    // Only send welcome email for new registrations, not for existing users logging in
    if (!guestId) {
      await this.email.sendEmail({
        to: user.email as string,
        subject: `Account verification confirmation ${process.env.MAIL_FROM_NAME as string}`,
        html: accountVerificationConfirmationTemplate({
          name: user.name as string,
        }),
      });
    }

    return {
      message: 'Apple login successful',
      data: {
        token: {
          accessToken,
          refreshToken,
        },
        user: data,
        sessionId: session?.id,
      },
    };
  }

  async logOut(id: string) {
    await this.prisma.userSession.updateMany({
      where: { userId: id, isCurrent: true },
      data: { isCurrent: false },
    }).catch(() => {});
    await this.userRepo.logOut(id);
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
