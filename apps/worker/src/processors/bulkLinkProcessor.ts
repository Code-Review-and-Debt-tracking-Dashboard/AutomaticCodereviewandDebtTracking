import { AnalysisTrigger, prisma } from '@codehealth/db';
import { githubClient, linkRepo, type Octokit } from '@codehealth/github';
import {
  ANALYSIS_QUEUE_NAME,
  type AnalysisJobData,
  type BulkLinkJobData,
  type BulkLinkJobResult,
  type BulkLinkRepoResult,
  type BulkLinkStatus,
} from '@codehealth/shared';
import { Queue, type Job } from 'bullmq';

import { env } from '../config/env';
import { decrypt } from '../lib/crypto';
import { logger } from '../lib/logger';
import { redis } from '../lib/redis';

const analysisQueue = new Queue<AnalysisJobData>(ANALYSIS_QUEUE_NAME, {
  connection: redis,
  skipWaitingForReady: true,
});

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

// Every status is always present, so the UI can read a zero without checking
// whether the key exists.
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

// Returns the failure instead of null so the batch can say which of the two it
// hit — signing in again only fixes one of them.
async function octokitFor(userId: string): Promise<{ octokit: Octokit } | { error: CredentialFailure }> {
  const credential = await prisma.gitHubCredential.findUnique({ where: { userId } });
  if (!credential) return { error: 'NO_CREDENTIAL' };

  // Caught here so the batch still reports a status per repo instead of dying
  // on the crypto error. Almost always a TOKEN_ENCRYPTION_KEY mismatch with
  // the API, which is what wrote the token.
  try {
    return { octokit: githubClient(decrypt(credential.encryptedAccessToken)) };
  } catch (err) {
    logger.error({ err, userId }, 'Could not decrypt the stored GitHub token');
    return { error: 'CREDENTIAL_DECRYPT_FAILED' };
  }
}

// Same status for every repo — the batch never got as far as looking at them.
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

  const credential = await octokitFor(userId);

  // No usable token means every repo would fail the same way, so don't make N
  // calls to find that out.
  if ('error' in credential) {
    const out = credentialFailureResults(githubRepoIds, credential.error);
    await job.updateProgress({ done: total, total });
    return { results: out, summary: summarize(out) };
  }
  const octokit = credential.octokit;

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

    if (outcome.status === 'LINKED') {
      try {
        const repo = await prisma.repository.findUnique({
          where: { id: outcome.repository.id },
          select: { id: true, defaultBranch: true, cloneUrl: true, htmlUrl: true },
        });

        if (repo) {
          const analysis = await prisma.analysisJob.create({
            data: {
              repoId: repo.id,
              branch: repo.defaultBranch ?? 'main',
              commitSha: 'HEAD',
              trigger: AnalysisTrigger.MANUAL,
            },
          });

          const analysisJob = await analysisQueue.add('analyze', {
            analysisId: analysis.id,
            repoId: repo.id,
            prNumber: null,
            branch: repo.defaultBranch ?? 'main',
            commitSha: 'HEAD',
            cloneUrl: repo.cloneUrl ?? `${repo.htmlUrl}.git`,
          });

          await prisma.analysisJob.update({
            where: { id: analysis.id },
            data: { bullJobId: analysisJob.id },
          });

          logger.info(
            { repoId: repo.id, analysisId: analysis.id, jobId: analysisJob.id },
            'Initial analysis queued for linked repository',
          );
        }
      } catch (err) {
        logger.error(
          { err, repoId: outcome.repository.id },
          'Could not queue initial analysis for linked repository',
        );
      }
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
