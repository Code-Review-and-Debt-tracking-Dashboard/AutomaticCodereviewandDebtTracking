# Project Plan, WBS & Risk Register

> **Today:** 21 June 2026 | **Final deadline:** 3 October 2026 (15 weeks)
> **Team:** 3 part-time students with parallel coursework (~15-20h/week per person on this project)

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
| A-24 | Push notification dispatch service (Expo Push API) | 4h | A-23 (see WBS-E) |
| A-25 | Input validation middleware (zod schemas for all endpoints) | 4h | A-11 through A-23 |
| A-26 | Rate limiting middleware | 2h | A-04 |
| A-27 | API integration tests | 6h | A-11 through A-23 |
| A-28 | Health check endpoints (`GET /health` for API + Worker) | 1h | A-04 |
| A-29 | Structured logging setup (Pino + pino-pretty for dev) | 2h | A-04 |
| A-30 | Bull Board dashboard (mount at `/admin/queues`) | 1h | A-09 |
| A-32 | Role-based authorization middleware + repo member endpoints (GET/POST/DELETE `/api/repos/:id/members`) | 4h | A-06, C-08 |
| A-33 | Organization tenancy enforcement: GitHub org sync service, `requireOrgAccess` middleware, org endpoints (`GET /api/orgs`, `POST /api/orgs/sync`, `GET /api/orgs/:orgId/members`, `GET /api/orgs/:orgId/repos`), rewrite `requireRepoAccess` to check the tenant first and drop the platform-admin bypass | 6h | A-32, C-09 |

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
| B-21 | Result persistence (write immutable HealthSnapshot + findings with **debtScore + debtDeltaMinutes + gateResult**, and transition the AnalysisJob status) | 4h | B-12, B-14, B-16, C-03 |
| B-22 | Notification creation (gate fail, score drop, critical vuln) | 3h | B-19, A-24 |
| B-23 | Cleanup stage (rm temp directory, always runs) | 2h | B-02 |
| B-24 | Worker Docker image (multi-language runtimes) | 5h | B-04 to B-11 |
| B-25 | Unit tests for scoring function | 3h | B-13 |
| B-26 | Unit tests for normalizers | 4h | B-12 |
| B-27 | Integration test: end-to-end analysis pipeline | 5h | B-01 to B-23 |

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
| A-31 | *(cross-trained from WBS-A)* REST: Application metrics endpoint (`GET /api/metrics`, admin-only) | 2h | A-04, C-03 |
| A-35 | *(cross-trained from WBS-A, reviewed by you)* OAuth `state` nonce: currently generated in `signState` but never checked in `verifyState`, so it does not provide the replay protection the design docs claim — either wire it to a single-use Redis check (TTL = state expiry) or remove it and correct the docs | 2h | A-05, A-09 |

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
| A-34 | *(cross-trained from WBS-A, reviewed by you)* Session/token revocation: Redis-backed denylist checked in `requireAuth`, real invalidation on `POST /auth/logout` (currently a stateless no-op, but FR-4 and `api_design.md` §1 both say logout "invalidates the session"), plus an admin-only force-logout endpoint | 4h | A-06, A-09 |

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
| A-23 | *(cross-trained from WBS-A)* REST: device registration endpoints (push tokens) | 2h | C-06 |
| E-08 | Push notification setup (Expo Notifications, device registration) | 5h | E-03, A-23 |
| E-09 | Push notification handling (foreground/background, tap navigation) | 4h | E-08 |
| E-10 | Mobile UI polish (loading states, pull-to-refresh, empty states) | 4h | E-05 to E-09 |

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

**Hour totals per person, summed across their WBS sections:**

