import IORedis from 'ioredis';

import { env } from '../config/env';
import { logger } from './logger';

// One Redis connection for the whole API process, shared by the job queue
// and the health check. Use maxRetriesPerRequest: null and a retry strategy
// so ioredis automatically reconnects when Redis starts or restarts.
export const redis = new IORedis(env.redisUrl, {
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    return Math.min(times * 100, 3000);
  },
});

// ioredis emits 'error' on every failed reconnect attempt. Without a listener
// Node treats it as an unhandled error event and kills the process, so a
// Redis blip would take the API down with it.
redis.on('error', (err) => {
  logger.error({ err }, 'Redis connection error');
});
