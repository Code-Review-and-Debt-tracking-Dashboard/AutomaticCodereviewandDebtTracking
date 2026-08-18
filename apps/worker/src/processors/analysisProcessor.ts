import { AnalysisStatus, prisma } from '@codehealth/db';
import type { AnalysisJobData } from '@codehealth/shared';
import type { Job } from 'bullmq';

import { logger } from '../lib/logger';

/**
 * Consumes one analysis job. For now it only moves the AnalysisJob row through
 * its lifecycle so the queue drains and the row stops sitting at PENDING —
 * the clone, detect, analyze, normalize, score, gate, comment and persist
 * stages are added on top of this in later tasks.
 *
 * Nothing is caught here on purpose: throwing is how BullMQ is told to retry,
 * and the worker's 'failed' listener is what marks the row FAILED.
 */
export async function analysisProcessor(job: Job<AnalysisJobData>) {
  const { analysisId, repoId, branch, commitSha } = job.data;

  await prisma.analysisJob.update({
    where: { id: analysisId },
    data: { status: AnalysisStatus.RUNNING, startedAt: new Date() },
  });

  logger.info({ jobId: job.id, analysisId, repoId, branch, commitSha }, 'Analysis started');

  // analysis stages go here

  await prisma.analysisJob.update({
    where: { id: analysisId },
    data: { status: AnalysisStatus.COMPLETED, progress: 100, completedAt: new Date() },
  });
}
