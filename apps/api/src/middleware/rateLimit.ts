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

// system_architecture.md §7.1 — global tier: 100 requests / 15 min per IP.
// /health is exempt since infra polls it far more often than that.
export const globalRateLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  prefix: 'rl:global:',
  skip: (req) => req.path === '/health',
});

// system_architecture.md §7.1 — webhook tier: 30 requests / 1 min per IP.
export const webhookRateLimiter = buildLimiter({
  windowMs: 60 * 1000,
  limit: 30,
  prefix: 'rl:webhook:',
});

// api_design.md Gap #9 — /auth/* has no rate limiting; number isn't specified
// in the docs, 20/15min is a reasonable per-IP default for login-adjacent routes.
export const authRateLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  prefix: 'rl:auth:',
});

// system_architecture.md §7.1 — analysis trigger: 5 requests / 5 min per user.
// Must be mounted after requireAuth, which is what sets req.user.
export const analyzeRateLimiter = buildLimiter({
  windowMs: 5 * 60 * 1000,
  limit: 5,
  prefix: 'rl:analyze:',
  keyGenerator: (req) => req.user!.id,
});
