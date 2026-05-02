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

type AuthType = 'user' | 'admin' | 'reset';

function isJwtPayload(value: unknown): value is JwtPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'email' in value &&
    'name' in value &&
    'role' in value
  );
}

function isAuthType(value: unknown): value is AuthType {
  return value === 'user' || value === 'admin' || value === 'reset';
}

function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new UnauthorizedException(`Missing env variable: ${key}`);
  return value;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic: unknown = this.reflector.getAllAndOverride(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic === true) return true;

    const rawType: unknown = this.reflector.getAllAndOverride(AUTH_TYPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const authType: AuthType = isAuthType(rawType) ? rawType : 'user';

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Missing access token');
    }

    const secret = this.getSecret(authType);
    let decoded: unknown;

    try {
      decoded = this.jwt.verify(token, { secret });
    } catch (err: unknown) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (!isJwtPayload(decoded)) {
      throw new UnauthorizedException('Malformed token payload');
    }

    const noGuest: unknown = this.reflector.getAllAndOverride(NO_GUEST_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (noGuest === true && decoded.isGuest === true) {
      throw new UnauthorizedException('Guests cannot access this route');
    }

    if (
      authType === 'admin' &&
      decoded.role !== 'admin' &&
      decoded.role !== 'super_admin'
    ) {
      throw new UnauthorizedException('Admin access required');
    }

    if (authType === 'user' && decoded.role !== 'user') {
      throw new UnauthorizedException('User access required');
    }

    request.user = decoded;
    return true;
  }

  private extractToken(request: Request): string | null {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' && token ? token : null;
  }

  private getSecret(type: AuthType): string {
    if (type === 'user') return getEnv('JWT_ACCESS_SECRET');
    if (type === 'admin') return getEnv('JWT_ADMIN_SECRET');
    if (type === 'reset') return getEnv('JWT_RESET_SECRET');
    throw new UnauthorizedException('Unknown auth type');
  }
}
