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

describe('Mobile App - Auth & Token Lifecycle', () => {
  it('supports token refresh via request body for native mobile clients', async () => {
    const t = await seedTenant('acme');
    const { createSession } = await import('../../src/services/sessionService');
    const session = await createSession(t.developer);

    const res = await api().post('/auth/refresh').send({ refreshToken: session.refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.refreshToken).not.toBe(session.refreshToken);
    expect(res.body.user).toMatchObject({
      id: t.developer.id,
      username: t.developer.username,
    });
  });

  it('allows mobile client to fetch authenticated user profile', async () => {
    const t = await seedTenant('acme');
    const res = await api().get('/auth/me').set(bearer(t.developer));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: t.developer.id,
      username: t.developer.username,
    });
  });

  it('allows mobile client to logout using body refresh token', async () => {
    const t = await seedTenant('acme');
    const { createSession } = await import('../../src/services/sessionService');
    const session = await createSession(t.developer);

    const res = await api().post('/auth/logout').send({ refreshToken: session.refreshToken });
    expect(res.status).toBe(204);

    const refreshAgain = await api().post('/auth/refresh').send({ refreshToken: session.refreshToken });
    expect(refreshAgain.status).toBe(401);
  });
});

describe('Mobile App - HomeScreen Endpoints Contract', () => {
  it('provides all data shapes expected by Mobile HomeScreen', async () => {
    const t = await seedTenant('acme');
    await createSnapshot(t.repo, { healthScore: 85, criticalCount: 1, debtMinutes: 120 });

    const orgsRes = await api().get('/api/orgs').set(bearer(t.developer));
    expect(orgsRes.status).toBe(200);
    expect(orgsRes.body.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: t.org.id })]),
    );

    const reposRes = await api().get(`/api/orgs/${t.org.id}/repos`).set(bearer(t.developer));
    expect(reposRes.status).toBe(200);
    expect(reposRes.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: t.repo.id,
          name: t.repo.name,
          fullName: t.repo.fullName,
          healthScore: expect.any(Number),
          openFindings: expect.any(Number),
          debtMinutes: expect.any(Number),
          private: expect.any(Boolean),
        }),
      ]),
    );

    const trendRes = await api().get(`/api/repos/${t.repo.id}/trend?days=30`).set(bearer(t.developer));
    expect(trendRes.status).toBe(200);
    expect(trendRes.body).toHaveProperty('dataPoints');
    expect(Array.isArray(trendRes.body.dataPoints)).toBe(true);
  });
});

describe('Mobile App - RepoSummaryScreen Endpoints Contract', () => {
  it('provides detail, trend, debt, and top smells for a repository', async () => {
    const t = await seedTenant('acme');
    await createFinding(t.snapshot, { severity: 'CRITICAL', state: 'EXISTING' });

    const [detailRes, trendRes, debtRes, smellsRes] = await Promise.all([
      api().get(`/api/repos/${t.repo.id}`).set(bearer(t.developer)),
      api().get(`/api/repos/${t.repo.id}/trend?days=30`).set(bearer(t.developer)),
      api().get(`/api/repos/${t.repo.id}/debt`).set(bearer(t.developer)),
      api().get(`/api/mobile/repos/${t.repo.id}/smells?limit=5`).set(bearer(t.developer)),
    ]);

    expect(detailRes.status).toBe(200);
    expect(detailRes.body).toMatchObject({ id: t.repo.id, name: t.repo.name });

    expect(trendRes.status).toBe(200);
    expect(trendRes.body.dataPoints).toBeDefined();

    expect(debtRes.status).toBe(200);
    expect(debtRes.body).toHaveProperty('totalDebtMinutes');

    expect(smellsRes.status).toBe(200);
    expect(smellsRes.body).toMatchObject({
      repoName: t.repo.name,
      healthScore: expect.any(Number),
      smells: expect.any(Array),
    });
  });
});

describe('Mobile App - NotificationsScreen Endpoints Contract', () => {
  it('supports listing, marking single, and marking all notifications as read', async () => {
    const t = await seedTenant('acme');
    const n1 = await createNotification(t.developer);
    const n2 = await createNotification(t.developer);

    const listRes = await api().get('/api/notifications').set(bearer(t.developer));
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(2);

    const readSingleRes = await api().put(`/api/notifications/${n1.id}/read`).set(bearer(t.developer));
    expect(readSingleRes.status).toBe(204);

    const readAllRes = await api().put('/api/notifications/read-all').set(bearer(t.developer));
    expect(readAllRes.status).toBe(204);
  });
});

