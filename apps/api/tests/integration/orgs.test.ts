import { prisma } from '@codehealth/db';
import { describe, expect, it } from 'vitest';

import { bulkLinkQueue } from '../../src/lib/queue';
import { api } from '../helpers/app';
import { bearer } from '../helpers/auth';
import {
  addOrgMember,
  addRepoMember,
  createAnalysisJob,
  createOrg,
  createPullRequest,
  createRepo,
  createUser,
} from '../helpers/factories';
import { seedTenant } from '../helpers/tenants';

describe('GET /api/orgs', () => {
  it('401 without a token', async () => {
    const res = await api().get('/api/orgs');
    expect(res.status).toBe(401);
  });

  it('lists only ACTIVE memberships, sorted by login, with the role', async () => {
    const user = await createUser();
    const zeta = await createOrg({ login: 'zeta' });
    const alpha = await createOrg({ login: 'alpha' });
    const gone = await createOrg({ login: 'gone' });
    await addOrgMember(zeta, user, 'MEMBER');
    await addOrgMember(alpha, user, 'OWNER');
    await addOrgMember(gone, user, 'MEMBER', 'REMOVED');

    const res = await api().get('/api/orgs').set(bearer(user));

    expect(res.status).toBe(200);
    expect(res.body.data.map((o: { login: string; role: string }) => [o.login, o.role])).toEqual([
      ['alpha', 'OWNER'],
      ['zeta', 'MEMBER'],
    ]);
  });

  it('is empty for a user in no org', async () => {
    const user = await createUser();
    const res = await api().get('/api/orgs').set(bearer(user));
    expect(res.body).toEqual({ data: [] });
  });
});

describe('GET /api/orgs/:orgId/pulls', () => {
  it('has no score for a PR that was never analysed', async () => {
    const t = await seedTenant('acme');
    const pending = await createPullRequest(t.repo, { title: 'pending' });

    const res = await api().get(`/api/orgs/${t.org.id}/pulls`).set(bearer(t.owner));

    expect(res.status).toBe(200);
    expect(res.body.pullRequests.find((p: { id: number }) => p.id === pending.prNumber)).toMatchObject({
      repoId: t.repo.id,
      score: null,
      status: 'Pending',
    });
  });
});

describe('POST /api/orgs/sync', () => {
  it('401 without a token', async () => {
    const res = await api().post('/api/orgs/sync');
    expect(res.status).toBe(401);
  });

  // The happy path calls GitHub, which these tests never reach.
  it('401 when the user has no stored GitHub credential', async () => {
    const user = await createUser();
    const res = await api().post('/api/orgs/sync').set(bearer(user));
    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/No GitHub credential/);
  });
});

describe('GET /api/orgs/:orgId/members', () => {
  it('401 without a token', async () => {
    const t = await seedTenant('acme');
    const res = await api().get(`/api/orgs/${t.org.id}/members`);
    expect(res.status).toBe(401);
  });

  it('400 for a blank id', async () => {
    const t = await seedTenant('acme');
    const res = await api().get('/api/orgs/%20/members').set(bearer(t.owner));
    expect(res.status).toBe(400);
    expect(res.body.errors[0].path).toBe('params.orgId');
  });

  it('404 for an unknown org', async () => {
    const t = await seedTenant('acme');
    const res = await api().get('/api/orgs/does-not-exist/members').set(bearer(t.owner));
    expect(res.status).toBe(404);
  });

  it('404 for a REMOVED member', async () => {
    const t = await seedTenant('acme');
    await prisma.organizationMember.update({
      where: { orgId_userId: { orgId: t.org.id, userId: t.developer.id } },
      data: { status: 'REMOVED' },
    });
    const res = await api().get(`/api/orgs/${t.org.id}/members`).set(bearer(t.developer));
    expect(res.status).toBe(404);
  });

  it('lists active members sorted by username for any member', async () => {
    const t = await seedTenant('acme');
    const res = await api().get(`/api/orgs/${t.org.id}/members`).set(bearer(t.developer));

    expect(res.status).toBe(200);
    const usernames = res.body.data.map((m: { username: string }) => m.username);
    expect(usernames).toEqual([...usernames].sort());
    expect(usernames).toEqual(
      expect.arrayContaining([t.owner.username, t.admin.username, t.teamLead.username, t.developer.username]),
    );
    expect(res.body.data.find((m: { userId: string }) => m.userId === t.owner.id)).toMatchObject({
      role: 'OWNER',
      status: 'ACTIVE',
    });
  });
});

