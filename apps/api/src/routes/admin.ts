import { Router } from 'express';

import { requireAuth } from '../middleware/requireAuth';
import { requireAdmin } from '../middleware/requirePlatformRole';
import { revokeAllUserSessions } from '../services/sessionService';

export const adminRouter = Router();

// Kills every session a user has. Their access token still works until it
// expires, but they can't get a new one.
adminRouter.delete(
  '/api/admin/users/:userId/sessions',
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      const revoked = await revokeAllUserSessions(req.params.userId, 'ADMIN_REVOKED');
      res.status(200).json({ revoked });
    } catch (err) {
      next(err);
    }
  },
);
