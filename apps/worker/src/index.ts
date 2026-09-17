import 'dotenv/config';

import { AnalysisStatus, prisma } from '@codehealth/db';
import {
  ANALYSIS_QUEUE_NAME,
  BULK_LINK_QUEUE_NAME,
  type AnalysisJobData,
  type BulkLinkJobData,
} from '@codehealth/shared';
import { Worker } from 'bullmq';

import { env } from './config/env';
import { logger } from './lib/logger';
import { redis } from './lib/redis';
import { analysisProcessor } from './processors/analysisProcessor';
import { bulkLinkProcessor } from './processors/bulkLinkProcessor';

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

// Its own queue rather than another job type on the analysis one: the handlers
// above read job.data.analysisId, which a bulk link job hasn't got.
// Concurrency 1 because each job is already a long sequential run of GitHub
// calls, and running batches side by side just invites rate limiting.
const bulkLinkWorker = new Worker<BulkLinkJobData>(BULK_LINK_QUEUE_NAME, bulkLinkProcessor, {
  connection: redis,
  concurrency: 1,
});

bulkLinkWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, orgId: job?.data.orgId, err }, 'Bulk link job failed');
});

bulkLinkWorker.on('error', (err) => {
  logger.error({ err }, 'Bulk link worker error');
});

logger.info(
  { queues: [ANALYSIS_QUEUE_NAME, BULK_LINK_QUEUE_NAME], concurrency: env.concurrency },
  'Worker listening',
);

// Finish whatever is in flight before exiting, rather than orphaning a job
// mid-analysis with a half-written temp directory behind it.
async function shutdown(signal: string) {
  logger.info({ signal }, 'Shutting down worker');
  await Promise.all([worker.close(), bulkLinkWorker.close()]);
  await redis.quit();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
