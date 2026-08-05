import { prisma } from '@codehealth/db';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { AppError } from './errorHandler';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      org?: { id: string; role: string };
    }
  }
}

// Runs after requireAuth on any :orgId route. Non-members get 404, not 403,
// so we don't confirm the org exists. Membership is read fresh every request.
export function requireOrgAccess(level: 'read' | 'write'): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const orgId = req.params.orgId;

      const membership = await prisma.organizationMember.findUnique({
        where: { orgId_userId: { orgId, userId: req.user!.id } },
        select: { role: true, status: true },
      });

      if (!membership || membership.status !== 'ACTIVE') {
        throw new AppError(404, 'NOT_FOUND', 'Organization not found');
      }

      if (level === 'write' && membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
        throw new AppError(403, 'FORBIDDEN', 'You do not have write access to this organization');
      }

      req.org = { id: orgId, role: membership.role };
      next();
    } catch (err) {
      next(err);
    }
  };
}
