// src/guards/auth.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AUTH_TYPE_KEY } from '../decorators/auth.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { NO_GUEST_KEY } from '../decorators/no-guest.decorator';
import { JwtPayload } from './../types/jwt.types';

type AuthType = 'user' | 'admin' | 'super_admin' | 'reset';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
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

    const noGuest: boolean = this.reflector.getAllAndOverride(NO_GUEST_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (noGuest === true && decoded.isGuest === true) {
      throw new UnauthorizedException('Guests cannot access this route');
    }

    // Role checks
    if (
      authType === 'admin' &&
      !['admin', 'super_admin'].includes(decoded.role)
    ) {
      throw new UnauthorizedException('Admin access required');
    }
    if (authType === 'super_admin' && decoded.role !== 'super_admin') {
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
    return ['user', 'admin', 'super_admin', 'reset'].includes(value as string);
  }

  private getSecret(type: AuthType): string {
    const secret =
      type === 'user'
        ? process.env.JWT_ACCESS_SECRET
        : process.env.JWT_ADMIN_SECRET;

    if (!secret) {
      throw new UnauthorizedException(`Missing JWT secret for ${type}`);
    }
    return secret;
  }
}
