import { prisma } from '@codehealth/db';
import { Router } from 'express';

import { requireAuth } from '../middleware/requireAuth';
import { AppError } from '../middleware/errorHandler';

export const notificationsRouter = Router();

notificationsRouter.get('/api/notifications', requireAuth, async (req, res, next) => {
  try {
    const unreadOnly = req.query.unreadOnly === 'true';

    const data = await prisma.notification.findMany({
      where: {
        userId: req.user!.id,
        ...(unreadOnly ? { readAt: null } : {}),
      },
      include: {
        repository: { select: { id: true, name: true, fullName: true } },
        snapshot: { select: { id: true, healthScore: true, calculatedAt: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.status(200).json({
      data: data.map((notification) => ({
        id: notification.id,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        data: notification.data,
        readAt: notification.readAt,
        createdAt: notification.createdAt,
        repository: notification.repository,
        snapshot: notification.snapshot,
      })),
    });
  } catch (err) {
    next(err);
  }
});

notificationsRouter.put('/api/notifications/:notificationId/read', requireAuth, async (req, res, next) => {
  try {
    const updated = await prisma.notification.updateMany({
      where: { id: req.params.notificationId, userId: req.user!.id },
      data: { readAt: new Date() },
    });

    if (updated.count === 0) {
      throw new AppError(404, 'NOT_FOUND', 'Notification not found');
    }

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

notificationsRouter.put('/api/notifications/read-all', requireAuth, async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, readAt: null },
      data: { readAt: new Date() },
    });

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
