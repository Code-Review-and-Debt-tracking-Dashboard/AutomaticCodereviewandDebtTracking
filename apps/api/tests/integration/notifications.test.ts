import { prisma } from '@codehealth/db';
import { describe, expect, it } from 'vitest';

import { api } from '../helpers/app';
import { bearer } from '../helpers/auth';
import { createNotification, createUser } from '../helpers/factories';
import { seedTenant } from '../helpers/tenants';

describe('GET /api/notifications', () => {
  it('401 without a token', async () => {
    const res = await api().get('/api/notifications');
    expect(res.status).toBe(401);
  });

  it('400 for a bad unreadOnly value', async () => {
    const user = await createUser();
    const res = await api().get('/api/notifications').query({ unreadOnly: 'maybe' }).set(bearer(user));
    expect(res.status).toBe(400);
  });

  it("lists only the caller's notifications, newest first, with repo and snapshot", async () => {
    const t = await seedTenant('acme');
    const other = await createUser();
    await createNotification(other, { title: 'not yours' });
    const first = await createNotification(t.developer, { title: 'first', createdAt: new Date(Date.now() - 1000) });
    const second = await createNotification(t.developer, {
      title: 'second',
      type: 'QUALITY_GATE_FAILED',
      repoId: t.repo.id,
      snapshotId: t.snapshot.id,
      data: { gate: 'FAIL' },
    });

    const res = await api().get('/api/notifications').set(bearer(t.developer));

    expect(res.status).toBe(200);
    expect(res.body.data.map((n: { id: string }) => n.id)).toEqual([second.id, first.id]);
    expect(res.body.data[0]).toMatchObject({
      type: 'QUALITY_GATE_FAILED',
      title: 'second',
      readAt: null,
      data: { gate: 'FAIL' },
      repository: { id: t.repo.id, name: t.repo.name, fullName: t.repo.fullName },
      snapshot: { id: t.snapshot.id, healthScore: t.snapshot.healthScore },
    });
  });

  it('unreadOnly=true hides read ones', async () => {
    const user = await createUser();
    await createNotification(user, { readAt: new Date() });
    const unread = await createNotification(user);

    const res = await api().get('/api/notifications').query({ unreadOnly: 'true' }).set(bearer(user));
    expect(res.body.data.map((n: { id: string }) => n.id)).toEqual([unread.id]);
  });
});

describe('PUT /api/notifications/:notificationId/read', () => {
  it('401 without a token', async () => {
    const user = await createUser();
    const n = await createNotification(user);
    const res = await api().put(`/api/notifications/${n.id}/read`);
    expect(res.status).toBe(401);
  });

  it('404 for an unknown id', async () => {
    const user = await createUser();
    const res = await api().put('/api/notifications/nope/read').set(bearer(user));
    expect(res.status).toBe(404);
  });

  it("404 for another user's notification — same as unknown", async () => {
    const owner = await createUser();
    const other = await createUser();
    const n = await createNotification(owner);

    const res = await api().put(`/api/notifications/${n.id}/read`).set(bearer(other));
    expect(res.status).toBe(404);
    expect((await prisma.notification.findUnique({ where: { id: n.id } }))?.readAt).toBeNull();
  });

  it('marks it read', async () => {
    const user = await createUser();
    const n = await createNotification(user);
    const res = await api().put(`/api/notifications/${n.id}/read`).set(bearer(user));
    expect(res.status).toBe(204);
    expect((await prisma.notification.findUnique({ where: { id: n.id } }))?.readAt).toBeInstanceOf(Date);
  });
});

describe('PUT /api/notifications/read-all', () => {
  it('401 without a token', async () => {
    const res = await api().put('/api/notifications/read-all');
    expect(res.status).toBe(401);
  });

  it("marks all of the caller's unread notifications read and nobody else's", async () => {
    const user = await createUser();
    const other = await createUser();
    await createNotification(user);
    await createNotification(user);
    const theirs = await createNotification(other);

    const res = await api().put('/api/notifications/read-all').set(bearer(user));
    expect(res.status).toBe(204);

    expect(await prisma.notification.count({ where: { userId: user.id, readAt: null } })).toBe(0);
    expect((await prisma.notification.findUnique({ where: { id: theirs.id } }))?.readAt).toBeNull();
  });
});

describe('DELETE /api/notifications/:notificationId', () => {
  it('401 without a token', async () => {
    const user = await createUser();
    const n = await createNotification(user);
    const res = await api().delete(`/api/notifications/${n.id}`);
    expect(res.status).toBe(401);
  });

  it("404 for another user's notification, and it stays", async () => {
    const user = await createUser();
    const theirs = await createNotification(await createUser());

    const res = await api().delete(`/api/notifications/${theirs.id}`).set(bearer(user));

    expect(res.status).toBe(404);
    expect(await prisma.notification.findUnique({ where: { id: theirs.id } })).not.toBeNull();
  });

  it('deletes it', async () => {
    const user = await createUser();
    const n = await createNotification(user);

    const res = await api().delete(`/api/notifications/${n.id}`).set(bearer(user));

    expect(res.status).toBe(204);
    expect(await prisma.notification.findUnique({ where: { id: n.id } })).toBeNull();
  });
});

describe('DELETE /api/notifications', () => {
  it('401 without a token', async () => {
    const res = await api().delete('/api/notifications');
    expect(res.status).toBe(401);
  });

  it("clears all of the caller's notifications and nobody else's", async () => {
    const user = await createUser();
    const other = await createUser();
    await createNotification(user);
    await createNotification(user);
    const theirs = await createNotification(other);

    const res = await api().delete('/api/notifications').set(bearer(user));

    expect(res.status).toBe(204);
    expect(await prisma.notification.count({ where: { userId: user.id } })).toBe(0);
    expect(await prisma.notification.findUnique({ where: { id: theirs.id } })).not.toBeNull();
  });
});
