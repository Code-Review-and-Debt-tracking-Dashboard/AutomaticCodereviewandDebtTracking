import { prisma } from '@codehealth/db';
import { describe, expect, it } from 'vitest';

import { analysisQueue } from '../../src/lib/queue';
import { api } from '../helpers/app';
import { bearer } from '../helpers/auth';
import {
  addRepoMember,
  createAnalysisJob,
  createFinding,
  createPullRequest,
  createRepo,
  createSnapshot,
  createUser,
} from '../helpers/factories';
import { seedTenant } from '../helpers/tenants';

describe('GET /api/repos/available', () => {
  it('401 without a token', async () => {
    const res = await api().get('/api/repos/available');
    expect(res.status).toBe(401);
  });

  it('400 for a blank orgId filter', async () => {
    const user = await createUser();
    const res = await api().get('/api/repos/available').query({ orgId: ' ' }).set(bearer(user));
    expect(res.status).toBe(400);
  });

  // Listing calls GitHub; without a stored credential it stops before that.
  it('401 when the user has no GitHub credential on file', async () => {
    const user = await createUser();
    const res = await api().get('/api/repos/available').set(bearer(user));
    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/No GitHub credential/);
  });
});

describe('POST /api/repos', () => {
  it('401 without a token', async () => {
    const res = await api().post('/api/repos').send({ githubRepoId: 1 });
    expect(res.status).toBe(401);
  });

  // The route applies no body validation (linkRepositorySchema is imported
  // but unused), so a missing id reaches the service and fails on the
  // credential lookup first. Asserting current behaviour.
  it('401 without a GitHub credential, even for a bad body', async () => {
    const user = await createUser();
    const res = await api().post('/api/repos').send({}).set(bearer(user));
    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/No GitHub credential/);
  });
});

describe('GET /api/repos/:repoId', () => {
  it('401 without a token', async () => {
    const t = await seedTenant('acme');
    const res = await api().get(`/api/repos/${t.repo.id}`);
    expect(res.status).toBe(401);
  });

  it('400 for a blank id', async () => {
    const t = await seedTenant('acme');
    const res = await api().get('/api/repos/%20').set(bearer(t.owner));
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ status: 'error', message: 'Validation failed' });
  });

  it('404 for an unknown repo', async () => {
    const t = await seedTenant('acme');
    const res = await api().get('/api/repos/nope').set(bearer(t.owner));
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Repository not found' } });
  });

  it('404 for an unlinked (inactive) repo, even for its owner', async () => {
    const t = await seedTenant('acme');
    const inactive = await createRepo(t.org, t.owner, { isActive: false });
    const res = await api().get(`/api/repos/${inactive.id}`).set(bearer(t.owner));
    expect(res.status).toBe(404);
  });

  it('403 for an org member with no repo membership', async () => {
    const t = await seedTenant('acme');
    const res = await api().get(`/api/repos/${t.repo.id}`).set(bearer(t.bystander));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('403 for a REMOVED repo member', async () => {
    const t = await seedTenant('acme');
    await prisma.repositoryMember.update({
      where: { userId_repoId: { userId: t.developer.id, repoId: t.repo.id } },
      data: { status: 'REMOVED' },
    });
    const res = await api().get(`/api/repos/${t.repo.id}`).set(bearer(t.developer));
    expect(res.status).toBe(403);
  });

  it.each([
    ['repo owner', (t: Awaited<ReturnType<typeof seedTenant>>) => t.owner],
    ['org ADMIN with no repo membership', (t: Awaited<ReturnType<typeof seedTenant>>) => t.admin],
    ['repo DEVELOPER', (t: Awaited<ReturnType<typeof seedTenant>>) => t.developer],
  ])('200 for the %s with the latest snapshot folded in', async (_who, pick) => {
    const t = await seedTenant('acme');
    const res = await api().get(`/api/repos/${t.repo.id}`).set(bearer(pick(t)));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: t.repo.id,
      name: t.repo.name,
      fullName: t.repo.fullName,
      orgId: t.org.id,
      ownerId: t.owner.id,
      healthScore: t.snapshot.healthScore,
      openFindings: t.snapshot.totalIssues,
      debtMinutes: t.snapshot.debtMinutes,
      lastAnalyzedAt: t.snapshot.calculatedAt.toISOString(),
    });
  });

  it('falls back to defaults when the repo has never been analysed', async () => {
    const t = await seedTenant('acme');
    const fresh = await createRepo(t.org, t.owner);
    const res = await api().get(`/api/repos/${fresh.id}`).set(bearer(t.owner));
    expect(res.body).toMatchObject({ healthScore: 80, openFindings: 0, debtMinutes: 0, lastAnalyzedAt: null });
  });
});

