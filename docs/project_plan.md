# Project Plan, WBS & Risk Register

> **Today:** 21 June 2026 | **Final deadline:** 3 October 2026 (15 weeks)
> **Team:** 3 part-time students with parallel coursework (~15-20h/week per person on this project)
>
> **Revised 29 August 2026 — post mid-evaluation.** New WBS entries `A-36`–`A-40`, `B-28`–`B-32`,
> `C-10`, `C-11` and `D-21` added for the work specified in `analysis_access_and_reporting_design.md`
> §7; `B-21` rescoped; mobile push notifications (`A-23`, `A-24`, `E-08`, `E-09`) cut. §1.1, §2, §3
> and §4 updated to match. **Step-level assignment for Weeks 11–15 lives in
> `project_features_plan.md`** — that document is the authority; this one holds the WBS and the risks.

---

## 1. Work Breakdown Structure

### WBS-A: Backend API (Owner: You — Team Lead)

> Seven endpoint/hardening tasks that were originally listed here — A-14, A-20, A-21, A-23, A-31, A-34, A-35 — have been moved into WBS-D/WBS-C/WBS-E below and are cross-trained to a teammate, reviewed by you before merge. They keep their original `A-xx` IDs (so `A-11 through A-23`-style ranges in A-25/A-27 below still resolve correctly), but physically live in their new owner's section now. See §1.1 for the full rationale.

| ID | Task | Est. Hours | Dependencies |
|---|---|---|---|
| A-01 | Monorepo setup (root package.json, workspaces, tsconfig base) | 3h | None |
| A-02 | Docker Compose file (PostgreSQL + Redis) | 2h | None |
| A-03 | GitHub Actions CI skeleton (lint + typecheck on push) | 3h | A-01 |
| A-04 | Express API scaffold (entry point, middleware stack, error handler) | 4h | A-01 |
| A-05 | GitHub OAuth route (redirect + callback + token exchange) | 6h | A-04 |
| A-06 | Session/JWT middleware (auth guard for protected routes) | 4h | A-05 |
| A-07 | Webhook endpoint (receive POST, verify HMAC-SHA256 signature) | 4h | A-04 |
| A-08 | Webhook event parsing (extract PR data, validate repo is linked) | 3h | A-07, C-03 |
| A-09 | BullMQ queue setup (connection, queue definition, job dispatch) | 4h | A-02 |
| A-10 | Job dispatch from webhook handler (enqueue analysis job) | 2h | A-08, A-09 |
| A-11 | REST: GET/POST/DELETE /api/repos (list, link, unlink) | 5h | A-06, A-32, C-03 |
| A-12 | REST: GET /api/repos/:id (detail + latest snapshot) | 3h | A-11 |
| A-13 | REST: GET /api/repos/:id/trend (health score over time range) | 3h | C-03 |
| A-15 | REST: GET /api/repos/:id/hotspots (worst files) | 3h | C-03 |
| A-16 | REST: GET /api/repos/:id/pulls + /:prNumber (PR list + detail) | 4h | C-03 |
| A-17 | REST: GET /api/snapshots/:id/findings (paginated + filtered) | 4h | C-03 |
| A-18 | REST: POST /api/repos/:id/analyze (manual trigger) | 2h | A-09 |
| A-19 | REST: GET/PUT quality gate endpoints | 3h | C-03 |
| A-22 | REST: mobile summary + smells endpoints | 3h | A-12, A-17 |
| ~~A-24~~ | ~~Push notification dispatch service (Expo Push API)~~ · **CUT 29 Aug** — see §4 | ~~4h~~ | — |
| A-25 | Input validation middleware (zod schemas for all endpoints) | 4h | A-11 through A-23 |
| A-26 | Rate limiting middleware | 2h | A-04 |
| A-27 | API integration tests | 6h | A-11 through A-23 |
| A-28 | Health check endpoints (`GET /health` for API + Worker) | 1h | A-04 |
| A-29 | Structured logging setup (Pino + pino-pretty for dev) | 2h | A-04 |
| A-30 | Bull Board dashboard (mount at `/admin/queues`) | 1h | A-09 |
| A-32 | Role-based authorization middleware + repo member endpoints (GET/POST/DELETE `/api/repos/:id/members`) | 4h | A-06, C-08 |
| A-33 | Organization tenancy enforcement: GitHub org sync service, `requireOrgAccess` middleware, org endpoints (`GET /api/orgs`, `POST /api/orgs/sync`, `GET /api/orgs/:orgId/members`, `GET /api/orgs/:orgId/repos`), rewrite `requireRepoAccess` to check the tenant first and drop the platform-admin bypass | 6h | A-32, C-09 |
| A-36 | **Data plane agent auth + results-ingest endpoint.** Authenticates a data plane deployment by agent token and accepts a findings/metrics payload. The endpoint schema must have no field capable of carrying source code — that is what makes the privacy guarantee structural rather than a promise | 5h | B-28, C-10 |
| A-37 | **Job-lease endpoint** — lease / complete / fail over HTTPS in front of the existing BullMQ queue, with a fixed visibility timeout so a data plane that dies mid-job does not strand it | 5h | A-36 |
| A-38 | **Bulk repository enable** — `POST /orgs/:orgId/repos/bulk-link`, queued registration job, per-repo result status. Reuses the existing `linkRepository` body | 5h | B-28 |
| A-39 | **Orphaned-webhook fix** in `unlinkRepository` — the current path swallows a failed `deleteWebhook` as a warning and nulls `webhookId` anyway, leaving GitHub delivering to an endpoint with no matching row | 2h | A-11 |
| A-40 | Subscribe webhook registration to `push` events, not `pull_request` only | 1h | A-11 |

