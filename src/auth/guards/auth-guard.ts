// src/guards/auth.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AUTH_TYPE_KEY } from '../decorators/auth.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { NO_GUEST_KEY } from '../decorators/no-guest.decorator';
import { JwtPayload } from './../types/jwt.types';
import { PrismaService } from '../../prisma/prisma.service';

type AuthType =
  | 'user'
  | 'admin'
  | 'super_admin'
  | 'customer_support'
  | 'content_manager'
  | 'finance'
  | 'reset';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic: boolean = this.reflector.getAllAndOverride(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic === true) return true;

    const rawType: unknown = this.reflector.getAllAndOverride(AUTH_TYPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const authType: AuthType = this.isAuthType(rawType) ? rawType : 'user';

    const request = context.switchToHttp().getRequest<Request>();

    // ←←← UPDATED: Support both Header and Cookie
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Missing access token');
    }

    const secret = this.getSecret(authType);
    let decoded: unknown;

    try {
      decoded = this.jwt.verify(token, { secret });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (!this.isJwtPayload(decoded)) {
      throw new UnauthorizedException('Malformed token payload');
    }

    // ── Guest server-side expiry check ────────────────────────────────
    // JWT expiry alone is not enough: the cron soft-blocks guests by
    // flipping isGuest → false in the DB. We do one lightweight DB read
    // only for guest tokens to enforce that block immediately.
    if (decoded.isGuest === true) {
      const guestRecord = await this.prisma.user.findUnique({
        where: { id: decoded.id },
        select: { isGuest: true, guestExpiresAt: true },
      });

      const isExpired =
        !guestRecord ||
        !guestRecord.isGuest ||
        (guestRecord.guestExpiresAt !== null &&
          guestRecord.guestExpiresAt < new Date());

      if (isExpired) {
        throw new UnauthorizedException(
          'Guest session has expired. Please sign up to continue.',
        );
      }
    }
    // ─────────────────────────────────────────────────────────────────

    const noGuest: boolean = this.reflector.getAllAndOverride(NO_GUEST_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (noGuest === true && decoded.isGuest === true) {
      throw new UnauthorizedException('Guests cannot access this route');
    }

    // Role checks
    const staffRoles = [
      'admin',
      'super_admin',
      'customer_support',
      'content_manager',
      'finance',
    ];

    if (authType === 'admin' && !staffRoles.includes(decoded.role)) {
      throw new UnauthorizedException('Admin access required');
    }
    if (
      authType === 'customer_support' &&
      !['admin', 'super_admin', 'customer_support'].includes(decoded.role)
    ) {
      throw new UnauthorizedException('Customer support access required');
    }
    if (
      authType === 'content_manager' &&
      !['admin', 'super_admin', 'content_manager'].includes(decoded.role)
    ) {
      throw new UnauthorizedException('Content manager access required');
    }
    if (
      authType === 'finance' &&
      !['admin', 'super_admin', 'finance'].includes(decoded.role)
    ) {
      throw new UnauthorizedException('Finance access required');
    }
    if (
      authType === 'super_admin' &&
      decoded.role !== 'super_admin' &&
      !decoded.isOwner
    ) {
      throw new UnauthorizedException('Super admin access required');
    }
    if (authType === 'user' && decoded.role !== 'user') {
      throw new UnauthorizedException('User access required');
    }

    request.user = decoded;
    return true;
  }

  private extractToken(request: Request): string | null {
    const authHeader = request.headers.authorization;
    if (authHeader) {
      const [type, token] = authHeader.split(' ');
      if (type === 'Bearer' && token) return token;
    }

    const tokenFromCookie =
      typeof request.cookies?.accessToken === 'string'
        ? request.cookies.accessToken
        : null;
    if (tokenFromCookie) {
      return tokenFromCookie;
    }

    return null;
  }

  private isJwtPayload(value: unknown): value is JwtPayload {
    return (
      typeof value === 'object' &&
      value !== null &&
      'id' in value &&
      'email' in value &&
      'name' in value &&
      'role' in value
    );
  }

  private isAuthType(value: unknown): value is AuthType {
    return [
      'user',
      'admin',
      'super_admin',
      'customer_support',
      'content_manager',
      'finance',
      'reset',
    ].includes(value as string);
  }

  private getSecret(type: AuthType): string {
    const secrets: Record<AuthType, string | undefined> = {
      user: process.env.JWT_ACCESS_SECRET,
      admin: process.env.JWT_ADMIN_SECRET,
      super_admin: process.env.JWT_ADMIN_SECRET,
      customer_support: process.env.JWT_ADMIN_SECRET,
      content_manager: process.env.JWT_ADMIN_SECRET,
      finance: process.env.JWT_ADMIN_SECRET,
      reset: process.env.JWT_RESET_SECRET,
    };

    const secret = secrets[type];
    if (!secret) {
      throw new UnauthorizedException(`Missing JWT secret for ${type}`);
    }
    return secret;
  }
}
