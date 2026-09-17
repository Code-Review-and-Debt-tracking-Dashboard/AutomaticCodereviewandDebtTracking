import {
  ANALYSIS_QUEUE_NAME,
  BULK_LINK_QUEUE_NAME,
  type AnalysisJobData,
  type BulkLinkJobData,
} from '@codehealth/shared';
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

// Bulk repository linking. Separate queue, not a second job type on the
// analysis queue — the analysis worker reads job.data.analysisId on failure
// and would choke on a payload that hasn't got one.
export const bulkLinkQueue = new Queue<BulkLinkJobData>(BULK_LINK_QUEUE_NAME, {
  connection: redis,
  skipWaitingForReady: true,
  defaultJobOptions: {
    // No retry. A second attempt would redo a half-finished batch and throw
    // away the per-repo results from the first, which is all we have.
    attempts: 1,
    // The results are the response to the status endpoint, so they have to
    // outlive the job. By age, so a busy queue can't evict a batch someone
    // is still watching.
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 3600 },
  },
});
