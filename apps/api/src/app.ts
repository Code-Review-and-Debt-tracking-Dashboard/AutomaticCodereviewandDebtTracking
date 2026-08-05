import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';

import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { authRouter } from './routes/auth';
import { healthRouter } from './routes/health';
import { notificationsRouter } from './routes/notifications';
import { orgsRouter } from './routes/orgs';
import { reposRouter } from './routes/repos';
import { qualityGatesRouter } from './routes/qualityGates';
import { webhookRouter } from './routes/webhooks';

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors());

  // must come before express.json() — signature check needs the raw body
  app.use(webhookRouter);

  app.use(express.json());

  app.use(authRouter);
  app.use(healthRouter);
  app.use(notificationsRouter);
  app.use(orgsRouter);
  app.use(reposRouter);
  app.use(qualityGatesRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
