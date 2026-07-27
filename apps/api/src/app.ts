import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';

import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { authRouter } from './routes/auth';
import { healthRouter } from './routes/health';
import { webhookRouter } from './routes/webhooks';

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors());

  // Must be mounted before express.json() — it parses its own body as a raw
  // Buffer so the HMAC signature can be verified against the exact bytes
  app.use(webhookRouter);

  app.use(express.json());

  app.use(authRouter);
  app.use(healthRouter);

  // Future routes (/api/*) mount here — before the 404/error handlers
  // below, which must stay last.

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