describe('GET /api/orgs/:orgId/repos', () => {
  it('401 without a token', async () => {
    const t = await seedTenant('acme');
    const res = await api().get(`/api/orgs/${t.org.id}/repos`);
    expect(res.status).toBe(401);
  });

  it('404 for a non-member', async () => {
    const t = await seedTenant('acme');
    const stranger = await createUser();
    const res = await api().get(`/api/orgs/${t.org.id}/repos`).set(bearer(stranger));
    expect(res.status).toBe(404);
  });

  it('org membership alone shows nothing — the caller must own or be a member of each repo', async () => {
    const t = await seedTenant('acme');
    const res = await api().get(`/api/orgs/${t.org.id}/repos`).set(bearer(t.bystander));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('shows owned and member repos with the latest snapshot, excluding inactive ones', async () => {
    const t = await seedTenant('acme');
    const other = await createRepo(t.org, t.admin, { name: 'other' });
    await addRepoMember(other, t.developer, 'VIEWER');
    await createRepo(t.org, t.developer, { name: 'unlinked', isActive: false });

    const res = await api().get(`/api/orgs/${t.org.id}/repos`).set(bearer(t.developer));

    expect(res.status).toBe(200);
    expect(res.body.data.map((r: { name: string }) => r.name)).toEqual([t.repo.name, 'other']);
    const main = res.body.data.find((r: { id: string }) => r.id === t.repo.id);
    expect(main).toMatchObject({
      orgId: t.org.id,
      healthScore: t.snapshot.healthScore,
      openFindings: t.snapshot.totalIssues,
      debtMinutes: t.snapshot.debtMinutes,
    });
    expect(main.lastAnalyzedAt).toBe(t.snapshot.calculatedAt.toISOString());
  });

  it('flags repos whose latest analysis is still queued or running', async () => {
    const t = await seedTenant('acme');
    const fresh = await createRepo(t.org, t.owner, { name: 'fresh' });
    await createAnalysisJob(fresh, { status: 'PENDING', startedAt: null, completedAt: null });

    const res = await api().get(`/api/orgs/${t.org.id}/repos`).set(bearer(t.owner));

    const byName = (name: string) => res.body.data.find((r: { name: string }) => r.name === name);
    expect(byName('fresh').analysisInProgress).toBe(true);
    expect(byName(t.repo.name).analysisInProgress).toBe(false);
  });
});

describe('POST /api/orgs/:orgId/repos/bulk-link', () => {
  it('401 without a token', async () => {
    const t = await seedTenant('acme');
    const res = await api().post(`/api/orgs/${t.org.id}/repos/bulk-link`).send({ githubRepoIds: [1] });
    expect(res.status).toBe(401);
  });

  it('400 for an empty list, a non-numeric id, or more than 200 ids', async () => {
    const t = await seedTenant('acme');
    const url = `/api/orgs/${t.org.id}/repos/bulk-link`;

    const empty = await api().post(url).send({ githubRepoIds: [] }).set(bearer(t.owner));
    expect(empty.status).toBe(400);
    expect(empty.body.errors[0].path).toBe('body.githubRepoIds');

    const bad = await api().post(url).send({ githubRepoIds: ['abc'] }).set(bearer(t.owner));
    expect(bad.status).toBe(400);

    const tooMany = await api()
      .post(url)
      .send({ githubRepoIds: Array.from({ length: 201 }, (_, i) => i + 1) })
      .set(bearer(t.owner));
    expect(tooMany.status).toBe(400);
  });

  it('404 for a non-member', async () => {
    const t = await seedTenant('acme');
    const stranger = await createUser();
    const res = await api()
      .post(`/api/orgs/${t.org.id}/repos/bulk-link`)
      .send({ githubRepoIds: [1] })
      .set(bearer(stranger));
    expect(res.status).toBe(404);
  });

  it('202 for any active member; queues one deduplicated job', async () => {
    const t = await seedTenant('acme');
    const res = await api()
      .post(`/api/orgs/${t.org.id}/repos/bulk-link`)
      .send({ githubRepoIds: [11, '22', 11] })
      .set(bearer(t.developer));

    expect(res.status).toBe(202);
    expect(res.body).toEqual({ message: 'Bulk link queued', jobId: expect.any(String), total: 2 });

    const job = await bulkLinkQueue.getJob(res.body.jobId);
    expect(job?.data).toEqual({ userId: t.developer.id, orgId: t.org.id, githubRepoIds: [11, 22] });
  });
});

describe('GET /api/orgs/:orgId/repos/bulk-link/:jobId', () => {
  it('401 without a token', async () => {
    const t = await seedTenant('acme');
    const res = await api().get(`/api/orgs/${t.org.id}/repos/bulk-link/${t.bulkLinkJobId}`);
    expect(res.status).toBe(401);
  });

  it('404 for a non-member', async () => {
    const t = await seedTenant('acme');
    const stranger = await createUser();
    const res = await api().get(`/api/orgs/${t.org.id}/repos/bulk-link/${t.bulkLinkJobId}`).set(bearer(stranger));
    expect(res.status).toBe(404);
  });

  it('404 for an unknown job id', async () => {
    const t = await seedTenant('acme');
    const res = await api().get(`/api/orgs/${t.org.id}/repos/bulk-link/999999`).set(bearer(t.owner));
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Bulk link job not found');
  });

  it("404 for another org's job, even for a member of the org in the URL", async () => {
    const a = await seedTenant('acme');
    const b = await seedTenant('globex');
    // guessing another org's job id
    const res = await api().get(`/api/orgs/${a.org.id}/repos/bulk-link/${b.bulkLinkJobId}`).set(bearer(a.owner));
    expect(res.status).toBe(404);
  });

  it('reports a queued job with zero progress and no results yet', async () => {
    const t = await seedTenant('acme');
    const res = await api().get(`/api/orgs/${t.org.id}/repos/bulk-link/${t.bulkLinkJobId}`).set(bearer(t.developer));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      jobId: t.bulkLinkJobId,
      state: 'waiting',
      progress: { done: 0, total: 2 },
      results: null,
      summary: null,
      failedReason: null,
    });
  });
});
