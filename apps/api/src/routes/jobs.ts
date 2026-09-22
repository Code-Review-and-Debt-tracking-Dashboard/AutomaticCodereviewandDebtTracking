import { AnalysisStatus, prisma } from '@codehealth/db';
import { Router } from 'express';
import { z } from 'zod';

import { AppError } from '../middleware/errorHandler';
import { requireAgent } from '../middleware/requireAgent';
import { validateRequest } from '../middleware/zodValidate';
import { analysisQueue } from '../lib/queue';
import { Job } from 'bullmq';

export const jobsRouter = Router();

const LEASE_DURATION_MS = 10 * 60_000;

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

// A-37: Complete Endpoint (if not using ingest)
jobsRouter.post(
  '/jobs/:jobId/complete',
  requireAgent,
  async (req, res, next) => {
    try {
      const { jobId } = req.params;
      const job = await prisma.analysisJob.update({
        where: { id: jobId },
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
const failJobSchema = z.object({
  errorMessage: z.string(),
});

jobsRouter.post(
  '/jobs/:jobId/fail',
  requireAgent,
  validateRequest(z.object({ body: failJobSchema })),
  async (req, res, next) => {
    try {
      const { jobId } = req.params;
      const { errorMessage } = req.body;

      const job = await prisma.analysisJob.update({
        where: { id: jobId },
        data: {
          status: AnalysisStatus.FAILED,
          errorMessage,
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
const ingestResultsSchema = z.object({
  healthScore: z.number(),
  debtMinutes: z.number().optional(),
  vulnerabilityCount: z.number().optional(),
  criticalCount: z.number().optional(),
  highCount: z.number().optional(),
  mediumCount: z.number().optional(),
  lowCount: z.number().optional(),
  complexityCount: z.number().optional(),
  duplicationCount: z.number().optional(),
  codeSmellCount: z.number().optional(),
  maintainabilityCount: z.number().optional(),
  duplicationPct: z.number().optional(),
  totalIssues: z.number().optional(),
  linesOfCode: z.number().optional(),
  // Flat record of small primitives only (tool versions, counts) — no
  // nested structure or large strings, so this can't be used to smuggle
  // source code across the boundary.
  rawMetrics: z
    .record(z.string(), z.union([z.string().max(200), z.number(), z.boolean()]))
    .refine((obj) => Object.keys(obj).length <= 20, 'rawMetrics accepts at most 20 keys')
    .optional(),
  findings: z
    .array(
      z.object({
        file: z.string().optional(),
        line: z.number().optional(),
        endLine: z.number().optional(),
        column: z.number().optional(),
        endColumn: z.number().optional(),
        severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']),
        category: z.enum(['VULNERABILITY', 'COMPLEXITY', 'DUPLICATION', 'CODE_SMELL', 'MAINTAINABILITY']),
        rule: z.string(),
        message: z.string(),
        tool: z.string(),
        debtMinutes: z.number().optional(),
      })
    )
    .optional(),
});

jobsRouter.post(
  '/jobs/:jobId/results',
  requireAgent,
  validateRequest(z.object({ body: ingestResultsSchema })),
  async (req, res, next) => {
    try {
      const { jobId } = req.params;
      const data = req.body;

      const job = await prisma.analysisJob.findUnique({
        where: { id: jobId },
      });

      if (!job) {
        throw new AppError(404, 'NOT_FOUND', 'Job not found');
      }

      // Create snapshot and findings, and update job status in a transaction
      await prisma.$transaction(async (tx) => {
        const snapshot = await tx.healthSnapshot.create({
          data: {
            analysisId: job.id,
            repoId: job.repoId,
            healthScore: data.healthScore,
            debtMinutes: data.debtMinutes || 0,
            vulnerabilityCount: data.vulnerabilityCount || 0,
            criticalCount: data.criticalCount || 0,
            highCount: data.highCount || 0,
            mediumCount: data.mediumCount || 0,
            lowCount: data.lowCount || 0,
            complexityCount: data.complexityCount || 0,
            duplicationCount: data.duplicationCount || 0,
            codeSmellCount: data.codeSmellCount || 0,
            maintainabilityCount: data.maintainabilityCount || 0,
            duplicationPct: data.duplicationPct || 0,
            totalIssues: data.totalIssues || 0,
            linesOfCode: data.linesOfCode || 0,
            rawMetrics: data.rawMetrics || null,
          },
        });

        if (data.findings && data.findings.length > 0) {
          const findingsData = data.findings.map((f: any) => ({
            ...f,
            snapshotId: snapshot.id,
            repoId: job.repoId,
          }));
          await tx.finding.createMany({
            data: findingsData,
          });
        }

        await tx.analysisJob.update({
          where: { id: job.id },
          data: {
            status: AnalysisStatus.COMPLETED,
            completedAt: new Date(),
            progress: 100,
          },
        });
      });

      res.status(200).json({ message: 'Results ingested successfully' });
    } catch (error) {
      next(error);
    }
  },
);
