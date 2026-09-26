import {
  prisma,
  type AnalysisJob,
  type NotificationType,
  type Organization,
  type Repository,
  type User,
} from '@codehealth/db';
import type { AnalysisResultsPayload, SnapshotMetrics } from '@codehealth/shared';
import crypto from 'crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { analysisQueue } from '../../src/lib/queue';
import { api } from '../helpers/app';
import {
  addRepoMember,
  createAnalysisJob,
  createDevice,
  createFinding,
  createOrg,
  createPullRequest,
  createQualityGate,
  createRepo,
  createSnapshot,
  createUser,
} from '../helpers/factories';

async function createAgent(org: Organization, token: string, revoked = false) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  await prisma.agent.create({
    data: { tokenHash, orgId: org.id, revokedAt: revoked ? new Date() : null },
  });
  return { authorization: `Bearer ${token}` };
}

// no orgId = serves every org
async function createPlatformAgent(token: string) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  await prisma.agent.create({ data: { tokenHash, orgId: null } });
  return { authorization: `Bearer ${token}` };
}

function results(analysisId: string, overrides: Partial<AnalysisResultsPayload> = {}): AnalysisResultsPayload {
  return {
    analysisId,
    commitSha: 'realsha123',
    metrics: {
      healthScore: 71.5,
      debtMinutes: 240,
      debtDeltaMinutes: -35,
      vulnerabilityCount: 2,
      criticalCount: 1,
      highCount: 1,
      mediumCount: 3,
      lowCount: 0,
      complexityCount: 1,
      duplicationCount: 0,
      codeSmellCount: 2,
      maintainabilityCount: 1,
      duplicationPct: 3.5,
      totalIssues: 5,
      linesOfCode: 4200,
      gateResult: 'FAIL',
    },
    findings: [
      {
        file: 'src/auth.ts',
        line: 42,
        endLine: 44,
        column: null,
        endColumn: null,
        severity: 'CRITICAL',
        category: 'VULNERABILITY',
        state: 'EXISTING',
        rule: 'detect-eval-with-expression',
        message: 'eval with a non-literal argument',
        tool: 'eslint',
        debtMinutes: 30,
      },
    ],
    toolVersions: { eslint: '8.57.0' },
    analysisLimited: false,
    ...overrides,
  };
}

