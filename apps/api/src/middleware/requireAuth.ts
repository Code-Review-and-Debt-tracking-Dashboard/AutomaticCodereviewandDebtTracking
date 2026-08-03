import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { env } from '../config/env';
import type { AppJwtPayload } from '../lib/jwt';
import { AppError } from './errorHandler';

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

// Verifies the Bearer token and puts the user on req.user. No DB lookup.
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
