import { AnalysisStatus, prisma, type AnalysisTrigger } from '@codehealth/db';

import { analysisQueue } from '../lib/queue';

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
