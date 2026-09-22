import { AnalysisStatus, prisma } from '@codehealth/db';
import type { QualityGateThresholds } from '@codehealth/shared';
import { Router, type Request } from 'express';
import { z } from 'zod';

import { AppError } from '../middleware/errorHandler';
import { requireAgent } from '../middleware/requireAgent';
import { validateRequest } from '../middleware/zodValidate';
import { analysisQueue } from '../lib/queue';
import { createAnalysisNotifications } from '../services/notificationService';
import { Job } from 'bullmq';

export const jobsRouter = Router();

const LEASE_DURATION_MS = 10 * 60_000;

// An agent belongs to one deployment, so it can only touch its own org's jobs.
// Another org's job is reported as missing rather than forbidden, so a token
// can't be used to find out which job ids exist.
async function loadAgentJob(req: Request, jobId: string) {
  const { orgId } = (req as any).agent;

  const job = await prisma.analysisJob.findFirst({
    where: { id: jobId, repository: { orgId } },
  });

  if (!job) {
    throw new AppError(404, 'NOT_FOUND', 'Job not found');
  }

  return job;
}

// A-37: Job Lease Endpoint
jobsRouter.post('/jobs/lease', requireAgent, async (req, res, next) => {
  try {
    // An agent that died mid-job leaves its job stuck at RUNNING. Reclaim
    // anything past its lease before handing out a new one.
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

// Marks a job as picked up. A worker that took its job off the queue rather
// than from /jobs/lease still has to say so here, so the same lease sweep above
// can reclaim it if the worker dies.
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

// The gate config the worker scores this job against. It has no database
// credentials of its own, so this is the only way it can read the thresholds.
jobsRouter.get('/jobs/:jobId/quality-gate', requireAgent, async (req, res, next) => {
  try {
    const job = await loadAgentJob(req, req.params.jobId);
    const gate = await prisma.qualityGate.findUnique({ where: { repoId: job.repoId } });

    // No gate configured — the worker falls back to its built-in defaults.
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

// A-37: Complete Endpoint (if not using ingest)
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

// A-37: Fail Endpoint
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
          // No column for the stage, so it rides along on the message rather
          // than being dropped.
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

// A-36: Results Ingest Endpoint
// Mirrors AnalysisResultsPayload field for field. Every field here is finding
// metadata or an aggregate number — there is deliberately nowhere to put source
// code, so source can't cross the boundary even by mistake.
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
  // Tool name to version. Short strings and a key cap, so this can't be used
  // to smuggle source code through the one free-form field on the payload.
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
      const { commitSha, metrics, findings, toolVersions, analysisLimited } = req.body;

      // A worker retries the whole job, so the same results can arrive twice
      // after a lost response. A snapshot is immutable, so the second delivery
      // is a no-op instead of a unique-constraint failure.
      const existing = await prisma.healthSnapshot.findUnique({
        where: { analysisId: job.id },
      });

      if (existing) {
        return res.status(200).json({ snapshotId: existing.id });
      }

      // Read before the new snapshot exists, or the ordering below would just
      // return the row we are about to write. Null on a repo's first analysis.
      const previous = await prisma.healthSnapshot.findFirst({
        where: { repoId: job.repoId },
        orderBy: { calculatedAt: 'desc' },
        select: { healthScore: true },
      });

      // Create snapshot and findings, and update job status in a transaction
      const snapshot = await prisma.$transaction(async (tx) => {
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
            data: findings.map((f: any) => ({
              ...f,
              snapshotId: created.id,
              repoId: job.repoId,
            })),
          });
        }

        await createAnalysisNotifications(tx, {
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
            // Manual runs are queued with a placeholder sha, so this is the
            // first point the row learns what was actually checked out.
            commitSha,
            completedAt: new Date(),
            progress: 100,
          },
        });

        return created;
      });

      res.status(200).json({ snapshotId: snapshot.id });
    } catch (error) {
      next(error);
    }
  },
);
