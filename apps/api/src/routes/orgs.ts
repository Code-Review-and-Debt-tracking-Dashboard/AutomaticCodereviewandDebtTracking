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

orgsRouter.get('/api/orgs', requireAuth, async (req, res, next) => {
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
