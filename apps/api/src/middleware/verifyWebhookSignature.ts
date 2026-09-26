import { createHmac, timingSafeEqual } from 'crypto';

import type { NextFunction, Request, Response } from 'express';

import { env } from '../config/env';
import { AppError } from './errorHandler';

const SIGNATURE_PREFIX = 'sha256=';

// Needs the raw bytes GitHub signed, so req.body must still be a Buffer here.
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
