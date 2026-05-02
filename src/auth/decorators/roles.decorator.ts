// decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { JwtPayload } from '../types/jwt.types';
export const ROLES_KEY = 'roles';
export const Roles = (...roles: JwtPayload['role'][]) =>
  SetMetadata(ROLES_KEY, roles);
