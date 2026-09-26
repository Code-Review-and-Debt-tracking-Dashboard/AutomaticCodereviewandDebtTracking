import IORedis from 'ioredis';

import { env } from '../config/env';
import { logger } from './logger';

// few retries so a request doesn't hang when redis is down
export const redis = new IORedis(env.redisUrl, { maxRetriesPerRequest: 3 });

// without this an unhandled error event crashes the process
redis.on('error', (err) => {
  logger.error({ err }, 'Redis connection error');
});
