import { prisma } from '@codehealth/db';

import { AppError } from '../middleware/errorHandler';

// api_design.md §3: only these `pull_request` actions are subscribed to;
// anything else (e.g. "edited", "labeled") is a no-op for this pipeline.
export const SUPPORTED_PR_ACTIONS = ['opened', 'synchronize', 'reopened', 'closed'] as const;
export type SupportedPrAction = (typeof SUPPORTED_PR_ACTIONS)[number];

/** The subset of GitHub's `pull_request` webhook payload we read (api_design.md §3). */
interface GithubPullRequestPayload {
  action: string;
  number?: number;
  pull_request: {
    number: number;
    title: string;
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

/** Extracted PR data, matching the shape in api_design.md §3. */
export interface ParsedPullRequestEvent {
  action: string;
  prNumber: number;
  title: string;
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

/**
 * Parses a raw `pull_request` webhook body (A-08, api_design.md §3) into the
 * documented extract shape. `rawBody` is the `Buffer` produced by
 * `express.raw()` in `webhooks.ts` — the same bytes the signature was
 * verified against.
 */
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
    authorLogin: payload.pull_request.user.login,
    headBranch: payload.pull_request.head.ref,
    baseBranch: payload.pull_request.base.ref,
    headSha: payload.pull_request.head.sha,
    cloneUrl: payload.repository.clone_url,
    repoFullName: payload.repository.full_name,
    githubRepoId: String(payload.repository.id),
  };
}

/**
 * Validates that the repository targeted by a webhook event is linked
 * (api_design.md §3: `404` "repo not linked"). A repo that was unlinked
 * (soft-deleted via `isActive: false`) counts as not linked.
 */
export async function findLinkedRepository(githubRepoId: string) {
  const repository = await prisma.repository.findUnique({ where: { githubRepoId } });

  if (!repository || !repository.isActive) {
    throw new AppError(404, 'NOT_FOUND', 'Repository not linked');
  }

  return repository;
}
