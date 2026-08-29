import { AnalysisStatus, AnalysisTrigger, prisma } from '@codehealth/db';

import { analysisQueue } from '../lib/queue';
import { AppError } from '../middleware/errorHandler';

interface EnqueueAnalysisInput {
  repoId: string;
  branch: string;
  commitSha: string;
  cloneUrl: string;
  trigger: AnalysisTrigger;
  // Both absent for a manual whole-repo analysis.
  pullRequestId?: string;
  prNumber?: number;
}

/**
 * Creates the AnalysisJob row and puts the job on the queue. The row is
 * written first so the analysis has an id to track before any work starts,
 * and the queue job id is stored back on it once the job is accepted.
 */
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
    // Redis is unreachable. Without this the row would sit at PENDING
    // forever and block every later analysis of the same repo.
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

/**
 * Manual whole-repo analysis of the default branch. The commit sha isn't known
 * here — the worker clones the branch and resolves it — so 'HEAD' is recorded
 * as a placeholder.
 */
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

  const running = await prisma.analysisJob.findFirst({
    where: { repoId, status: { in: [AnalysisStatus.PENDING, AnalysisStatus.RUNNING] } },
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
