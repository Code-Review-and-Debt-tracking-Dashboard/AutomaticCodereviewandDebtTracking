import { prisma, PRStatus } from '@codehealth/db';

import { AppError } from '../middleware/errorHandler';

// anything else (edited, labeled, ...) is a no-op
export const SUPPORTED_PR_ACTIONS = ['opened', 'synchronize', 'reopened', 'closed'] as const;
export type SupportedPrAction = (typeof SUPPORTED_PR_ACTIONS)[number];

// the part of the payload we actually read
interface GithubPullRequestPayload {
  action: string;
  number?: number;
  pull_request: {
    number: number;
    title: string;
    html_url: string;
    merged: boolean;
    user: { login: string };
    head: { ref: string; sha: string };
    base: { ref: string };
  };
  repository: {
    id: number;
    full_name: string;
    clone_url: string;
  };
}

export interface ParsedPullRequestEvent {
  action: string;
  prNumber: number;
  title: string;
  htmlUrl: string;
  merged: boolean;
  authorLogin: string;
  headBranch: string;
  baseBranch: string;
  headSha: string;
  cloneUrl: string;
  repoFullName: string;
  githubRepoId: string;
}

function isGithubPullRequestPayload(value: unknown): value is GithubPullRequestPayload {
  if (typeof value !== 'object' || value === null) return false;
  const payload = value as Record<string, unknown>;

  const pr = payload.pull_request as GithubPullRequestPayload['pull_request'] | undefined;
  const repo = payload.repository as GithubPullRequestPayload['repository'] | undefined;

  return (
    typeof payload.action === 'string' &&
    typeof pr === 'object' &&
    pr !== null &&
    typeof pr.number === 'number' &&
    typeof pr.title === 'string' &&
    typeof pr.html_url === 'string' &&
    typeof pr.merged === 'boolean' &&
    typeof pr.user?.login === 'string' &&
    typeof pr.head?.ref === 'string' &&
    typeof pr.head?.sha === 'string' &&
    typeof pr.base?.ref === 'string' &&
    typeof repo === 'object' &&
    repo !== null &&
    typeof repo.id === 'number' &&
    typeof repo.full_name === 'string' &&
    typeof repo.clone_url === 'string'
  );
}

// rawBody is the same Buffer the signature was verified against
export function parsePullRequestEvent(rawBody: Buffer): ParsedPullRequestEvent {
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    throw new AppError(400, 'VALIDATION_ERROR', 'Malformed webhook payload: invalid JSON');
  }

  if (!isGithubPullRequestPayload(payload)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Malformed webhook payload: missing pull_request fields');
  }

  return {
    action: payload.action,
    prNumber: payload.pull_request.number,
    title: payload.pull_request.title,
    htmlUrl: payload.pull_request.html_url,
    merged: payload.pull_request.merged,
    authorLogin: payload.pull_request.user.login,
    headBranch: payload.pull_request.head.ref,
    baseBranch: payload.pull_request.base.ref,
    headSha: payload.pull_request.head.sha,
    cloneUrl: payload.repository.clone_url,
    repoFullName: payload.repository.full_name,
    githubRepoId: String(payload.repository.id),
  };
}

// an unlinked (inactive) repo counts as not linked
export async function findLinkedRepository(githubRepoId: string) {
  const repository = await prisma.repository.findUnique({ where: { githubRepoId } });

  if (!repository || !repository.isActive) {
    throw new AppError(404, 'NOT_FOUND', 'Repository not linked');
  }

  return repository;
}

// synchronize fires on every push to the PR branch, so this upserts rather
// than just creating
export async function upsertPullRequest(repoId: string, event: ParsedPullRequestEvent) {
  const status =
    event.action !== 'closed' ? PRStatus.OPEN : event.merged ? PRStatus.MERGED : PRStatus.CLOSED;

  const fields = {
    title: event.title,
    authorLogin: event.authorLogin,
    htmlUrl: event.htmlUrl,
    headBranch: event.headBranch,
    baseBranch: event.baseBranch,
    headSha: event.headSha,
    status,
  };

  return prisma.pullRequest.upsert({
    where: { repoId_prNumber: { repoId, prNumber: event.prNumber } },
    create: { repoId, prNumber: event.prNumber, ...fields },
    update: fields,
  });
}
