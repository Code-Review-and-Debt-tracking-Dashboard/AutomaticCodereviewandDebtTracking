import { prisma } from '@codehealth/db';
import { Octokit } from '@octokit/rest';

export type { Octokit };

// Callers hold their own encrypted tokens, so they build the client and pass
// it in — one client per batch rather than one per repo.
export function githubClient(token: string): Octokit {
  return new Octokit({ auth: token });
}

// The org a repo lands in comes from its GitHub owner, never from the request.
export interface GithubRepo {
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

export interface LinkedRepository {
  id: string;
  name: string;
  fullName: string;
  language: string | null;
  isActive: boolean;
  orgId: string;
  webhookId: string | null;
}

// Every way linking one repo can end. Callers decide what each means: the API
// maps them to status codes, the bulk job counts them.
export type LinkOutcome =
  | { status: 'LINKED'; repository: LinkedRepository }
  | { status: 'ALREADY_LINKED'; fullName: string }
  | { status: 'NO_ADMIN'; fullName: string }
  | { status: 'NOT_IN_ORG'; fullName: string }
  | { status: 'NOT_FOUND' }
  | { status: 'GITHUB_ERROR'; message: string; fullName?: string };

export interface LinkConfig {
  webhookUrl: string;
  webhookSecret: string;
  // When set, the repo must belong to this org or it's NOT_IN_ORG.
  orgId?: string;
}

// Only the bit of pino we use, so this package doesn't depend on a logger.
export interface WarnLogger {
  warn(obj: unknown, msg: string): void;
}

// By id, not owner/name, so a rename on GitHub can't point us elsewhere.
// Octokit has no typed method for this route, hence the cast.
export async function fetchRepo(
  octokit: Octokit,
  githubRepoId: number,
): Promise<GithubRepo | { error: 'NOT_FOUND' | 'GITHUB_ERROR' }> {
  try {
    const response = await octokit.request('GET /repositories/{repository_id}', {
      repository_id: githubRepoId,
    });
    return response.data as GithubRepo;
  } catch (err) {
    if ((err as { status?: number }).status === 404) {
      return { error: 'NOT_FOUND' };
    }
    return { error: 'GITHUB_ERROR' };
  }
}

// GitHub 422s when a hook with the same config is already there. That repo is
// healthy, not broken, so find the existing hook and carry on with its id.
async function findExistingHook(
  octokit: Octokit,
  repo: GithubRepo,
  webhookUrl: string,
): Promise<string | null> {
  try {
    const hooks = await octokit.rest.repos.listWebhooks({
      owner: repo.owner.login,
      repo: repo.name,
    });
    const match = hooks.data.find((hook) => hook.config?.url === webhookUrl);
    return match ? String(match.id) : null;
  } catch {
    return null;
  }
}

/**
 * Registers the webhook and upserts the Repository row for one repo. Returns
 * how it went instead of throwing, because the bulk path needs to keep going
 * after a repo the user has no admin on.
 */
export async function linkRepo(
  octokit: Octokit,
  userId: string,
  githubRepoId: number,
  cfg: LinkConfig,
  logger?: WarnLogger,
): Promise<LinkOutcome> {
  const fetched = await fetchRepo(octokit, githubRepoId);

  if ('error' in fetched) {
    return fetched.error === 'NOT_FOUND'
      ? { status: 'NOT_FOUND' }
      : { status: 'GITHUB_ERROR', message: 'Could not read the repository from GitHub' };
  }

  const repo = fetched;

  // creating a webhook needs admin on GitHub's side
  if (repo.permissions?.admin !== true) {
    return { status: 'NO_ADMIN', fullName: repo.full_name };
  }

  const organization = await prisma.organization.findUnique({
    where: { githubOrgId: String(repo.owner.id) },
    select: { id: true, members: { where: { userId }, select: { status: true } } },
  });

  // caller isn't in the repo's org, or it isn't the org they asked for
  if (
    !organization ||
    organization.members[0]?.status !== 'ACTIVE' ||
    (cfg.orgId !== undefined && organization.id !== cfg.orgId)
  ) {
    return { status: 'NOT_IN_ORG', fullName: repo.full_name };
  }

  const existing = await prisma.repository.findUnique({
    where: { githubRepoId: String(repo.id) },
    select: { isActive: true, webhookId: true },
  });

  if (existing?.isActive) {
    return { status: 'ALREADY_LINKED', fullName: repo.full_name };
  }

  if (existing?.webhookId) {
    // A previous unlink may have failed to remove this hook — best effort
    // cleanup so relinking doesn't leave two live webhooks on GitHub. Failure
    // here just leaves us where we already were, so it isn't fatal to linking.
    try {
      await octokit.rest.repos.deleteWebhook({
        owner: repo.owner.login,
        repo: repo.name,
        hook_id: Number(existing.webhookId),
      });
    } catch (err) {
      logger?.warn({ err, githubRepoId: repo.id }, 'Could not clean up stale webhook before relinking');
    }
  }

  let webhookId: string;
  try {
    const hook = await octokit.rest.repos.createWebhook({
      owner: repo.owner.login,
      repo: repo.name,
      config: {
        url: cfg.webhookUrl,
        content_type: 'json',
        secret: cfg.webhookSecret,
      },
      events: ['pull_request', 'push'],
      active: true,
    });
    webhookId = String(hook.data.id);
  } catch (err) {
    const existingHookId =
      (err as { status?: number }).status === 422
        ? await findExistingHook(octokit, repo, cfg.webhookUrl)
        : null;

    if (!existingHookId) {
      return {
        status: 'GITHUB_ERROR',
        message: 'Could not register the webhook on GitHub',
        fullName: repo.full_name,
      };
    }
    webhookId = existingHookId;
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
    status: 'LINKED',
    repository: {
      id: repository.id,
      name: repository.name,
      fullName: repository.fullName,
      language: repository.language,
      isActive: repository.isActive,
      orgId: repository.orgId,
      webhookId: repository.webhookId,
    },
  };
}
