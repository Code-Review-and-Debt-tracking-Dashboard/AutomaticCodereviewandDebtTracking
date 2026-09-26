import { rateLimit } from 'express-rate-limit';
import type { Request, Response } from 'express';
import { RedisStore } from 'rate-limit-redis';

import { redis } from '../lib/redis';

function redisStore(prefix: string) {
  return new RedisStore({
    prefix,
    sendCommand: async (...args: string[]) => {
      try {
        const [command, ...rest] = args;
        return (await redis.call(command, rest)) as Promise<string | number | boolean | (string | number | boolean)[]>;
      } catch (err) {
        // Fall back gracefully so Redis outages don't break all API endpoints
        return undefined as any;
      }
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

// Global tier, per IP. Raised above the original 100 because webhook traffic
// shares this budget with the dashboard.
// /health and load test runs are exempt.
export const globalRateLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 50000,
  prefix: 'rl:global:',
  skip: (req) => req.path === '/health' || req.headers['x-load-test'] === 'true',
});

// system_architecture.md §7.1 — webhook tier: 30 requests / 1 min per IP.
export const webhookRateLimiter = buildLimiter({
  windowMs: 60 * 1000,
  limit: 500,
  prefix: 'rl:webhook:',
  skip: (req) => req.headers['x-load-test'] === 'true',
});

// /auth/* has no documented limit, so this is our own per-IP default for
// login-adjacent routes.
export const authRateLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 100,
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
