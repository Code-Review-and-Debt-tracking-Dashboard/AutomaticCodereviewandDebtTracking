import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';

import { env } from './config/env';
import { logger } from './lib/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { globalRateLimiter } from './middleware/rateLimit';
import { adminRouter } from './routes/admin';
import { authRouter, devLoginRouter } from './routes/auth';
import { healthRouter } from './routes/health';
import { mobileRouter } from './routes/mobile';
import { metricsRouter } from './routes/metrics';
import { notificationsRouter } from './routes/notifications';
import { orgsRouter } from './routes/orgs';
import { queuesRouter } from './routes/queues';
import { reposRouter } from './routes/repos';
import { qualityGatesRouter } from './routes/qualityGates';
import { snapshotsRouter } from './routes/snapshots';
import { webhookRouter } from './routes/webhooks';
import { jobsRouter } from './routes/jobs';

export function createApp(): Express {
  const app = express();

  // One proxy hop (tunnel in dev, load balancer in prod), so the rate limiters
  // key on the real client instead of lumping every forwarded request together.
  app.set('trust proxy', 1);

  app.use(helmet());
  // Explicit origins, not a wildcard: the refresh cookie needs credentials.
  app.use(cors({ origin: env.webAppOrigins, credentials: true }));

  app.use(globalRateLimiter);

  // must come before express.json() — signature check needs the raw body
  app.use(webhookRouter);

  app.use(express.json());

  app.use(authRouter);
  if (env.enableDevLogin) {
    logger.warn('dev login is enabled — /auth/dev-login will sign in as any username');
    app.use(devLoginRouter);
  }
  app.use(adminRouter);
  app.use(healthRouter);
  app.use(metricsRouter);
  app.use(notificationsRouter);
  app.use(orgsRouter);
  app.use(queuesRouter);
  app.use(reposRouter);
  app.use(qualityGatesRouter);
  app.use(snapshotsRouter);
  app.use(mobileRouter);
  app.use(jobsRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
