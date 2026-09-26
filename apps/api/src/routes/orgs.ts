import { Router } from 'express';

import { requireAuth } from '../middleware/requireAuth';
import { requireOrgAccess } from '../middleware/requireOrgAccess';
import { validateRequest } from '../middleware/zodValidate';
import { bulkLinkSchema, bulkLinkStatusSchema } from '../schemas/repoSchemas';
import { orgIdParamsSchema } from '../schemas/requestSchemas';
import { enqueueBulkLink, getBulkLinkStatus } from '../services/bulkLinkService';
import {
  listOrgMembers,
  listOrgRepositories,
  listUserOrganizations,
  resyncOrganizations,
  getOrgPullRequests,
} from '../services/orgService';

export const orgsRouter = Router();

// GET /api/orgs : orgs the caller belongs to
orgsRouter.get('/api/orgs',requireAuth, async (req, res, next) => {
  try {
    const data = await listUserOrganizations(req.user!.id);
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
});

// so a user who just joined/left an org doesn't have to log in again
orgsRouter.post('/api/orgs/sync', requireAuth, async (req, res, next) => {
  try {
    const data = await resyncOrganizations(req.user!.id);
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
});

orgsRouter.get(
  '/api/orgs/:orgId/members',
  requireAuth,
  validateRequest(orgIdParamsSchema),
  requireOrgAccess('read'),
  async (req, res, next) => {
    try {
      const data = await listOrgMembers(req.params.orgId);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  },
);

// being in the org isn't enough on its own — the service filters further
orgsRouter.get(
  '/api/orgs/:orgId/repos',
  requireAuth,
  validateRequest(orgIdParamsSchema),
  requireOrgAccess('read'),
  async (req, res, next) => {
    try {
      const data = await listOrgRepositories(req.params.orgId, req.user!.id);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  },
);

// hands the work to the worker. GitHub admin is the real check, so read access is enough
orgsRouter.post(
  '/api/orgs/:orgId/repos/bulk-link',
  requireAuth,
  validateRequest(bulkLinkSchema),
  requireOrgAccess('read'),
  async (req, res, next) => {
    try {
      const githubRepoIds = (req.body.githubRepoIds as unknown[]).map(Number);
      const { jobId, total } = await enqueueBulkLink(req.user!.id, req.params.orgId, githubRepoIds);
      res.status(202).json({ message: 'Bulk link queued', jobId, total });
    } catch (err) {
      next(err);
    }
  },
);

// bulk link job progress
orgsRouter.get(
  '/api/orgs/:orgId/repos/bulk-link/:jobId',
  requireAuth,
  validateRequest(bulkLinkStatusSchema),
  requireOrgAccess('read'),
  async (req, res, next) => {
    try {
      const data = await getBulkLinkStatus(req.params.jobId, req.params.orgId);
      res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  },
);

orgsRouter.get(
  '/api/orgs/:orgId/pulls',
  requireAuth,
  validateRequest(orgIdParamsSchema),
  requireOrgAccess('read'),
  async (req, res, next) => {
    try {
      const data = await getOrgPullRequests(req.params.orgId, req.user!.id);
      res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  },
);