describe('DELETE /api/repos/:repoId', () => {
  it('401 without a token', async () => {
    const t = await seedTenant('acme');
    const res = await api().delete(`/api/repos/${t.repo.id}`);
    expect(res.status).toBe(401);
  });

  it('403 for a DEVELOPER', async () => {
    const t = await seedTenant('acme');
    const res = await api().delete(`/api/repos/${t.repo.id}`).set(bearer(t.developer));
    expect(res.status).toBe(403);
  });

  it('403 for a TEAM_LEAD — write access is not enough to unlink', async () => {
    const t = await seedTenant('acme');
    const res = await api().delete(`/api/repos/${t.repo.id}`).set(bearer(t.teamLead));
    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/owner or an organization admin/);
  });

  it('soft-deletes for the owner and the repo disappears from every read', async () => {
    const t = await seedTenant('acme');
    const res = await api().delete(`/api/repos/${t.repo.id}`).set(bearer(t.owner));
    expect(res.status).toBe(204);

    const row = await prisma.repository.findUnique({ where: { id: t.repo.id } });
    expect(row).toMatchObject({ isActive: false, webhookId: null });

    const read = await api().get(`/api/repos/${t.repo.id}`).set(bearer(t.owner));
    expect(read.status).toBe(404);
    const snapshots = await prisma.healthSnapshot.count({ where: { repoId: t.repo.id } });
    expect(snapshots).toBe(1);
  });

  it('org ADMIN can unlink, and a failed GitHub hook removal keeps webhookId for cleanup', async () => {
    const t = await seedTenant('acme');
    await prisma.repository.update({ where: { id: t.repo.id }, data: { webhookId: 'hook-123' } });

    // admin has no GitHub credential → the hook delete fails with a non-404
    const res = await api().delete(`/api/repos/${t.repo.id}`).set(bearer(t.admin));
    expect(res.status).toBe(204);

    const row = await prisma.repository.findUnique({ where: { id: t.repo.id } });
    expect(row).toMatchObject({ isActive: false, webhookId: 'hook-123' });
  });

  it('404 when already unlinked', async () => {
    const t = await seedTenant('acme');
    await api().delete(`/api/repos/${t.repo.id}`).set(bearer(t.owner));
    const res = await api().delete(`/api/repos/${t.repo.id}`).set(bearer(t.owner));
    expect(res.status).toBe(404);
  });
});

