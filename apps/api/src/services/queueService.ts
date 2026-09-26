import { AnalysisStatus, AnalysisTrigger, prisma } from '@codehealth/db';

import { analysisQueue } from '../lib/queue';
import { AppError } from '../middleware/errorHandler';

interface EnqueueAnalysisInput {
  repoId: string;
  branch: string;
  commitSha: string;
  cloneUrl: string;
  trigger: AnalysisTrigger;
  // empty for manual runs
  pullRequestId?: string;
  prNumber?: number;
}

// row first so there's an id to track, then add to the queue
export async function enqueueAnalysisJob(input: EnqueueAnalysisInput) {
  const analysis = await prisma.analysisJob.create({
    data: {
      repoId: input.repoId,
      branch: input.branch,
      commitSha: input.commitSha,
      trigger: input.trigger,
      pullRequestId: input.pullRequestId,
    },
  });

  let job;
  try {
    job = await analysisQueue.add('analyze', {
      analysisId: analysis.id,
      repoId: input.repoId,
      prNumber: input.prNumber ?? null,
      branch: input.branch,
      commitSha: input.commitSha,
      cloneUrl: input.cloneUrl,
    });
  } catch (err) {
    // redis down, don't leave it stuck at PENDING
    await prisma.analysisJob.update({
      where: { id: analysis.id },
      data: { status: AnalysisStatus.FAILED, errorMessage: 'Failed to enqueue analysis job' },
    });
    throw err;
  }

  await prisma.analysisJob.update({
    where: { id: analysis.id },
    data: { bullJobId: job.id },
  });

  return { analysisId: analysis.id, jobId: job.id };
}

// How long a job can sit unfinished before a new one is allowed anyway.
const STALE_AFTER_MS = 15 * 60 * 1000;

// sha isn't known yet, so HEAD for now
export async function triggerManualAnalysis(repoId: string, userId: string, orgRole: string) {
  const repository = await prisma.repository.findUnique({
    where: { id: repoId },
    select: { isActive: true, ownerId: true, defaultBranch: true, cloneUrl: true, htmlUrl: true },
  });

  if (!repository || !repository.isActive) {
    throw new AppError(404, 'NOT_FOUND', 'Repository not found');
  }

  // narrower than the route's write guard — a TEAM_LEAD can't trigger analysis
  const isOrgManager = orgRole === 'OWNER' || orgRole === 'ADMIN';
  if (repository.ownerId !== userId && !isOrgManager) {
    throw new AppError(
      403,
      'FORBIDDEN',
      'Only the repository owner or an organization admin can trigger an analysis',
    );
  }

  // ignore old jobs so a dead worker can't block the repo
  const running = await prisma.analysisJob.findFirst({
    where: {
      repoId,
      status: { in: [AnalysisStatus.PENDING, AnalysisStatus.RUNNING] },
      queuedAt: { gt: new Date(Date.now() - STALE_AFTER_MS) },
    },
    select: { id: true },
  });

  if (running) {
    throw new AppError(
      429,
      'RATE_LIMITED',
      'An analysis is already in progress for this repository',
    );
  }

  return await enqueueAnalysisJob({
    repoId,
    branch: repository.defaultBranch,
    commitSha: 'HEAD',
    cloneUrl: repository.cloneUrl ?? `${repository.htmlUrl}.git`,
    trigger: AnalysisTrigger.MANUAL,
  });
}
