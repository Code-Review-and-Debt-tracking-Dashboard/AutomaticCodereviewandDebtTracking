import { randomUUID } from 'crypto';

import jwt from 'jsonwebtoken';

import { env } from '../config/env';

/**
 * The app-issued JWT returned to clients on login (api_design.md §1,
 * `GET /auth/github/callback` response `token` field). Session/logout
 * handling (A-06) is out of scope here — this is a stateless JWT only.
 */
export interface AppJwtPayload {
  sub: string; // User.id
  username: string;
  platformRole: string;
}

export function signAppJwt(payload: AppJwtPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'] });
}

/**
 * Signed, short-lived OAuth `state` param. Since the API is stateless (no
 * pre-login session store), CSRF protection + the optional post-login
 * `redirect` are carried inside a signed token instead of server-side
 * storage. `verifyState` rejects anything invalid, tampered, or expired.
 */
export interface OAuthStatePayload {
  redirect?: string;
  nonce: string;
}

const STATE_EXPIRES_IN = '10m';

export function signState(redirect?: string): string {
  const payload: OAuthStatePayload = { redirect, nonce: randomUUID() };
  return jwt.sign(payload, env.jwtSecret, { expiresIn: STATE_EXPIRES_IN });
}

export function verifyState(state: string): OAuthStatePayload {
  return jwt.verify(state, env.jwtSecret) as OAuthStatePayload & jwt.JwtPayload;
}
