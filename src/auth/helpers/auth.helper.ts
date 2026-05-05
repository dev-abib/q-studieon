// src/common/repositories/user.repository.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { JwtPayload } from '../types/jwt.types';
import { StringValue } from 'ms';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'crypto';

@Injectable()
export class AuthHelper {
  constructor(private readonly jwt: JwtService) {}

  async comparePassword(
    password: string,
    hashPassword: string,
  ): Promise<boolean> {
    return await bcrypt.compare(password, hashPassword);
  }

  // password hashing helper
  async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, 10);
  }

  // validate env
  env(value: string | undefined, name: string): string {
    if (!value) {
      throw new Error(`Missing env: ${name}`);
    }
    return value;
  }

  getJwtConfig(
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
  generateToken(
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
  verifyToken(
    token: string,
    type: 'user' | 'admin' | 'reset',
    tokenType: 'access' | 'refresh',
  ): JwtPayload {
    const config = this.getJwtConfig(type, tokenType);

    try {
      return this.jwt.verify(token, {
        secret: config.secret,
      });
    } catch {
      throw new BadRequestException('Invalid or expired token');
    }
  }

  // hash refresh token
  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
