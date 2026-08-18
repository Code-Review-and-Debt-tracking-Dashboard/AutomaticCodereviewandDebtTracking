import { prisma } from '@codehealth/db';
import { Octokit } from '@octokit/rest';

import { env } from '../config/env';
import { decrypt } from '../lib/crypto';
import { logger } from '../lib/logger';
import { AppError } from '../middleware/errorHandler';

// The org a repo lands in comes from its GitHub owner, never from the request.
interface GithubRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  clone_url: string;
  default_branch: string;
  language: string | null;
  private: boolean;
  owner: { id: number; login: string };
  permissions?: { admin?: boolean };
}

async function githubClientFor(userId: string): Promise<Octokit> {
  const credential = await prisma.gitHubCredential.findUnique({ where: { userId } });

  if (!credential) {
    throw new AppError(401, 'UNAUTHORIZED', 'No GitHub credential on file; sign in again');
  }

  return new Octokit({ auth: decrypt(credential.encryptedAccessToken) });
}

// By id, not owner/name, so a rename on GitHub can't point us elsewhere.
// Octokit has no typed method for this route, hence the cast.
async function fetchRepo(octokit: Octokit, githubRepoId: number): Promise<GithubRepo> {
  try {
    const response = await octokit.request('GET /repositories/{repository_id}', {
      repository_id: githubRepoId,
    });
    return response.data as GithubRepo;
  } catch (err) {
    if ((err as { status?: number }).status === 404) {
      throw new AppError(404, 'NOT_FOUND', 'Repository not found on GitHub');
    }
    throw new AppError(502, 'GITHUB_UNAVAILABLE', 'Could not read the repository from GitHub');
  }
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

export async function linkRepository(userId: string, githubRepoId: number) {
  const octokit = await githubClientFor(userId);
  const repo = await fetchRepo(octokit, githubRepoId);

  // creating a webhook needs admin on GitHub's side
  if (repo.permissions?.admin !== true) {
    throw new AppError(403, 'FORBIDDEN', 'You need admin access to this repository on GitHub');
  }

  const organization = await prisma.organization.findUnique({
    where: { githubOrgId: String(repo.owner.id) },
    select: { id: true, members: { where: { userId }, select: { status: true } } },
  });

  // 404 not 403, so you can't probe another org's repos
  if (!organization || organization.members[0]?.status !== 'ACTIVE') {
    throw new AppError(
      404,
      'NOT_FOUND',
      'This repository belongs to an organization you are not a member of; sync your organizations if you have just joined it',
    );
  }

  const existing = await prisma.repository.findUnique({
    where: { githubRepoId: String(repo.id) },
    select: { isActive: true },
  });

  if (existing?.isActive) {
    throw new AppError(409, 'CONFLICT', 'Repository is already linked');
  }

  let webhookId: string;
  try {
    const hook = await octokit.rest.repos.createWebhook({
      owner: repo.owner.login,
      repo: repo.name,
      config: {
        url: env.githubWebhookUrl,
        content_type: 'json',
        secret: env.githubWebhookSecret,
      },
      events: ['pull_request'],
      active: true,
    });
    webhookId = String(hook.data.id);
  } catch {
    throw new AppError(502, 'GITHUB_UNAVAILABLE', 'Could not register the webhook on GitHub');
  }

  // upsert, so relinking an old repo keeps its snapshots and findings
  const fields = {
    name: repo.name,
    fullName: repo.full_name,
    htmlUrl: repo.html_url,
    cloneUrl: repo.clone_url,
    defaultBranch: repo.default_branch,
    language: repo.language,
    private: repo.private,
    webhookId,
    isActive: true,
    orgId: organization.id,
    ownerId: userId,
  };

  const repository = await prisma.repository.upsert({
    where: { githubRepoId: String(repo.id) },
    update: fields,
    create: { githubRepoId: String(repo.id), ...fields },
  });

  return {
    id: repository.id,
    name: repository.name,
    fullName: repository.fullName,
    language: repository.language,
    isActive: repository.isActive,
    orgId: repository.orgId,
    webhookId: repository.webhookId,
  };
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
      // repo may be gone on GitHub already — unlinking still has to work
      logger.warn({ err, repoId }, 'Could not remove GitHub webhook while unlinking');
    }
  }

  // soft delete. webhookId is unique, so clear it or a relink collides.
  await prisma.repository.update({
    where: { id: repoId },
    data: { isActive: false, webhookId: null },
  });
}
