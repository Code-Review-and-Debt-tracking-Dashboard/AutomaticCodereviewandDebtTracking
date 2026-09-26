import { prisma } from '@codehealth/db';
import { describe, expect, it } from 'vitest';

import { createSession } from '../../src/services/sessionService';
import { api } from '../helpers/app';
import { bearer } from '../helpers/auth';
import { createAdmin, createSnapshot, createUser } from '../helpers/factories';
import { seedTenant } from '../helpers/tenants';

describe('DELETE /api/admin/users/:userId/sessions', () => {
  it('401 without a token', async () => {
    const res = await api().delete('/api/admin/users/x/sessions');
    expect(res.status).toBe(401);
  });

  it('403 for a regular user', async () => {
    const user = await createUser();
    const res = await api().delete(`/api/admin/users/${user.id}/sessions`).set(bearer(user));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('403 when the token claims ADMIN but the database says USER', async () => {
    const user = await createUser();
    const forged = bearer({ ...user, platformRole: 'ADMIN' });
    const res = await api().delete(`/api/admin/users/${user.id}/sessions`).set(forged);
    expect(res.status).toBe(403);
  });

  it('403 for a deactivated admin', async () => {
    const admin = await createAdmin({ active: false });
    const res = await api().delete(`/api/admin/users/${admin.id}/sessions`).set(bearer(admin));
    expect(res.status).toBe(403);
  });

  it('revokes every live session of the target and reports the count', async () => {
    const admin = await createAdmin();
    const target = await createUser();
    const s1 = await createSession(target);
    const s2 = await createSession(target);
    const bystander = await createUser();
    const s3 = await createSession(bystander);

    const res = await api().delete(`/api/admin/users/${target.id}/sessions`).set(bearer(admin));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ revoked: 2 });

    for (const dead of [s1, s2]) {
      const refresh = await api().post('/auth/refresh').send({ refreshToken: dead.refreshToken });
      expect(refresh.status).toBe(401);
    }
    const alive = await api().post('/auth/refresh').send({ refreshToken: s3.refreshToken });
    expect(alive.status).toBe(200);

    const rows = await prisma.session.findMany({ where: { userId: target.id } });
    expect(rows.every((r) => r.revokedReason === 'ADMIN_REVOKED')).toBe(true);
  });

  it('200 with zero for an unknown user', async () => {
    const admin = await createAdmin();
    const res = await api().delete('/api/admin/users/nope/sessions').set(bearer(admin));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ revoked: 0 });
  });
});

describe('GET /api/metrics', () => {
  it('401 without a token', async () => {
    const res = await api().get('/api/metrics');
    expect(res.status).toBe(401);
  });

  it('403 for a regular user', async () => {
    const user = await createUser();
    const res = await api().get('/api/metrics').set(bearer(user));
    expect(res.status).toBe(403);
  });

  it('returns analysis, queue and system stats for an admin', async () => {
    const admin = await createAdmin();
    const t = await seedTenant('acme');
    await createSnapshot(t.repo, { healthScore: 62 });

    const res = await api().get('/api/metrics').set(bearer(admin));

    expect(res.status).toBe(200);
    expect(res.body.analysisStats).toMatchObject({
      totalAnalyses: 2,
      averageHealthScore: (t.snapshot.healthScore + 62) / 2,
    });
    expect(res.body.analysisStats.averageDurationSeconds).toBeCloseTo(60, 0);
    expect(res.body.queueStats).toEqual({ pending: 0, active: 0, completed: 0, failed: 0 });
    expect(res.body.systemStats).toEqual({
      uptimeSeconds: expect.any(Number),
      memoryUsageMB: expect.any(Number),
    });
  });
});
