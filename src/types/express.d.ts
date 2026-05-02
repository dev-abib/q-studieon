// src/types/express.d.ts
import type { JwtPayload } from '../auth/types/jwt.types';

export {};

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