describe('GET /api/repos/:repoId/trend', () => {
  it('401 without a token', async () => {
    const t = await seedTenant('acme');
    const res = await api().get(`/api/repos/${t.repo.id}/trend`);
    expect(res.status).toBe(401);
  });

  it('403 for a bystander', async () => {
    const t = await seedTenant('acme');
    const res = await api().get(`/api/repos/${t.repo.id}/trend`).set(bearer(t.bystander));
    expect(res.status).toBe(403);
  });

  it('defaults to the last 30 days, oldest first', async () => {
    const t = await seedTenant('acme');
    const old = await createSnapshot(t.repo, { healthScore: 50, calculatedAt: new Date(Date.now() - 40 * 86_400_000) });
    const recent = await createSnapshot(t.repo, { healthScore: 90, calculatedAt: new Date(Date.now() - 86_400_000) });

    const res = await api().get(`/api/repos/${t.repo.id}/trend`).set(bearer(t.developer));

    expect(res.status).toBe(200);
    expect(res.body.repoId).toBe(t.repo.id);
    const ids = res.body.dataPoints.map((p: { snapshotId: string }) => p.snapshotId);
    expect(ids).toEqual([recent.id, t.snapshot.id]);
    expect(ids).not.toContain(old.id);
    expect(res.body.dataPoints[0]).toMatchObject({ healthScore: 90, debtMinutes: 120, totalIssues: 3 });
  });

  it('honours days=', async () => {
    const t = await seedTenant('acme');
    await createSnapshot(t.repo, { calculatedAt: new Date(Date.now() - 40 * 86_400_000) });
    const res = await api().get(`/api/repos/${t.repo.id}/trend`).query({ days: '60' }).set(bearer(t.owner));
    expect(res.body.dataPoints).toHaveLength(2);
  });

  it('400 when days is out of range', async () => {
    const t = await seedTenant('acme');
    const res = await api().get(`/api/repos/${t.repo.id}/trend`).query({ days: '0' }).set(bearer(t.owner));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('400 when from is given without to', async () => {
    const t = await seedTenant('acme');
    const res = await api()
      .get(`/api/repos/${t.repo.id}/trend`)
      .query({ from: new Date().toISOString() })
      .set(bearer(t.owner));
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/together/);
  });

  it('400 when from is after to', async () => {
    const t = await seedTenant('acme');
    const res = await api()
      .get(`/api/repos/${t.repo.id}/trend`)
      .query({ from: '2026-02-01T00:00:00.000Z', to: '2026-01-01T00:00:00.000Z' })
      .set(bearer(t.owner));
    expect(res.status).toBe(400);
  });
});

describe('GET /api/repos/:repoId/members', () => {
  it('401 without a token', async () => {
    const t = await seedTenant('acme');
    const res = await api().get(`/api/repos/${t.repo.id}/members`);
    expect(res.status).toBe(401);
  });

  it('lists active members only; the owner is not a member row', async () => {
    const t = await seedTenant('acme');
    const removed = await createUser();
    await addRepoMember(t.repo, removed, 'VIEWER', 'REMOVED');

    const res = await api().get(`/api/repos/${t.repo.id}/members`).set(bearer(t.developer));

    expect(res.status).toBe(200);
    const ids = res.body.data.map((m: { userId: string }) => m.userId);
    expect(ids).toEqual([t.teamLead.id, t.developer.id]);
    expect(res.body.data[0]).toMatchObject({ username: t.teamLead.username, role: 'TEAM_LEAD', status: 'ACTIVE' });
  });
});

describe('GET /api/repos/:repoId/debt', () => {
  it('401 without a token', async () => {
    const t = await seedTenant('acme');
    const res = await api().get(`/api/repos/${t.repo.id}/debt`);
    expect(res.status).toBe(401);
  });

  it('404 when the repo has no snapshot', async () => {
    const t = await seedTenant('acme');
    const fresh = await createRepo(t.org, t.owner);
    const res = await api().get(`/api/repos/${fresh.id}/debt`).set(bearer(t.owner));
    expect(res.status).toBe(404);
    expect(res.body.error.message).toMatch(/No analysis/);
  });

  it('breaks the latest snapshot down by category with zeroed defaults', async () => {
    const t = await seedTenant('acme');
    await createFinding(t.snapshot, { category: 'VULNERABILITY', debtMinutes: 30 });
    await createFinding(t.snapshot, { category: 'VULNERABILITY', debtMinutes: 20 });

    const res = await api().get(`/api/repos/${t.repo.id}/debt`).set(bearer(t.developer));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      totalDebtMinutes: t.snapshot.debtMinutes,
      snapshotId: t.snapshot.id,
      breakdown: {
        vulnerability: { count: 2, debtMinutes: 50 },
        code_smell: { count: 1, debtMinutes: 5 },
        complexity: { count: 0, debtMinutes: 0 },
        duplication: { count: 0, debtMinutes: 0 },
        maintainability: { count: 0, debtMinutes: 0 },
      },
    });
  });
});

