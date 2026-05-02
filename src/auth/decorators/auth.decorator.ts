import { SetMetadata } from '@nestjs/common';

export const AUTH_TYPE_KEY = 'authType';
export const Auth = (type: 'user' | 'admin' | 'reset') =>
  SetMetadata(AUTH_TYPE_KEY, type);
