import pino from 'pino';

import { env } from '../config/env';

// Pretty-printed in dev, raw JSON in production so logs stay searchable
// once they hit a real log aggregator.
export const logger = pino({
  level: env.logLevel,
  transport: env.nodeEnv === 'development' ? { target: 'pino-pretty' } : undefined,
});
