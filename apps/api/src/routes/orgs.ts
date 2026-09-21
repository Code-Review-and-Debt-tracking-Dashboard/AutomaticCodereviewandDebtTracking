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
} from '../services/orgService';

export const orgsRouter = Router();

// GET /api/orgs : the tenants the caller belongs to. This is what the UI uses
// to let them pick which organization to work in.
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

// Linking a few hundred repos means a webhook call each, so this hands the
// work to the worker and answers straight away. 'read' access on purpose:
// linking one repo needs no org role either, and GitHub admin is the real gate.
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

// What the bulk job has done so far, and the per-repo outcome once it's done.
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
