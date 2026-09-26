import { prisma } from '@codehealth/db';
import { Router } from 'express';

import { requireAuth } from '../middleware/requireAuth';
import { requireRepoAccess } from '../middleware/requireRepoAccess';
import { validateRequest } from '../middleware/zodValidate';
import { updateQualityGateSchema } from '../schemas/qualityGateSchemas';

export const qualityGatesRouter = Router();

qualityGatesRouter.get(
  '/api/repos/:repoId/quality-gate',
  requireAuth,
  requireRepoAccess('read'),
  async (req, res, next) => {
    try {
      const qualityGate = await prisma.qualityGate.findUnique({
        where: { repoId: req.params.repoId },
      });

      res.status(200).json({
        data: qualityGate ?? {
          repoId: req.params.repoId,
          minHealthScore: 60,
          maxCriticalFindings: null,
          maxVulnerabilities: null,
          maxDuplicationPct: null,
          maxComplexityCount: null,
          maxCodeSmellCount: null,
          blockPR: false,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

qualityGatesRouter.put(
  '/api/repos/:repoId/quality-gate',
  requireAuth,
  requireRepoAccess('write'),
  validateRequest(updateQualityGateSchema),
  async (req, res, next) => {
    try {
      const data = {
        minHealthScore: req.body.minHealthScore,
        maxCriticalFindings: req.body.maxCriticalFindings === undefined ? null : req.body.maxCriticalFindings,
        maxVulnerabilities: req.body.maxVulnerabilities === undefined ? null : req.body.maxVulnerabilities,
        maxDuplicationPct: req.body.maxDuplicationPct === undefined ? null : req.body.maxDuplicationPct,
        maxComplexityCount: req.body.maxComplexityCount === undefined ? null : req.body.maxComplexityCount,
        maxCodeSmellCount: req.body.maxCodeSmellCount === undefined ? null : req.body.maxCodeSmellCount,
        blockPR: req.body.blockPR,
      };

      const qualityGate = await prisma.qualityGate.upsert({
        where: { repoId: req.params.repoId },
        update: data,
        create: { repoId: req.params.repoId, ...data },
      });

      res.status(200).json({ data: qualityGate });
    } catch (err) {
      next(err);
    }
  },
);
