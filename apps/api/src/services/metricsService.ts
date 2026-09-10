import { prisma } from '@codehealth/db';

import { analysisQueue } from '../lib/queue';

export async function getMetrics() {
  const [snapshotAgg, completedJobs, jobCounts] = await Promise.all([
    prisma.healthSnapshot.aggregate({
      _avg: { healthScore: true },
      _count: true,
    }),
    prisma.analysisJob.findMany({
      where: { status: 'COMPLETED', startedAt: { not: null }, completedAt: { not: null } },
      select: { startedAt: true, completedAt: true },
    }),
    analysisQueue.getJobCounts('waiting', 'active', 'completed', 'failed'),
  ]);

  const averageDurationSeconds =
    completedJobs.length === 0
      ? 0
      : completedJobs.reduce((sum, job) => {
          return sum + (job.completedAt!.getTime() - job.startedAt!.getTime()) / 1000;
        }, 0) / completedJobs.length;

  return {
    analysisStats: {
      totalAnalyses: snapshotAgg._count,
      averageHealthScore: snapshotAgg._avg.healthScore ?? 0,
      averageDurationSeconds,
    },
    queueStats: {
      pending: jobCounts.waiting,
      active: jobCounts.active,
      completed: jobCounts.completed,
      failed: jobCounts.failed,
    },
    systemStats: {
      uptimeSeconds: Math.floor(process.uptime()),
      memoryUsageMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    },
  };
}