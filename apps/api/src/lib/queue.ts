import { ANALYSIS_QUEUE_NAME, type AnalysisJobData } from '@codehealth/shared';
import { Queue } from 'bullmq';

import { redis } from './redis';

// Producer side of the analysis queue — the API only ever adds jobs here;
// the worker is a separate process that consumes them.
export const analysisQueue = new Queue<AnalysisJobData>(ANALYSIS_QUEUE_NAME, {
  connection: redis,
  // Error instead of blocking when Redis is unreachable. Jobs are added
  // while an HTTP request is waiting, and a webhook has to be answered in
  // seconds — failing fast lets us mark the analysis failed and reply.
  skipWaitingForReady: true,
  defaultJobOptions: {
    // 3 total attempts, backing off 5s then 10s between them.
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    // Keep a bounded history so Redis doesn't grow without limit.
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});
