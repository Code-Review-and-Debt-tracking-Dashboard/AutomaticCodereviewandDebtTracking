import { prisma, type PlatformRole } from '@codehealth/db';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { AppError } from './errorHandler';

// Runs after requireAuth. Reads the role from the database rather than the
// access token, otherwise a demoted admin keeps their powers until the token
// expires. Only admin routes use this, so the extra query is cheap.
export function requirePlatformRole(...roles: PlatformRole[]): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { platformRole: true, active: true },
      });

      if (!user?.active || !roles.includes(user.platformRole)) {
        throw new AppError(403, 'FORBIDDEN', 'Platform admin role required');
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

export const requireAdmin = requirePlatformRole('ADMIN');