describe('agent job endpoints', () => {
  let org: Organization;
  let owner: User;
  let repo: Repository;
  let job: AnalysisJob;
  let auth: { authorization: string };

  beforeEach(async () => {
    owner = await createUser();
    org = await createOrg();
    repo = await createRepo(org, owner);
    job = await createAnalysisJob(repo, { status: 'PENDING', commitSha: 'HEAD' });
    auth = await createAgent(org, 'test-agent-token');
  });

  describe('authentication', () => {
    it('rejects a request with no token', async () => {
      const res = await api().post(`/jobs/${job.id}/results`).send(results(job.id));
      expect(res.status).toBe(401);
    });

    it('rejects an unknown token', async () => {
      const res = await api()
        .post(`/jobs/${job.id}/results`)
        .set({ authorization: 'Bearer nope' })
        .send(results(job.id));
      expect(res.status).toBe(401);
    });

    it('rejects a revoked token', async () => {
      const revoked = await createAgent(org, 'revoked-token', true);
      const res = await api().post(`/jobs/${job.id}/results`).set(revoked).send(results(job.id));
      expect(res.status).toBe(401);
    });
  });

  describe('POST /jobs/:jobId/start', () => {
    it('marks the job running and gives it a lease', async () => {
      const res = await api().post(`/jobs/${job.id}/start`).set(auth);
      expect(res.status).toBe(204);

      const row = await prisma.analysisJob.findUniqueOrThrow({ where: { id: job.id } });
      expect(row.status).toBe('RUNNING');
      expect(row.startedAt).not.toBeNull();
      expect(row.leaseExpiresAt!.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('agent org scoping', () => {
    it("an org-scoped agent cannot reach another org's job", async () => {
      const otherOwner = await createUser();
      const otherOrg = await createOrg();
      const otherRepo = await createRepo(otherOrg, otherOwner);
      const otherJob = await createAnalysisJob(otherRepo, { status: 'PENDING', commitSha: 'HEAD' });

      const res = await api().post(`/jobs/${otherJob.id}/start`).set(auth);

      expect(res.status).toBe(404);
    });

    it('a platform agent can reach jobs in any org', async () => {
      const platform = await createPlatformAgent('platform-token-1');

      const otherOwner = await createUser();
      const otherOrg = await createOrg();
      const otherRepo = await createRepo(otherOrg, otherOwner);
      const otherJob = await createAnalysisJob(otherRepo, { status: 'PENDING', commitSha: 'HEAD' });

      const mine = await api().post(`/jobs/${job.id}/start`).set(platform);
      const theirs = await api().post(`/jobs/${otherJob.id}/start`).set(platform);

      expect(mine.status).toBe(204);
      expect(theirs.status).toBe(204);
    });
  });

  describe('GET /jobs/:jobId/quality-gate', () => {
    it('returns the repo thresholds', async () => {
      await createQualityGate(repo, { minHealthScore: 75, maxCriticalFindings: 0, blockPR: true });

      const res = await api().get(`/jobs/${job.id}/quality-gate`).set(auth);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ minHealthScore: 75, maxCriticalFindings: 0, blockPR: true });
    });

    it('returns 204 when the repo has no gate, so the worker uses its defaults', async () => {
      const res = await api().get(`/jobs/${job.id}/quality-gate`).set(auth);
      expect(res.status).toBe(204);
    });
  });

  describe('GET /jobs/:jobId/baseline', () => {
    const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000);

    it('returns 204 when there is no earlier run to compare against', async () => {
      const res = await api().get(`/jobs/${job.id}/baseline`).set(auth);
      expect(res.status).toBe(204);
    });

    it('compares a push with the latest run on its own branch', async () => {
      await createSnapshot(repo, { healthScore: 60, calculatedAt: hoursAgo(3) });
      const latest = await createSnapshot(repo, { healthScore: 70, calculatedAt: hoursAgo(2) });
      await createFinding(latest, { rule: 'no-eval', debtMinutes: 30 });
      const other = await createAnalysisJob(repo, { branch: 'feature/other' });
      await createSnapshot(repo, { healthScore: 90, calculatedAt: hoursAgo(1) }, other);
      // same branch name but it's a PR, not a push
      const pr = await createPullRequest(repo, { headBranch: 'main', baseBranch: 'release' });
      const prRun = await createAnalysisJob(repo, { branch: 'main', pullRequestId: pr.id });
      await createSnapshot(repo, { healthScore: 95, calculatedAt: hoursAgo(1) }, prRun);

      const res = await api().get(`/jobs/${job.id}/baseline`).set(auth);

      expect(res.status).toBe(200);
      expect(res.body.healthScore).toBe(70);
      expect(res.body.findings).toEqual([
        expect.objectContaining({ rule: 'no-eval', debtMinutes: 30, tool: 'eslint' }),
      ]);
    });

    it('compares a PR with its target branch, not with earlier PR runs', async () => {
      const pr = await createPullRequest(repo, { baseBranch: 'main' });
      const prJob = await createAnalysisJob(repo, {
        status: 'PENDING',
        branch: pr.headBranch,
        pullRequestId: pr.id,
      });
      await createSnapshot(repo, { healthScore: 75, calculatedAt: hoursAgo(2) });
      const earlierPrRun = await createAnalysisJob(repo, { branch: pr.headBranch, pullRequestId: pr.id });
      await createSnapshot(repo, { healthScore: 95, calculatedAt: hoursAgo(1) }, earlierPrRun);

      const res = await api().get(`/jobs/${prJob.id}/baseline`).set(auth);

      expect(res.status).toBe(200);
      expect(res.body.healthScore).toBe(75);
    });
  });

  describe('POST /jobs/:jobId/results', () => {
    it('writes the snapshot, the findings and the job transition', async () => {
      const res = await api().post(`/jobs/${job.id}/results`).set(auth).send(results(job.id));
      expect(res.status).toBe(200);

      const snapshot = await prisma.healthSnapshot.findUniqueOrThrow({
        where: { analysisId: job.id },
        include: { findings: true },
      });

      expect(snapshot.healthScore).toBe(71.5);
      expect(snapshot.debtDeltaMinutes).toBe(-35);
      expect(snapshot.gateResult).toBe('FAIL');
      expect(snapshot.linesOfCode).toBe(4200);
      expect(snapshot.rawMetrics).toEqual({ eslint: '8.57.0', analysisLimited: false });

      expect(snapshot.findings).toHaveLength(1);
      expect(snapshot.findings[0].state).toBe('EXISTING');
      expect(snapshot.findings[0].repoId).toBe(repo.id);

      const row = await prisma.analysisJob.findUniqueOrThrow({ where: { id: job.id } });
      expect(row.status).toBe('COMPLETED');
      expect(row.progress).toBe(100);
      // The queued sha was a placeholder; this is what was checked out.
      expect(row.commitSha).toBe('realsha123');
    });

    it('ignores a second delivery of a run it already stored', async () => {
      const first = await api().post(`/jobs/${job.id}/results`).set(auth).send(results(job.id));
      const second = await api().post(`/jobs/${job.id}/results`).set(auth).send(results(job.id));

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(second.body.snapshotId).toBe(first.body.snapshotId);

      expect(await prisma.healthSnapshot.count({ where: { analysisId: job.id } })).toBe(1);
      expect(await prisma.finding.count({ where: { repoId: repo.id } })).toBe(1);
    });

    it('rejects a payload missing a metric', async () => {
      const payload = results(job.id) as Record<string, any>;
      delete payload.metrics.healthScore;

      const res = await api().post(`/jobs/${job.id}/results`).set(auth).send(payload);
      expect(res.status).toBe(400);
    });

    it('stores a run with thousands of findings', async () => {
      const findings = Array(2000).fill(results(job.id).findings[0]);

      const res = await api().post(`/jobs/${job.id}/results`).set(auth).send(results(job.id, { findings }));
      expect(res.status).toBe(200);
      expect(await prisma.finding.count({ where: { repoId: repo.id } })).toBe(2000);
    });

    it('rejects a body over the size limit with 413, not 500', async () => {
      const finding = { ...results(job.id).findings[0], message: 'x'.repeat(6_000_000) };

      const res = await api().post(`/jobs/${job.id}/results`).set(auth).send(results(job.id, { findings: [finding] }));
      expect(res.status).toBe(413);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('notification creation', () => {
    function metrics(overrides: Partial<SnapshotMetrics> = {}) {
      return { ...results(job.id).metrics, ...overrides };
    }

    // default payload fails the gate
    const quiet = () => ({ metrics: metrics({ gateResult: 'PASS' as const }), findings: [] });

    function ingest(overrides: Partial<AnalysisResultsPayload> = {}) {
      return api().post(`/jobs/${job.id}/results`).set(auth).send(results(job.id, overrides));
    }

    function rows(type?: NotificationType) {
      return prisma.notification.findMany({
        where: { repoId: repo.id, ...(type ? { type } : {}) },
      });
    }

    it('tells the repo owner the gate failed', async () => {
      await ingest();

      const found = await rows('QUALITY_GATE_FAILED');
      expect(found).toHaveLength(1);
      expect(found[0].userId).toBe(owner.id);
      expect(found[0].title).toContain(repo.name);
      expect(found[0].snapshotId).not.toBeNull();
      expect(found[0].readAt).toBeNull();
      expect(found[0].data).toMatchObject({ gateResult: 'FAIL', healthScore: 71.5 });
    });

    it('says nothing about a run that passed the gate with no new criticals', async () => {
      await ingest(quiet());
      expect(await rows()).toHaveLength(0);
    });

    it('reports a drop of more than ten points since the last analysis', async () => {
      await createSnapshot(repo, { healthScore: 90 });
      await ingest({ ...quiet(), metrics: metrics({ gateResult: 'PASS', healthScore: 70 }) });

      const found = await rows('SCORE_DROPPED');
      expect(found).toHaveLength(1);
      expect(found[0].body).toBe('Down 20 points, from 90 to 70.');
    });

    it('ignores a smaller drop', async () => {
      await createSnapshot(repo, { healthScore: 75 });
      await ingest({ ...quiet(), metrics: metrics({ gateResult: 'PASS', healthScore: 70 }) });

      expect(await rows('SCORE_DROPPED')).toHaveLength(0);
    });

    it('has nothing to compare a first analysis against', async () => {
      await ingest({ ...quiet(), metrics: metrics({ gateResult: 'PASS', healthScore: 10 }) });
      expect(await rows('SCORE_DROPPED')).toHaveLength(0);
    });

    it('flags a new critical vulnerability', async () => {
      const finding = { ...results(job.id).findings[0], state: 'NEW' as const };
      await ingest({ ...quiet(), findings: [finding] });

      const found = await rows('CRITICAL_FINDING');
      expect(found).toHaveLength(1);
      expect(found[0].body).toContain('detect-eval-with-expression');
      expect(found[0].data).toMatchObject({ count: 1, file: 'src/auth.ts' });
    });

    it('leaves a critical vulnerability that was already there alone', async () => {
      // The default finding is CRITICAL + VULNERABILITY but EXISTING.
      await ingest({ metrics: metrics({ gateResult: 'PASS' }) });
      expect(await rows('CRITICAL_FINDING')).toHaveLength(0);
    });

    it('notifies the owner and active members once each, and nobody else', async () => {
      const member = await createUser();
      const removed = await createUser();
      await createUser(); // no membership at all
      await addRepoMember(repo, member, 'DEVELOPER', 'ACTIVE');
      await addRepoMember(repo, removed, 'DEVELOPER', 'REMOVED');
      // the owner holding a member row too must not double up
      await addRepoMember(repo, owner, 'TEAM_LEAD', 'ACTIVE');

      await ingest();

      const found = await rows('QUALITY_GATE_FAILED');
      expect(found.map((n) => n.userId).sort()).toEqual([owner.id, member.id].sort());
    });

    it('does not notify twice when the same results arrive again', async () => {
      await ingest();
      await ingest();
      expect(await rows()).toHaveLength(1);
    });

    describe('push', () => {
      afterEach(() => {
        vi.restoreAllMocks();
      });

      it("sends what it notified to the users' phones once the results are stored", async () => {
        const device = await createDevice(owner);
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
          const messages = JSON.parse(String(init?.body)) as unknown[];
          return new Response(JSON.stringify({ data: messages.map(() => ({ status: 'ok', id: 'receipt' })) }));
        });

        const res = await ingest();
        expect(res.status).toBe(200);

        // push is sent after the response
        await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
        const [url, init] = fetchSpy.mock.calls[0];
        expect(String(url)).toBe('https://exp.host/--/api/v2/push/send');
        expect(JSON.parse(String(init?.body))).toEqual([
          expect.objectContaining({
            to: device.expoPushToken,
            title: expect.stringContaining(repo.name),
            data: { type: 'QUALITY_GATE_FAILED', repoId: repo.id },
          }),
        ]);
      });
    });
  });

  describe('POST /jobs/:jobId/fail', () => {
    it('records the stage, the message and the attempt count', async () => {
      const res = await api()
        .post(`/jobs/${job.id}/fail`)
        .set(auth)
        .send({ analysisId: job.id, stage: 'clone', errorMessage: 'repository not found', retryCount: 3 });

      expect(res.status).toBe(200);

      const row = await prisma.analysisJob.findUniqueOrThrow({ where: { id: job.id } });
      expect(row.status).toBe('FAILED');
      expect(row.errorMessage).toBe('clone: repository not found');
      expect(row.retryCount).toBe(3);
    });
  });

  describe('tenant scoping', () => {
    it("an agent cannot touch another org's job", async () => {
      const otherOrg = await createOrg();
      const otherAuth = await createAgent(otherOrg, 'other-org-token');

      const start = await api().post(`/jobs/${job.id}/start`).set(otherAuth);
      const gate = await api().get(`/jobs/${job.id}/quality-gate`).set(otherAuth);
      const baseline = await api().get(`/jobs/${job.id}/baseline`).set(otherAuth);
      const ingest = await api().post(`/jobs/${job.id}/results`).set(otherAuth).send(results(job.id));
      const fail = await api()
        .post(`/jobs/${job.id}/fail`)
        .set(otherAuth)
        .send({ analysisId: job.id, stage: 'clone', errorMessage: 'x', retryCount: 0 });

      expect([start.status, gate.status, baseline.status, ingest.status, fail.status]).toEqual([
        404, 404, 404, 404, 404,
      ]);
      expect(await prisma.healthSnapshot.count({ where: { analysisId: job.id } })).toBe(0);
    });
  });
});

describe('POST /jobs/repos/:repoId/first-analysis', () => {
  let org: Organization;
  let owner: User;
  let repo: Repository;
  let auth: { authorization: string };

  beforeEach(async () => {
    owner = await createUser();
    org = await createOrg();
    repo = await createRepo(org, owner);
    auth = await createAgent(org, 'first-analysis-token');
  });

  it('401 without a token', async () => {
    const res = await api().post(`/jobs/repos/${repo.id}/first-analysis`);
    expect(res.status).toBe(401);
  });

  it('queues a MANUAL run of the default branch for a freshly linked repo', async () => {
    const res = await api().post(`/jobs/repos/${repo.id}/first-analysis`).set(auth);

    expect(res.status).toBe(202);
    const job = await prisma.analysisJob.findUniqueOrThrow({ where: { id: res.body.analysisId } });
    expect(job).toMatchObject({
      repoId: repo.id,
      trigger: 'MANUAL',
      status: 'PENDING',
      branch: repo.defaultBranch,
      commitSha: 'HEAD',
      bullJobId: res.body.jobId,
    });
    expect(await analysisQueue.getJob(res.body.jobId)).toBeTruthy();
  });

  it('skips a repo that already has an analysis, like one being re-linked', async () => {
    await createAnalysisJob(repo, { status: 'COMPLETED' });

    const res = await api().post(`/jobs/repos/${repo.id}/first-analysis`).set(auth);

    expect(res.status).toBe(204);
    expect(await prisma.analysisJob.count({ where: { repoId: repo.id } })).toBe(1);
  });

  it("404 for a repo in another org", async () => {
    const otherRepo = await createRepo(await createOrg(), await createUser());

    const res = await api().post(`/jobs/repos/${otherRepo.id}/first-analysis`).set(auth);

    expect(res.status).toBe(404);
    expect(await prisma.analysisJob.count({ where: { repoId: otherRepo.id } })).toBe(0);
  });
});
