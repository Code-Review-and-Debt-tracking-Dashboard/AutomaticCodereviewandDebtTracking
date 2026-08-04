import IORedis from 'ioredis';

import { env } from '../config/env';
import { logger } from './logger';

// One Redis connection for the whole API process, shared by the job queue
// and the health check. Every command here runs while an HTTP request is
// waiting, so give up after a few retries instead of ioredis's default 20 —
// a webhook has to be answered well inside GitHub's timeout.
export const redis = new IORedis(env.redisUrl, { maxRetriesPerRequest: 3 });

// ioredis emits 'error' on every failed reconnect attempt. Without a listener
// Node treats it as an unhandled error event and kills the process, so a
// Redis blip would take the API down with it.
redis.on('error', (err) => {
  logger.error({ err }, 'Redis connection error');
});
