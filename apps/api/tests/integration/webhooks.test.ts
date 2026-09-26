import { createHmac } from 'crypto';

import { prisma } from '@codehealth/db';
import { describe, expect, it } from 'vitest';

import { analysisQueue } from '../../src/lib/queue';
import { api } from '../helpers/app';
import { createRepo } from '../helpers/factories';
import { seedTenant } from '../helpers/tenants';
import { TEST_WEBHOOK_SECRET } from '../setup/env';

function sign(body: string, secret = TEST_WEBHOOK_SECRET): string {
  return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
}

// Mounted before express.json(), so the body must go over as raw bytes with
// the signature computed over exactly those bytes.
function deliver(event: string, payload: unknown, opts: { secret?: string; rawBody?: string } = {}) {
  const body = opts.rawBody ?? JSON.stringify(payload);
  return api()
    .post('/webhooks/github')
    .set('Content-Type', 'application/json')
    .set('X-GitHub-Event', event)
    .set('X-Hub-Signature-256', sign(body, opts.secret))
    .send(body);
}

const prPayload = (githubRepoId: string, overrides: Record<string, unknown> = {}) => ({
  action: 'opened',
  pull_request: {
    number: 7,
    title: 'Add thing',
    html_url: 'https://github.com/acme-org/acme-repo/pull/7',
    merged: false,
    user: { login: 'octocat' },
    head: { ref: 'feature/thing', sha: 'abc123' },
    base: { ref: 'main' },
  },
  repository: {
    id: Number(githubRepoId.replace(/\D/g, '')),
    full_name: 'acme-org/acme-repo',
    clone_url: 'https://github.com/acme-org/acme-repo.git',
  },
  ...overrides,
});

