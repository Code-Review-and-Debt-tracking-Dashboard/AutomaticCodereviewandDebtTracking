import { prisma } from '@codehealth/db';
import { Router } from 'express';

import { requireAuth } from '../middleware/requireAuth';
import { requireRepoAccess } from '../middleware/requireRepoAccess';
import { AppError } from '../middleware/errorHandler';
import { assertValidation, parseOptionalBoolean, parseOptionalNumber } from '../middleware/validate';

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
  async (req, res, next) => {
    try {
      const {
        minHealthScore,
        maxCriticalFindings,
        maxVulnerabilities,
        maxDuplicationPct,
        maxComplexityCount,
        maxCodeSmellCount,
        blockPR,
      } = req.body ?? {};

      const parsedMinHealthScore = parseOptionalNumber(minHealthScore, 'minHealthScore') ?? 60;
      const parsedMaxCriticalFindings = parseOptionalNumber(maxCriticalFindings, 'maxCriticalFindings');
      const parsedMaxVulnerabilities = parseOptionalNumber(maxVulnerabilities, 'maxVulnerabilities');
      const parsedMaxDuplicationPct = parseOptionalNumber(maxDuplicationPct, 'maxDuplicationPct');
      const parsedMaxComplexityCount = parseOptionalNumber(maxComplexityCount, 'maxComplexityCount');
      const parsedMaxCodeSmellCount = parseOptionalNumber(maxCodeSmellCount, 'maxCodeSmellCount');
      const parsedBlockPR = parseOptionalBoolean(blockPR) ?? false;

      assertValidation(parsedMinHealthScore >= 0 && parsedMinHealthScore <= 100, 'minHealthScore', 'must be between 0 and 100');

      const data = {
        minHealthScore: parsedMinHealthScore,
        maxCriticalFindings: parsedMaxCriticalFindings === undefined ? null : parsedMaxCriticalFindings,
        maxVulnerabilities: parsedMaxVulnerabilities === undefined ? null : parsedMaxVulnerabilities,
        maxDuplicationPct: parsedMaxDuplicationPct === undefined ? null : parsedMaxDuplicationPct,
        maxComplexityCount: parsedMaxComplexityCount === undefined ? null : parsedMaxComplexityCount,
        maxCodeSmellCount: parsedMaxCodeSmellCount === undefined ? null : parsedMaxCodeSmellCount,
        blockPR: parsedBlockPR,
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
