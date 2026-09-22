import { prisma } from '@codehealth/db';
import { githubClient, type Octokit } from '@codehealth/github';

import { decrypt } from '../lib/crypto';
import { logger } from '../lib/logger';

export interface CommentTarget {
  owner: string;
  repo: string;
  prNumber: number;
  // Null until the bot has posted on this PR once.
  botCommentId: string | null;
}

/**
 * Puts the body on the PR, editing the bot's own comment when we already know
 * its id, and returns the id to store. A 404 on the edit means someone deleted
 * the comment, so post a fresh one rather than lose the report.
 *
 * The client is passed in so this can be tested without going near the network.
 */
export async function upsertComment(
  octokit: Octokit,
  target: CommentTarget,
  body: string,
): Promise<string> {
  const { owner, repo, prNumber, botCommentId } = target;

  if (botCommentId) {
    try {
      const updated = await octokit.rest.issues.updateComment({
        owner,
        repo,
        comment_id: Number(botCommentId),
        body,
      });
      return String(updated.data.id);
    } catch (err) {
      if ((err as { status?: number }).status !== 404) throw err;
    }
  }

  const created = await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: prNumber,
    body,
  });

  return String(created.data.id);
}

/**
 * Best effort on purpose. The snapshot is already stored by the time this runs,
 * so a rate limit or a revoked token costs the comment, not the analysis — it
 * logs and returns instead of throwing the whole job back to the queue.
 */
export async function postPrComment(input: {
  analysisId: string;
  body: string;
}): Promise<void> {
  const { analysisId, body } = input;

  const job = await prisma.analysisJob.findUnique({
    where: { id: analysisId },
    select: {
      pullRequest: { select: { id: true, prNumber: true, botCommentId: true } },
      repository: {
        select: {
          fullName: true,
          owner: { select: { githubCredential: { select: { encryptedAccessToken: true } } } },
        },
      },
    },
  });

  // Manual runs aren't tied to a pull request, so there is nowhere to post.
  if (!job?.pullRequest) return;
  const pr = job.pullRequest;

  const encrypted = job.repository.owner.githubCredential?.encryptedAccessToken;
  if (!encrypted) {
    logger.warn({ analysisId }, 'No stored GitHub token for repo owner, skipping PR comment');
    return;
  }

  const [owner, repo] = job.repository.fullName.split('/');

  try {
    const commentId = await upsertComment(
      githubClient(decrypt(encrypted)),
      { owner, repo, prNumber: pr.prNumber, botCommentId: pr.botCommentId },
      body,
    );

    if (commentId !== pr.botCommentId) {
      await prisma.pullRequest.update({
        where: { id: pr.id },
        data: { botCommentId: commentId },
      });
    }

    logger.info({ analysisId, prNumber: pr.prNumber, commentId }, 'PR comment posted');
  } catch (err) {
    logger.error({ analysisId, prNumber: pr.prNumber, err }, 'Could not post PR comment');
  }
}
