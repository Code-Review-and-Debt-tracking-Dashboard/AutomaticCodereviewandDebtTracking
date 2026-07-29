import { prisma } from '@codehealth/db';

import { AppError } from '../middleware/errorHandler';

const REPO_ROLES = ['TEAM_LEAD', 'DEVELOPER', 'VIEWER'] as const;
export type RepoRole = (typeof REPO_ROLES)[number];

export function isRepoRole(value: unknown): value is RepoRole {
  return typeof value === 'string' && (REPO_ROLES as readonly string[]).includes(value);
}

export interface RepoMember {
  id: string;
  userId: string;
  username: string;
  avatarUrl: string | null;
  role: string;
  status: string;
  addedAt: Date;
}

function toRepoMember(member: {
  id: string;
  userId: string;
  role: string;
  status: string;
  addedAt: Date;
  user: { username: string; avatarUrl: string | null };
}): RepoMember {
  return {
    id: member.id,
    userId: member.userId,
    username: member.user.username,
    avatarUrl: member.user.avatarUrl,
    role: member.role,
    status: member.status,
    addedAt: member.addedAt,
  };
}

// GET /api/repos/:repoId/members : active members only — the owner is
// deliberately excluded, since ownership isn't a RepositoryMember row.
export async function listMembers(repoId: string): Promise<RepoMember[]> {
  const members = await prisma.repositoryMember.findMany({
    where: { repoId, status: 'ACTIVE' },
    include: { user: { select: { username: true, avatarUrl: true } } },
    orderBy: { addedAt: 'asc' },
  });

  return members.map(toRepoMember);
}

// POST /api/repos/:repoId/members : grants access by username. Re-adding a
// previously removed member reactivates that row instead of erroring, so the
// unique(userId, repoId) constraint only ever rejects a currently-active one.
export async function addMember(
  repoId: string,
  username: string,
  role: RepoRole,
  addedById: string,
): Promise<RepoMember> {
  const targetUser = await prisma.user.findUnique({ where: { username } });
  if (!targetUser) {
    throw new AppError(404, 'NOT_FOUND', 'No platform user found with that username');
  }

  const existing = await prisma.repositoryMember.findUnique({
    where: { userId_repoId: { userId: targetUser.id, repoId } },
  });

  if (existing?.status === 'ACTIVE') {
    throw new AppError(409, 'CONFLICT', 'User is already a member of this repository');
  }

  const member = existing
    ? await prisma.repositoryMember.update({
        where: { id: existing.id },
        data: { role, status: 'ACTIVE', removedAt: null, addedById },
        include: { user: { select: { username: true, avatarUrl: true } } },
      })
    : await prisma.repositoryMember.create({
        data: { repoId, userId: targetUser.id, role, addedById },
        include: { user: { select: { username: true, avatarUrl: true } } },
      });

  return toRepoMember(member);
}

// DELETE /api/repos/:repoId/members/:userId : soft-removes the membership
// (status + removedAt) instead of deleting the row, to keep the audit trail.
export async function removeMember(repoId: string, userId: string): Promise<void> {
  const existing = await prisma.repositoryMember.findUnique({
    where: { userId_repoId: { userId, repoId } },
  });

  if (!existing || existing.status === 'REMOVED') {
    throw new AppError(404, 'NOT_FOUND', 'Membership not found');
  }

  await prisma.repositoryMember.update({
    where: { id: existing.id },
    data: { status: 'REMOVED', removedAt: new Date() },
  });
}
