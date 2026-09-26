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
import { queueFirstAnalysis } from '../lib/apiClient';
import { decrypt } from '../lib/crypto';
import { logger } from '../lib/logger';

const EMPTY_SUMMARY: Record<BulkLinkStatus, number> = {
  LINKED: 0,
  ALREADY_LINKED: 0,
  NO_ADMIN: 0,
  NOT_IN_ORG: 0,
  NOT_FOUND: 0,
  NO_CREDENTIAL: 0,
  CREDENTIAL_DECRYPT_FAILED: 0,
  GITHUB_ERROR: 0,
};

// every status key is always there, even if 0
export function summarize(results: BulkLinkRepoResult[]): Record<BulkLinkStatus, number> {
  return results.reduce(
    (acc, result) => ({ ...acc, [result.status]: acc[result.status] + 1 }),
    { ...EMPTY_SUMMARY },
  );
}

type CredentialFailure = 'NO_CREDENTIAL' | 'CREDENTIAL_DECRYPT_FAILED';

const CREDENTIAL_FAILURE_MESSAGE: Record<CredentialFailure, string> = {
  NO_CREDENTIAL: 'No GitHub credential on file; sign in again',
  CREDENTIAL_DECRYPT_FAILED:
    'Stored GitHub token could not be read on the server; signing in again will not help',
};

async function octokitFor(userId: string): Promise<{ octokit: Octokit } | { error: CredentialFailure }> {
  const credential = await prisma.gitHubCredential.findUnique({ where: { userId } });
  if (!credential) return { error: 'NO_CREDENTIAL' };

  // usually a TOKEN_ENCRYPTION_KEY mismatch with the API
  try {
    return { octokit: githubClient(decrypt(credential.encryptedAccessToken)) };
  } catch (err) {
    logger.error({ err, userId }, 'Could not decrypt the stored GitHub token');
    return { error: 'CREDENTIAL_DECRYPT_FAILED' };
  }
}

export function credentialFailureResults(
  githubRepoIds: number[],
  reason: CredentialFailure,
): BulkLinkRepoResult[] {
  return githubRepoIds.map((githubRepoId) => ({
    githubRepoId,
    status: reason,
    message: CREDENTIAL_FAILURE_MESSAGE[reason],
  }));
}

export async function bulkLinkProcessor(job: Job<BulkLinkJobData>): Promise<BulkLinkJobResult> {
  const { userId, orgId, githubRepoIds } = job.data;
  const total = githubRepoIds.length;
  const results: BulkLinkRepoResult[] = [];

  logger.info({ jobId: job.id, orgId, total }, 'Bulk link started');

  const credential = await octokitFor(userId);

  // no token means they'd all fail anyway
  if ('error' in credential) {
    const out = credentialFailureResults(githubRepoIds, credential.error);
    await job.updateProgress({ done: total, total });
    return { results: out, summary: summarize(out) };
  }
  const octokit = credential.octokit;

  // one by one, github rate-limits parallel writes
  for (const githubRepoId of githubRepoIds) {
    const outcome = await linkRepo(
      octokit,
      userId,
      githubRepoId,
      { webhookUrl: env.githubWebhookUrl, webhookSecret: env.githubWebhookSecret, orgId },
      logger,
    );

    // the link already worked, so a failure here is only logged
    if (outcome.status === 'LINKED') {
      await queueFirstAnalysis(outcome.repository.id).catch((err) =>
        logger.warn({ err, repoId: outcome.repository.id }, 'Could not queue first analysis'),
      );
    }

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
