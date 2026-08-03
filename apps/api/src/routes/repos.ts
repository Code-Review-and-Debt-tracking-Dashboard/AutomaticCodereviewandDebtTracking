import { Router } from 'express';

import { AppError } from '../middleware/errorHandler';
import { requireAuth } from '../middleware/requireAuth';
import { requireRepoAccess } from '../middleware/requireRepoAccess';
import { addMember, isRepoRole, listMembers, removeMember } from '../services/memberService';
import { linkRepository, unlinkRepository } from '../services/repoLinkService';
import { getRepoDebt, getRepoTrend, listUserRepositories } from '../services/repoService';

export const reposRouter = Router();

// GET /api/repos : repos the caller can open, within the tenants they belong
// to. There is no platform-admin shortcut here — the organization boundary
// applies to everyone.
reposRouter.get('/api/repos', requireAuth, async (req, res, next) => {
  try {
    const repos = await listUserRepositories(req.user!.id, req.query);
    res.status(200).json(repos);
  } catch (err) {
    next(err);
  }
});

// POST /api/repos : link a GitHub repo and register its webhook. The caller
// becomes the repo's owner; the tenant comes from the repo's GitHub owner.
reposRouter.post('/api/repos', requireAuth, async (req, res, next) => {
  try {
    const { githubRepoId } = req.body ?? {};

    if (!Number.isInteger(githubRepoId) || githubRepoId <= 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request body', [
        { field: 'githubRepoId', message: 'must be a positive integer' },
      ]);
    }

    const repository = await linkRepository(req.user!.id, githubRepoId);
    res.status(201).json(repository);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/repos/:repoId : unlink and remove the GitHub webhook. The guard
// checks the tenant and loads the caller's org role; the service then narrows
// it further to the repo's owner or an organization owner/admin.
reposRouter.delete(
  '/api/repos/:repoId',
  requireAuth,
  requireRepoAccess('write'),
  async (req, res, next) => {
    try {
      await unlinkRepository(req.params.repoId, req.user!.id, req.org!.role);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/repos/:repoId/trend : any active member (any role), the owner,
// or a platform admin can view the trend data.
reposRouter.get(
  '/api/repos/:repoId/trend',
  requireAuth,
  requireRepoAccess('read'),
  async (req, res, next) => {
    try {
      const trend = await getRepoTrend(req.params.repoId, req.query);
      res.status(200).json(trend);
    } catch (err) {
      next(err);
    }
  },
);

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

// GET /api/repos/:repoId/debt : any active member (any role), the owner,
// or a platform admin can view the debt breakdown.
reposRouter.get(
  '/api/repos/:repoId/debt',
  requireAuth,
  requireRepoAccess('read'),
  async (req, res, next) => {
    try {
      const debt = await getRepoDebt(req.params.repoId);
      res.status(200).json(debt);
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
