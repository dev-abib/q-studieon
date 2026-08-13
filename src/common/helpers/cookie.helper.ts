import type { Response, CookieOptions } from 'express';

const MS_MULTIPLIERS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
};

// parse an "ms"-style duration ("15m", "8h", "7d") into milliseconds
function durationToMs(value: string | undefined, fallbackMs: number): number {
  if (!value) return fallbackMs;
  const match = /^(\d+)\s*(ms|s|m|h|d|w)$/i.exec(value.trim());
  if (!match) return fallbackMs;
  return Number(match[1]) * (MS_MULTIPLIERS[match[2].toLowerCase()] ?? 1);
}

export class CookieHelper {
  private static getCookieOptions(res?: Response): CookieOptions {
    const host = res?.req?.headers?.host || '';
    const origin = (res?.req?.headers?.origin as string) || '';
    const isLocal =
      host.includes('localhost') ||
      host.includes('127.0.0.1') ||
      origin.includes('localhost') ||
      origin.includes('127.0.0.1');

    const isProd = process.env.NODE_ENV === 'production' && !isLocal;

    // For local development we need SameSite=lax and secure=false.
    // Modern browsers reject SameSite=None when secure is false.
    const sameSite: 'none' | 'lax' = isProd ? 'none' : 'lax';
    const secure = isProd; // secure only in production

    return {
      httpOnly: true,
      secure: secure,
      sameSite: sameSite,
      path: '/',
      domain: isProd
        ? process.env.COOKIE_DOMAIN || '.dwellr.tech'
        : process.env.COOKIE_DOMAIN || undefined,
    };
  }

  static setAdminAuthCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
  ) {
    const options = this.getCookieOptions(res);

    // keep cookie lifetimes in sync with the JWT expiry env vars
    const accessMaxAge = durationToMs(
      process.env.JWT_ADMIN_EXPIRES_IN,
      15 * 60 * 1000,
    );
    const refreshMaxAge = durationToMs(
      process.env.JWT_ADMIN_REFRESH_EXPIRES_IN,
      7 * 24 * 60 * 60 * 1000,
    );

    res.cookie('accessToken', accessToken, {
      ...options,
      maxAge: accessMaxAge,
    });

    res.cookie('refreshToken', refreshToken, {
      ...options,
      maxAge: refreshMaxAge,
    });
  }

  static clearAdminAuthCookies(res: Response) {
    const options = this.getCookieOptions(res);

    res.clearCookie('accessToken', options);
    res.clearCookie('refreshToken', options);
  }
}
