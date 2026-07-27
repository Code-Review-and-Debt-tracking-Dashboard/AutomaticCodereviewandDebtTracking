import { prisma } from '@codehealth/db';
import { Router } from 'express';

export const healthRouter = Router();

// Public liveness/readiness check — no auth. Used by uptime monitors and
// load balancers, so it must never throw; a failed dependency check is a
// normal 503 result, not an error.
healthRouter.get('/health', async (_req, res) => {
  let databaseOk = true;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    databaseOk = false;
  }

  const healthy = databaseOk;

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'degraded',
    version: process.env.npm_package_version ?? '0.1.0',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    checks: {
      database: databaseOk,
    },
  });
});
