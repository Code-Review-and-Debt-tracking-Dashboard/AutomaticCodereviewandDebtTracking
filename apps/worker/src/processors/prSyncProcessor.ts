import { prisma, PRStatus } from '@codehealth/db';

import { logger } from '../lib/logger';
import { octokitFor } from './bulkLinkProcessor';

export const PR_SYNC_QUEUE_NAME = 'pr-sync-queue';
export const PR_SYNC_EVERY_MS = 60 * 60 * 1000;

// the bits of GET /pulls/:n we read
export interface GithubPullState {
  state: string;
  merged_at: string | null;
  closed_at: string | null;
}

// null = still open on github, leave the row alone
export function closedUpdate(pull: GithubPullState) {
  if (pull.state !== 'closed') return null;
  return {
    status: pull.merged_at ? PRStatus.MERGED : PRStatus.CLOSED,
    mergedAt: pull.merged_at ? new Date(pull.merged_at) : null,
    closedAt: pull.closed_at ? new Date(pull.closed_at) : null,
  };
}

// a missed "closed" webhook leaves a PR OPEN forever, so check them against github
export async function prSyncProcessor(): Promise<{ checked: number; closed: number }> {
  const openPrs = await prisma.pullRequest.findMany({
    where: { status: PRStatus.OPEN, repository: { isActive: true } },
    select: {
      id: true,
      prNumber: true,
      repository: { select: { id: true, fullName: true, ownerId: true } },
    },
  });

  const byRepo = new Map<string, typeof openPrs>();
  for (const pr of openPrs) {
    byRepo.set(pr.repository.id, [...(byRepo.get(pr.repository.id) ?? []), pr]);
  }

  let checked = 0;
  let closed = 0;

  for (const prs of byRepo.values()) {
    const { fullName, ownerId } = prs[0].repository;
    const [owner, repo] = fullName.split('/');

    const credential = await octokitFor(ownerId);
    if ('error' in credential) {
      logger.warn({ repo: fullName, reason: credential.error }, 'PR sync skipped repo');
      continue;
    }

    for (const pr of prs) {
      try {
        const { data } = await credential.octokit.rest.pulls.get({ owner, repo, pull_number: pr.prNumber });
        checked += 1;

        const update = closedUpdate(data);
        if (!update) continue;

        // status in the where so a "reopened" webhook landing meanwhile wins
        const res = await prisma.pullRequest.updateMany({
          where: { id: pr.id, status: PRStatus.OPEN },
          data: update,
        });
        closed += res.count;
      } catch (err) {
        logger.warn({ err, repo: fullName, prNumber: pr.prNumber }, 'PR sync could not check PR');
      }
    }
  }

  logger.info({ open: openPrs.length, checked, closed }, 'PR sync done');
  return { checked, closed };
}
