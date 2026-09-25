import { prisma } from '@codehealth/db';

import { AppError } from '../middleware/errorHandler';
import { getActiveRepo } from './repoService';

interface RegisterDeviceInput {
  expoPushToken: string;
  platform: 'ios' | 'android';
  deviceName?: string;
}

/**
 * Registers the caller's phone for push. The app calls this on every start,
 * so it has to be idempotent: the token is the key, and a repeat just
 * refreshes the row.
 *
 * A token that belongs to someone else moves to the caller — the same phone
 * signed out and then signed in as another user, and pushes must follow the
 * person who is signed in now.
 */
export async function registerDevice(userId: string, input: RegisterDeviceInput) {
  const fields = {
    userId,
    platform: input.platform === 'ios' ? ('IOS' as const) : ('ANDROID' as const),
    deviceName: input.deviceName ?? null,
    active: true,
    lastUsedAt: new Date(),
  };

  const device = await prisma.device.upsert({
    where: { expoPushToken: input.expoPushToken },
    create: { expoPushToken: input.expoPushToken, ...fields },
    update: fields,
  });

  return {
    id: device.id,
    expoPushToken: device.expoPushToken,
    platform: device.platform.toLowerCase(),
    active: device.active,
  };
}

// Someone else's device reads as missing, not forbidden, so ids can't be probed.
export async function unregisterDevice(userId: string, deviceId: string): Promise<void> {
  const deleted = await prisma.device.deleteMany({ where: { id: deviceId, userId } });

  if (deleted.count === 0) {
    throw new AppError(404, 'NOT_FOUND', 'Device not found');
  }
}

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
        healthScore: latest?.healthScore ?? 80,
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
}

function resolveSmellsLimit(query: SmellsQuery): number {
  const limitRaw = typeof query.limit === 'string' ? query.limit : undefined;
  const limit = limitRaw === undefined ? 20 : Number(limitRaw);

  if (!Number.isInteger(limit) || limit <= 0 || limit > 100) {
    throw new AppError(400, 'VALIDATION_ERROR', '"limit" must be an integer between 1 and 100');
  }

  return limit;
}

export async function getRepoSmells(repoId: string, query: SmellsQuery) {
  const repo = await getActiveRepo(repoId);
  const limit = resolveSmellsLimit(query);

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
      orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
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
