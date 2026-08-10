import type { CookieOptions, Response } from 'express';

import { env } from '../config/env';

export const REFRESH_COOKIE_NAME = 'ch_refresh';

// Set and clear have to pass identical flags or the browser ignores the
// delete, so both go through here.
function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    // SameSite=None is only legal on a secure cookie.
    secure: env.cookieSecure || env.cookieSameSite === 'none',
    sameSite: env.cookieSameSite,
    // Covers /auth/refresh and /auth/logout, keeps it off every /api call.
    path: '/auth',
  };
}

export function setRefreshCookie(res: Response, token: string, expiresAt: Date): void {
  // expires, not maxAge — rotation must not extend the session.
  res.cookie(REFRESH_COOKIE_NAME, token, { ...cookieOptions(), expires: expiresAt });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, cookieOptions());
}
