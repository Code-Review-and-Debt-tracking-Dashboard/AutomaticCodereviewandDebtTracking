import { AnalysisStatus, prisma } from '@codehealth/db';
import type { AnalysisResultsPayload, BaselineSnapshot, QualityGateThresholds } from '@codehealth/shared';
import { Router, type Request } from 'express';
import { z } from 'zod';

import { AppError } from '../middleware/errorHandler';
import { requireAgent } from '../middleware/requireAgent';
import { validateRequest } from '../middleware/zodValidate';
import { createAnalysisNotifications } from '../services/notificationService';
import { sendPushNotifications } from '../services/pushService';

export const jobsRouter = Router();

const LEASE_DURATION_MS = 10 * 60_000;

// agents only see their own org's jobs, others are a 404
async function loadAgentJob(req: Request, jobId: string) {
  const { orgId } = req.agent!;

  const job = await prisma.analysisJob.findFirst({
    // no orgId = platform agent, sees every org
    where: { id: jobId, ...(orgId ? { repository: { orgId } } : {}) },
  });

  if (!job) {
    throw new AppError(404, 'NOT_FOUND', 'Job not found');
  }

  return job;
}

jobsRouter.post('/jobs/lease', requireAgent, async (req, res, next) => {
  try {
    // put expired leases back to PENDING first
    await prisma.analysisJob.updateMany({
      where: { status: AnalysisStatus.RUNNING, leaseExpiresAt: { lt: new Date() } },
      data: { status: AnalysisStatus.PENDING, leaseExpiresAt: null },
    });

    const startedAt = new Date();
    const leaseExpiresAt = new Date(startedAt.getTime() + LEASE_DURATION_MS);

    // SKIP LOCKED so two agents polling at once can't lease the same job.
    const leased = await prisma.$queryRaw<{ id: string }[]>`
      UPDATE "AnalysisJob"
      SET status = 'RUNNING'::"AnalysisStatus", "startedAt" = ${startedAt}, "leaseExpiresAt" = ${leaseExpiresAt}
      WHERE id = (
        SELECT id FROM "AnalysisJob"
        WHERE status = 'PENDING'::"AnalysisStatus"
        ORDER BY "queuedAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      RETURNING id;
    `;

    if (!leased.length) {
      return res.status(204).send();
    }

    const job = await prisma.analysisJob.findUniqueOrThrow({
      where: { id: leased[0].id },
      include: { repository: true },
    });

    res.status(200).json({
      id: job.id,
      repoId: job.repoId,
      branch: job.branch,
      commitSha: job.commitSha,
      cloneUrl: job.repository.cloneUrl || `${job.repository.htmlUrl}.git`,
      pullRequestId: job.pullRequestId,
    });
  } catch (error) {
    next(error);
  }
});