describe('POST /webhooks/github', () => {
  it('401 without a signature', async () => {
    const res = await api().post('/webhooks/github').set('Content-Type', 'application/json').send('{}');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('401 for a signature made with the wrong secret', async () => {
    const res = await deliver('ping', { zen: 'x' }, { secret: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('401 when the body was altered after signing', async () => {
    const body = JSON.stringify({ zen: 'x' });
    const res = await api()
      .post('/webhooks/github')
      .set('Content-Type', 'application/json')
      .set('X-GitHub-Event', 'ping')
      .set('X-Hub-Signature-256', sign(body))
      .send(body + ' ');
    expect(res.status).toBe(401);
  });

  it('answers ping', async () => {
    const res = await deliver('ping', { zen: 'Keep it logically awesome.' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'pong' });
  });

  it('400 for an unsupported event', async () => {
    const res = await deliver('issues', { action: 'opened' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/Unsupported event: issues/);
  });

  it('400 for malformed JSON that is correctly signed', async () => {
    const res = await deliver('pull_request', null, { rawBody: '{not json' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/invalid JSON/);
  });

  it('400 for a pull_request payload missing fields', async () => {
    const res = await deliver('pull_request', { action: 'opened', pull_request: {} });
    expect(res.status).toBe(400);
  });

  describe('push', () => {
    const pushPayload = (id: number, overrides: Record<string, unknown> = {}) => ({
      ref: 'refs/heads/main',
      after: 'deadbeef',
      deleted: false,
      repository: { id, clone_url: 'https://github.com/acme-org/acme-repo.git' },
      ...overrides,
    });

    it('404 for a repo that is not linked', async () => {
      const res = await deliver('push', pushPayload(999999));
      expect(res.status).toBe(404);
      expect(res.body.error.message).toBe('Repository not linked');
    });

    it('404 for an unlinked (inactive) repo', async () => {
      const t = await seedTenant('acme');
      const inactive = await createRepo(t.org, t.owner, { githubRepoId: '424242', isActive: false });
      const res = await deliver('push', pushPayload(Number(inactive.githubRepoId)));
      expect(res.status).toBe(404);
    });

    it('400 for a branch deletion or a tag push', async () => {
      const t = await seedTenant('acme');
      await prisma.repository.update({ where: { id: t.repo.id }, data: { githubRepoId: '1001' } });
      const del = await deliver('push', pushPayload(1001, { deleted: true }));
      expect(del.status).toBe(400);
      const tag = await deliver('push', pushPayload(1001, { ref: 'refs/tags/v1' }));
      expect(tag.status).toBe(400);
    });

    it('202 queues a WEBHOOK analysis for a linked repo', async () => {
      const t = await seedTenant('acme');
      await prisma.repository.update({ where: { id: t.repo.id }, data: { githubRepoId: '1002' } });

      const res = await deliver('push', pushPayload(1002, { ref: 'refs/heads/develop' }));

      expect(res.status).toBe(202);
      expect(res.body).toMatchObject({ message: 'Push analysis queued', analysisId: expect.any(String), jobId: expect.any(String) });

      const job = await prisma.analysisJob.findUnique({ where: { id: res.body.analysisId } });
      expect(job).toMatchObject({
        repoId: t.repo.id,
        trigger: 'WEBHOOK',
        branch: 'develop',
        commitSha: 'deadbeef',
        bullJobId: res.body.jobId,
        pullRequestId: null,
      });

      const queued = await analysisQueue.getJob(res.body.jobId);
      expect(queued?.data).toMatchObject({ analysisId: job!.id, repoId: t.repo.id, branch: 'develop', prNumber: null });
    });
  });

  describe('pull_request', () => {
    it('404 for a repo that is not linked', async () => {
      const res = await deliver('pull_request', prPayload('999999'));
      expect(res.status).toBe(404);
    });

    it('opened: upserts the PR and queues an analysis', async () => {
      const t = await seedTenant('acme');
      await prisma.repository.update({ where: { id: t.repo.id }, data: { githubRepoId: '2001' } });

      const res = await deliver('pull_request', prPayload('2001'));

      expect(res.status).toBe(202);
      expect(res.body.message).toBe('Job queued');

      const pr = await prisma.pullRequest.findUnique({ where: { repoId_prNumber: { repoId: t.repo.id, prNumber: 7 } } });
      expect(pr).toMatchObject({ title: 'Add thing', status: 'OPEN', headSha: 'abc123', authorLogin: 'octocat' });

      const job = await prisma.analysisJob.findUnique({ where: { id: res.body.analysisId } });
      expect(job).toMatchObject({ pullRequestId: pr!.id, branch: 'feature/thing', commitSha: 'abc123' });

      const queued = await analysisQueue.getJob(res.body.jobId);
      expect(queued?.data.prNumber).toBe(7);
    });

    it('synchronize: updates the existing PR row instead of creating another', async () => {
      const t = await seedTenant('acme');
      await prisma.repository.update({ where: { id: t.repo.id }, data: { githubRepoId: '2002' } });
      await deliver('pull_request', prPayload('2002'));

      const res = await deliver(
        'pull_request',
        prPayload('2002', {
          action: 'synchronize',
          pull_request: { ...prPayload('2002').pull_request, title: 'Renamed', head: { ref: 'feature/thing', sha: 'def456' } },
        }),
      );

      expect(res.status).toBe(202);
      const rows = await prisma.pullRequest.findMany({ where: { repoId: t.repo.id, prNumber: 7 } });
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ title: 'Renamed', headSha: 'def456' });
    });

    it('closed: records MERGED/CLOSED and queues nothing', async () => {
      const t = await seedTenant('acme');
      await prisma.repository.update({ where: { id: t.repo.id }, data: { githubRepoId: '2003' } });
      const jobsBefore = await prisma.analysisJob.count();

      const res = await deliver(
        'pull_request',
        prPayload('2003', { action: 'closed', pull_request: { ...prPayload('2003').pull_request, merged: true } }),
      );

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: 'Pull request closed' });
      const pr = await prisma.pullRequest.findUnique({ where: { repoId_prNumber: { repoId: t.repo.id, prNumber: 7 } } });
      expect(pr?.status).toBe('MERGED');
      expect(await prisma.analysisJob.count()).toBe(jobsBefore);
    });

    it('ignores actions it does not handle without touching the database', async () => {
      const t = await seedTenant('acme');
      await prisma.repository.update({ where: { id: t.repo.id }, data: { githubRepoId: '2004' } });

      const res = await deliver('pull_request', prPayload('2004', { action: 'labeled' }));

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: 'Ignored action', action: 'labeled' });
      expect(await prisma.pullRequest.count({ where: { repoId: t.repo.id, prNumber: 7 } })).toBe(0);
    });
  });
});
