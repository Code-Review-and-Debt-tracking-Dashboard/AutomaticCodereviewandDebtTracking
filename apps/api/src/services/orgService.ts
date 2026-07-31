import { prisma } from '@codehealth/db';
import { Octokit } from '@octokit/rest';

import { decrypt } from '../lib/crypto';
import { AppError } from '../middleware/errorHandler';

/**
 * An organization is the tenant boundary, and it mirrors a GitHub account
 * owner. Membership is only ever derived from GitHub — nothing in this app
 * grants it — so we can never hand out access GitHub itself would not.
 */

export interface GithubAccount {
  githubId: string;
  login: string;
  name?: string | null;
  avatarUrl?: string | null;
}

export interface OrgSummary {
  id: string;
  githubOrgId: string;
  login: string;
  name: string | null;
  avatarUrl: string | null;
  type: string;
  role: string;
}

/** GitHub reports `admin`, `member` or `billing_manager`; only admin maps up. */
function toOrgRole(githubRole: string): 'ADMIN' | 'MEMBER' {
  return githubRole === 'admin' ? 'ADMIN' : 'MEMBER';
}

/**
 * Rebuilds the caller's tenant memberships from GitHub. The user's own account
 * is always one of them, so personal repositories still land in a tenant.
 * Memberships GitHub no longer reports are marked REMOVED — that is what makes
 * being removed from a GitHub org actually revoke access here.
 */
export async function syncUserOrganizations(
  userId: string,
  account: GithubAccount,
  accessToken: string,
): Promise<OrgSummary[]> {
  const octokit = new Octokit({ auth: accessToken });

  let memberships: Awaited<
    ReturnType<typeof octokit.rest.orgs.listMembershipsForAuthenticatedUser>
  >['data'];
  try {
    memberships = await octokit.paginate(octokit.rest.orgs.listMembershipsForAuthenticatedUser, {
      state: 'active',
      per_page: 100,
    });
  } catch {
    throw new AppError(502, 'GITHUB_UNAVAILABLE', 'Could not fetch your GitHub organizations');
  }

  const wanted = [
    {
      githubOrgId: account.githubId,
      login: account.login,
      name: account.name ?? account.login,
      avatarUrl: account.avatarUrl ?? null,
      type: 'USER' as const,
      role: 'OWNER' as const,
    },
    ...memberships.map((m) => ({
      githubOrgId: String(m.organization.id),
      login: m.organization.login,
      name: m.organization.description ?? m.organization.login,
      avatarUrl: m.organization.avatar_url ?? null,
      type: 'ORGANIZATION' as const,
      role: toOrgRole(m.role),
    })),
  ];

  return prisma.$transaction(async (tx) => {
    const summaries: OrgSummary[] = [];

    for (const org of wanted) {
      const saved = await tx.organization.upsert({
        where: { githubOrgId: org.githubOrgId },
        update: { login: org.login, name: org.name, avatarUrl: org.avatarUrl, type: org.type },
        create: {
          githubOrgId: org.githubOrgId,
          login: org.login,
          name: org.name,
          avatarUrl: org.avatarUrl,
          type: org.type,
        },
      });

      await tx.organizationMember.upsert({
        where: { orgId_userId: { orgId: saved.id, userId } },
        update: { role: org.role, status: 'ACTIVE', syncedAt: new Date() },
        create: { orgId: saved.id, userId, role: org.role, status: 'ACTIVE' },
      });

      summaries.push({
        id: saved.id,
        githubOrgId: saved.githubOrgId,
        login: saved.login,
        name: saved.name,
        avatarUrl: saved.avatarUrl,
        type: saved.type,
        role: org.role,
      });
    }

    // Anything GitHub stopped reporting is revoked here too.
    await tx.organizationMember.updateMany({
      where: {
        userId,
        status: 'ACTIVE',
        orgId: { notIn: summaries.map((s) => s.id) },
      },
      data: { status: 'REMOVED' },
    });

    return summaries;
  });
}

/** Re-runs the sync for a signed-in caller using their stored GitHub token. */
export async function resyncOrganizations(userId: string): Promise<OrgSummary[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { githubCredential: true },
  });

  if (!user?.githubCredential) {
    throw new AppError(401, 'UNAUTHORIZED', 'No GitHub credential on file; sign in again');
  }

  return syncUserOrganizations(
    userId,
    {
      githubId: user.githubId,
      login: user.username,
      name: user.username,
      avatarUrl: user.avatarUrl,
    },
    decrypt(user.githubCredential.encryptedAccessToken),
  );
}

/** Tenants the caller currently belongs to. */
export async function listUserOrganizations(userId: string): Promise<OrgSummary[]> {
  const memberships = await prisma.organizationMember.findMany({
    where: { userId, status: 'ACTIVE' },
    include: { organization: true },
    orderBy: { organization: { login: 'asc' } },
  });

  return memberships.map((m) => ({
    id: m.organization.id,
    githubOrgId: m.organization.githubOrgId,
    login: m.organization.login,
    name: m.organization.name,
    avatarUrl: m.organization.avatarUrl,
    type: m.organization.type,
    role: m.role,
  }));
}

export interface OrgMember {
  userId: string;
  username: string;
  avatarUrl: string | null;
  role: string;
  status: string;
  syncedAt: Date;
}

export async function listOrgMembers(orgId: string): Promise<OrgMember[]> {
  const members = await prisma.organizationMember.findMany({
    where: { orgId, status: 'ACTIVE' },
    include: { user: { select: { username: true, avatarUrl: true } } },
    orderBy: { user: { username: 'asc' } },
  });

  return members.map((m) => ({
    userId: m.userId,
    username: m.user.username,
    avatarUrl: m.user.avatarUrl,
    role: m.role,
    status: m.status,
    syncedAt: m.syncedAt,
  }));
}

/**
 * Repositories in this tenant that the caller can actually open. Belonging to
 * the org is not by itself enough — a repo still needs ownership or an active
 * repository membership.
 */
export async function listOrgRepositories(orgId: string, userId: string) {
  const repositories = await prisma.repository.findMany({
    where: {
      orgId,
      isActive: true,
      OR: [{ ownerId: userId }, { members: { some: { userId, status: 'ACTIVE' } } }],
    },
    select: {
      id: true,
      name: true,
      fullName: true,
      language: true,
      defaultBranch: true,
      isActive: true,
      orgId: true,
    },
    orderBy: { name: 'asc' },
  });

  return repositories;
}
