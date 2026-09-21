import { AnalysisStatus, prisma } from '@codehealth/db';
import { Router } from 'express';
import { z } from 'zod';

import { AppError } from '../middleware/errorHandler';
import { requireAgent } from '../middleware/requireAgent';
import { validate } from '../middleware/validate';
import { analysisQueue } from '../lib/queue';
import { Job } from 'bullmq';

export const jobsRouter = Router();

// A-37: Job Lease Endpoint
// Since jobs are enqueued in BullMQ, we can pop them or we can fetch them via DB. 
// Given the requirements "Job-lease endpoint... fixed visibility timeout", we'll lease via Postgres
// to provide a simple HTTP pull interface.
jobsRouter.post('/jobs/lease', requireAgent, async (req, res, next) => {
  try {
    const job = await prisma.$transaction(async (tx) => {
      // Find the oldest pending job
      const pendingJobs = await tx.analysisJob.findMany({
        where: { status: AnalysisStatus.PENDING },
        orderBy: { queuedAt: 'asc' },
        take: 1,
        // PostgreSQL specific lock
        // skipLocked would require raw query but prisma doesn't support skipLocked natively on findMany yet
        // However, we can just do a simple findFirst and update, assuming low concurrency of agents for now.
      });

      if (!pendingJobs.length) return null;

      const jobToLease = pendingJobs[0];

      return await tx.analysisJob.update({
        where: { id: jobToLease.id },
        data: {
          status: AnalysisStatus.RUNNING,
          startedAt: new Date(),
        },
        include: {
          repository: true,
        },
      });
    });

    if (!job) {
      return res.status(204).send();
    }

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
  validate({ body: failJobSchema }),
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
  rawMetrics: z.any().optional(),
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
  validate({ body: ingestResultsSchema }),
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
