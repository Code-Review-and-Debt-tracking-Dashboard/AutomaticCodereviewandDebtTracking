import pino from 'pino';

import { env } from '../config/env';

// pretty in dev, JSON in production
export const logger = pino({
  level: env.logLevel,
  transport: env.nodeEnv === 'development' ? { target: 'pino-pretty' } : undefined,
});
