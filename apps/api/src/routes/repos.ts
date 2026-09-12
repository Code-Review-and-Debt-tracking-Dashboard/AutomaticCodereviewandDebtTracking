import { Router } from 'express';

import { AppError } from '../middleware/errorHandler';
import { analyzeRateLimiter } from '../middleware/rateLimit';
import { requireAuth } from '../middleware/requireAuth';
import { requireRepoAccess } from '../middleware/requireRepoAccess';
import { addMember, isRepoRole, listMembers, removeMember } from '../services/memberService';
import { linkRepository, listAvailableRepos, unlinkRepository } from '../services/repoLinkService';
import { getRepoDebt, getRepoDetail, getRepoHotspots, getRepoPullRequests, getRepoPullRequestDetail, getRepoTrend, triggerManualAnalysis } from '../services/repoService';
import { validateRequest } from '../middleware/zodValidate';
import { linkRepositorySchema, addMemberSchema } from '../schemas/repoSchemas';
import { availableReposQuerySchema, hotspotsQuerySchema, memberParamsSchema, prParamsSchema, repoIdParamsSchema, trendQuerySchema } from '../schemas/requestSchemas';

export const reposRouter = Router();

// GET /api/repos/available : returns repositories available to link
reposRouter.get('/api/repos/available', requireAuth, validateRequest(availableReposQuerySchema), async (req, res, next) => {
  try {
    const orgId = typeof req.query.orgId === 'string' ? req.query.orgId : undefined;
    const data = await listAvailableRepos(req.user!.id, orgId);
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
});

// POST /api/repos : link a repository and register its webhook. Everything
// else comes from GitHub, and the org is derived from the repo's owner, so
// the body is just the id.
reposRouter.post('/api/repos', requireAuth, async (req, res, next) => {
  try {
    const repo = await linkRepository(req.user!.id, Number(req.body.githubRepoId));
    res.status(201).json(repo);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/repos/:repoId : unlink and remove the GitHub webhook. Soft
// delete, so snapshots and PR history survive a relink.
reposRouter.delete(
  '/api/repos/:repoId',
  requireAuth,
  validateRequest(repoIdParamsSchema),
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

// GET /api/repos/:repoId : fetch single repository details
reposRouter.get(
  '/api/repos/:repoId',
  requireAuth,
  validateRequest(repoIdParamsSchema),
  validateRequest(trendQuerySchema),
  requireRepoAccess('read'),
  async (req, res, next) => {
    try {
      const repo = await getRepoDetail(req.params.repoId);
      res.status(200).json(repo);
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
  validateRequest(repoIdParamsSchema),
  validateRequest(hotspotsQuerySchema),
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

reposRouter.get(
  '/api/repos/:repoId/members',
  requireAuth,
  validateRequest(repoIdParamsSchema),
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

reposRouter.get(
  '/api/repos/:repoId/debt',
  requireAuth,
  validateRequest(repoIdParamsSchema),
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

reposRouter.get(
  '/api/repos/:repoId/hotspots',
  requireAuth,
  validateRequest(repoIdParamsSchema),
  requireRepoAccess('read'),
  async (req, res, next) => {
    try {
      const hotspots = await getRepoHotspots(req.params.repoId, req.query);
      res.status(200).json(hotspots);
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/repos/:repoId/pulls : list pull requests with health & debt delta
reposRouter.get(
  '/api/repos/:repoId/pulls',
  requireAuth,
  validateRequest(repoIdParamsSchema),
  requireRepoAccess('read'),
  async (req, res, next) => {
    try {
      const pulls = await getRepoPullRequests(req.params.repoId);
      res.status(200).json({ data: pulls });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/repos/:repoId/pulls/:prNumber : single PR detail with full analysis history
reposRouter.get(
  '/api/repos/:repoId/pulls/:prNumber',
  requireAuth,
  validateRequest(prParamsSchema),
  requireRepoAccess('read'),
  async (req, res, next) => {
    try {
      const prNumber = Number(req.params.prNumber);
      if (!Number.isInteger(prNumber)) {
        throw new AppError(400, 'VALIDATION_ERROR', 'prNumber must be an integer');
      }
      const pr = await getRepoPullRequestDetail(req.params.repoId, prNumber);
      res.status(200).json(pr);
    } catch (err) {
      next(err);
    }
  },
);


// POST /api/repos/:repoId/analyze : queue an analysis of the default branch
// without waiting for a webhook. Returns the analysis job id — there is no
// snapshot until the job finishes.
reposRouter.post(
  '/api/repos/:repoId/analyze',
  requireAuth,
  validateRequest(repoIdParamsSchema),
  analyzeRateLimiter,
  requireRepoAccess('write'),
  async (req, res, next) => {
    try {
      const { analysisId, jobId } = await triggerManualAnalysis(
        req.params.repoId,
        req.user!.id,
        req.org!.role,
      );
      res.status(202).json({ message: 'Analysis queued', analysisId, jobId });
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
  validateRequest(repoIdParamsSchema),
  requireRepoAccess('write'),
  validateRequest(addMemberSchema),
  async (req, res, next) => {
    try {
      const { username, role } = req.body;

      const member = await addMember(req.params.repoId, username, role, req.user!.id);
      res.status(201).json(member);
    } catch (err) {
      next(err);
    }
  },
);

reposRouter.delete(
  '/api/repos/:repoId/members/:userId',
  requireAuth,
  validateRequest(memberParamsSchema),
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
