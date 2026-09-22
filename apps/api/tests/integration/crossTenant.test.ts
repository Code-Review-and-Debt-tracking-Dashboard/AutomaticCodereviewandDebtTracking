import { prisma, type User } from '@codehealth/db';
import { beforeEach, describe, expect, it } from 'vitest';

import { api, app } from '../helpers/app';
import { bearer } from '../helpers/auth';
import { seedTwoOrgs, type Tenant, type TwoOrgs } from '../helpers/tenants';

type Method = 'get' | 'post' | 'put' | 'delete';

interface ScopedRoute {
  method: Method;
  /** the Express path template, matched against the router in the guard test */
  template: string;
  path: (t: Tenant) => string;
  body?: (t: Tenant) => object;
}

// Every route whose params name a tenant-owned resource. The guard test at
// the bottom walks the live router and fails if a route with :repoId,
// :orgId or :snapshotId is registered that is not listed here.
const SCOPED_ROUTES: ScopedRoute[] = [
  { method: 'get', template: '/api/orgs/:orgId/members', path: (t) => `/api/orgs/${t.org.id}/members` },
  { method: 'get', template: '/api/orgs/:orgId/repos', path: (t) => `/api/orgs/${t.org.id}/repos` },
  { method: 'get', template: '/api/orgs/:orgId/pulls', path: (t) => `/api/orgs/${t.org.id}/pulls` },
  {
    method: 'post',
    template: '/api/orgs/:orgId/repos/bulk-link',
    path: (t) => `/api/orgs/${t.org.id}/repos/bulk-link`,
    body: () => ({ githubRepoIds: [123456] }),
  },
  {
    method: 'get',
    template: '/api/orgs/:orgId/repos/bulk-link/:jobId',
    path: (t) => `/api/orgs/${t.org.id}/repos/bulk-link/${t.bulkLinkJobId}`,
  },

  { method: 'get', template: '/api/repos/:repoId', path: (t) => `/api/repos/${t.repo.id}` },
  { method: 'delete', template: '/api/repos/:repoId', path: (t) => `/api/repos/${t.repo.id}` },
  { method: 'get', template: '/api/repos/:repoId/trend', path: (t) => `/api/repos/${t.repo.id}/trend` },
  { method: 'get', template: '/api/repos/:repoId/members', path: (t) => `/api/repos/${t.repo.id}/members` },
  { method: 'get', template: '/api/repos/:repoId/debt', path: (t) => `/api/repos/${t.repo.id}/debt` },
  { method: 'get', template: '/api/repos/:repoId/hotspots', path: (t) => `/api/repos/${t.repo.id}/hotspots` },
  { method: 'get', template: '/api/repos/:repoId/pulls', path: (t) => `/api/repos/${t.repo.id}/pulls` },
  {
    method: 'get',
    template: '/api/repos/:repoId/pulls/:prNumber',
    path: (t) => `/api/repos/${t.repo.id}/pulls/${t.pullRequest.prNumber}`,
  },
  { method: 'post', template: '/api/repos/:repoId/analyze', path: (t) => `/api/repos/${t.repo.id}/analyze` },
  {
    method: 'post',
    template: '/api/repos/:repoId/members',
    path: (t) => `/api/repos/${t.repo.id}/members`,
    body: (t) => ({ username: t.developer.username, role: 'VIEWER' }),
  },
  {
    method: 'delete',
    template: '/api/repos/:repoId/members/:userId',
    path: (t) => `/api/repos/${t.repo.id}/members/${t.developer.id}`,
  },
  {
    method: 'get',
    template: '/api/repos/:repoId/quality-gate',
    path: (t) => `/api/repos/${t.repo.id}/quality-gate`,
  },
  {
    method: 'put',
    template: '/api/repos/:repoId/quality-gate',
    path: (t) => `/api/repos/${t.repo.id}/quality-gate`,
    body: () => ({ minHealthScore: 10, blockPR: false }),
  },

  {
    method: 'get',
    template: '/api/snapshots/:snapshotId/findings',
    path: (t) => `/api/snapshots/${t.snapshot.id}/findings`,
  },

  {
    method: 'get',
    template: '/api/mobile/repos/:repoId/smells',
    path: (t) => `/api/mobile/repos/${t.repo.id}/smells`,
  },
];

const label = (r: ScopedRoute): string => `${r.method.toUpperCase()} ${r.template}`;

// Strings that would only appear in a response if org A's data leaked. The
// bulk-link job id is left out: BullMQ ids are small sequential integers, so
// "1" would match digits in unrelated headers.
function secretsOf(t: Tenant): string[] {
  return [t.org.id, t.org.login, t.repo.id, t.repo.name, t.repo.fullName, t.snapshot.id, t.pullRequest.title];
}

async function callAs(route: ScopedRoute, target: Tenant, user: User) {
  const req = api()[route.method](route.path(target)).set(bearer(user));
  return route.body ? req.send(route.body(target)) : req;
}

