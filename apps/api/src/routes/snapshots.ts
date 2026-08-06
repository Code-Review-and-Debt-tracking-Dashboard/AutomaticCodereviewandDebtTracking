import { Router } from 'express';

import { requireAuth } from '../middleware/requireAuth';
import { getSnapshotFindings } from '../services/snapshotService';

export const snapshotsRouter = Router();

// GET /api/snapshots/:snapshotId/findings : paginated, filtered findings for a snapshot
snapshotsRouter.get(
  '/api/snapshots/:snapshotId/findings',
  requireAuth,
  async (req, res, next) => {
    try {
      const findings = await getSnapshotFindings(req.params.snapshotId, req.user!.id, req.query);
      res.status(200).json(findings);
    } catch (err) {
      next(err);
    }
  },
);
