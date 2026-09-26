import type { BulkLinkJobResult, BulkLinkProgress } from '@codehealth/shared';
import { Job } from 'bullmq';

import { bulkLinkQueue } from '../lib/queue';
import { AppError } from '../middleware/errorHandler';

export async function enqueueBulkLink(userId: string, orgId: string, githubRepoIds: number[]) {
  // dedupe
  const ids = [...new Set(githubRepoIds)];

  const job = await bulkLinkQueue.add('bulk-link', { userId, orgId, githubRepoIds: ids });

  return { jobId: job.id, total: ids.length };
}

export async function getBulkLinkStatus(jobId: string, orgId: string) {
  const job = await Job.fromId<unknown, BulkLinkJobResult>(bulkLinkQueue, jobId);

  if (!job) {
    throw new AppError(404, 'NOT_FOUND', 'Bulk link job not found');
  }

  // job ids are guessable, so check the org
  if ((job.data as { orgId?: string }).orgId !== orgId) {
    throw new AppError(404, 'NOT_FOUND', 'Bulk link job not found');
  }

  const progress = job.progress as BulkLinkProgress | number;
  const result = job.returnvalue ?? null;

  return {
    jobId: job.id,
    state: await job.getState(),
    progress:
      typeof progress === 'object' && progress !== null
        ? progress
        : { done: 0, total: (job.data as { githubRepoIds: number[] }).githubRepoIds.length },
    results: result?.results ?? null,
    summary: result?.summary ?? null,
    failedReason: job.failedReason ?? null,
  };
}
