import 'dotenv/config';

import { AnalysisStatus, prisma } from '@codehealth/db';
import { ANALYSIS_QUEUE_NAME, type AnalysisJobData } from '@codehealth/shared';
import { Worker } from 'bullmq';

import { env } from './config/env';
import { logger } from './lib/logger';
import { redis } from './lib/redis';
import { analysisProcessor } from './processors/analysisProcessor';

// Consumer side of the analysis queue. Retry and retention options live on the
// producer in the API — BullMQ stores them per job, so they must not be
// repeated here.
const worker = new Worker<AnalysisJobData>(ANALYSIS_QUEUE_NAME, analysisProcessor, {
  connection: redis,
  concurrency: env.concurrency,
});

worker.on('completed', (job) => {
  logger.info({ jobId: job.id, analysisId: job.data.analysisId }, 'Analysis completed');
});

worker.on('failed', async (job, err) => {
  if (!job) {
    logger.error({ err }, 'Job failed before it could be loaded');
    return;
  }

  const attempts = job.opts.attempts ?? 1;
  logger.error(
    { jobId: job.id, analysisId: job.data.analysisId, attempt: job.attemptsMade, err },
    'Analysis attempt failed',
  );


  if (job.attemptsMade < attempts) return;

  try {
    await prisma.analysisJob.update({
      where: { id: job.data.analysisId },
      data: {
        status: AnalysisStatus.FAILED,
        errorMessage: err.message,
        retryCount: job.attemptsMade,
        completedAt: new Date(),
      },
    });
  } catch (updateErr) {
    logger.error({ analysisId: job.data.analysisId, err: updateErr }, 'Could not mark analysis failed');
  }
});

worker.on('error', (err) => {
  logger.error({ err }, 'Worker error');
});

logger.info({ queue: ANALYSIS_QUEUE_NAME, concurrency: env.concurrency }, 'Worker listening');

// Finish whatever is in flight before exiting, rather than orphaning a job
// mid-analysis with a half-written temp directory behind it.
async function shutdown(signal: string) {
  logger.info({ signal }, 'Shutting down worker');
  await worker.close();
  await redis.quit();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