### WBS-B: Worker Service (Owner: You — Team Lead)

| ID | Task | Est. Hours | Dependencies |
|---|---|---|---|
| B-01 | Worker scaffold (BullMQ consumer, job processor registration) | 4h | A-09 |
| B-02 | Clone stage (git clone --depth=1, temp directory management) | 4h | B-01 |
| B-03 | Language detection stage (scan file extensions, map to tools) | 3h | B-02 |
| B-04 | ESLint analyzer wrapper (invoke CLI, parse JSON output) | 4h | B-03 |
| B-05 | PyLint analyzer wrapper | 3h | B-03 |
| B-06 | Bandit analyzer wrapper | 3h | B-03 |
| B-07 | Radon analyzer wrapper (CC + MI) | 3h | B-03 |
| B-08 | jscpd analyzer wrapper (duplication detection) | 3h | B-03 |
| B-09 | Checkstyle analyzer wrapper | 3h | B-03 |
| B-10 | PMD analyzer wrapper | 3h | B-03 |
| B-11 | Cppcheck analyzer wrapper | 3h | B-03 |
| B-12 | Output normalizer (all tools → unified Finding shape) | 5h | B-04 to B-11 |
| B-13 | Health Score computation function (pure, testable) | 4h | None (pure logic) |
| B-14 | **Debt Score computation** (sum remediation minutes from cost table) | 3h | B-13 |
| B-15 | Finding matcher (set `FindingState`: NEW / EXISTING / RESOLVED vs baseline) | 4h | B-13 |
| B-16 | **Debt Delta computation** (current debt − baseline debt) | 2h | B-14, B-15 |
| B-17 | Quality gate evaluator | 2h | B-13, C-03 |
| B-18 | PR comment builder (markdown template — includes Health Score + **Debt summary + Debt Delta**) | 3h | B-13, B-14 |
| B-19 | GitHub PR comment poster (Octokit, update existing comment) | 4h | B-18 |
| B-20 | GitHub commit status poster (pass/fail) | 2h | B-17 |
| B-21 | **Rescoped 29 Aug.** Result persistence **as an authenticated API client**, not direct Prisma writes — writes the immutable HealthSnapshot + findings with **debtScore + debtDeltaMinutes + gateResult** and transitions the AnalysisJob status, via `A-36`. This is what lets the worker run inside a customer's network without holding our database credentials | ~~4h~~ 6h | B-12, B-14, B-16, **A-37**, **B-28** |
| B-22 | Notification creation (gate fail, score drop, critical vuln) | 3h | B-19 *(A-24 dependency removed — push cut)* |
| B-23 | Cleanup stage (rm temp directory, always runs) | 2h | B-02 |
| B-24 | Worker Docker image (multi-language runtimes) | 5h | B-04 to B-11 |
| B-25 | Unit tests for scoring function | 3h | B-13 |
| B-26 | Unit tests for normalizers | 4h | B-12 |
| B-27 | Integration test: end-to-end analysis pipeline | 5h | B-01 to B-23 |
| B-28 | **Contract DTOs** in `packages/shared` — job descriptor and results payload shared by both planes | 2h | None |
| B-29 | Add `eslint-plugin-sonarjs` to the worker's ESLint config — cognitive complexity and bug rules absent from `eslint:recommended` | 1h | B-04 |
| B-30 | TODO / FIXME / HACK scan analyzer (self-admitted technical debt) | 2h | B-12 |
| B-31 | **PR comment metrics table** — extends `B-18` with a per-metric value / threshold / status table, failing rows first, rows with no configured threshold omitted | 3h | B-18, C-11 |
| B-32 | Self-hosted data plane — compose file + deployment documentation for running the worker inside a customer network | 3h | B-24, B-21, A-37 |

