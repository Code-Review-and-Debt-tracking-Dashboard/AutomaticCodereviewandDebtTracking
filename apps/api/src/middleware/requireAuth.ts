import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { env } from '../config/env';
import type { AppJwtPayload } from '../lib/jwt';
import { AppError } from './errorHandler';

/** Identity attached to `req.user` once a Bearer token has been verified. */
export interface AuthenticatedUser {
  id: string;
  username: string;
  platformRole: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Auth guard  for protected routes. Verifies the `Authorization:
 * Bearer <token>` header against the app JWT issued by `signAppJwt`
 *  and attaches the decoded identity to `req.user`.
 * Stateless — no DB/session lookup, per the 401 UNAUTHORIZED contract.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;

  if (!token) {
    next(new AppError(401, 'UNAUTHORIZED', 'Missing or invalid auth token'));
    return;
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret) as AppJwtPayload & jwt.JwtPayload;
    req.user = { id: payload.sub, username: payload.username, platformRole: payload.platformRole };
    next();
  } catch {
    next(new AppError(401, 'UNAUTHORIZED', 'Missing or invalid auth token'));
  }
}
