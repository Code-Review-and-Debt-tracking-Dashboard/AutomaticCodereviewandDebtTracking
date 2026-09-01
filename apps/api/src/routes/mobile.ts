import { Router } from 'express';

import { requireAuth } from '../middleware/requireAuth';
import { requireRepoAccess } from '../middleware/requireRepoAccess';
import { getMobileSummary, getRepoSmells } from '../services/mobileService';

export const mobileRouter = Router();

// GET /api/mobile/summary : aggregated home-screen data, single call
mobileRouter.get('/api/mobile/summary', requireAuth, async (req, res, next) => {
  try {
    const summary = await getMobileSummary(req.user!.id);
    res.status(200).json(summary);
  } catch (err) {
    next(err);
  }
});

// GET /api/mobile/repos/:repoId/smells : quick-view findings for the latest snapshot
mobileRouter.get(
  '/api/mobile/repos/:repoId/smells',
  requireAuth,
  requireRepoAccess('read'),
  async (req, res, next) => {
    try {
      const smells = await getRepoSmells(req.params.repoId, req.query);
      res.status(200).json(smells);
    } catch (err) {
      next(err);
    }
  },
);
