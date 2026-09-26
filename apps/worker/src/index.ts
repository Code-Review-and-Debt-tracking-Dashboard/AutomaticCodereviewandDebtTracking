import 'dotenv/config';

import { prisma } from '@codehealth/db';
import {
  ANALYSIS_QUEUE_NAME,
  BULK_LINK_QUEUE_NAME,
  type AnalysisJobData,
  type AnalysisStage,
  type BulkLinkJobData,
} from '@codehealth/shared';
import { Worker } from 'bullmq';

import { reportFailure } from './lib/apiClient';
import { env } from './config/env';
import { logger } from './lib/logger';
import { redis } from './lib/redis';
import { analysisProcessor } from './processors/analysisProcessor';
import { bulkLinkProcessor } from './processors/bulkLinkProcessor';

// retry options are set by the API when it adds the job
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
    await reportFailure({
      analysisId: job.data.analysisId,
      // untagged errors came from the API call
      stage: (err as { stage?: AnalysisStage }).stage ?? 'persist',
      errorMessage: err.message,
      retryCount: job.attemptsMade,
    });
  } catch (updateErr) {
    logger.error({ analysisId: job.data.analysisId, err: updateErr }, 'Could not mark analysis failed');
  }
});

worker.on('error', (err) => {
  logger.error({ err }, 'Worker error');
});

// one at a time to avoid github rate limits
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

// let running jobs finish before exit
async function shutdown(signal: string) {
  logger.info({ signal }, 'Shutting down worker');
  await Promise.all([worker.close(), bulkLinkWorker.close()]);
  await redis.quit();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
