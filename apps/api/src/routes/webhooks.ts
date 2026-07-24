import express, { Router } from 'express';

import { AppError } from '../middleware/errorHandler';
import { verifyWebhookSignature } from '../middleware/verifyWebhookSignature';
import {
  findLinkedRepository,
  parsePullRequestEvent,
  SUPPORTED_PR_ACTIONS,
  type SupportedPrAction,
} from '../services/webhookService';

export const webhookRouter = Router();

// POST /webhooks/github — api_design.md §3: verifies the HMAC-SHA256
// signature before accepting the request (A-07). `express.raw` keeps the
// body as a Buffer so the signature is checked against the exact bytes
// GitHub signed; must run before the app's global `express.json()`.
webhookRouter.post(
  '/webhooks/github',
  express.raw({ type: 'application/json' }),
  verifyWebhookSignature,
  async (req, res, next) => {
    try {
      const githubEvent = req.headers['x-github-event'];

      // GitHub sends `ping` once when the webhook is first registered
      // (A-11) — acknowledge it rather than rejecting it as unsupported.
      if (githubEvent === 'ping') {
        res.status(200).json({ message: 'pong' });
        return;
      }

      if (githubEvent !== 'pull_request') {
        throw new AppError(400, 'VALIDATION_ERROR', `Unsupported event: ${String(githubEvent)}`);
      }

      const event = parsePullRequestEvent(req.body);

      // Only opened/synchronize/reopened/closed are subscribed to
      // (api_design.md §3); other pull_request actions are a no-op.
      if (!SUPPORTED_PR_ACTIONS.includes(event.action as SupportedPrAction)) {
        res.status(200).json({ message: 'Ignored action', action: event.action });
        return;
      }

      await findLinkedRepository(event.githubRepoId);

      // Job dispatch (A-10) will replace this with an enqueue call and
      // return `{ message: 'Job queued', jobId }` per api_design.md §3.
      res.status(202).json({ message: 'Received' });
    } catch (err) {
      next(err);
    }
  },
);
