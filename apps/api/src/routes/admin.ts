import { Router } from 'express';

import { requireAuth } from '../middleware/requireAuth';
import { requireAdmin } from '../middleware/requirePlatformRole';
import { revokeAllUserSessions } from '../services/sessionService';

export const adminRouter = Router();

// kills all sessions, the current access token still works till it expires
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
