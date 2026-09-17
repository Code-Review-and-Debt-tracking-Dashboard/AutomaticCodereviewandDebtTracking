import { prisma } from '@codehealth/db';
import { linkRepo, type LinkOutcome } from '@codehealth/github';
import { Octokit } from '@octokit/rest';

import { env } from '../config/env';
import { decrypt } from '../lib/crypto';
import { logger } from '../lib/logger';
import { AppError } from '../middleware/errorHandler';

export async function githubClientFor(userId: string): Promise<Octokit> {
  const credential = await prisma.gitHubCredential.findUnique({ where: { userId } });

  if (!credential) {
    throw new AppError(401, 'UNAUTHORIZED', 'No GitHub credential on file; sign in again');
  }

  return new Octokit({ auth: decrypt(credential.encryptedAccessToken) });
}

// Repos the picker can offer: admin on GitHub (needed to register the hook)
// and owned by an org the caller belongs to here. Already-linked ones are
// flagged rather than dropped, so the picker can show them as linked.
export async function listAvailableRepos(userId: string, orgId?: string) {
  const octokit = await githubClientFor(userId);

  const memberships = await prisma.organizationMember.findMany({
    where: { userId, status: 'ACTIVE', ...(orgId ? { orgId } : {}) },
    select: { organization: { select: { githubOrgId: true } } },
  });
  const ownerIds = new Set(memberships.map((m) => m.organization.githubOrgId));

  let repos;
  try {
    repos = await octokit.paginate(octokit.rest.repos.listForAuthenticatedUser, {
      per_page: 100,
      affiliation: 'owner,organization_member',
    });
  } catch {
    throw new AppError(502, 'GITHUB_UNAVAILABLE', 'Could not list your GitHub repositories');
  }

  const linked = await prisma.repository.findMany({
    where: { isActive: true },
    select: { githubRepoId: true },
  });
  const linkedIds = new Set(linked.map((r) => r.githubRepoId));

  return repos
    .filter((repo) => repo.permissions?.admin === true && ownerIds.has(String(repo.owner.id)))
    .map((repo) => ({
      githubRepoId: String(repo.id),
      name: repo.name,
      fullName: repo.full_name,
      htmlUrl: repo.html_url,
      cloneUrl: repo.clone_url ?? `${repo.html_url}.git`,
      defaultBranch: repo.default_branch ?? 'main',
      language: repo.language ?? null,
      private: repo.private,
      isAlreadyLinked: linkedIds.has(String(repo.id)),
    }));
}

// The link itself is shared with the bulk job, which needs to carry on past a
// repo it can't link. Here each way it can fail is just a status code.
export function assertLinked(outcome: LinkOutcome) {
  switch (outcome.status) {
    case 'LINKED':
      return outcome.repository;
    case 'ALREADY_LINKED':
      throw new AppError(409, 'CONFLICT', 'Repository is already linked');
    case 'NO_ADMIN':
      throw new AppError(403, 'FORBIDDEN', 'You need admin access to this repository on GitHub');
    case 'NOT_IN_ORG':
      throw new AppError(
        404,
        'NOT_FOUND',
        'This repository belongs to an organization you are not a member of; sync your organizations if you have just joined it',
      );
    case 'NOT_FOUND':
      throw new AppError(404, 'NOT_FOUND', 'Repository not found on GitHub');
    case 'GITHUB_ERROR':
      throw new AppError(502, 'GITHUB_UNAVAILABLE', outcome.message);
  }
}

export async function linkRepository(userId: string, githubRepoId: number) {
  const octokit = await githubClientFor(userId);

  const outcome = await linkRepo(
    octokit,
    userId,
    githubRepoId,
    { webhookUrl: env.githubWebhookUrl, webhookSecret: env.githubWebhookSecret },
    logger,
  );

  return assertLinked(outcome);
}

export async function unlinkRepository(
  repoId: string,
  userId: string,
  orgRole: string,
): Promise<void> {
  const repository = await prisma.repository.findUnique({ where: { id: repoId } });

  if (!repository || !repository.isActive) {
    throw new AppError(404, 'NOT_FOUND', 'Repository not found');
  }

  // narrower than the route's write guard — a TEAM_LEAD can't unlink
  const isOrgManager = orgRole === 'OWNER' || orgRole === 'ADMIN';
  if (repository.ownerId !== userId && !isOrgManager) {
    throw new AppError(
      403,
      'FORBIDDEN',
      'Only the repository owner or an organization admin can unlink it',
    );
  }

  if (repository.webhookId) {
    try {
      const octokit = await githubClientFor(userId);
      await octokit.rest.repos.deleteWebhook({
        owner: repository.fullName.split('/')[0],
        repo: repository.name,
        hook_id: Number(repository.webhookId),
      });
    } catch (err) {
      if ((err as { status?: number }).status !== 404) {
        // Not a "gone already" — the hook is likely still live on GitHub.
        // Unlinking still has to work, but don't discard the only pointer
        // to a hook we couldn't confirm was removed.
        logger.error(
          { err, repoId },
          'Could not remove GitHub webhook while unlinking; leaving webhookId set for cleanup',
        );
        await prisma.repository.update({ where: { id: repoId }, data: { isActive: false } });
        return;
      }
      // 404: hook (or repo) already gone on GitHub — safe to clear below.
      logger.warn({ err, repoId }, 'GitHub webhook already gone while unlinking');
    }
  }

  // soft delete. webhookId is unique, so clear it or a relink collides.
  await prisma.repository.update({
    where: { id: repoId },
    data: { isActive: false, webhookId: null },
  });
}
