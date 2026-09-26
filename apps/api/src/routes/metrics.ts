import { Router } from 'express';

import { requireAuth } from '../middleware/requireAuth';
import { requireAdmin } from '../middleware/requirePlatformRole';
import { getMetrics } from '../services/metricsService';

export const metricsRouter = Router();

metricsRouter.get('/api/metrics', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const metrics = await getMetrics();
    res.status(200).json(metrics);
  } catch (err) {
    next(err);
  }
});