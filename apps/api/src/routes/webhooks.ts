import { AnalysisTrigger } from '@codehealth/db';
import express, { Router } from 'express';

import { AppError } from '../middleware/errorHandler';
import { verifyWebhookSignature } from '../middleware/verifyWebhookSignature';
import { enqueueAnalysisJob } from '../services/queueService';
import {
  findLinkedRepository,
  parsePullRequestEvent,
  SUPPORTED_PR_ACTIONS,
  type SupportedPrAction,
  upsertPullRequest,
} from '../services/webhookService';

export const webhookRouter = Router();

// express.raw keeps the body as a Buffer so the signature is checked against
// the exact bytes GitHub signed
webhookRouter.post(
  '/webhooks/github',
  express.raw({ type: 'application/json' }),
  verifyWebhookSignature,
  async (req, res, next) => {
    try {
      const githubEvent = req.headers['x-github-event'];

      // GitHub sends this once when the webhook is registered
      if (githubEvent === 'ping') {
        res.status(200).json({ message: 'pong' });
        return;
      }

      if (githubEvent !== 'pull_request') {
        throw new AppError(400, 'VALIDATION_ERROR', `Unsupported event: ${String(githubEvent)}`);
      }

      const event = parsePullRequestEvent(req.body);

      if (!SUPPORTED_PR_ACTIONS.includes(event.action as SupportedPrAction)) {
        res.status(200).json({ message: 'Ignored action', action: event.action });
        return;
      }

      const repository = await findLinkedRepository(event.githubRepoId);
      const pullRequest = await upsertPullRequest(repository.id, event);

      if (event.action === 'closed') {
        res.status(200).json({ message: 'Pull request closed' });
        return;
      }

      const { analysisId, jobId } = await enqueueAnalysisJob({
        repoId: repository.id,
        branch: event.headBranch,
        commitSha: event.headSha,
        cloneUrl: event.cloneUrl,
        trigger: AnalysisTrigger.WEBHOOK,
        pullRequestId: pullRequest.id,
        prNumber: event.prNumber,
      });

      res.status(202).json({ message: 'Job queued', analysisId, jobId });
    } catch (err) {
      next(err);
    }
  },
);
