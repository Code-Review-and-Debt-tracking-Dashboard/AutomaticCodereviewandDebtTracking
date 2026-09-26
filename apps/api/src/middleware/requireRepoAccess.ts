import { prisma } from '@codehealth/db';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { AppError } from './errorHandler';

// Two checks: is the caller in the owning org, then what they can do with the
// repo. Failing the first is a 404 so other tenants' repos stay hidden.
export function requireRepoAccess(level: 'read' | 'write'): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const repoId = req.params.repoId;
      const userId = req.user!.id;

      const repository = await prisma.repository.findUnique({
        where: { id: repoId },
        select: {
          id: true,
          orgId: true,
          ownerId: true,
          isActive: true,
          organization: {
            select: {
              members: {
                where: { userId },
                select: { role: true, status: true },
              },
            },
          },
          members: {
            where: { userId },
            select: { role: true, status: true },
          },
        },
      });

      if (!repository || !repository.isActive) {
        throw new AppError(404, 'NOT_FOUND', 'Repository not found');
      }

      const orgMembership = repository.organization.members[0];
      if (orgMembership?.status !== 'ACTIVE') {
        throw new AppError(404, 'NOT_FOUND', 'Repository not found');
      }

      req.org = { id: repository.orgId, role: orgMembership.role };

      // repo owner and org owners/admins always pass
      const isOrgManager = orgMembership.role === 'OWNER' || orgMembership.role === 'ADMIN';
      if (repository.ownerId === userId || isOrgManager) {
        next();
        return;
      }

      const membership = repository.members[0];
      const isActiveMember = membership?.status === 'ACTIVE';
      const allowed =
        level === 'read' ? isActiveMember : isActiveMember && membership?.role === 'TEAM_LEAD';

      if (!allowed) {
        throw new AppError(403, 'FORBIDDEN', 'You do not have access to this repository');
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
