import { prisma } from '@codehealth/db';

import { AppError } from '../middleware/errorHandler';
import { getActiveRepo } from './repoService';

export async function getMobileSummary(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true, avatarUrl: true },
  });

  const unreadNotifications = await prisma.notification.count({
    where: { userId, readAt: null },
  });

  const repos = await prisma.repository.findMany({
    where: {
      isActive: true,
      OR: [{ ownerId: userId }, { members: { some: { userId, status: 'ACTIVE' } } }],
    },
    select: {
      id: true,
      name: true,
      fullName: true,
      snapshots: {
        orderBy: { calculatedAt: 'desc' },
        take: 2,
        select: { healthScore: true, criticalCount: true, calculatedAt: true },
      },
    },
  });

  const repoIds = repos.map((r) => r.id);
  const openPrCounts = await prisma.pullRequest.groupBy({
    by: ['repoId'],
    where: { repoId: { in: repoIds }, status: 'OPEN' },
    _count: true,
  });
  const openPrByRepo = new Map(openPrCounts.map((c) => [c.repoId, c._count]));

  return {
    user,
    unreadNotifications,
    repos: repos.map((repo) => {
      const [latest, previous] = repo.snapshots;
      return {
        id: repo.id,
        name: repo.name,
        fullName: repo.fullName,
        healthScore: latest?.healthScore ?? null,
        scoreChange: latest && previous ? latest.healthScore - previous.healthScore : 0,
        openPRs: openPrByRepo.get(repo.id) ?? 0,
        criticalIssues: latest?.criticalCount ?? 0,
        lastAnalyzedAt: latest?.calculatedAt ? latest.calculatedAt.toISOString() : null,
      };
    }),
  };
}

interface SmellsQuery {
  limit?: unknown;
  offset?: unknown;
}

function resolveSmellsLimit(query: SmellsQuery): number {
  const limitRaw = typeof query.limit === 'string' ? query.limit : undefined;
  const limit = limitRaw === undefined ? 20 : Number(limitRaw);

  if (!Number.isInteger(limit) || limit <= 0 || limit > 100) {
    throw new AppError(400, 'VALIDATION_ERROR', '"limit" must be an integer between 1 and 100');
  }

  return limit;
}

function resolveSmellsOffset(query: SmellsQuery): number {
  const offsetRaw = typeof query.offset === 'string' ? query.offset : undefined;
  const offset = offsetRaw === undefined ? 0 : Number(offsetRaw);

  if (!Number.isInteger(offset) || offset < 0) {
    throw new AppError(400, 'VALIDATION_ERROR', '"offset" must be a non-negative integer');
  }

  return offset;
}

export async function getRepoSmells(repoId: string, query: SmellsQuery) {
  const repo = await getActiveRepo(repoId);
  const limit = resolveSmellsLimit(query);
  const offset = resolveSmellsOffset(query);

  const snapshot = await prisma.healthSnapshot.findFirst({
    where: { repoId },
    orderBy: { calculatedAt: 'desc' },
  });

  if (!snapshot) {
    throw new AppError(404, 'NOT_FOUND', 'No analysis found for this repository');
  }

  const [findings, totalSmells, newSmells] = await Promise.all([
    prisma.finding.findMany({
      where: { snapshotId: snapshot.id },
      // id tiebreak keeps pages stable: a scan inserts many findings with the same createdAt
      orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }, { id: 'asc' }],
      skip: offset,
      take: limit,
      select: { file: true, line: true, severity: true, rule: true, message: true, state: true },
    }),
    prisma.finding.count({ where: { snapshotId: snapshot.id } }),
    prisma.finding.count({ where: { snapshotId: snapshot.id, state: 'NEW' } }),
  ]);

  return {
    repoName: repo.name,
    healthScore: snapshot.healthScore,
    snapshotDate: snapshot.calculatedAt.toISOString(),
    smells: findings.map((f) => ({
      file: f.file,
      line: f.line,
      severity: f.severity,
      rule: f.rule,
      message: f.message,
      isNew: f.state === 'NEW',
    })),
    totalSmells,
    newSmells,
  };
}
