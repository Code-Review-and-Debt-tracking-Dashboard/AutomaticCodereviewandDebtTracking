import type { CookieOptions, Response } from 'express';

import { env } from '../config/env';

export const REFRESH_COOKIE_NAME = 'ch_refresh';
export const STATE_COOKIE_NAME = 'ch_oauth_state';

// Must match STATE_EXPIRES_IN in jwt.ts.
const STATE_COOKIE_MAX_AGE_MS = 10 * 60 * 1000;

// set and clear need the same flags or the delete is ignored
function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    // SameSite=None needs secure
    secure: env.cookieSecure || env.cookieSameSite === 'none',
    sameSite: env.cookieSameSite,
    // only sent to /auth routes
    path: '/auth',
  };
}

export function setRefreshCookie(res: Response, token: string, expiresAt: Date): void {
  // expires not maxAge, so rotating doesn't extend the session
  res.cookie(REFRESH_COOKIE_NAME, token, { ...cookieOptions(), expires: expiresAt });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, cookieOptions());
}

// ties the login to the browser that started it
export function setStateCookie(res: Response, nonce: string): void {
  res.cookie(STATE_COOKIE_NAME, nonce, { ...cookieOptions(), maxAge: STATE_COOKIE_MAX_AGE_MS });
}

export function clearStateCookie(res: Response): void {
  res.clearCookie(STATE_COOKIE_NAME, cookieOptions());
}
