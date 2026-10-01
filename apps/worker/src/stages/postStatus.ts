import { prisma } from '@codehealth/db';
import { githubClient, type Octokit } from '@codehealth/github';

import { decrypt } from '../lib/crypto';
import { logger } from '../lib/logger';
import type { GateEvaluation } from './gate';

// branch protection matches on this name, don't change it
const STATUS_CONTEXT = 'codepulse/quality-gate';

export interface StatusTarget {
  owner: string;
  repo: string;
  sha: string;
}

export async function createGateStatus(
  octokit: Octokit,
  target: StatusTarget,
  evaluation: GateEvaluation,
): Promise<void> {
  const failed = evaluation.metrics.filter((metric) => !metric.passed);
  // only go red when the repo wants PRs blocked
  const blocking = evaluation.result === 'FAIL' && evaluation.blockPR;

  await octokit.rest.repos.createCommitStatus({
    owner: target.owner,
    repo: target.repo,
    sha: target.sha,
    state: blocking ? 'failure' : 'success',
    context: STATUS_CONTEXT,
    description:
      failed.length === 0
        ? `All ${evaluation.metrics.length} checks passed`
        : `${failed.length} of ${evaluation.metrics.length} checks failed${blocking ? '' : ' (not blocking)'}`,
  });
}

// best effort, a failure here shouldn't fail the job
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