describe('cross-tenant isolation', () => {
  let orgs: TwoOrgs;

  beforeEach(async () => {
    orgs = await seedTwoOrgs();
  });

  const callers: { name: string; pick: (o: TwoOrgs) => User }[] = [
    { name: "org B's OWNER", pick: (o) => o.b.owner },
    { name: "org B's ADMIN", pick: (o) => o.b.admin },
    { name: "org B's repo TEAM_LEAD", pick: (o) => o.b.teamLead },
    { name: 'a user in no org', pick: (o) => o.outsider },
  ];

  for (const caller of callers) {
    describe(`${caller.name} against org A`, () => {
      it.each(SCOPED_ROUTES.map((r) => [label(r), r] as const))('%s → 404', async (_name, route) => {
        const res = await callAs(route, orgs.a, caller.pick(orgs));

        // 404, never 403 — a 403 would confirm the resource exists.
        expect(res.status).toBe(404);
        expect(res.body).toEqual({
          error: { code: 'NOT_FOUND', message: expect.any(String) },
        });

        const raw = JSON.stringify(res.body) + JSON.stringify(res.headers);
        for (const secret of secretsOf(orgs.a)) {
          expect(raw).not.toContain(secret);
        }
      });
    });
  }

  it('the same routes succeed for org A members, so the 404s above are tenancy, not breakage', async () => {
    // the write routes mutate, so use fresh state for the reads first
    for (const route of SCOPED_ROUTES.filter((r) => r.method === 'get')) {
      const res = await callAs(route, orgs.a, orgs.a.owner);
      expect(res.status, label(route)).toBe(200);
    }
  });

  it('a write from org B leaves org A untouched', async () => {
    await callAs(SCOPED_ROUTES.find((r) => label(r) === 'PUT /api/repos/:repoId/quality-gate')!, orgs.a, orgs.b.owner);
    await callAs(SCOPED_ROUTES.find((r) => label(r) === 'DELETE /api/repos/:repoId')!, orgs.a, orgs.b.owner);
    await callAs(SCOPED_ROUTES.find((r) => label(r) === 'DELETE /api/repos/:repoId/members/:userId')!, orgs.a, orgs.b.owner);

    const gate = await api().get(`/api/repos/${orgs.a.repo.id}/quality-gate`).set(bearer(orgs.a.owner));
    expect(gate.body.data.minHealthScore).toBe(orgs.a.qualityGate.minHealthScore);

    const repo = await api().get(`/api/repos/${orgs.a.repo.id}`).set(bearer(orgs.a.owner));
    expect(repo.status).toBe(200);

    const members = await api().get(`/api/repos/${orgs.a.repo.id}/members`).set(bearer(orgs.a.owner));
    expect(members.body.data.map((m: { userId: string }) => m.userId)).toContain(orgs.a.developer.id);
  });

  it('a REMOVED org membership is treated like no membership', async () => {
    await prisma.organizationMember.update({
      where: { orgId_userId: { orgId: orgs.a.org.id, userId: orgs.a.developer.id } },
      data: { status: 'REMOVED' },
    });

    for (const route of SCOPED_ROUTES) {
      const res = await callAs(route, orgs.a, orgs.a.developer);
      expect(res.status, label(route)).toBe(404);
    }
  });
});

describe('cross-tenant matrix completeness', () => {
  // Express 4 keeps mounted routers in app._router.stack; each router's own
  // stack holds Layer objects whose .route carries the path and methods.
  function registeredScopedRoutes(): Set<string> {
    const found = new Set<string>();
    const router = (app as unknown as { _router: { stack: Layer[] } })._router;

    const visit = (layers: Layer[]) => {
      for (const layer of layers) {
        if (layer.route) {
          if (/:(repoId|orgId|snapshotId)\b/.test(layer.route.path)) {
            for (const method of Object.keys(layer.route.methods)) {
              found.add(`${method.toUpperCase()} ${layer.route.path}`);
            }
          }
        } else if (layer.handle?.stack) {
          visit(layer.handle.stack);
        }
      }
    };

    visit(router.stack);
    return found;
  }

  it('every registered :repoId / :orgId / :snapshotId route is in SCOPED_ROUTES', () => {
    const registered = registeredScopedRoutes();
    const covered = new Set(SCOPED_ROUTES.map(label));

    const missing = [...registered].filter((r) => !covered.has(r));
    const stale = [...covered].filter((r) => !registered.has(r));

    expect(missing, 'tenant-scoped routes with no cross-tenant test — add them to SCOPED_ROUTES').toEqual([]);
    expect(stale, 'SCOPED_ROUTES lists routes that no longer exist').toEqual([]);
    expect(registered.size).toBeGreaterThan(0);
  });
});

interface Layer {
  route?: { path: string; methods: Record<string, boolean> };
  handle?: { stack?: Layer[] };
}
