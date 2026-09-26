import { prisma, type Agent } from '@codehealth/db';
import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';

import { AppError } from './errorHandler';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      agent?: Agent;
    }
  }
}

export async function requireAgent(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError(401, 'UNAUTHORIZED', 'Missing or invalid Authorization header');
    }

    const token = authHeader.substring(7);
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const agent = await prisma.agent.findUnique({
      where: { tokenHash },
    });

    if (!agent || agent.revokedAt) {
      throw new AppError(401, 'UNAUTHORIZED', 'Invalid or revoked agent token');
    }

    req.agent = agent;

    // don't wait for this
    prisma.agent
      .update({
        where: { id: agent.id },
        data: { lastSeenAt: new Date() },
      })
      .catch((err) => {
        console.error('Failed to update agent lastSeenAt', err);
      });

    next();
  } catch (error) {
    next(error);
  }
}