// marks a job as started so the lease sweep can reclaim it
jobsRouter.post('/jobs/:jobId/start', requireAgent, async (req, res, next) => {
  try {
    const job = await loadAgentJob(req, req.params.jobId);
    const startedAt = new Date();

    await prisma.analysisJob.update({
      where: { id: job.id },
      data: {
        status: AnalysisStatus.RUNNING,
        startedAt,
        leaseExpiresAt: new Date(startedAt.getTime() + LEASE_DURATION_MS),
      },
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

jobsRouter.get('/jobs/:jobId/quality-gate', requireAgent, async (req, res, next) => {
  try {
    const job = await loadAgentJob(req, req.params.jobId);
    const gate = await prisma.qualityGate.findUnique({ where: { repoId: job.repoId } });

    // no gate, worker uses its defaults
    if (!gate) {
      return res.status(204).send();
    }

    const thresholds: QualityGateThresholds = {
      minHealthScore: gate.minHealthScore,
      maxCriticalFindings: gate.maxCriticalFindings,
      maxVulnerabilities: gate.maxVulnerabilities,
      maxDuplicationPct: gate.maxDuplicationPct,
      maxComplexityCount: gate.maxComplexityCount,
      maxCodeSmellCount: gate.maxCodeSmellCount,
      blockPR: gate.blockPR,
    };

    res.status(200).json(thresholds);
  } catch (error) {
    next(error);
  }
});

// PRs compare against their base branch, pushes against their own branch
jobsRouter.get('/jobs/:jobId/baseline', requireAgent, async (req, res, next) => {
  try {
    const job = await loadAgentJob(req, req.params.jobId);

    const pullRequest = job.pullRequestId
      ? await prisma.pullRequest.findUnique({ where: { id: job.pullRequestId } })
      : null;
    const branch = pullRequest?.baseBranch ?? job.branch;

    const snapshot = await prisma.healthSnapshot.findFirst({
      where: {
        repoId: job.repoId,
        analysisId: { not: job.id },
        analysis: { branch, pullRequestId: null },
      },
      orderBy: { calculatedAt: 'desc' },
      select: {
        healthScore: true,
        findings: {
          select: {
            file: true,
            line: true,
            endLine: true,
            column: true,
            endColumn: true,
            severity: true,
            category: true,
            state: true,
            rule: true,
            message: true,
            tool: true,
            debtMinutes: true,
          },
        },
      },
    });

    // first run
    if (!snapshot) {
      return res.status(204).send();
    }

    const baseline: BaselineSnapshot = snapshot;
    res.status(200).json(baseline);
  } catch (error) {
    next(error);
  }
});

jobsRouter.post(
  '/jobs/:jobId/complete',
  requireAgent,
  async (req, res, next) => {
    try {
      const leased = await loadAgentJob(req, req.params.jobId);
      const job = await prisma.analysisJob.update({
        where: { id: leased.id },
        data: {
          status: AnalysisStatus.COMPLETED,
          completedAt: new Date(),
          progress: 100,
        },
      });
      res.status(200).json(job);
    } catch (error) {
      next(error);
    }
  },
);

const analysisStage = z.enum([
  'clone',
  'detect',
  'analyze',
  'normalize',
  'score',
  'gate',
  'comment',
  'persist',
]);

const failJobSchema = z.object({
  analysisId: z.string(),
  stage: analysisStage,
  errorMessage: z.string(),
  retryCount: z.number().int(),
});

jobsRouter.post(
  '/jobs/:jobId/fail',
  requireAgent,
  validateRequest(z.object({ body: failJobSchema })),
  async (req, res, next) => {
    try {
      const leased = await loadAgentJob(req, req.params.jobId);
      const { stage, errorMessage, retryCount } = req.body;

      const job = await prisma.analysisJob.update({
        where: { id: leased.id },
        data: {
          status: AnalysisStatus.FAILED,
          // no stage column, so put it in the message
          errorMessage: `${stage}: ${errorMessage}`,
          retryCount,
          completedAt: new Date(),
        },
      });

      res.status(200).json(job);
    } catch (error) {
      next(error);
    }
  },
);

// no field can hold source code
const ingestResultsSchema = z.object({
  analysisId: z.string(),
  commitSha: z.string(),
  metrics: z.object({
    healthScore: z.number(),
    debtMinutes: z.number(),
    debtDeltaMinutes: z.number(),
    vulnerabilityCount: z.number(),
    criticalCount: z.number(),
    highCount: z.number(),
    mediumCount: z.number(),
    lowCount: z.number(),
    complexityCount: z.number(),
    duplicationCount: z.number(),
    codeSmellCount: z.number(),
    maintainabilityCount: z.number(),
    duplicationPct: z.number(),
    totalIssues: z.number(),
    linesOfCode: z.number(),
    gateResult: z.enum(['PASS', 'FAIL']).nullable(),
  }),
  findings: z.array(
    z.object({
      file: z.string().nullable(),
      line: z.number().nullable(),
      endLine: z.number().nullable(),
      column: z.number().nullable(),
      endColumn: z.number().nullable(),
      severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']),
      category: z.enum(['VULNERABILITY', 'COMPLEXITY', 'DUPLICATION', 'CODE_SMELL', 'MAINTAINABILITY']),
      state: z.enum(['NEW', 'EXISTING', 'RESOLVED', 'UNKNOWN']),
      rule: z.string(),
      message: z.string(),
      tool: z.string(),
      debtMinutes: z.number(),
    }),
  ),
  // capped so source code can't be sent through here
  toolVersions: z
    .record(z.string(), z.string().max(200))
    .refine((obj) => Object.keys(obj).length <= 20, 'toolVersions accepts at most 20 keys'),
  analysisLimited: z.boolean(),
});

jobsRouter.post(
  '/jobs/:jobId/results',
  requireAgent,
  validateRequest(z.object({ body: ingestResultsSchema })),
  async (req, res, next) => {
    try {
      const job = await loadAgentJob(req, req.params.jobId);
      const { commitSha, metrics, findings, toolVersions, analysisLimited } =
        req.body as AnalysisResultsPayload;

      // a retry can send the same results twice, ignore the second one
      const existing = await prisma.healthSnapshot.findUnique({
        where: { analysisId: job.id },
      });

      if (existing) {
        return res.status(200).json({ snapshotId: existing.id });
      }

      // read before writing the new one, null on first run
      const previous = await prisma.healthSnapshot.findFirst({
        where: { repoId: job.repoId },
        orderBy: { calculatedAt: 'desc' },
        select: { healthScore: true },
      });

      const { snapshot, notified } = await prisma.$transaction(async (tx) => {
        const created = await tx.healthSnapshot.create({
          data: {
            analysisId: job.id,
            repoId: job.repoId,
            ...metrics,
            rawMetrics: { ...toolVersions, analysisLimited },
          },
        });

        if (findings.length > 0) {
          await tx.finding.createMany({
            data: findings.map((f) => ({
              ...f,
              snapshotId: created.id,
              repoId: job.repoId,
            })),
          });
        }

        const notified = await createAnalysisNotifications(tx, {
          repoId: job.repoId,
          snapshotId: created.id,
          metrics,
          findings,
          previousScore: previous?.healthScore ?? null,
        });

        await tx.analysisJob.update({
          where: { id: job.id },
          data: {
            status: AnalysisStatus.COMPLETED,
            // manual runs only get the real sha here
            commitSha,
            completedAt: new Date(),
            progress: 100,
          },
        });

        return { snapshot: created, notified };
      });

      res.status(200).json({ snapshotId: snapshot.id });

      // after commit, don't make the worker wait
      void sendPushNotifications({ repoId: job.repoId, ...notified });
    } catch (error) {
      next(error);
    }
  },
);