describe('GET /api/repos/:repoId/hotspots', () => {
  it('401 without a token', async () => {
    const t = await seedTenant('acme');
    const res = await api().get(`/api/repos/${t.repo.id}/hotspots`);
    expect(res.status).toBe(401);
  });

  // No zod query schema on this route (hotspotsQuerySchema is applied to
  // /trend instead), so both come back from the service's own check.
  it('400 for a non-numeric or out-of-range limit', async () => {
    const t = await seedTenant('acme');
    for (const limit of ['ten', '0', '101']) {
      const res = await api().get(`/api/repos/${t.repo.id}/hotspots`).query({ limit }).set(bearer(t.owner));
      expect(res.status, `limit=${limit}`).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it("404 for a snapshotId that belongs to another repo", async () => {
    const t = await seedTenant('acme');
    const other = await createRepo(t.org, t.owner);
    const foreign = await createSnapshot(other);
    const res = await api()
      .get(`/api/repos/${t.repo.id}/hotspots`)
      .query({ snapshotId: foreign.id })
      .set(bearer(t.owner));
    expect(res.status).toBe(404);
  });

  it('ranks files by finding count with a severity breakdown', async () => {
    const t = await seedTenant('acme');
    await createFinding(t.snapshot, { file: 'src/hot.ts', severity: 'CRITICAL', state: 'NEW' });
    await createFinding(t.snapshot, { file: 'src/hot.ts', severity: 'LOW', state: 'EXISTING' });

    const res = await api().get(`/api/repos/${t.repo.id}/hotspots`).query({ limit: '1' }).set(bearer(t.owner));

    expect(res.status).toBe(200);
    expect(res.body.snapshotId).toBe(t.snapshot.id);
    expect(res.body.files).toHaveLength(1);
    expect(res.body.files[0]).toMatchObject({
      file: 'src/hot.ts',
      totalFindings: 2,
      newFindings: 1,
      bySeverity: { critical: 1, high: 0, medium: 0, low: 1, info: 0 },
      debtMinutes: 10,
    });
  });
});

describe('GET /api/repos/:repoId/analyses', () => {
  it('401 without a token', async () => {
    const t = await seedTenant('acme');
    const res = await api().get(`/api/repos/${t.repo.id}/analyses`);
    expect(res.status).toBe(401);
  });

  it('403 for a bystander', async () => {
    const t = await seedTenant('acme');
    const res = await api().get(`/api/repos/${t.repo.id}/analyses`).set(bearer(t.bystander));
    expect(res.status).toBe(403);
  });

  it('lists the latest jobs newest first, with the failure reason', async () => {
    const t = await seedTenant('acme');
    const failed = await createAnalysisJob(t.repo, {
      status: 'FAILED',
      trigger: 'MANUAL',
      errorMessage: 'clone: repository not found',
      queuedAt: new Date(Date.now() + 1_000),
    });

    const res = await api().get(`/api/repos/${t.repo.id}/analyses`).set(bearer(t.developer));

    expect(res.status).toBe(200);
    expect(res.body.data.map((j: { id: string }) => j.id)).toEqual([failed.id, t.snapshot.analysisId]);
    expect(res.body.data[0]).toMatchObject({
      status: 'FAILED',
      trigger: 'MANUAL',
      errorMessage: 'clone: repository not found',
    });
  });
});

describe('GET /api/repos/:repoId/pulls', () => {
  it('401 without a token', async () => {
    const t = await seedTenant('acme');
    const res = await api().get(`/api/repos/${t.repo.id}/pulls`);
    expect(res.status).toBe(401);
  });

  it('lists PRs newest first, pending when unanalysed', async () => {
    const t = await seedTenant('acme');
    const newer = await createPullRequest(t.repo, { title: 'newer' });

    const res = await api().get(`/api/repos/${t.repo.id}/pulls`).set(bearer(t.developer));

    expect(res.status).toBe(200);
    expect(res.body.data.map((p: { title: string }) => p.title)).toEqual(['newer', t.pullRequest.title]);
    expect(res.body.data[0]).toMatchObject({
      id: newer.prNumber,
      author: 'octocat',
      branch: newer.headBranch,
      status: 'Pending',
      htmlUrl: newer.htmlUrl,
    });
  });
});

describe('GET /api/repos/:repoId/pulls/:prNumber', () => {
  it('401 without a token', async () => {
    const t = await seedTenant('acme');
    const res = await api().get(`/api/repos/${t.repo.id}/pulls/${t.pullRequest.prNumber}`);
    expect(res.status).toBe(401);
  });

  it('400 for a non-numeric prNumber', async () => {
    const t = await seedTenant('acme');
    const res = await api().get(`/api/repos/${t.repo.id}/pulls/abc`).set(bearer(t.owner));
    expect(res.status).toBe(400);
  });

  it('404 for an unknown PR number', async () => {
    const t = await seedTenant('acme');
    const res = await api().get(`/api/repos/${t.repo.id}/pulls/999999`).set(bearer(t.owner));
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Pull request not found');
  });

  it('returns the PR with its analysis snapshots', async () => {
    const t = await seedTenant('acme');
    const job = await createAnalysisJob(t.repo, { pullRequestId: t.pullRequest.id });
    const snap = await createSnapshot(t.repo, { healthScore: 77, gateResult: 'FAIL' }, job);
    await createFinding(snap, { state: 'NEW' });
    await createFinding(snap, { state: 'EXISTING' });

    const res = await api().get(`/api/repos/${t.repo.id}/pulls/${t.pullRequest.prNumber}`).set(bearer(t.owner));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: t.pullRequest.id,
      prNumber: t.pullRequest.prNumber,
      status: 'OPEN',
      snapshots: [{ id: snap.id, healthScore: 77, gateResult: 'FAIL', newIssues: 1, status: 'COMPLETED' }],
    });
  });
});

describe('POST /api/repos/:repoId/analyze', () => {
  it('401 without a token', async () => {
    const t = await seedTenant('acme');
    const res = await api().post(`/api/repos/${t.repo.id}/analyze`);
    expect(res.status).toBe(401);
  });

  it('403 for a DEVELOPER', async () => {
    const t = await seedTenant('acme');
    const res = await api().post(`/api/repos/${t.repo.id}/analyze`).set(bearer(t.developer));
    expect(res.status).toBe(403);
  });

  it('202 for the owner: records a MANUAL job and puts it on the queue', async () => {
    const t = await seedTenant('acme');
    const res = await api().post(`/api/repos/${t.repo.id}/analyze`).set(bearer(t.owner));

    expect(res.status).toBe(202);
    expect(res.body).toMatchObject({ message: 'Analysis queued', analysisId: expect.any(String), jobId: expect.any(String) });

    const job = await prisma.analysisJob.findUnique({ where: { id: res.body.analysisId } });
    expect(job).toMatchObject({
      repoId: t.repo.id,
      trigger: 'MANUAL',
      status: 'PENDING',
      branch: t.repo.defaultBranch,
      commitSha: 'HEAD',
      bullJobId: res.body.jobId,
      pullRequestId: null,
    });

    const queued = await analysisQueue.getJob(res.body.jobId);
    expect(queued?.data).toMatchObject({ analysisId: job!.id, repoId: t.repo.id, branch: t.repo.defaultBranch });
  });

  // Deliberately narrower than the route's write guard: triggering an analysis
  // is limited to the repo owner and org managers.
  it('403 for a TEAM_LEAD', async () => {
    const t = await seedTenant('acme');
    const res = await api().post(`/api/repos/${t.repo.id}/analyze`).set(bearer(t.teamLead));
    expect(res.status).toBe(403);
    // the route's middleware lets a TEAM_LEAD through, so this is the service
    expect(res.body.error.message).toMatch(/owner or an organization admin/);
  });

  it('429 while an analysis of the same repo is still running', async () => {
    const t = await seedTenant('acme');

    const first = await api().post(`/api/repos/${t.repo.id}/analyze`).set(bearer(t.owner));
    expect(first.status).toBe(202);

    const second = await api().post(`/api/repos/${t.repo.id}/analyze`).set(bearer(t.owner));
    expect(second.status).toBe(429);
    expect(second.body.error).toMatchObject({ code: 'RATE_LIMITED', message: /already in progress/ });
  });

  it('a job left unfinished past the stale window stops blocking', async () => {
    const t = await seedTenant('acme');

    const first = await api().post(`/api/repos/${t.repo.id}/analyze`).set(bearer(t.owner));
    expect(first.status).toBe(202);

    await prisma.analysisJob.update({
      where: { id: first.body.analysisId },
      data: { queuedAt: new Date(Date.now() - 16 * 60 * 1000) },
    });

    const second = await api().post(`/api/repos/${t.repo.id}/analyze`).set(bearer(t.owner));
    expect(second.status).toBe(202);
  });

  it('429 after 5 triggers by the same user', async () => {
    const t = await seedTenant('acme');

    // Each job is completed before the next trigger, so it is the rate limiter
    // that rejects the sixth, not the in-progress guard.
    for (let i = 0; i < 5; i++) {
      const ok = await api().post(`/api/repos/${t.repo.id}/analyze`).set(bearer(t.owner));
      expect(ok.status).toBe(202);
      await prisma.analysisJob.update({
        where: { id: ok.body.analysisId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
    }

    const limited = await api().post(`/api/repos/${t.repo.id}/analyze`).set(bearer(t.owner));
    expect(limited.status).toBe(429);
    expect(limited.body.error).toMatchObject({ code: 'RATE_LIMITED', message: 'Too many requests, try again later' });
  });
});

describe('POST /api/repos/:repoId/members', () => {
  it('401 without a token', async () => {
    const t = await seedTenant('acme');
    const res = await api().post(`/api/repos/${t.repo.id}/members`).send({ username: 'x' });
    expect(res.status).toBe(401);
  });

  it('403 for a DEVELOPER', async () => {
    const t = await seedTenant('acme');
    const res = await api()
      .post(`/api/repos/${t.repo.id}/members`)
      .send({ username: t.bystander.username })
      .set(bearer(t.developer));
    expect(res.status).toBe(403);
  });

  it('400 for a missing username or an unknown role', async () => {
    const t = await seedTenant('acme');
    const noName = await api().post(`/api/repos/${t.repo.id}/members`).send({}).set(bearer(t.owner));
    expect(noName.status).toBe(400);
    expect(noName.body.errors[0].path).toBe('body.username');

    const badRole = await api()
      .post(`/api/repos/${t.repo.id}/members`)
      .send({ username: t.bystander.username, role: 'GOD' })
      .set(bearer(t.owner));
    expect(badRole.status).toBe(400);
  });

  it('404 for a user who is not in the repo org', async () => {
    const t = await seedTenant('acme');
    const stranger = await createUser();
    const res = await api()
      .post(`/api/repos/${t.repo.id}/members`)
      .send({ username: stranger.username })
      .set(bearer(t.owner));
    expect(res.status).toBe(404);
  });

  it('201 for the owner, defaulting the role to DEVELOPER', async () => {
    const t = await seedTenant('acme');
    const res = await api()
      .post(`/api/repos/${t.repo.id}/members`)
      .send({ username: t.bystander.username })
      .set(bearer(t.owner));

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ userId: t.bystander.id, username: t.bystander.username, role: 'DEVELOPER', status: 'ACTIVE' });

    const read = await api().get(`/api/repos/${t.repo.id}`).set(bearer(t.bystander));
    expect(read.status).toBe(200);
  });

  it('201 for a TEAM_LEAD with an explicit role', async () => {
    const t = await seedTenant('acme');
    const res = await api()
      .post(`/api/repos/${t.repo.id}/members`)
      .send({ username: t.bystander.username, role: 'VIEWER' })
      .set(bearer(t.teamLead));
    expect(res.status).toBe(201);
    expect(res.body.role).toBe('VIEWER');
  });

  it('409 when already an active member', async () => {
    const t = await seedTenant('acme');
    const res = await api()
      .post(`/api/repos/${t.repo.id}/members`)
      .send({ username: t.developer.username })
      .set(bearer(t.owner));
    expect(res.status).toBe(409);
  });

  it('re-adding a removed member reactivates the row', async () => {
    const t = await seedTenant('acme');
    await api().delete(`/api/repos/${t.repo.id}/members/${t.developer.id}`).set(bearer(t.owner));

    const res = await api()
      .post(`/api/repos/${t.repo.id}/members`)
      .send({ username: t.developer.username, role: 'TEAM_LEAD' })
      .set(bearer(t.owner));

    expect(res.status).toBe(201);
    const rows = await prisma.repositoryMember.count({ where: { repoId: t.repo.id, userId: t.developer.id } });
    expect(rows).toBe(1);
    expect(res.body).toMatchObject({ role: 'TEAM_LEAD', status: 'ACTIVE' });
  });
});

describe('DELETE /api/repos/:repoId/members/:userId', () => {
  it('401 without a token', async () => {
    const t = await seedTenant('acme');
    const res = await api().delete(`/api/repos/${t.repo.id}/members/${t.developer.id}`);
    expect(res.status).toBe(401);
  });

  it('403 for a DEVELOPER', async () => {
    const t = await seedTenant('acme');
    const res = await api().delete(`/api/repos/${t.repo.id}/members/${t.teamLead.id}`).set(bearer(t.developer));
    expect(res.status).toBe(403);
  });

  it('404 for a user who is not a member', async () => {
    const t = await seedTenant('acme');
    const res = await api().delete(`/api/repos/${t.repo.id}/members/${t.bystander.id}`).set(bearer(t.owner));
    expect(res.status).toBe(404);
  });

  it('soft-removes and the member loses access', async () => {
    const t = await seedTenant('acme');
    const res = await api().delete(`/api/repos/${t.repo.id}/members/${t.developer.id}`).set(bearer(t.owner));
    expect(res.status).toBe(204);

    const row = await prisma.repositoryMember.findUnique({
      where: { userId_repoId: { userId: t.developer.id, repoId: t.repo.id } },
    });
    expect(row?.status).toBe('REMOVED');
    expect(row?.removedAt).toBeInstanceOf(Date);

    const read = await api().get(`/api/repos/${t.repo.id}`).set(bearer(t.developer));
    expect(read.status).toBe(403);

    const again = await api().delete(`/api/repos/${t.repo.id}/members/${t.developer.id}`).set(bearer(t.owner));
    expect(again.status).toBe(404);
  });
});
