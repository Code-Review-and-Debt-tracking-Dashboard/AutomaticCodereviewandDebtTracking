import { prisma } from '@codehealth/db';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { AppError } from './errorHandler';

/**
 * Repo-scoped authorization guard, run after requireAuth. Access is checked in
 * two layers: first that the caller belongs to the organization owning the
 * repo, then what they may do with that specific repo.
 *
 * Failing the first layer returns 404, not 403, so one tenant cannot confirm
 * another tenant's repositories exist. Failing only the second returns 403,
 * because at that point the caller is entitled to know the repo is there.
 *
 * `read` allows the owner or any ACTIVE member. `write` narrows the member
 * case to an ACTIVE TEAM_LEAD, and also admits organization owners/admins,
 * since managing the tenant's repos is their job.
 *
 * There is deliberately no platform-level bypass here — tenant isolation
 * applies to everyone, and platformRole only guards operational routes.
 */
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

      // The repo's own owner, and whoever runs the tenant, always pass.
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
