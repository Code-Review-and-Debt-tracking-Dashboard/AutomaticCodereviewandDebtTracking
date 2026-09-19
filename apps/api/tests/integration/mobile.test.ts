import { describe, expect, it } from 'vitest';

import { api } from '../helpers/app';
import { bearer } from '../helpers/auth';
import { createFinding, createNotification, createPullRequest, createRepo, createSnapshot, createUser } from '../helpers/factories';
import { seedTenant } from '../helpers/tenants';

describe('GET /api/mobile/summary', () => {
  it('401 without a token', async () => {
    const res = await api().get('/api/mobile/summary');
    expect(res.status).toBe(401);
  });

  it('aggregates the home screen for the caller in one call', async () => {
    const t = await seedTenant('acme');
    await createNotification(t.developer);
    await createNotification(t.developer, { readAt: new Date() });
    await createPullRequest(t.repo, { status: 'MERGED' });
    await createSnapshot(t.repo, { healthScore: 90, criticalCount: 2, calculatedAt: new Date(Date.now() + 1000) });

    const res = await api().get('/api/mobile/summary').set(bearer(t.developer));

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ username: t.developer.username, avatarUrl: null });
    expect(res.body.unreadNotifications).toBe(1);
    expect(res.body.repos).toHaveLength(1);
    expect(res.body.repos[0]).toMatchObject({
      id: t.repo.id,
      name: t.repo.name,
      healthScore: 90,
      scoreChange: 90 - t.snapshot.healthScore,
      openPRs: 1,
      criticalIssues: 2,
    });
  });

  it('only includes repos the caller owns or is an active member of', async () => {
    const t = await seedTenant('acme');
    await createRepo(t.org, t.admin, { name: 'not-mine' });
    const res = await api().get('/api/mobile/summary').set(bearer(t.developer));
    expect(res.body.repos.map((r: { name: string }) => r.name)).toEqual([t.repo.name]);

    const nobody = await createUser();
    const empty = await api().get('/api/mobile/summary').set(bearer(nobody));
    expect(empty.body.repos).toEqual([]);
  });
});

describe('GET /api/mobile/repos/:repoId/smells', () => {
  it('401 without a token', async () => {
    const t = await seedTenant('acme');
    const res = await api().get(`/api/mobile/repos/${t.repo.id}/smells`);
    expect(res.status).toBe(401);
  });

  it('403 for a bystander', async () => {
    const t = await seedTenant('acme');
    const res = await api().get(`/api/mobile/repos/${t.repo.id}/smells`).set(bearer(t.bystander));
    expect(res.status).toBe(403);
  });

  it('400 for a bad limit', async () => {
    const t = await seedTenant('acme');
    const res = await api().get(`/api/mobile/repos/${t.repo.id}/smells`).query({ limit: '0' }).set(bearer(t.owner));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('404 when the repo has no snapshot', async () => {
    const t = await seedTenant('acme');
    const fresh = await createRepo(t.org, t.owner);
    const res = await api().get(`/api/mobile/repos/${fresh.id}/smells`).set(bearer(t.owner));
    expect(res.status).toBe(404);
  });

  it('returns the latest snapshot findings, capped by limit', async () => {
    const t = await seedTenant('acme');
    await createFinding(t.snapshot, { severity: 'CRITICAL', state: 'EXISTING' });
    await createFinding(t.snapshot, { severity: 'LOW', state: 'NEW' });

    const res = await api().get(`/api/mobile/repos/${t.repo.id}/smells`).query({ limit: '2' }).set(bearer(t.developer));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      repoName: t.repo.name,
      healthScore: t.snapshot.healthScore,
      snapshotDate: t.snapshot.calculatedAt.toISOString(),
      totalSmells: 3,
      newSmells: 2,
    });
    expect(res.body.smells).toHaveLength(2);
    expect(res.body.smells[0]).toEqual({
      file: expect.any(String),
      line: expect.any(Number),
      severity: expect.any(String),
      rule: expect.any(String),
      message: expect.any(String),
      isNew: expect.any(Boolean),
    });
  });
});
