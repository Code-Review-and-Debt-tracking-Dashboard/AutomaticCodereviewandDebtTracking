import { randomUUID } from 'crypto';

import jwt from 'jsonwebtoken';

import { env } from '../config/env';

export interface AppJwtPayload {
  sub: string; // user id
  username: string;
  platformRole: string;
}

export function signAppJwt(payload: AppJwtPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'] });
}

// No session store before login, so the OAuth state (CSRF + redirect) is
// carried in a signed token instead.
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
