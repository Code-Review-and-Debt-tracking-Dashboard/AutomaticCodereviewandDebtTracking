import { randomUUID } from 'crypto';

import jwt from 'jsonwebtoken';

import { env } from '../config/env';

// both share JWT_SECRET, so typ stops one being used as the other
type TokenType = 'access' | 'state';

export interface AppJwtPayload {
  sub: string; // user id
  username: string;
  platformRole: string;
}

interface AccessTokenClaims extends AppJwtPayload {
  jti: string;
  typ: 'access';
}

export function signAccessToken(payload: AppJwtPayload): string {
  const claims: AccessTokenClaims = { ...payload, jti: randomUUID(), typ: 'access' };
  return jwt.sign(claims, env.jwtSecret, {
    expiresIn: env.accessTokenExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): AppJwtPayload {
  const payload = jwt.verify(token, env.jwtSecret) as Partial<AccessTokenClaims> & jwt.JwtPayload;
  if (payload.typ !== 'access') {
    throw new Error('Not an access token');
  }
  return {
    sub: payload.sub as string,
    username: payload.username as string,
    platformRole: payload.platformRole as string,
  };
}

// web gets a cookie, native gets tokens back
export type OAuthClient = 'web' | 'native';

export interface OAuthStatePayload {
  redirect?: string;
  client: OAuthClient;
  nonce: string;
}

const STATE_EXPIRES_IN = '10m';

export function signState(
  redirect: string | undefined,
  client: OAuthClient,
): { state: string; nonce: string } {
  const nonce = randomUUID();
  const payload: OAuthStatePayload & { typ: TokenType } = { redirect, client, nonce, typ: 'state' };
  return { state: jwt.sign(payload, env.jwtSecret, { expiresIn: STATE_EXPIRES_IN }), nonce };
}

export function verifyState(state: string): OAuthStatePayload {
  const payload = jwt.verify(state, env.jwtSecret) as OAuthStatePayload &
    jwt.JwtPayload & { typ?: TokenType };
  if (payload.typ !== 'state') {
    throw new Error('Not a state token');
  }
  return { redirect: payload.redirect, client: payload.client, nonce: payload.nonce };
}
