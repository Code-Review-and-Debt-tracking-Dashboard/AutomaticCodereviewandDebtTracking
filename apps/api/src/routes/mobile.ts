import { Router } from 'express';

import { requireAuth } from '../middleware/requireAuth';
import { requireRepoAccess } from '../middleware/requireRepoAccess';
import { validateRequest } from '../middleware/zodValidate';
import { deviceIdParamsSchema, registerDeviceSchema, repoIdParamsSchema } from '../schemas/requestSchemas';
import { getMobileSummary, getRepoSmells, registerDevice, unregisterDevice } from '../services/mobileService';

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
  validateRequest(repoIdParamsSchema),
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

// POST /api/devices : register this phone's Expo push token
mobileRouter.post('/api/devices', requireAuth, validateRequest(registerDeviceSchema), async (req, res, next) => {
  try {
    // parse again to get trimmed values
    const body = registerDeviceSchema.shape.body.parse(req.body);
    const device = await registerDevice(req.user!.id, body);
    res.status(200).json(device);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/devices/:deviceId : stop pushing to this phone (logout, notifications off)
mobileRouter.delete(
  '/api/devices/:deviceId',
  requireAuth,
  validateRequest(deviceIdParamsSchema),
  async (req, res, next) => {
    try {
      await unregisterDevice(req.user!.id, req.params.deviceId);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);
