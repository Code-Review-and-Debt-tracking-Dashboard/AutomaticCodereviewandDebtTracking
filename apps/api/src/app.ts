import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';

import { errorHandler, notFoundHandler } from './middleware/errorHandler';

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  // Future routes (auth, webhooks, /api/*) mount here — before the
  // 404/error handlers below, which must stay last.

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
