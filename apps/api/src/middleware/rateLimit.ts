import { rateLimit } from 'express-rate-limit';
import type { Request, Response } from 'express';
import { RedisStore } from 'rate-limit-redis';

import { redis } from '../lib/redis';

function redisStore(prefix: string) {
  return new RedisStore({
    prefix,
    sendCommand: (...args: string[]) => {
      const [command, ...rest] = args;
      return redis.call(command, rest) as Promise<string | number | boolean | (string | number | boolean)[]>;
    },
  });
}

function rateLimitHandler(_req: Request, res: Response): void {
  res.status(429).json({
    error: { code: 'RATE_LIMITED', message: 'Too many requests, try again later' },
  });
}

interface LimiterOptions {
  windowMs: number;
  limit: number;
  prefix: string;
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
}

function buildLimiter({ windowMs, limit, prefix, keyGenerator, skip }: LimiterOptions) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    store: redisStore(prefix),
    handler: rateLimitHandler,
    keyGenerator,
    skip,
  });
}

// per IP, /health is skipped
export const globalRateLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  prefix: 'rl:global:',
  skip: (req) => req.path === '/health',
});

// 30 / min per IP
export const webhookRateLimiter = buildLimiter({
  windowMs: 60 * 1000,
  limit: 30,
  prefix: 'rl:webhook:',
});

export const authRateLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  prefix: 'rl:auth:',
});

// 5 per 5 min per user, needs requireAuth before it
export const analyzeRateLimiter = buildLimiter({
  windowMs: 5 * 60 * 1000,
  limit: 5,
  prefix: 'rl:analyze:',
  keyGenerator: (req) => req.user!.id,
});
