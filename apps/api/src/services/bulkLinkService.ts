import type { BulkLinkJobResult, BulkLinkProgress } from '@codehealth/shared';
import { Job } from 'bullmq';

import { bulkLinkQueue } from '../lib/queue';
import { AppError } from '../middleware/errorHandler';

export async function enqueueBulkLink(userId: string, orgId: string, githubRepoIds: number[]) {
  // Deduped so a picker that sends the same repo twice doesn't link it twice.
  const ids = [...new Set(githubRepoIds)];

  const job = await bulkLinkQueue.add('bulk-link', { userId, orgId, githubRepoIds: ids });

  return { jobId: job.id, total: ids.length };
}

export async function getBulkLinkStatus(jobId: string, orgId: string) {
  const job = await Job.fromId<unknown, BulkLinkJobResult>(bulkLinkQueue, jobId);

  // Also covers a job that has aged out of Redis.
  if (!job) {
    throw new AppError(404, 'NOT_FOUND', 'Bulk link job not found');
  }

  // Job ids are sequential, so without this anyone could read another org's
  // batch by guessing one.
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
