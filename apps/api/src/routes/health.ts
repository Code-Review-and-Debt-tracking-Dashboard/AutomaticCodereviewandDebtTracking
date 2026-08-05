import { prisma } from '@codehealth/db';
import { Router } from 'express';

import { logger } from '../lib/logger';
import { redis } from '../lib/redis';

export const healthRouter = Router();

// public, no auth. A dead dependency is a 503, not a thrown error.
healthRouter.get('/health', async (_req, res) => {
  let databaseOk = true;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    logger.warn({ err }, 'Database health check failed');
    databaseOk = false;
  }

  let redisOk = true;
  try {
    await redis.ping();
  } catch (err) {
    logger.warn({ err }, 'Redis health check failed');
    redisOk = false;
  }

  const healthy = databaseOk && redisOk;

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'degraded',
    version: process.env.npm_package_version ?? '0.1.0',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    checks: {
      database: databaseOk,
      redis: redisOk,
    },
  });
});
