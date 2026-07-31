import { Router } from 'express';

import { requireAuth } from '../middleware/requireAuth';
import { requireOrgAccess } from '../middleware/requireOrgAccess';
import {
  listOrgMembers,
  listOrgRepositories,
  listUserOrganizations,
  resyncOrganizations,
} from '../services/orgService';

export const orgsRouter = Router();

// GET /api/orgs : the tenants the caller belongs to. This is what the UI uses
// to let them pick which organization to work in.
orgsRouter.get('/api/orgs', requireAuth, async (req, res, next) => {
  try {
    const data = await listUserOrganizations(req.user!.id);
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
});

// POST /api/orgs/sync : pull the caller's organizations from GitHub again,
// for when they have just joined or left one and don't want to log in again.
orgsRouter.post('/api/orgs/sync', requireAuth, async (req, res, next) => {
  try {
    const data = await resyncOrganizations(req.user!.id);
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
});

// GET /api/orgs/:orgId/members : everyone in the tenant. Non-members get 404
// rather than 403 so the org's existence stays private.
orgsRouter.get(
  '/api/orgs/:orgId/members',
  requireAuth,
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

// GET /api/orgs/:orgId/repos : linked repos in this tenant that the caller can
// actually open — being in the org is not on its own enough.
orgsRouter.get(
  '/api/orgs/:orgId/repos',
  requireAuth,
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
