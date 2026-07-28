import { Router } from 'express';

import { AppError } from '../middleware/errorHandler';
import { requireAuth } from '../middleware/requireAuth';
import { requireRepoAccess } from '../middleware/requireRepoAccess';
import { addMember, isRepoRole, listMembers, removeMember } from '../services/memberService';

export const reposRouter = Router();

// GET /api/repos/:repoId/members : any active member (any role), the owner,
// or a platform admin can view the member list.
reposRouter.get(
  '/api/repos/:repoId/members',
  requireAuth,
  requireRepoAccess('read'),
  async (req, res, next) => {
    try {
      const data = await listMembers(req.params.repoId);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/repos/:repoId/members : owner, an active TEAM_LEAD, or a platform
// admin can grant another existing platform user access to the repo.
reposRouter.post(
  '/api/repos/:repoId/members',
  requireAuth,
  requireRepoAccess('write'),
  async (req, res, next) => {
    try {
      const { username, role = 'DEVELOPER' } = req.body ?? {};

      if (typeof username !== 'string' || username.trim() === '') {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request body', [
          { field: 'username', message: 'must be a non-empty string' },
        ]);
      }
      if (!isRepoRole(role)) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request body', [
          { field: 'role', message: 'must be one of TEAM_LEAD, DEVELOPER, VIEWER' },
        ]);
      }

      const member = await addMember(req.params.repoId, username, role, req.user!.id);
      res.status(201).json(member);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/repos/:repoId/members/:userId : owner, an active TEAM_LEAD, or a
// platform admin can revoke another member's access.
reposRouter.delete(
  '/api/repos/:repoId/members/:userId',
  requireAuth,
  requireRepoAccess('write'),
  async (req, res, next) => {
    try {
      await removeMember(req.params.repoId, req.params.userId);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);
