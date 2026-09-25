import { AnalysisStatus, prisma, type Agent, type AnalysisJob, type Repository } from '@codehealth/db';
import type { JobLeaseDescriptor } from '@codehealth/shared';

import { env } from '../config/env';
import { analysisQueue } from '../lib/queue';
import { logger } from '../lib/logger';
import { AppError } from '../middleware/errorHandler';

// Matches BullMQ defaultJobOptions.attempts on the analysis queue.
export const MAX_JOB_LEASE_ATTEMPTS = 3;

type LeasedJobRow = AnalysisJob & {
  repository: Repository;
  pullRequest: { prNumber: number } | null;
};

function toDescriptor(job: LeasedJobRow, visibilityTimeoutSeconds: number): JobLeaseDescriptor {
  return {
    analysisId: job.id,
    repoId: job.repoId,
    prNumber: job.pullRequest?.prNumber ?? null,
    branch: job.branch,
    commitSha: job.commitSha,
    cloneUrl: job.repository.cloneUrl ?? `${job.repository.htmlUrl}.git`,
    leaseExpiresAt: job.leaseExpiresAt!.toISOString(),
    visibilityTimeoutSeconds,
  };
}

async function removeBullJob(bullJobId: string | null): Promise<void> {
  if (!bullJobId) return;

  try {
    const bullJob = await analysisQueue.getJob(bullJobId);
    if (bullJob) {
      await bullJob.remove();
    }
  } catch (err) {
    logger.warn({ bullJobId, err }, 'Could not remove BullMQ job after HTTP lease');
  }
}

export async function assertActiveLease(jobId: string, agent: Agent): Promise<AnalysisJob> {
  const job = await prisma.analysisJob.findUnique({
    where: { id: jobId },
    include: { repository: { select: { orgId: true } } },
  });

  if (!job) {
    throw new AppError(404, 'NOT_FOUND', 'Job not found');
  }

  if (job.repository.orgId !== agent.orgId) {
    throw new AppError(404, 'NOT_FOUND', 'Job not found');
  }

  if (job.status !== AnalysisStatus.RUNNING) {
    throw new AppError(409, 'CONFLICT', 'Job is not currently leased');
  }

  if (job.leasedByAgentId !== agent.id) {
    throw new AppError(409, 'CONFLICT', 'Job is leased by another agent');
  }

  if (!job.leaseExpiresAt || job.leaseExpiresAt <= new Date()) {
    throw new AppError(409, 'LEASE_EXPIRED', 'Job lease has expired');
  }

  return job;
}

export async function leaseNextJob(agent: Agent): Promise<JobLeaseDescriptor | null> {
  const visibilityTimeoutSeconds = env.jobLeaseVisibilityTimeoutSeconds;

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "AnalysisJob" AS aj
      SET
        "status" = CASE
          WHEN aj."retryCount" + 1 >= ${MAX_JOB_LEASE_ATTEMPTS} THEN 'FAILED'::"AnalysisStatus"
          ELSE 'PENDING'::"AnalysisStatus"
        END,
        "startedAt" = NULL,
        "leasedByAgentId" = NULL,
        "leaseExpiresAt" = NULL,
        "retryCount" = aj."retryCount" + 1,
        "errorMessage" = CASE
          WHEN aj."retryCount" + 1 >= ${MAX_JOB_LEASE_ATTEMPTS} THEN 'Lease expired after maximum retries'
          ELSE aj."errorMessage"
        END,
        "completedAt" = CASE
          WHEN aj."retryCount" + 1 >= ${MAX_JOB_LEASE_ATTEMPTS} THEN NOW()
          ELSE aj."completedAt"
        END
      FROM "Repository" AS r
      WHERE aj."repoId" = r.id
        AND r."orgId" = ${agent.orgId}
        AND aj."status" = 'RUNNING'::"AnalysisStatus"
        AND aj."leaseExpiresAt" IS NOT NULL
        AND aj."leaseExpiresAt" < NOW()
    `;

    const candidates = await tx.$queryRaw<{ id: string }[]>`
      SELECT aj.id
      FROM "AnalysisJob" AS aj
      INNER JOIN "Repository" AS r ON aj."repoId" = r.id
      WHERE r."orgId" = ${agent.orgId}
        AND aj."status" = 'PENDING'::"AnalysisStatus"
      ORDER BY aj."queuedAt" ASC
      LIMIT 1
      FOR UPDATE OF aj SKIP LOCKED
    `;

    if (!candidates.length) {
      return null;
    }

    const leaseExpiresAt = new Date(Date.now() + visibilityTimeoutSeconds * 1000);

    const leased = await tx.analysisJob.update({
      where: { id: candidates[0].id },
      data: {
        status: AnalysisStatus.RUNNING,
        startedAt: new Date(),
        leasedByAgentId: agent.id,
        leaseExpiresAt,
      },
      include: {
        repository: true,
        pullRequest: { select: { prNumber: true } },
      },
    });

    return toDescriptor(leased, visibilityTimeoutSeconds);
  }).then(async (descriptor) => {
    if (!descriptor) return null;

    const job = await prisma.analysisJob.findUnique({
      where: { id: descriptor.analysisId },
      select: { bullJobId: true },
    });
    await removeBullJob(job?.bullJobId ?? null);

    return descriptor;
  });
}

export async function completeJob(jobId: string, agent: Agent): Promise<AnalysisJob> {
  await assertActiveLease(jobId, agent);

  return prisma.analysisJob.update({
    where: { id: jobId },
    data: {
      status: AnalysisStatus.COMPLETED,
      completedAt: new Date(),
      progress: 100,
      leasedByAgentId: null,
      leaseExpiresAt: null,
    },
  });
}

export async function failJob(
  jobId: string,
  agent: Agent,
  errorMessage: string,
  stage?: string,
): Promise<AnalysisJob> {
  await assertActiveLease(jobId, agent);

  const message = stage ? `[${stage}] ${errorMessage}` : errorMessage;

  return prisma.analysisJob.update({
    where: { id: jobId },
    data: {
      status: AnalysisStatus.FAILED,
      errorMessage: message,
      completedAt: new Date(),
      leasedByAgentId: null,
      leaseExpiresAt: null,
    },
  });
}
