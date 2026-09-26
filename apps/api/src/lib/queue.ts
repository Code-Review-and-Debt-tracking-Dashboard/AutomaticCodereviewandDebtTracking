import {
  ANALYSIS_QUEUE_NAME,
  BULK_LINK_QUEUE_NAME,
  type AnalysisJobData,
  type BulkLinkJobData,
} from '@codehealth/shared';
import { Queue } from 'bullmq';

import { redis } from './redis';

// API only adds jobs, the worker consumes them
export const analysisQueue = new Queue<AnalysisJobData>(ANALYSIS_QUEUE_NAME, {
  connection: redis,
  // fail fast if redis is down instead of hanging the request
  skipWaitingForReady: true,
  defaultJobOptions: {
    // 3 tries, 5s then 10s backoff
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

// separate queue, bulk link jobs have no analysisId
export const bulkLinkQueue = new Queue<BulkLinkJobData>(BULK_LINK_QUEUE_NAME, {
  connection: redis,
  skipWaitingForReady: true,
  defaultJobOptions: {
    // no retry, it would lose the first run's results
    attempts: 1,
    // keep for an hour so the status endpoint can read it
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 3600 },
  },
});