| Person | Sections | Total Hours | Weeks | Avg h/week |
|---|---|---|---|---|
| You (Team Lead) | WBS-A (101h) + WBS-B (91h) + WBS-F (56h) | ~248h | 15 | ~16.5h |
| Teammate 1 | WBS-D (86h + A-34's 4h) | ~90h | 15 | ~6.0h |
| Teammate 2 | WBS-C (20h + A-35's 2h) + WBS-E (42h) | ~64h | 15 | ~4.3h |



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
| **9** | Aug 17–23 | B-01 worker scaffold, B-02 clone, B-03 detect | D-12 hotspot table, D-13 PR scan table | E-08 push notification setup | Mid Eval period |
| **10** | Aug 24–30 | B-04 ESLint wrapper, B-05 PyLint, B-06 Bandit, B-07 Radon | D-14 PR finding drill-down | E-09 push handling, E-10 polish start | **Mid Eval ends Aug 30** |
| **11** | Aug 31–Sep 6 | B-08 jscpd, B-09–B-11 Java/C++ wrappers, B-12 normalizer | D-15 quality gate config page, **A-20 notification endpoints (own endpoint, reviewed by you)** | E-10 finish | |
| **12** | Sep 7–13 | B-13 scoring fn, B-14 debt score, B-15 matcher, B-16 debt delta, B-17 gate eval, B-18 PR comment builder | D-16 notification bell, D-17 loading/error states | C-07 migrations, mobile bug fixes | |
| **13** | Sep 14–20 | B-19 PR comment poster, B-20 commit status poster, B-21 persistence, B-22 notifications, B-23 cleanup, A-19 gate endpoints | D-18 responsive, D-19 tests | Integration testing all apps | |
| **14** | Sep 21–27 | B-24 Docker image, B-25–B-27 tests, A-24–A-27 push + tests, F-05 testing doc | Frontend bug fixes, test fixes | Mobile bug fixes, test fixes | **📋 Testing doc due Sep 27** |
| **15** | Sep 28–Oct 3 | F-06 final report, F-07 marketing video | Video demo help, final polish | Video demo help, final polish | **📋 Review 2, Video, Final report + zip** |

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
                                                                → B-21 persist

API contract (JSON shapes in api_design.md) → D-05 API client → ALL frontend pages
                                             → E-04 mobile client → ALL mobile screens
```

**Key insight:** Teammate 1 (frontend) can start building UI with **mock data / seed data** from Week 1, but needs the API contract document (already done) and real endpoints by Week 7 to connect for Progress Review 1.

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
| R-09 | **Push notifications don't work on iOS simulator / physical device differences** | Medium | Low | Use Expo Go app on a physical device for testing (push doesn't work on simulators). For demo, show the notification on an Android device as backup. |
| R-10 | **Scope creep — "just one more feature" delays core deliverables** | High | High | Enforce the "Cut List" (§4 below). Any new feature request goes to a "Post-MVP" backlog. No new features after Week 12. Weeks 13-15 are testing + docs + polish only. |
| R-11 | **Marketing video production takes longer than expected** | Medium | Medium | Write the script during Week 14 while doing final testing. Record in one session (screen recording + voiceover). Don't attempt professional editing — clear narration over screen capture is sufficient. Use OBS Studio. |
| R-12 | **Parallel coursework spikes (assignments, labs, other project deadlines)** | High | Medium | Identify known assignment deadlines at sprint planning. Reduce this project's commitment to ~8h/week during heavy weeks. Front-load critical-path work (Weeks 1-7) when course load is likely lighter. |
| R-13 | **Bull Board `/admin/queues` exposed publicly** | Low | Medium | Add basic auth middleware to the `/admin` route (hardcoded username/password is fine for demo). In production, restrict to internal network or authenticated admin users only. |

---

## 4. Cut List (What to Drop First If Behind)

Ranked from **safest to cut** to **must keep at all costs**:

| Priority | Feature | Can Cut? | Impact of Cutting |
|---|---|---|---|
| 1 (cut first) | **C/C++ analysis (Cppcheck)** | ✅ Safe | Least common language in target audience. Demo with JS/TS + Python + Java is sufficient. |
| 2 | **Java analysis (Checkstyle + PMD)** | ✅ Safe | Two tools, added setup (JRE). Demo with JS/TS + Python covers the concept. |
| 3 | **Mobile push notifications** | ✅ Safe | In-app notifications on mobile still work. Push is impressive but not evaluable without a physical device at review. |
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
6. ✅ Bot posts a comment on the GitHub PR
7. ✅ Mobile app shows repo list + scores (even without push notifications)

Everything above this line must ship. Everything below it is negotiable.

---

*This plan assumes ~15-20h/week per person with reduced capacity during exam weeks. Review and adjust at the start of each sprint based on actual progress.*
