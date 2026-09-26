import IORedis from 'ioredis';

import { env } from '../config/env';
import { logger } from './logger';

// bullmq workers need maxRetriesPerRequest: null
export const redis = new IORedis(env.redisUrl, { maxRetriesPerRequest: null });

redis.on('error', (err) => {
  logger.error({ err }, 'Redis connection error');
});
