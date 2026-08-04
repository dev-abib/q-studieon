import { Response, CookieOptions } from 'express';

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
  return Number(match[1]) * (MS_MULTIPLIERS[match[2]] ?? 1);
}

export class CookieHelper {
  private static getCookieOptions(): CookieOptions {
    const isProd = process.env.NODE_ENV === 'production';

    return {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      path: '/',
      domain: isProd ? '.dwellr.tech' : undefined,
    };
  }

  static setAdminAuthCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
  ) {
    const options = this.getCookieOptions();

    // keep cookie lifetimes in sync with the JWT expiry env vars
    // (previously the access cookie was hardcoded to 15 minutes, which logged
    // admins out long before the 8h JWT actually expired)
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
    const options = this.getCookieOptions();

    res.clearCookie('accessToken', options);
    res.clearCookie('refreshToken', options);
  }
}

// import { Response, CookieOptions } from 'express';

// export class CookieHelper {
//   private static getCookieOptions(): CookieOptions {
//     const isProd = process.env.NODE_ENV === 'production';

//     return {
//       httpOnly: true,
//       secure: isProd, // false on localhost (no HTTPS)
//       sameSite: isProd ? 'none' : 'lax', // 'lax' works for localhost:3000 <-> localhost:4000
//       path: '/',
//       domain: undefined, // never set a domain for localhost
//     };
//   }

//   static setAdminAuthCookies(
//     res: Response,
//     accessToken: string,
//     refreshToken: string,
//   ) {
//     const options = this.getCookieOptions();

//     res.cookie('accessToken', accessToken, {
//       ...options,
//       maxAge: 15 * 60 * 1000,
//     });

//     res.cookie('refreshToken', refreshToken, {
//       ...options,
//       maxAge: 7 * 24 * 60 * 60 * 1000,
//     });
//   }

//   static clearAdminAuthCookies(res: Response) {
//     const options = this.getCookieOptions();

//     res.clearCookie('accessToken', options);
//     res.clearCookie('refreshToken', options);
//   }
// }
