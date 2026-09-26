import { prisma } from '@codehealth/db';
import { githubClient, type Octokit } from '@codehealth/github';

import { decrypt } from '../lib/crypto';
import { logger } from '../lib/logger';
import type { GateEvaluation } from './gate';

// The check name GitHub shows on the commit. Branch protection matches on this
// string, so changing it silently un-requires the check on every repo.
const STATUS_CONTEXT = 'codepulse/quality-gate';

export interface StatusTarget {
  owner: string;
  repo: string;
  sha: string;
}

/**
 * Puts the gate verdict on the commit as a pass/fail status.
 *
 * The status goes up whether or not the repo blocks PRs — blocking is decided
 * on GitHub's side by whether an admin marks this context required, not here.
 *
 * The client is passed in so this can be tested without going near the network.
 */
export async function createGateStatus(
  octokit: Octokit,
  target: StatusTarget,
  evaluation: GateEvaluation,
): Promise<void> {
  const failed = evaluation.metrics.filter((metric) => !metric.passed);

  await octokit.rest.repos.createCommitStatus({
    owner: target.owner,
    repo: target.repo,
    sha: target.sha,
    state: evaluation.result === 'PASS' ? 'success' : 'failure',
    context: STATUS_CONTEXT,
    // Counted off the same array the verdict came from, so the two can't disagree.
    description:
      failed.length === 0
        ? `All ${evaluation.metrics.length} checks passed`
        : `${failed.length} of ${evaluation.metrics.length} checks failed`,
  });
}

/**
 * Best effort on purpose, same as the PR comment. The snapshot is already
 * stored by the time this runs, so a revoked token costs the status, not the
 * analysis — it logs and returns instead of throwing the job back to the queue.
 *
 * Unlike the comment, this needs no pull request: a status hangs off the commit
 * itself, so push and manual runs get one too.
 */
export async function postCommitStatus(input: {
  analysisId: string;
  commitSha: string;
  evaluation: GateEvaluation;
}): Promise<void> {
  const { analysisId, commitSha, evaluation } = input;

  const job = await prisma.analysisJob.findUnique({
    where: { id: analysisId },
    select: {
      repository: {
        select: {
          fullName: true,
          owner: { select: { githubCredential: { select: { encryptedAccessToken: true } } } },
        },
      },
    },
  });

  if (!job) return;

  const encrypted = job.repository.owner.githubCredential?.encryptedAccessToken;
  if (!encrypted) {
    logger.warn({ analysisId }, 'No stored GitHub token for repo owner, skipping commit status');
    return;
  }

  const [owner, repo] = job.repository.fullName.split('/');

  try {
    await createGateStatus(
      githubClient(decrypt(encrypted)),
      { owner, repo, sha: commitSha },
      evaluation,
    );

    logger.info(
      { analysisId, sha: commitSha, gateResult: evaluation.result },
      'Commit status posted',
    );
  } catch (err) {
    logger.error({ analysisId, sha: commitSha, err }, 'Could not post commit status');
  }
}
