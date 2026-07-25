import { createHmac, timingSafeEqual } from 'crypto';

import type { NextFunction, Request, Response } from 'express';

import { env } from '../config/env';
import { AppError } from './errorHandler';

const SIGNATURE_PREFIX = 'sha256=';

/**
 * Verifies the GitHub `X-Hub-Signature-256` header 
 * against `GITHUB_WEBHOOK_SECRET`. Must run after a raw body parser — it
 * needs the exact bytes GitHub signed, so `req.body` is expected to be a
 * `Buffer`, not JSON already parsed by `express.json()`.
 */
export function verifyWebhookSignature(req: Request, _res: Response, next: NextFunction): void {
  const signature = req.headers['x-hub-signature-256'];

  if (typeof signature !== 'string' || !signature.startsWith(SIGNATURE_PREFIX) || !Buffer.isBuffer(req.body)) {
    next(new AppError(401, 'UNAUTHORIZED', 'Invalid webhook signature'));
    return;
  }

  const expected = Buffer.from(
    SIGNATURE_PREFIX + createHmac('sha256', env.githubWebhookSecret).update(req.body).digest('hex'),
  );
  const received = Buffer.from(signature);

  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    next(new AppError(401, 'UNAUTHORIZED', 'Invalid webhook signature'));
    return;
  }

  next();
}
