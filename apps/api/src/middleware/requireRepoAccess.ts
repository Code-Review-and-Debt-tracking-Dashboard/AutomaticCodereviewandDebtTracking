import { prisma } from '@codehealth/db';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { AppError } from './errorHandler';

/**
 * Repo-scoped authorization guard, run after requireAuth. `read` allows the
 * owner, any ACTIVE member (any role), or a platform ADMIN. `write` narrows
 * the member case to an ACTIVE TEAM_LEAD, since only the owner/lead/admin can
 * manage the repo (unlink, quality gate, manual analysis, members).
 */
export function requireRepoAccess(level: 'read' | 'write'): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const repoId = req.params.repoId;

      const repository = await prisma.repository.findUnique({
        where: { id: repoId },
        select: {
          id: true,
          ownerId: true,
          isActive: true,
          members: {
            where: { userId: req.user!.id },
            select: { role: true, status: true },
          },
        },
      });

      if (!repository || !repository.isActive) {
        throw new AppError(404, 'NOT_FOUND', 'Repository not found');
      }

      if (req.user!.platformRole === 'ADMIN' || repository.ownerId === req.user!.id) {
        next();
        return;
      }

      const membership = repository.members[0];
      const isActiveMember = membership?.status === 'ACTIVE';
      const allowed = level === 'read' ? isActiveMember : isActiveMember && membership?.role === 'TEAM_LEAD';

      if (!allowed) {
        throw new AppError(403, 'FORBIDDEN', 'You do not have access to this repository');
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
