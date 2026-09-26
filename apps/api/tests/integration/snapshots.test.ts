import { prisma } from '@codehealth/db';
import { describe, expect, it } from 'vitest';

import { api } from '../helpers/app';
import { bearer } from '../helpers/auth';
import { createFinding, createRepo, createSnapshot } from '../helpers/factories';
import { seedTenant } from '../helpers/tenants';

describe('GET /api/snapshots/:snapshotId/findings', () => {
  it('401 without a token', async () => {
    const t = await seedTenant('acme');
    const res = await api().get(`/api/snapshots/${t.snapshot.id}/findings`);
    expect(res.status).toBe(401);
  });

  it('400 for a blank id', async () => {
    const t = await seedTenant('acme');
    const res = await api().get('/api/snapshots/%20/findings').set(bearer(t.owner));
    expect(res.status).toBe(400);
  });

  it('404 for an unknown snapshot', async () => {
    const t = await seedTenant('acme');
    const res = await api().get('/api/snapshots/nope/findings').set(bearer(t.owner));
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Snapshot not found');
  });

  it('404 when the snapshot belongs to an unlinked repo', async () => {
    const t = await seedTenant('acme');
    await prisma.repository.update({ where: { id: t.repo.id }, data: { isActive: false } });
    const res = await api().get(`/api/snapshots/${t.snapshot.id}/findings`).set(bearer(t.owner));
    expect(res.status).toBe(404);
  });

  it('403 for an org member with no repo membership', async () => {
    const t = await seedTenant('acme');
    const res = await api().get(`/api/snapshots/${t.snapshot.id}/findings`).set(bearer(t.bystander));
    expect(res.status).toBe(403);
  });

  it('400 for invalid filters — zod for shape, service for values', async () => {
    const t = await seedTenant('acme');
    const base = `/api/snapshots/${t.snapshot.id}/findings`;

    const page = await api().get(base).query({ page: 'one' }).set(bearer(t.owner));
    expect(page.status).toBe(400);
    expect(page.body.status).toBe('error');

    const category = await api().get(base).query({ category: 'nonsense' }).set(bearer(t.owner));
    expect(category.status).toBe(400);
    expect(category.body.error.code).toBe('VALIDATION_ERROR');

    const severity = await api().get(base).query({ severity: 'meh' }).set(bearer(t.owner));
    expect(severity.status).toBe(400);

    const limit = await api().get(base).query({ limit: '101' }).set(bearer(t.owner));
    expect(limit.status).toBe(400);
  });

  it('returns findings with a summary and pagination', async () => {
    const t = await seedTenant('acme');
    await createFinding(t.snapshot, { severity: 'CRITICAL', category: 'VULNERABILITY', state: 'EXISTING', file: 'src/a.ts' });
    await createFinding(t.snapshot, { severity: 'LOW', category: 'DUPLICATION', state: 'NEW', file: 'src/b.ts' });

    const res = await api().get(`/api/snapshots/${t.snapshot.id}/findings`).set(bearer(t.developer));

    expect(res.status).toBe(200);
    expect(res.body.snapshotId).toBe(t.snapshot.id);
    expect(res.body.summary).toEqual({
      total: 3,
      new: 2,
      carryOver: 1,
      bySeverity: { critical: 1, high: 0, medium: 1, low: 1, info: 0 },
      byCategory: { vulnerability: 1, complexity: 0, duplication: 1, code_smell: 1, maintainability: 0 },
    });
    expect(res.body.pagination).toEqual({ page: 1, limit: 50, total: 3, totalPages: 1 });
    expect(res.body.data[0]).toEqual(
      expect.objectContaining({ id: expect.any(String), severity: expect.any(String), isNew: expect.any(Boolean) }),
    );
  });

  it('filters by category/severity/isNew/file and paginates', async () => {
    const t = await seedTenant('acme');
    await createFinding(t.snapshot, { severity: 'CRITICAL', category: 'VULNERABILITY', state: 'EXISTING', file: 'src/a.ts' });
    await createFinding(t.snapshot, { severity: 'CRITICAL', category: 'VULNERABILITY', state: 'NEW', file: 'src/b.ts' });
    const base = `/api/snapshots/${t.snapshot.id}/findings`;

    const byCat = await api().get(base).query({ category: 'vulnerability', isNew: 'true' }).set(bearer(t.owner));
    expect(byCat.body.summary.total).toBe(2); // summary ignores isNew
    expect(byCat.body.pagination.total).toBe(1); // data honours it
    expect(byCat.body.data[0].file).toBe('src/b.ts');

    const byFile = await api().get(base).query({ file: 'a.ts' }).set(bearer(t.owner));
    expect(byFile.body.data.map((f: { file: string }) => f.file)).toEqual(['src/a.ts']);

    const paged = await api().get(base).query({ limit: '2', page: '2' }).set(bearer(t.owner));
    expect(paged.body.data).toHaveLength(1);
    expect(paged.body.pagination).toEqual({ page: 2, limit: 2, total: 3, totalPages: 2 });
  });

  it('the org ADMIN can read a snapshot for a repo they are not a member of', async () => {
    const t = await seedTenant('acme');
    const other = await createRepo(t.org, t.owner);
    const snap = await createSnapshot(other);
    const res = await api().get(`/api/snapshots/${snap.id}/findings`).set(bearer(t.admin));
    expect(res.status).toBe(200);
    expect(res.body.summary.total).toBe(0);
  });
});
