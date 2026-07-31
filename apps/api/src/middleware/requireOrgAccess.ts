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

/**
 * Tenant guard for routes with an :orgId param, run after requireAuth.
 *
 * A caller who is not an active member gets 404 rather than 403: a 403 would
 * confirm the organization exists, which is itself information belonging to
 * another tenant. Membership is read from the database on every request, not
 * from the token, so revoking it takes effect immediately.
 */
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