> **Note:** SpotBugs (previously B-11) has been dropped — it analyzes compiled Java bytecode, and this worker only does a shallow `git clone` (no build step), so it cannot run as designed. It was also never part of the locked tool stack in `CLAUDE.md` or the pipeline in `system_architecture.md` §3.2. Java security coverage for this project comes from PMD's rule set only (see `tool_matrix.md`).

### WBS-C: Database (Owner: Teammate 2)

| ID | Task | Est. Hours | Dependencies |
|---|---|---|---|
| C-01 | Prisma schema (all models, enums, indexes) | 5h | None |
| C-02 | Initial migration (`prisma migrate dev --name init`) | 1h | C-01, A-02 |
| C-03 | Prisma client package setup (`packages/db` with re-export) | 3h | C-01 |
| C-04 | Seed script (sample users, repos, snapshots, findings) | 4h | C-02 |
| C-05 | Database index validation (EXPLAIN ANALYZE on key queries) | 3h | C-04 |
| C-06 | Add Device model for push tokens | 2h | C-01 |
| C-07 | Migration for schema updates during development | ongoing | C-02 |
| C-08 | Add role model: `PlatformRole` enum (+ `platformRole` on User) and per-repo `RepositoryRole`/`MemberStatus` on the `RepositoryMember` model | 2h | C-01 |
| C-09 | Add organization tenancy: `Organization` + `OrganizationMember` models, `OrgType`/`OrgRole` enums, `Repository.orgId`. Needs a hand-written backfill inside the migration because `orgId` is `NOT NULL` on an already-populated table | 3h | C-01, C-08 |
| C-10 | **Data plane agent record** + migration — token hash, organization, last-seen. Identity for a deployment rather than for a human user | 2h | C-01 |
| C-11 | **`PullRequest.botCommentId`** migration (nullable) — lets the PR comment be updated in place instead of a new comment per push | 1h | C-01 |
| A-31 | *(cross-trained from WBS-A)* REST: Application metrics endpoint (`GET /api/metrics`, admin-only) | 2h | A-04, C-03 |
| A-35 | ✅ **Done 11 Aug — taken back into WBS-A by the lead.** OAuth `state` now does what the docs claimed. The single-use Redis nonce shipped in `0779659` (replay protection); browser binding completed on 11 Aug — `/auth/github` writes the nonce to an `HttpOnly; SameSite=Lax` cookie and the callback rejects any state whose nonce doesn't match it. Without that second half, a validly-signed state was accepted from *any* browser, so an attacker could harvest one and have a victim complete a login into the attacker's GitHub identity | 2h | A-05, A-09 |

### WBS-D: Frontend Web Dashboard (Owner: Teammate 1)

