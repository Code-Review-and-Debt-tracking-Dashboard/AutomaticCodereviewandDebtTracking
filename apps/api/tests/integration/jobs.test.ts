import { prisma, type AnalysisJob, type Organization, type Repository } from '@codehealth/db';
import type { AnalysisResultsPayload } from '@codehealth/shared';
import crypto from 'crypto';
import { beforeEach, describe, expect, it } from 'vitest';

import { api } from '../helpers/app';
import { createAnalysisJob, createOrg, createQualityGate, createRepo, createUser } from '../helpers/factories';

// The API stores only the hash, so a test agent is a token plus its hash.
async function createAgent(org: Organization, token: string, revoked = false) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  await prisma.agent.create({
    data: { tokenHash, orgId: org.id, revokedAt: revoked ? new Date() : null },
  });
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
  let repo: Repository;
  let job: AnalysisJob;
  let auth: { authorization: string };

  beforeEach(async () => {
    const owner = await createUser();
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
      const ingest = await api().post(`/jobs/${job.id}/results`).set(otherAuth).send(results(job.id));
      const fail = await api()
        .post(`/jobs/${job.id}/fail`)
        .set(otherAuth)
        .send({ analysisId: job.id, stage: 'clone', errorMessage: 'x', retryCount: 0 });

      expect([start.status, gate.status, ingest.status, fail.status]).toEqual([404, 404, 404, 404]);
      expect(await prisma.healthSnapshot.count({ where: { analysisId: job.id } })).toBe(0);
    });
  });
});
