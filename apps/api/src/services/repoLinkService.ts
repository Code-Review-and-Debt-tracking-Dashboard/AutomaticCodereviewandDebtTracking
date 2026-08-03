import { prisma } from '@codehealth/db';
import { Octokit } from '@octokit/rest';

import { env } from '../config/env';
import { decrypt } from '../lib/crypto';
import { logger } from '../lib/logger';
import { AppError } from '../middleware/errorHandler';

/**
 * Linking is the only way a repository enters the platform, so this is where
 * the tenant is decided. It is taken from the repo's GitHub owner rather than
 * from anything the caller sends, which means a repo always lands in the
 * organization that really owns it on GitHub.
 */

/** The fields we read off GitHub's repository resource. */
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

/**
 * Looked up by id rather than owner/name so a rename on GitHub cannot silently
 * point us at a different repository. This route is not in Octokit's typed
 * endpoint map, hence the explicit shape on the response.
 */
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

export async function linkRepository(userId: string, githubRepoId: number) {
  const octokit = await githubClientFor(userId);
  const repo = await fetchRepo(octokit, githubRepoId);

  // Registering a webhook needs admin rights on GitHub's side. This is about
  // the caller's GitHub permissions, not their role on this platform.
  if (repo.permissions?.admin !== true) {
    throw new AppError(403, 'FORBIDDEN', 'You need admin access to this repository on GitHub');
  }

  const organization = await prisma.organization.findUnique({
    where: { githubOrgId: String(repo.owner.id) },
    select: { id: true, members: { where: { userId }, select: { status: true } } },
  });

  // Not a member of the owning organization, so the repo is out of reach. This
  // is a 404 rather than a 403 for the same reason as everywhere else — one
  // tenant should not be able to probe another's boundary.
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

  // Upsert rather than create: a repo that was unlinked earlier still has its
  // row, along with all its past snapshots and findings, so relinking revives
  // that history instead of starting over.
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

  // Deliberately narrower than the route's write guard: a TEAM_LEAD may manage
  // the member list, but removing the repo altogether is for its owner or for
  // whoever runs the organization.
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
      // A repo that was deleted on GitHub, or that we lost access to, still has
      // to be removable here — so a failed hook deletion is logged, not fatal.
      logger.warn({ err, repoId }, 'Could not remove GitHub webhook while unlinking');
    }
  }

  // Soft delete, matching how the webhook path already treats an inactive repo
  // as unlinked. webhookId is unique, so it has to be cleared or a later
  // relink would collide on the stale value.
  await prisma.repository.update({
    where: { id: repoId },
    data: { isActive: false, webhookId: null },
  });
}
