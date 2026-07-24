import express, { Router } from 'express';

import { verifyWebhookSignature } from '../middleware/verifyWebhookSignature';

export const webhookRouter = Router();

// POST /webhooks/github — api_design.md §3: verifies the HMAC-SHA256
// signature before accepting the request (A-07). `express.raw` keeps the
// body as a Buffer so the signature is checked against the exact bytes
// GitHub signed; must run before the app's global `express.json()`.
// Event parsing (A-08) and job dispatch (A-10) land in this handler later.
webhookRouter.post(
  '/webhooks/github',
  express.raw({ type: 'application/json' }),
  verifyWebhookSignature,
  (_req, res) => {
    res.status(202).json({ message: 'Received' });
  },
);
