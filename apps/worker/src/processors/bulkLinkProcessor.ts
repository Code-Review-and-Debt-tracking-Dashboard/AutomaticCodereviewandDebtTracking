import { prisma } from '@codehealth/db';
import { githubClient, linkRepo, type Octokit } from '@codehealth/github';
import type {
  BulkLinkJobData,
  BulkLinkJobResult,
  BulkLinkRepoResult,
  BulkLinkStatus,
} from '@codehealth/shared';
import type { Job } from 'bullmq';

import { env } from '../config/env';
import { decrypt } from '../lib/crypto';
import { logger } from '../lib/logger';

const EMPTY_SUMMARY: Record<BulkLinkStatus, number> = {
  LINKED: 0,
  ALREADY_LINKED: 0,
  NO_ADMIN: 0,
  NOT_IN_ORG: 0,
  NOT_FOUND: 0,
  NO_CREDENTIAL: 0,
  GITHUB_ERROR: 0,
};

// Every status is always present, so the UI can read a zero without checking
// whether the key exists.
export function summarize(results: BulkLinkRepoResult[]): Record<BulkLinkStatus, number> {
  return results.reduce(
    (acc, result) => ({ ...acc, [result.status]: acc[result.status] + 1 }),
    { ...EMPTY_SUMMARY },
  );
}

async function octokitFor(userId: string): Promise<Octokit | null> {
  const credential = await prisma.gitHubCredential.findUnique({ where: { userId } });
  if (!credential) return null;

  // A token we can't decrypt is as good as no token. Caught here so the batch
  // still reports a status per repo instead of dying on the crypto error.
  try {
    return githubClient(decrypt(credential.encryptedAccessToken));
  } catch (err) {
    logger.error({ err, userId }, 'Could not decrypt the stored GitHub token');
    return null;
  }
}

/**
 * Links every repo in the batch, one at a time, and records how each went.
 * Repos the user has no admin on are the normal case, not an error — the job
 * only fails if it can't get started at all.
 */
export async function bulkLinkProcessor(job: Job<BulkLinkJobData>): Promise<BulkLinkJobResult> {
  const { userId, orgId, githubRepoIds } = job.data;
  const total = githubRepoIds.length;
  const results: BulkLinkRepoResult[] = [];

  logger.info({ jobId: job.id, orgId, total }, 'Bulk link started');

  const octokit = await octokitFor(userId);

  // No token means every repo would fail the same way, so don't make N calls
  // to find that out.
  if (!octokit) {
    const out = githubRepoIds.map((githubRepoId) => ({
      githubRepoId,
      status: 'NO_CREDENTIAL' as const,
      message: 'No GitHub credential on file; sign in again',
    }));
    await job.updateProgress({ done: total, total });
    return { results: out, summary: summarize(out) };
  }

  // Sequential on purpose. GitHub rate-limits parallel writes, and a batch
  // that trips that limit fails repos that were otherwise fine.
  for (const githubRepoId of githubRepoIds) {
    const outcome = await linkRepo(
      octokit,
      userId,
      githubRepoId,
      { webhookUrl: env.githubWebhookUrl, webhookSecret: env.githubWebhookSecret, orgId },
      logger,
    );

    results.push({
      githubRepoId,
      status: outcome.status,
      fullName:
        outcome.status === 'LINKED'
          ? outcome.repository.fullName
          : 'fullName' in outcome
            ? outcome.fullName
            : undefined,
      message: outcome.status === 'GITHUB_ERROR' ? outcome.message : undefined,
    });

    await job.updateProgress({ done: results.length, total });
  }

  const summary = summarize(results);
  logger.info({ jobId: job.id, orgId, summary }, 'Bulk link finished');

  return { results, summary };
}
