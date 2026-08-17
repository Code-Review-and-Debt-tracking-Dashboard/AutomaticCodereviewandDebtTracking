import IORedis from 'ioredis';

import { env } from '../config/env';
import { logger } from './logger';

// maxRetriesPerRequest must be null here. A BullMQ consumer sits on a blocking
// command waiting for the next job, and bullmq refuses to start if the
// connection is set to give up on it after N retries. The API uses a retry
// limit instead because its commands run while an HTTP request waits.
export const redis = new IORedis(env.redisUrl, { maxRetriesPerRequest: null });

redis.on('error', (err) => {
  logger.error({ err }, 'Redis connection error');
});