| ID | Task | Est. Hours | Dependencies |
|---|---|---|---|
| D-01 | React + Vite project scaffold in apps/web | 3h | A-01 |
| D-02 | Design system setup (colors, typography, theme, dark mode) | 5h | None |
| D-03 | Layout shell (sidebar, topbar, routing with React Router) | 5h | D-01 |
| D-04 | GitHub OAuth login page + callback handler | 5h | D-03, A-05 (API contract) |
| D-05 | API client module (axios/fetch wrapper, auth interceptor) | 4h | D-01 |
| D-06 | Repo list page (cards grid, search, filter, sort) | 6h | D-05, A-11 (API contract) |
| A-21 | *(cross-trained from WBS-A)* REST: GET /api/repos/available (list user's GitHub repos) | 3h | A-06 |
| D-07 | Link repository modal (fetch available repos, link action) | 4h | D-06, A-21 |
| D-08 | HealthGauge component (circular SVG score indicator) | 4h | D-02 |
| D-09 | Repo detail page — hero section + tab layout | 5h | D-06, A-12 |
| D-10 | Trend line chart — **Health Score + Debt Score** dual-axis (Recharts, time range selector) | 6h | D-09, A-13 |
| A-14 | *(cross-trained from WBS-A)* REST: GET /api/repos/:id/debt (debt breakdown by category) | 2h | C-03 |
| D-11 | **Debt breakdown chart** (Recharts donut/bar — category: vuln/complexity/dup/smell) | 4h | D-09, A-14 |
| D-12 | Hotspot table (worst files, sortable) | 4h | D-09, A-15 |
| D-13 | PR scan history table (**includes debt delta indicator ▲/▼ per PR**) | 4h | D-09, A-16 |
| D-14 | PR finding drill-down page (filter bar, finding cards) | 6h | D-13, A-17 |
| D-15 | Quality gate configuration page (sliders, toggles, save) | 5h | D-09, A-19 |
| A-20 | *(cross-trained from WBS-A)* REST: notifications endpoints (list, mark read, mark all) | 3h | C-03 |
| D-16 | Notification bell + dropdown in topbar | 4h | D-03, A-20 |
| D-17 | Loading states, empty states, error boundaries | 4h | D-06 to D-16 |
| D-18 | Responsive layout adjustments (1024px–1920px) | 3h | D-03 to D-16 |
| D-19 | Frontend unit/component tests | 5h | D-06 to D-16 |
| D-20 | Organization switcher in the topbar (fed by `GET /api/orgs`); selected organization scopes the repo list and the link-repo picker | 3h | D-05, A-33 |
| D-21 | **Bulk enable UI** — multi-select repository picker, progress indicator, per-repo result summary ("enabled 47 · already linked 5 · skipped 7, no admin"). Partial failure is the normal case and must be reported, not swallowed | 3h | D-07, A-38 |
| A-34 | ✅ **Done 10 Aug — taken back into WBS-A by the lead, rescoped.** Session-backed revocation rather than the Redis denylist originally specified: 15-minute access JWT plus a rotating 7-day refresh token stored hashed in `Session`, with family-wide reuse detection, working `POST /auth/logout`, and an admin force-logout endpoint. The denylist would have satisfied FR-4 while leaving the architecture document's `Session.tokenHash` / `validateSession()` / `revokeSession()` unimplemented. Also removed the `demo-token` backdoor that signed every anonymous visitor in as a platform ADMIN | ~~4h~~ 14h | A-06, A-09 |

### WBS-E: Mobile App (Owner: Teammate 2)

| ID | Task | Est. Hours | Dependencies |
|---|---|---|---|
| E-01 | Expo project scaffold in apps/mobile | 3h | A-01 |
| E-02 | Bottom tab navigator + screen scaffolds | 3h | E-01 |
| E-03 | Mobile auth flow (token-based, persist token in SecureStore) | 5h | E-02, A-05 |
| E-04 | API client module for mobile | 3h | E-01 |
| E-05 | Home screen — repo list with sparklines | 5h | E-04, A-22 |
| E-06 | Repo summary screen (gauge, trend, category bars, top issues) | 6h | E-05, A-22 |
| E-07 | Notification screen (list, mark read, swipe) | 4h | E-04, A-20 |
| ~~A-23~~ | ~~*(cross-trained from WBS-A)* REST: device registration endpoints (push tokens)~~ · **CUT 29 Aug** | ~~2h~~ | — |
| ~~E-08~~ | ~~Push notification setup (Expo Notifications, device registration)~~ · **CUT 29 Aug** | ~~5h~~ | — |
| ~~E-09~~ | ~~Push notification handling (foreground/background, tap navigation)~~ · **CUT 29 Aug** | ~~4h~~ | — |
| E-10 | Mobile UI polish (loading states, pull-to-refresh, empty states) | 4h | E-05 to E-07 |

### WBS-F: Documentation (Owner: You — Team Lead)

| ID | Task | Est. Hours | Dependencies |
|---|---|---|---|
| F-01 | Project Proposal document | 8h | None |
| F-02 | Feasibility Study + Gantt chart | 8h | F-01 |
| F-03 | SRS document | 10h | Requirements analysis done |
| F-04 | System Architecture & Design document | 6h | Architecture design done |
| F-05 | Testing document | 6h | Testing done |
| F-06 | Final report (including before/after comparison) | 10h | All dev done |
| F-07 | Marketing video script + recording (10-15 min) | 8h | All dev done |

### 1.1 Task Load Audit & Cross-Training Rationale

**Original allocation (21 June), by WBS section:**

| Person | Sections | Total Hours | Weeks | Avg h/week |
|---|---|---|---|---|
| You (Team Lead) | WBS-A (101h + A-34's 14h) + WBS-B (91h) + WBS-F (56h) | ~262h | 15 | ~17.5h |
| Teammate 1 | WBS-D (86h) | ~86h | 15 | ~5.7h |
| Teammate 2 | WBS-C (20h + A-35's 2h) + WBS-E (42h) | ~64h | 15 | ~4.3h |

**This allocation did not survive contact with the schedule.** A 262 / 86 / 64 split makes the lead a
single point of failure on the critical path, and by Week 10 that had materialised — Week 11 was
carrying ~27h for the lead once the Week 10 spillover (`B-04`, `B-05`, `D-15`) was added to it.

**Actual allocation after the 29 August replan**, summed from the week tables in
`project_features_plan.md` rather than from section boundaries — ownership no longer follows WBS
sections, and the section headings above should be read as *authorship of the original spec*, not as
who builds each task:

| Person | Total Hours (Weeks 6–15) | Avg h/week | New work from the replan |
|---|---|---|---|
| Rumesh | ~125h | ~13.3h | 14h |
| Nethmi | ~119h | ~12.7h | 14h |
| Vidushi | ~112h | ~11.9h | 13h |

Three changes produced this: cutting mobile push (−18h, §4), moving `B-06`, `B-07`, `D-15` and `B-20`
off the lead, and splitting the 41h of new work evenly three ways. The remaining spread is historical
— Weeks 1–10 are spent and cannot be rebalanced retrospectively.

> **Documentation (WBS-F, 56h) sits on a separate track** and is not included in the figures above,
> which is why they are lower than the original audit for the lead.



## 2. Week-by-Week Schedule

**Assumption:** Each person can commit ~15-20 hours/week. Exam periods reduce this to ~8-10h/week.

| Week | Dates | You (Backend/Worker/Docs) | Teammate 1 (Frontend + cross-trained backend) | Teammate 2 (DB + Mobile + cross-trained backend) | Milestone |
|---|---|---|---|---|---|
| **1** | Jun 22–28 | A-01 monorepo, A-02 Docker Compose, F-01 proposal start | D-01 Vite scaffold, D-02 design system | C-01 Prisma schema | — |
| **2** | Jun 29–Jul 5 | A-03 CI pipeline, A-04 Express scaffold + A-28 health check + A-29 Pino logging, F-01 finish | D-02 finish, D-03 layout shell | C-01 finish, C-02 migration, C-03 client pkg | **📋 Proposal due Jul 5** |
| **3** | Jul 6–12 | A-05 OAuth, F-02 feasibility + Gantt | D-05 API client, D-04 login page (mock API) | C-04 seed script, E-01 Expo scaffold | **📋 Feasibility due Jul 12** |
| **4** | Jul 13–19 | A-06 auth middleware, A-07 webhook endpoint | D-06 repo list page (use seed data) | E-02 tab navigator, E-03 mobile auth start, C-08 role + membership models |  |
| **5** | Jul 20–26 | A-08 webhook parsing, A-09 BullMQ setup + A-30 Bull Board, A-10 dispatch, A-32 role middleware + member endpoints | D-06 finish, D-07 link repo modal, **A-21 available repos (own endpoint, reviewed by you)** | C-05 index validation, E-03 finish, E-04 API client |  |
| **6** | Jul 27–Aug 2 | A-11 repo CRUD, A-12 repo detail | D-08 HealthGauge, D-09 repo detail page start, **A-14 debt endpoint (own endpoint, reviewed by you)** | E-05 home screen, C-06 Device model | ⚠️ API auth working by Jul 27 |
| **7** | Aug 3–9 | A-13 trend, A-15 hotspots, F-03 SRS, F-04 arch doc | D-04 connect real OAuth, D-06 connect real API, D-09 finish | E-05 finish, E-06 repo summary start, **A-23 device registration + A-31 metrics endpoint (own endpoints, reviewed by you)** | ⚠️ Dashboard showing real DB data by Aug 9 |
| — | **Aug 9** | — | — | — | **📋 SRS + Architecture due** |
| **8** | Aug 10–16 | A-16 PR endpoints, A-17 findings, A-18 manual trigger | D-10 trend chart, D-11 debt chart | E-06 finish, E-07 notifications | **📋 Progress Review 1 (Aug 10-14)** |
| **9** | Aug 17–23 | B-01 worker scaffold, B-02 clone, B-03 detect, B-23 cleanup | D-12 hotspot table, D-13 PR scan table | ~~E-08 push setup~~ *(cut)* | Mid Eval period |
| **10** | Aug 24–30 | B-04, B-05, D-15 — **none merged, carried to Week 11** | D-16 bell, A-25 zod validation | A-26, A-31 — **carried to Week 11**; ~~E-09~~ *(cut)* | **Mid Eval ends Aug 30** |

**Weeks 11–15 were re-planned on 29 August.** Assignment by real name below, because ownership no
longer follows the original "Teammate 1 / Teammate 2" section split. Step-level detail, dependencies
and per-week hour loads are in `project_features_plan.md`; this table is the WBS-level view.

| Week | Dates | Rumesh | Nethmi | Vidushi | Milestone |
|---|---|---|---|---|---|
| **11** | Aug 31–Sep 6 | B-04, B-05 *(carried)*, B-29 sonarjs, B-28 contract DTOs, B-12 normalizer | B-06 Bandit, B-07 Radon, A-40 push events, E-05 home screen, D-17 states | D-15 gate page *(carried)*, A-26, A-31 *(carried)*, C-07, C-10 agent record, A-39 webhook fix | ⚠️ Week 10 spillover cleared |
| **12** | Sep 7–13 | B-13 scoring fn, B-14 debt score, B-15 matcher, B-16 debt delta, B-17 gate eval | A-36 results-ingest, A-37 job-lease, D-21 bulk enable UI | B-25 scoring tests, B-18 PR comment builder, C-11 botCommentId, B-31 metrics table, B-30 TODO scan | **⛔ FEATURE FREEZE Sep 13** |
| **13** | Sep 14–20 | **B-21 persistence as API client**, B-19 PR comment poster, A-38 bulk enable endpoint, B-22 notifications | D-19 frontend tests, D-17/E-07 carried polish, cross-test mobile + API | A-27 API integration tests *(incl. cross-tenant matrix)*, B-20 commit status, E-10 polish, cross-test web | Loop closes across the plane boundary |
| **14** | Sep 21–27 | B-24 Docker image, B-26 normalizer tests, B-27 e2e test, cloud deploy, F-05 testing doc | Web bug fixes, D-18 responsive, deploy dashboard | Mobile bug fixes, Expo EAS build, B-32 self-hosted data plane docs, cloud deploy | **📋 Testing doc due Sep 27** |
| **15** | Sep 28–Oct 3 | F-06 final report, F-07 marketing video | Smoke test, regression fixes, demo rehearsal | Smoke test, regression fixes, demo rehearsal | **📋 Review 2, Video, Final report + zip** |

### Dependency Chain (Critical Path)

```
C-01 schema → C-02 migration → C-03 client pkg ──→ ALL API endpoints (A-11+)
                                                  ──→ ALL worker DB writes (B-21)
             → C-08 role + membership models ────→ A-32 role middleware ──→ A-11+
             → C-09 org tenancy models ──────────→ A-33 org enforcement ──→ A-11+

A-05 OAuth  → A-06 auth middleware ──→ A-32 role middleware ──→ A-33 org enforcement
                                                              ──→ ALL protected endpoints (A-11+)
                                                              ──→ D-04 real login page

A-09 BullMQ → B-01 worker scaffold → B-02 clone → B-03 detect → B-04+ analyzers
                                                                → B-12 normalize
                                                                → B-13 score
                                                                → B-21 persist (API client)

B-28 contract DTOs ──→ A-36 results-ingest ──→ A-37 job-lease ──→ B-21 persist
                   ──→ A-38 bulk enable ─────→ D-21 bulk enable UI
C-10 agent record ───→ A-36
C-11 botCommentId ───→ B-31 PR metrics table ──→ B-19 comment poster

API contract (JSON shapes in api_design.md) → D-05 API client → ALL frontend pages
                                             → E-04 mobile client → ALL mobile screens
```

**Key insight:** Teammate 1 (frontend) can start building UI with **mock data / seed data** from Week 1, but needs the API contract document (already done) and real endpoints by Week 7 to connect for Progress Review 1.

**Second key insight (29 Aug):** `B-28` is two hours of work that `A-36`, `A-37`, `B-21`, `A-38` and
`B-32` all sit behind. `A-37` in turn gates `B-21`, which is the last opportunity to write persistence
once rather than twice. These two are now the narrowest part of the chain — narrower than the scoring
functions they used to sit behind.

---

## 3. Risk Register

| # | Risk | Like. | Impact | Mitigation |
|---|---|---|---|---|
| R-01 | **Teammate unavailable during exam week** (e.g., CS3xxx exams overlap with sprints) | High | High | Keep tasks modular so any one person's 1-week absence doesn't block the others. Frontend and mobile can use mock data. Worker development is independent of frontend. Build 1-week buffer before each major deadline. |
| R-02 | **Progress Review 1: "frontend + DB connected" demo fails** | Medium | Critical | Start connecting frontend to real API by Week 6 (not Week 7). Have a fallback plan: if API isn't ready, demo frontend with seed data loaded directly via Prisma client in a demo script. The evaluator cares about "connected" — even seed data in PostgreSQL displayed in React counts. |
| R-03 | **GitHub webhook behavior differs from docs** (e.g., unexpected payload shape, signature format, retry behavior) | Medium | Medium | Test webhook locally using `ngrok` + GitHub's "Redeliver" button starting Week 5. GitHub also has a webhook test endpoint. Don't wait until Week 8 to test real webhooks for the first time. |
| R-04 | **Multi-language worker Docker image is too large / slow to build** | Medium | Medium | Start with a JS/TS-only worker (ESLint + jscpd). Add Python tools second, Java/C++ last. The demo can use a JS/TS repo. Docker image can be pre-built and pushed to a registry rather than built on every deploy. |
| R-05 | **Analysis takes >5 minutes on real repos, times out** | Medium | Medium | Use `--depth=1` for git clone (shallow). Set per-tool timeouts (2 min each). For demo, use small test repos (<5K LOC). Document the timeout as a known limitation. |
| R-06 | **Free-tier hosting limits exceeded** (DB rows, Redis commands, compute hours) | Low | High | Monitor usage weekly. Supabase free tier has 500MB + 50K rows (plenty for demo). Upstash has 10K commands/day (sufficient for dev). If exceeded, migrate to Railway which offers $5 credit. |
| R-07 | **Frontend teammate blocked waiting for API endpoints** | High | Medium | API contract (api_design.md) is already defined. Frontend builds against mock data / JSON fixtures from Day 1. Swap to real API incrementally. Use MSW (Mock Service Worker) for development. |
| R-08 | **Prisma schema needs breaking migration mid-development** | Medium | Medium | Run `prisma migrate dev` early and often. Keep migrations small and additive. Avoid renaming columns after Week 6 — add new + deprecate old instead. **Materialised in Week 6** by C-09: adding a `NOT NULL` tenant column to an already-populated `Repository` table. Handled without a database reset by splitting the migration into add-nullable → backfill → set-not-null, so teammates' local data survived. Treat that migration as the worked example if this recurs. |
| ~~R-09~~ | ~~**Push notifications don't work on iOS simulator / physical device differences**~~ | — | — | **Closed 29 Aug — risk eliminated by cutting the feature.** Push notifications were cut (§4); in-app notifications on web (`D-16`) and mobile (`E-07`) still ship. |
| R-14 | **`B-21` gets written twice** — as direct Prisma writes, then rewritten as an API client once the control/data plane split is adopted | Medium | High | This is the one item in `analysis_access_and_reporting_design.md` §7 whose cost rises sharply with delay; everything else deferred there can be added later at roughly the same price. Mitigation is sequencing, not effort: `B-28`, `A-36` and `A-37` land in Weeks 11–12 so `B-21` is written against the contract the first time. If they slip, write `B-21` against the contract anyway and stub the endpoints. |
| R-15 | **New analyzers flatten the Health Score to zero.** `VULNERABILITY` carries category weight 4.0; a secret or dependency scanner emitting hundreds of findings would dominate every repository's score and destroy the trend chart — which §4 ranks "do not cut" | Medium | High | Severity mapping for any new tool must be conservative and reviewed against `scoring_algorithm.md` §1.2/§1.5 before the tool is enabled. This is the stated reason those tools are deferred rather than built. |
| R-10 | **Scope creep — "just one more feature" delays core deliverables** | High | High | Enforce the "Cut List" (§4 below). Any new feature request goes to a "Post-MVP" backlog. No new features after Week 12. Weeks 13-15 are testing + docs + polish only. |
| R-11 | **Marketing video production takes longer than expected** | Medium | Medium | Write the script during Week 14 while doing final testing. Record in one session (screen recording + voiceover). Don't attempt professional editing — clear narration over screen capture is sufficient. Use OBS Studio. |
| R-12 | **Parallel coursework spikes (assignments, labs, other project deadlines)** | High | Medium | Identify known assignment deadlines at sprint planning. Reduce this project's commitment to ~8h/week during heavy weeks. Front-load critical-path work (Weeks 1-7) when course load is likely lighter. |
| R-13 | **Bull Board `/admin/queues` exposed publicly** | Low | Medium | Add basic auth middleware to the `/admin` route (hardcoded username/password is fine for demo). In production, restrict to internal network or authenticated admin users only. |

---

## 4. Cut List (What to Drop First If Behind)

Ranked from **safest to cut** to **must keep at all costs**:

> ⚠️ **Correction, 29 Aug.** Ranks 1 and 2 below are **not usable as relief.** `B-09`, `B-10` and
> `B-11` were never scheduled as steps in `project_features_plan.md` — they appear only as cut
> candidates. Cutting them frees zero hours. Any future "we're behind, what do we drop" decision has
> to start at rank 3 or below, and rank 3 has now been spent.

| Priority | Feature | Can Cut? | Impact of Cutting |
|---|---|---|---|
| 1 (cut first) | **C/C++ analysis (Cppcheck)** | ⚠️ Never scheduled | Nothing to reclaim — was never in the build chain. Already absent from the demo by default. |
| 2 | **Java analysis (Checkstyle + PMD)** | ⚠️ Never scheduled | As above. Demo with JS/TS + Python covers the concept. |
| ~~3~~ | ~~**Mobile push notifications**~~ | ✅ **CUT 29 Aug** | **Spent.** Freed 18h (`A-23`, `A-24`, `E-08`, `E-09`, physical-device testing) and removed a critical link from Week 11. In-app notifications still ship on web (`D-16`) and mobile (`E-07`); only device push is gone. |
| 4 | **Quality gate PR blocking** (commit status posting) | ⚠️ Moderate | Quality gate config + score display still works. Just skip the GitHub commit status API call. Comment-only is still valuable. |
| 5 | **File hotspot analysis** (worst files endpoint + UI) | ⚠️ Moderate | Nice-to-have dashboard feature. Trend charts + finding list are more important. |
| 6 | **Debt score in remediation minutes** | ⚠️ Moderate | Health Score alone is sufficient for demo. Debt minutes adds depth but isn't core. |
| 7 | **Mobile app entirely** | ❌ Last resort | Scope document explicitly lists it. But if desperate, a polished web dashboard + working backend > half-finished mobile + half-finished web. |
| 8 | **Multi-language support** (keep JS/TS only) | ❌ Risky | Technically works but weakens the "supports any project" narrative. Keep at least JS/TS + Python. |
| 9 | **Trend charts** | ❌ Do not cut | Core differentiator. "Health Score over time" is the whole point of the product. |
| 10 | **PR bot comment** | ❌ Do not cut | Expected Outcome 2 in the scope doc. Evaluators will specifically look for this. |
| 11 (never cut) | **Health Score + Dashboard + GitHub OAuth** | ❌ Never | These ARE the product. Without them, there's nothing to demo. |

### The "Minimum Viable Demo" (if everything goes wrong)

If the team falls significantly behind, this is the bare minimum that constitutes a passable demo:

1. ✅ User logs in with GitHub OAuth
2. ✅ User links a repository
3. ✅ Webhook triggers analysis (even if only ESLint + jscpd)
4. ✅ Health Score appears on dashboard
5. ✅ Trend chart shows score history
6. ✅ Bot posts a comment on the GitHub PR — **with the per-metric threshold table (`B-31`)**, since
   that is what the mid-evaluation asked for
7. ✅ Mobile app shows repo list + scores (push notifications now cut, not optional)

Everything above this line must ship. Everything below it is negotiable.

**Next cut candidates, in order**, now that rank 3 is spent: `B-30` (TODO scan), `B-32` (self-hosted
data plane docs), then the webhook reconciliation job already deferred in
`analysis_access_and_reporting_design.md` §4.4. `B-28`/`A-36`/`A-37`/`B-21` are **not** cut
candidates — see R-14.

---

*This plan assumes ~15-20h/week per person with reduced capacity during exam weeks. Review and adjust at the start of each sprint based on actual progress.*

*Last revised 29 August 2026 after the mid-evaluation. Weeks 11–15 step-level detail lives in
`project_features_plan.md`; the design behind the new WBS entries is in
`analysis_access_and_reporting_design.md`.*
