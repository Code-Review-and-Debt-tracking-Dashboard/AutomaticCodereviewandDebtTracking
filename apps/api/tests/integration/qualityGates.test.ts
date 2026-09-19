import { prisma } from '@codehealth/db';
import { describe, expect, it } from 'vitest';

import { api } from '../helpers/app';
import { bearer } from '../helpers/auth';
import { createRepo } from '../helpers/factories';
import { seedTenant } from '../helpers/tenants';

describe('GET /api/repos/:repoId/quality-gate', () => {
  it('401 without a token', async () => {
    const t = await seedTenant('acme');
    const res = await api().get(`/api/repos/${t.repo.id}/quality-gate`);
    expect(res.status).toBe(401);
  });

  it('403 for a bystander', async () => {
    const t = await seedTenant('acme');
    const res = await api().get(`/api/repos/${t.repo.id}/quality-gate`).set(bearer(t.bystander));
    expect(res.status).toBe(403);
  });

  it('404 for an unknown repo', async () => {
    const t = await seedTenant('acme');
    const res = await api().get('/api/repos/nope/quality-gate').set(bearer(t.owner));
    expect(res.status).toBe(404);
  });

  // Unlike every other :repoId route this one skips repoIdParamsSchema, so
  // a blank id is a 404 from the access check rather than a 400.
  it('a blank id is a 404, not a 400 (no params validation on this route)', async () => {
    const t = await seedTenant('acme');
    const res = await api().get('/api/repos/%20/quality-gate').set(bearer(t.owner));
    expect(res.status).toBe(404);
  });

  it('returns the stored gate', async () => {
    const t = await seedTenant('acme');
    const res = await api().get(`/api/repos/${t.repo.id}/quality-gate`).set(bearer(t.developer));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: t.qualityGate.id, repoId: t.repo.id, minHealthScore: 70, blockPR: true });
  });

  it('returns defaults when none is stored', async () => {
    const t = await seedTenant('acme');
    const fresh = await createRepo(t.org, t.owner);
    const res = await api().get(`/api/repos/${fresh.id}/quality-gate`).set(bearer(t.owner));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      repoId: fresh.id,
      minHealthScore: 60,
      maxCriticalFindings: null,
      maxVulnerabilities: null,
      maxDuplicationPct: null,
      maxComplexityCount: null,
      maxCodeSmellCount: null,
      blockPR: false,
    });
  });
});

describe('PUT /api/repos/:repoId/quality-gate', () => {
  it('401 without a token', async () => {
    const t = await seedTenant('acme');
    const res = await api().put(`/api/repos/${t.repo.id}/quality-gate`).send({});
    expect(res.status).toBe(401);
  });

  it('403 for a DEVELOPER', async () => {
    const t = await seedTenant('acme');
    const res = await api().put(`/api/repos/${t.repo.id}/quality-gate`).send({ minHealthScore: 50 }).set(bearer(t.developer));
    expect(res.status).toBe(403);
  });

  it('400 when minHealthScore is out of range or a field has the wrong type', async () => {
    const t = await seedTenant('acme');
    const range = await api().put(`/api/repos/${t.repo.id}/quality-gate`).send({ minHealthScore: 101 }).set(bearer(t.owner));
    expect(range.status).toBe(400);
    expect(range.body.errors[0].path).toBe('body.minHealthScore');

    const type = await api().put(`/api/repos/${t.repo.id}/quality-gate`).send({ blockPR: 'yes' }).set(bearer(t.owner));
    expect(type.status).toBe(400);
  });

  it('updates an existing gate for a TEAM_LEAD, nulling omitted thresholds', async () => {
    const t = await seedTenant('acme');
    const res = await api()
      .put(`/api/repos/${t.repo.id}/quality-gate`)
      .send({ minHealthScore: 85, maxCriticalFindings: 0, blockPR: false })
      .set(bearer(t.teamLead));

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: t.qualityGate.id,
      minHealthScore: 85,
      maxCriticalFindings: 0,
      maxVulnerabilities: null,
      blockPR: false,
    });
  });

  it('creates the gate on first write with defaults for an empty body', async () => {
    const t = await seedTenant('acme');
    const fresh = await createRepo(t.org, t.owner);
    const res = await api().put(`/api/repos/${fresh.id}/quality-gate`).send({}).set(bearer(t.owner));

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ repoId: fresh.id, minHealthScore: 60, blockPR: false });
    expect(await prisma.qualityGate.count({ where: { repoId: fresh.id } })).toBe(1);
  });
});
