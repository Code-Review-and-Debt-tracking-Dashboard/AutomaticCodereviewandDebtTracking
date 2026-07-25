# Feature-Wise Delivery Plan

> **Status:** Active plan from 25 July 2026 onward. Supersedes the *sequencing and ownership* in
> `project_plan.md` — but **not** its task IDs, hour estimates, or risk register, which stay valid
> and are referenced throughout.
> **Final deadline:** 3 October 2026 (10 weeks left)
> **Team:** Rumesh (lead), Nethmi (web), Vidushi (DB + mobile)

---

## 1. Why this document exists

`project_plan.md` breaks the work down **by layer** — WBS-A is all backend, WBS-D is all frontend,
WBS-E is all mobile. Each person owns one horizontal stripe of the system and builds it top to
bottom.

Two problems surfaced with that:

1. **The team said it isn't workable.** "Build the entire web dashboard" and "build the entire
   mobile app" are not tasks anyone can finish or demo in isolation — they're multi-month blobs
   with no natural stopping point, and no way to tell if you're 20% or 80% done.
2. **The mentor asked for feature-wise implementation.** Progress should be demonstrable as
   *working features*, not as "the frontend is 60% done."

The evidence backs both up. As of today the repo contains a polished nine-page React dashboard,
a working OAuth backend, and a 12-model database — and **not one of them talks to another**.
`apps/web` has no API client; every page renders from a hardcoded `mockRepositories` array.
Three people worked hard for five weeks and the integrated product currently demos as zero
features. That is the specific failure mode layer-first delivery produces, and Progress Review 1
(10–14 Aug) explicitly grades "GUI + DB + connection between them."

This plan reorganizes the **same work, the same WBS task IDs** into **vertical feature slices**.
A slice cuts through every layer it needs — schema, endpoint, worker stage, web page, mobile
screen — and is only finished when a person can *use* it.

**Nothing is being added to scope and nothing is being dropped.** §9 proves this with a
traceability matrix mapping all 100+ original WBS IDs into their new feature.

---

## 2. The rules of a feature slice

These are the working agreements that make this plan different from the last one. They matter
more than the feature list itself.

### 2.1 Definition of Done — applies to every feature

A feature is **not done** until all of these are true:

| # | Rule |
|---|---|
| 1 | **Real data, no mocks.** The UI reads from the live API, which reads from PostgreSQL. A page rendering from a hardcoded array is not done, no matter how good it looks. |
| 2 | **Demoable in one sentence.** Every feature below has a *Demo script* — a thing you physically do in front of the mentor. If you can't perform it, the feature is open. |
| 3 | **Merged to `develop`.** Not sitting on a personal branch. Feature branches are short-lived. |
| 4 | **CI green.** Lint + typecheck pass on the PR. |
| 5 | **Loading + empty + error states exist.** Not polished, but present — no infinite spinner and no white screen when the API returns 500 or an empty list. |
| 6 | **Learning log updated** by everyone who touched it (`docs/learning-log-*.md`). This is viva ammunition — we have to defend every line. |

### 2.2 Every feature has one Feature Owner

The Feature Owner is **accountable for the slice reaching Done end-to-end**, including the parts
other people wrote. They chase the integration, they run the demo, they answer for it at review.

This does *not* mean the owner writes every layer alone. It means the buck stops with one person
instead of "I finished my half, the other half isn't my problem" — which is how we got here.

### 2.3 Layer specialists remain, but everyone ships full-stack

Deep expertise stays where it is: Vidushi still owns schema changes, Nethmi still owns the design
system. But each person now owns **at least three features end-to-end**, meaning each person
writes some database code, some API code, and some UI code across the project. This is also what
the module expects from us individually at the viva.

> ⚠️ **This conflicts with the ownership rule in `CLAUDE.md`** ("don't edit another teammate's app
> without asking first"). See §11 — Rumesh needs to make a call on this before Sprint 1 starts.

### 2.4 Integration happens first, not last

Within a feature, build in this order:

```
schema (if needed) → endpoint returning REAL data → UI consuming the REAL endpoint → polish
```

Never build the UI against mocks and "connect it later." Later never comes — that's the current
situation. If an endpoint isn't ready, the person doing the UI writes the endpoint or waits; they
do not build a mock.

### 2.5 Feature branches

`feature/F-03-link-repository` (feature id), or `feature/F-03-A-11-repos-crud` when several people
work in parallel on one feature. WBS IDs stay in commit messages for traceability.

---

## 3. Where we actually are — verified snapshot, 25 July 2026

Read from the repo, not from the plan. Legend: ✅ done · 🟡 partial · ⬜ not started.

### Backend API — `apps/api`

| ✅/⬜ | What | Evidence |
|---|---|---|
| ✅ | Express scaffold, error handler, 404 handler | `src/app.ts`, `src/middleware/errorHandler.ts` |
| ✅ | GitHub OAuth redirect + callback + token exchange (A-05) | `src/services/authService.ts` |
| ✅ | AES-256-GCM token-at-rest encryption | `src/lib/crypto.ts` |
| ✅ | JWT auth guard (A-06) | `src/middleware/requireAuth.ts` |
| ✅ | Webhook HMAC verification (A-07) | `src/middleware/verifyWebhookSignature.ts` |
| ✅ | Webhook PR parsing + linked-repo check (A-08) | `src/services/webhookService.ts` |
| ⬜ | `GET /health` (A-28), Pino logging (A-29) | not in `app.ts` — plan said Week 2 |
| ⬜ | BullMQ queue (A-09), job dispatch (A-10) | webhook returns `202 Received` and drops the event |
| ⬜ | Every `/api/*` endpoint (A-11 → A-24) | no `routes/` beyond `auth.ts` + `webhooks.ts` |

### Database — `packages/db`

| ✅/⬜ | What | Evidence |
|---|---|---|
| ✅ | 12 models + 12 enums (C-01, C-06, C-08) | `prisma/schema.prisma` — 512 lines |
| ✅ | Init migration applied (C-02) | `prisma/migrations/20260719051244_init/` |
| ✅ | Client package + re-export (C-03) | `packages/db/index.ts`, imported by the API |
| ⬜ | **Seed script (C-04)** | no `prisma/seed.ts` — **this blocks the Review 1 demo** |
| ⬜ | Index validation (C-05) | — |

### Web dashboard — `apps/web`

| ✅/⬜ | What | Evidence |
|---|---|---|
| ✅ | Vite scaffold, design system, layout shell, routing (D-01, D-02, D-03) | `src/app/routes.tsx`, `src/components/layout/` |
| 🟡 | 9 pages built as UI — login, dashboard, repositories, overview, trends, findings, PRs, quality gate, members (~4,900 lines) | `src/pages/**` |
| ⬜ | **API client (D-05)** | **no `src/services/` or `src/lib/api` exists at all** |
| ⬜ | Real data anywhere | `mockRepositories` hardcoded in `RepositoriesPage.tsx:87` and elsewhere |
| ⬜ | Auth context / protected routes | `AppLayout` renders regardless of login state |

> Nethmi's UI work is real and substantial — the pages are the hard part and they're largely
> built. The gap is purely that they're disconnected. Most of Sprint 1 for the web app is
> **wiring, not building**, which is why the Review 1 target below is realistic.

### Worker — `apps/worker` · Mobile — `apps/mobile` · Shared — `packages/shared`

⬜ All three are empty — `.gitkeep` only. Nothing started.

### Honest summary

- **Features shipped end-to-end: 0.**
- Foundations are genuinely good: the schema is thorough, the OAuth flow is properly secured, the
  UI is well ahead of where most groups are at week 5.
- **The single highest-risk item is that mobile is at 0% with 10 weeks left**, and the second is
  that no client-server integration has ever been attempted, so we don't yet know what breaks.

---

## 4. Sprint structure

Four sprints, each ending on a real deliverable date.

| Sprint | Dates | Weeks | Theme | Ends at |
|---|---|---|---|---|
| **S1** | Jul 25 – Aug 9 | 2.2 | **Connect the wires** — make one path work end-to-end | SRS + Arch doc due Aug 9; **Progress Review 1 Aug 10–14** |
| **S2** | Aug 10 – Aug 30 | 3.0 | **Make it analyze** — the actual product function | **Mid Evaluation ends Aug 30** |
| **S3** | Aug 31 – Sep 20 | 3.0 | **Make it insightful** — trends, debt, gates, notifications | Feature freeze Sep 20 |
| **S4** | Sep 21 – Oct 3 | 1.8 | **Make it shippable** — hardening, tests, docs, video | Testing doc Sep 27; **Review 2 Sep 28 – Oct 2**; Final Oct 3 |

**Feature freeze is 20 September.** After that: bug fixes, tests, documents and the video only.
This is the enforcement mechanism for risk R-10 (scope creep) from `project_plan.md`.

---

## 5. Feature catalogue

Fourteen features. Each card gives you the demo, the slice, the owner, and the exit criteria.

---

### F-01 — Foundation & developer environment ✅ *mostly done*

**Sprint:** S0 (complete) · **Owner:** Rumesh
**Goal:** Anybody can clone the repo and get all services running locally.

| Layer | Task | WBS | Who | Status |
|---|---|---|---|---|
| Repo | Monorepo + npm workspaces | A-01 | Rumesh | ✅ |
| Infra | Docker Compose (Postgres + Redis) | A-02 | Rumesh | ✅ |
| CI | GitHub Actions lint + typecheck | A-03 | Rumesh | ✅ |
| API | Express scaffold + error handler | A-04 | Rumesh | ✅ |
| API | `GET /health` for API + Worker | A-28 | Rumesh | ⬜ |
| API | Pino structured logging | A-29 | Rumesh | ⬜ |
| DB | Schema + init migration + client package | C-01, C-02, C-03 | Vidushi | ✅ |
| DB | **Seed script — users, repos, snapshots, findings** | C-04 | Vidushi | ⬜ **blocker** |
| Web | Vite scaffold + design system + layout shell | D-01, D-02, D-03 | Nethmi | ✅ |

**Demo script:** `docker compose up`, `npm run dev`, `curl localhost:4000/health` → `200`.
**Done when:** health endpoint responds, logs are structured JSON, and `npm run seed` populates a
database you can immediately develop the dashboard against.

> **C-04 is the most urgent single task in this plan.** Without seed data, Nethmi cannot connect
> any page to a real API, so F-02/F-03/F-05 cannot start. Vidushi: this is due **Mon 27 Jul**.

---

### F-02 — Sign in with GitHub

**Sprint:** S1 · **Owner:** Nethmi · **Contributors:** Rumesh (API, done), Vidushi (mobile)
**Goal:** A real GitHub user logs into the dashboard and the app knows who they are.

| Layer | Task | WBS | Who | Status |
|---|---|---|---|---|
| API | OAuth redirect + callback + token exchange | A-05 | Rumesh | ✅ |
| API | JWT auth guard, `GET /auth/me`, `POST /auth/logout` | A-06 | Rumesh | ✅ |
| Web | **API client module** (axios wrapper + auth interceptor + 401 handling) | D-05 | Nethmi | ⬜ |
| Web | Login page wired to the real OAuth redirect + callback token capture | D-04 | Nethmi | 🟡 UI exists |
| Web | Auth context, protected routes, real user in Topbar, logout | D-04 | Nethmi | ⬜ |
| Mobile | Expo scaffold + bottom tab navigator | E-01, E-02 | Vidushi | ⬜ |
| Mobile | API client module | E-04 | Vidushi | ⬜ |
| Mobile | Auth flow, token in SecureStore | E-03 | Vidushi | ⬜ |

**Demo script:** Click *Sign in with GitHub* → GitHub consent screen → land back on the dashboard
with your own avatar and username in the topbar. Log out → bounced to `/login`. Repeat on the
phone.
**Done when:** an unauthenticated user cannot reach `/dashboard`, the JWT survives a page refresh,
and a 401 from the API redirects to login rather than crashing.
**Depends on:** F-01.

> This is Nethmi's first full-stack slice and the API side is already written and tested, so it's
> a deliberately safe place to learn the integration pattern. The `D-05` API client she builds
> here is reused by every subsequent web feature — build it properly.

---

### F-03 — Link a GitHub repository

**Sprint:** S1 · **Owner:** Nethmi · **Contributors:** Rumesh (review + A-32), Vidushi (schema)
**Goal:** A logged-in user picks one of their GitHub repos and links it to CodeHealth.

| Layer | Task | WBS | Who | Status |
|---|---|---|---|---|
| DB | `RepositoryMember`, roles, statuses | C-08 | Vidushi | ✅ |
| API | Role-based authorization middleware + member endpoints | A-32 | Rumesh | ⬜ |
| API | `GET /api/repos/available` — user's GitHub repos via Octokit | **A-21** | **Nethmi** | ⬜ |
| API | `GET / POST / DELETE /api/repos` — list, link, unlink | **A-11** | **Nethmi** | ⬜ |
| API | Register the GitHub webhook on link (Octokit) | A-11 | Rumesh | ⬜ |
| Web | Repo list page — grid, search, filter, sort, connected to `GET /api/repos` | D-06 | Nethmi | 🟡 UI exists, mocked |
| Web | Link-repository modal | D-07 | Nethmi | 🟡 |
| Web | Members page connected to the member endpoints | — | Nethmi | 🟡 |

**Demo script:** Click *Link repository* → modal lists your actual GitHub repos → pick one →
it appears in the repo grid → refresh the page and it's still there → check GitHub repo settings
and the webhook is registered.
**Done when:** linking persists to `Repository`, unlinking soft-deletes (`isActive: false` — this
is what `webhookService.findLinkedRepository` already checks), and a non-member gets `403`.
**Depends on:** F-02.
**Reference:** `api_design.md` §4.

---

### F-04 — Automated analysis pipeline (JS/TS)

**Sprint:** S1 → S2 · **Owner:** Rumesh
**Goal:** Opening a pull request causes the code to be analyzed and a Health Score stored.
**This is the heart of the product.** Everything downstream reads what this writes.

| Layer | Task | WBS | Who | Status |
|---|---|---|---|---|
| API | Webhook receive + HMAC verify | A-07 | Rumesh | ✅ |
| API | Webhook PR parsing + linked-repo validation | A-08 | Rumesh | ✅ |
| API | BullMQ queue setup + Bull Board at `/admin/queues` | A-09, A-30 | Rumesh | ⬜ |
| API | Enqueue job from the webhook handler | A-10 | Rumesh | ⬜ |
| API | `POST /api/repos/:id/analyze` — manual trigger | A-18 | Rumesh | ⬜ |
| Worker | Scaffold — BullMQ consumer, processor registration | B-01 | Rumesh | ⬜ |
| Worker | Clone stage (`--depth=1`, temp dir) | B-02 | Rumesh | ⬜ |
| Worker | Language detection | B-03 | Rumesh | ⬜ |
| Worker | ESLint wrapper (+ `eslint-plugin-security`) | B-04 | Rumesh | ⬜ |
| Worker | jscpd wrapper (duplication) | B-08 | Rumesh | ⬜ |
| Worker | Output normalizer → unified `Finding` | B-12 | Rumesh | ⬜ |
| Worker | Health Score computation (pure fn) | B-13 | Rumesh | ⬜ |
| Worker | Persist `HealthSnapshot` + findings, transition `AnalysisJob` | B-21 | Rumesh | ⬜ |
| Worker | Cleanup stage (always runs) | B-23 | Rumesh | ⬜ |
| Worker | Unit tests — scoring + normalizers | B-25, B-26 | Rumesh | ⬜ |

**Demo script:** Open a PR on a linked test repo → Bull Board shows the job go
`waiting → active → completed` → a new `HealthSnapshot` row exists with a score between 0 and 100
→ `Finding` rows exist for the ESLint issues.
**Done when:** the round trip works unattended for a small JS/TS repo, the temp directory is
always removed (even on failure), and the scoring function has unit tests proving the same input
gives the same score.
**Depends on:** F-03 (a repo must be linked for the webhook to resolve).
**Reference:** `scoring_algorithm.md` for the formula, `system_architecture.md` §3.2 for stages.

> **Split for delivery:** get the *queue path* (A-09, A-10, B-01, B-02, B-23) working by **Aug 9**
> so Review 1 can show a job flowing through Bull Board even if analysis is stubbed. Analyzers and
> scoring land in S2. Test locally against GitHub with `ngrok` starting this week — risk R-03 says
> don't discover webhook surprises in August.

---

### F-05 — Repository health at a glance

**Sprint:** S1 (seeded) → S2 (live) · **Owner:** Nethmi · **Contributors:** Vidushi (mobile), Rumesh (review)
**Goal:** A user opens a repo and immediately sees how healthy it is.

| Layer | Task | WBS | Who | Status |
|---|---|---|---|---|
| API | `GET /api/repos/:id` — detail + latest snapshot | A-12 | Rumesh | ⬜ |
| Web | `HealthGauge` component (circular SVG) | D-08 | Nethmi | 🟡 |
| Web | Repo detail page — hero + tabs, on real data | D-09 | Nethmi | 🟡 UI exists, mocked |
| Web | Dashboard page connected to real repo list + scores | — | Nethmi | 🟡 |
| API | `GET /api/mobile/summary` + `/mobile/repos/:id/smells` | **A-22** | **Vidushi** | ⬜ |
| Mobile | Home screen — repo list with sparklines | E-05 | Vidushi | ⬜ |
| Mobile | Repo summary screen — gauge, category bars, top issues | E-06 | Vidushi | ⬜ |

**Demo script:** From the repo grid click a repo → see its score in the gauge, its language, its
last-analyzed time — all matching what's in PostgreSQL. Open the phone → same score.
**Done when:** every number on the page came from the API; a repo with no snapshot yet shows a
sensible "not analyzed yet" empty state rather than `NaN` or `0`.
**Depends on:** F-03. Renders seed data in S1, real analysis output once F-04 lands.
**Reference:** `api_design.md` §4, §9.

> **This is the Progress Review 1 centrepiece** — GUI + DB + connection, exactly what's graded.

---

### F-06 — PR bot feedback

**Sprint:** S2 · **Owner:** Rumesh
**Goal:** The bot comments on the pull request with the Health Score, and sets a commit status.

| Layer | Task | WBS | Who | Status |
|---|---|---|---|---|
| Worker | PR comment builder (markdown template) | B-18 | Rumesh | ⬜ |
| Worker | Comment poster via Octokit — update existing, don't spam | B-19 | Rumesh | ⬜ |
| Worker | Quality gate evaluator | B-17 | Rumesh | ⬜ |
| Worker | Commit status poster (pass/fail) | B-20 | Rumesh | ⬜ |

**Demo script:** Open a PR → within a minute the bot comments with the score and issue summary →
push another commit → the **same comment updates** rather than a second one appearing → the PR
checks list shows a CodeHealth pass/fail status.
**Done when:** comment is idempotent per PR and the commit status is visible in GitHub's UI.
**Depends on:** F-04.
**Reference:** Expected Outcome 2 in the scope doc — evaluators will look for this specifically.
`project_plan.md` cut list ranks it "never cut."

---

### F-07 — Pull request history & findings drill-down

**Sprint:** S2 · **Owner:** Nethmi · **Contributors:** Rumesh (review)
**Goal:** A user can see every analyzed PR and drill into the individual issues found.

| Layer | Task | WBS | Who | Status |
|---|---|---|---|---|
| API | `GET /api/repos/:id/pulls` + `/pulls/:prNumber` | A-16 | Rumesh | ⬜ |
| API | `GET /api/snapshots/:id/findings` — paginated + filtered | A-17 | Rumesh | ⬜ |
| API | `GET /api/repos/:id/hotspots` — worst files | A-15 | Rumesh | ⬜ |
| Web | PR scan history table | D-13 | Nethmi | 🟡 |
| Web | Finding drill-down page — filter bar, finding cards | D-14 | Nethmi | 🟡 |
| Web | Hotspot table (sortable) | D-12 | Nethmi | ⬜ |

**Demo script:** Repo → *Pull Requests* tab → list of analyzed PRs with their scores → click one →
findings grouped by severity → filter to Critical only → each finding shows file, line and rule.
**Done when:** pagination works past page 1 and the severity/category filters actually filter
server-side (`api_design.md` §10 pagination shape).
**Depends on:** F-04 (needs real findings), F-05.

---

### F-08 — Health trend over time

**Sprint:** S3 · **Owner:** Nethmi · **Contributors:** Rumesh (API)
**Goal:** A user sees whether their code is getting better or worse.

| Layer | Task | WBS | Who | Status |
|---|---|---|---|---|
| API | `GET /api/repos/:id/trend` — score over a time range | A-13 | Rumesh | ⬜ |
| Web | Recharts dual-axis line chart, time-range selector | D-10 | Nethmi | 🟡 |

**Demo script:** Repo → *Trends* → line chart of Health Score across the last 30 days → switch to
7 days → chart re-fetches and redraws.
**Done when:** the range selector triggers a real refetch, and a repo with one snapshot degrades
gracefully instead of rendering a broken chart.
**Depends on:** F-04, F-05.
**Note:** `project_plan.md` cut list — "core differentiator, do not cut."

---

### F-09 — Technical debt tracking

**Sprint:** S3 · **Owner:** Rumesh · **Contributors:** Nethmi (endpoint + chart)
**Goal:** Quantify debt in remediation minutes and show whether a PR added or removed it.

| Layer | Task | WBS | Who | Status |
|---|---|---|---|---|
| Worker | Debt Score — sum remediation minutes from the cost table | B-14 | Rumesh | ⬜ |
| Worker | Finding matcher — NEW / EXISTING / RESOLVED vs baseline | B-15 | Rumesh | ⬜ |
| Worker | Debt Delta — current minus baseline | B-16 | Rumesh | ⬜ |
| API | `GET /api/repos/:id/debt` — breakdown by category | **A-14** | **Nethmi** | ⬜ |
| Web | Debt breakdown chart (donut/bar by category) | D-11 | Nethmi | 🟡 |
| Web | Debt Score on the trend chart's second axis | D-10 | Nethmi | ⬜ |
| Web | Debt delta indicator ▲/▼ per PR in the scan table | D-13 | Nethmi | ⬜ |
| Worker | Debt summary + delta in the PR comment | B-18 | Rumesh | ⬜ |

**Demo script:** Open a PR that adds a bad function → the bot comment says debt went up by N
minutes and flags the finding as NEW → fix it and push → next comment shows the finding RESOLVED
and debt down.
**Done when:** the same finding across two snapshots is correctly matched as EXISTING rather than
counted twice — this is the tricky part, and it's the thing the mentor is most likely to probe.
**Depends on:** F-04, F-06, F-08.
**Reference:** `scoring_algorithm.md` for the remediation cost table.

---

### F-10 — Quality gates

**Sprint:** S3 · **Owner:** Vidushi · **Contributors:** Nethmi (page), Rumesh (evaluator)
**Goal:** A repo owner sets thresholds, and PRs below them are marked failing.

| Layer | Task | WBS | Who | Status |
|---|---|---|---|---|
| API | `GET` + `PUT /api/repos/:id/quality-gate` | **A-19** | **Vidushi** | ⬜ |
| Web | Gate configuration page — sliders, toggles, save | D-15 | Nethmi | 🟡 |
| Worker | Gate evaluator reads per-repo config | B-17 | Rumesh | ⬜ |
| Worker | Gate result written to `HealthSnapshot.gateResult` | B-21 | Rumesh | ⬜ |

**Demo script:** Set *minimum health score* to 90 → open a PR scoring 70 → PR check goes red and
the bot comment says the gate failed → lower the threshold to 60 → re-run → green.
**Done when:** the threshold is read from the database per repo, not hardcoded.
**Depends on:** F-06.
**Reference:** `api_design.md` §7.

> Vidushi's entry into backend work. `A-19` is a small, well-specified CRUD pair against a model
> she designed herself — the safest possible first API task. Rumesh reviews.

---

### F-11 — Notifications (web + mobile push)

**Sprint:** S3 · **Owner:** Vidushi · **Contributors:** Nethmi (bell UI), Rumesh (worker trigger)
**Goal:** A user is told when something bad happens without having to go looking.

| Layer | Task | WBS | Who | Status |
|---|---|---|---|---|
| DB | `Device` model for push tokens | C-06 | Vidushi | ✅ |
| API | `GET /api/notifications`, mark read, mark all read | **A-20** | **Vidushi** | ⬜ |
| API | `POST /api/devices`, `DELETE /api/devices/:id` | **A-23** | **Vidushi** | ⬜ |
| API | Push dispatch service (Expo Push API) | A-24 | Rumesh | ⬜ |
| Worker | Create notifications — gate fail, score drop, critical vuln | B-22 | Rumesh | ⬜ |
| Web | Notification bell + dropdown in the topbar | D-16 | Nethmi | ⬜ |
| Mobile | Notification screen — list, mark read, swipe | E-07 | Vidushi | ⬜ |
| Mobile | Expo Notifications setup + device registration | E-08 | Vidushi | ⬜ |
| Mobile | Foreground/background handling + tap-to-navigate | E-09 | Vidushi | ⬜ |

**Demo script:** Trigger a quality gate failure → the web topbar bell shows a badge → a push
notification arrives on the physical Android device → tap it → the app opens on that repo.
**Done when:** the bell count decrements on read, and the push tap deep-links correctly.
**Depends on:** F-06, F-10.
**Note:** Risk R-09 — push does **not** work on simulators. Test on a physical Android device from
day one. Cut list ranks push as safe to cut; in-app notifications are not.

---

### F-12 — Multi-language analysis

**Sprint:** S3 · **Owner:** Rumesh
**Goal:** The product analyzes Python, Java and C/C++ in addition to JS/TS.

| Layer | Task | WBS | Who | Status |
|---|---|---|---|---|
| Worker | PyLint wrapper | B-05 | Rumesh | ⬜ |
| Worker | Bandit wrapper (Python security) | B-06 | Rumesh | ⬜ |
| Worker | Radon wrapper (complexity + maintainability index) | B-07 | Rumesh | ⬜ |
| Worker | Checkstyle wrapper | B-09 | Rumesh | ⬜ |
| Worker | PMD wrapper | B-10 | Rumesh | ⬜ |
| Worker | Cppcheck wrapper | B-11 | Rumesh | ⬜ |
| Worker | Multi-runtime Docker image | B-24 | Rumesh | ⬜ |

**Demo script:** Link a Python repo → analysis produces Bandit security findings and Radon
complexity metrics alongside the score.
**Done when:** language detection routes each file to the right tool and one tool failing doesn't
abort the whole job.
**Depends on:** F-04.
**Order — this is the designated cut point.** Build in this sequence and stop wherever the
calendar runs out: **Python (B-05/06/07) → Java (B-09/10) → C++ (B-11)**. Cut list ranks Cppcheck
as the very first thing to drop, Java second. Do not start Java before F-09, F-10 and F-11 are
done.

---

### F-13 — Trust & correctness

**Sprint:** S4 · **Owner:** Rumesh · **Contributors:** all
**Goal:** The system behaves safely and we can prove it works.

| Layer | Task | WBS | Who | Status |
|---|---|---|---|---|
| API | Zod input validation on all endpoints | A-25 | Rumesh | ⬜ |
| API | Rate limiting | A-26 | Rumesh | ⬜ |
| API | Basic auth on `/admin/queues` (risk R-13) | — | Rumesh | ⬜ |
| API | Integration tests | A-27 | Rumesh | ⬜ |
| API | `GET /api/metrics`, admin-only | **A-31** | **Vidushi** | ⬜ |
| Worker | End-to-end pipeline integration test | B-27 | Rumesh | ⬜ |
| DB | Index validation (`EXPLAIN ANALYZE`) | C-05 | Vidushi | ⬜ |
| Web | Component/unit tests | D-19 | Nethmi | ⬜ |

**Demo script:** `npm test` at the repo root — green across API, worker and web.
**Done when:** there's enough evidence to write the Testing Document (F-05 doc, due Sep 27).

---

### F-14 — Polish & submission

**Sprint:** S4 · **Owner:** Rumesh (docs) · **Contributors:** all
**Goal:** It looks finished and the deliverables are in.

| Layer | Task | WBS | Who | Status |
|---|---|---|---|---|
| Web | Loading, empty and error states across all pages | D-17 | Nethmi | ⬜ |
| Web | Responsive 1024–1920px | D-18 | Nethmi | ⬜ |
| Mobile | Pull-to-refresh, loading, empty states | E-10 | Vidushi | ⬜ |
| Docs | SRS | F-03 | Rumesh | 🟡 due **Aug 9** |
| Docs | Architecture document | F-04 | Rumesh | 🟡 due **Aug 9** |
| Docs | Testing document | F-05 | Rumesh | ⬜ due **Sep 27** |
| Docs | Final report | F-06 | Rumesh | ⬜ due **Oct 3** |
| Docs | Marketing video (10–15 min) | F-07 | all | ⬜ due **Oct 2** |

> Document IDs F-03…F-07 collide with feature IDs F-03…F-07. When it's ambiguous, write
> "doc F-03 (SRS)" vs "feature F-03 (Link repository)". Renaming the doc IDs would break the
> Gantt chart already submitted with the feasibility study, so we live with it.

---

## 6. Sprint-by-sprint plan

### Sprint 1 — Connect the wires · Jul 25 → Aug 9

**Sprint goal:** *A real user logs in, links a real repository, and sees a real Health Score from
PostgreSQL.* That sentence is the Progress Review 1 demo.

| Who | Features | Tasks |
|---|---|---|
| **Rumesh** | F-01, F-03, F-04 | A-28 health, A-29 Pino, A-32 roles, A-12 repo detail, A-09 queue, A-30 Bull Board, A-10 dispatch, B-01 worker scaffold, B-02 clone, B-23 cleanup · **+ doc F-03 SRS and doc F-04 architecture, both due Aug 9** |
| **Nethmi** | F-02, F-03, F-05 | **D-05 API client (first, blocks everything)**, D-04 real login + auth context, A-21 available repos, A-11 repos CRUD, D-06 + D-07 on real data, D-08/D-09 on real data |
| **Vidushi** | F-01, F-02, F-05 | **C-04 seed script by Mon Jul 27 (blocks the whole sprint)**, E-01 + E-02 Expo scaffold, E-04 mobile API client, E-03 mobile auth, A-22 mobile summary endpoints |

**Ordered so nothing blocks:**

```
Mon Jul 27  C-04 seed  ────────────► Nethmi unblocked on real data
Jul 28–31   D-05 API client + D-04 auth   │  A-28/A-29  │  E-01/E-02 scaffold
Aug 1–5     A-21 + A-11 + D-06/D-07       │  A-32, A-12 │  E-03/E-04 auth
Aug 6–9     D-08/D-09 wired               │  A-09/A-10/B-01 queue path │ A-22
Aug 9       ⚠️ SRS + Architecture doc due
Aug 10–14   ⚠️ PROGRESS REVIEW 1 — rehearse the demo on Aug 9
```

**Sprint 1 exit criteria — all must be true on Aug 9:**

- [ ] Login with a real GitHub account works on web
- [ ] Repo list renders from `GET /api/repos`, no mock arrays remaining in `apps/web`
- [ ] At least one repo can be linked from the UI and persists across a restart
- [ ] Repo detail shows a Health Score sourced from the database (seeded is acceptable)
- [ ] Bull Board shows a job moving through the queue
- [ ] Mobile app launches and can log in
- [ ] SRS + Architecture documents submitted

> ⚠️ **Deleting the mock arrays from `apps/web` is a Sprint 1 deliverable, not a nice-to-have.**
> Grep for `mock` in `apps/web/src` on Aug 9 — it should return nothing.

### Sprint 2 — Make it analyze · Aug 10 → Aug 30

**Sprint goal:** *A pull request is analyzed automatically and the bot comments on it.*

| Who | Features | Tasks |
|---|---|---|
| **Rumesh** | F-04, F-06 | B-03 detect, B-04 ESLint, B-08 jscpd, B-12 normalizer, B-13 scoring, B-21 persist, B-25/B-26 tests, B-18/B-19 PR comment, A-18 manual trigger |
| **Nethmi** | F-07 | A-16 PR endpoints, A-17 findings, A-15 hotspots, D-13 scan table, D-14 drill-down, D-12 hotspots |
| **Vidushi** | F-05, F-11 | E-05 home screen, E-06 repo summary, A-20 notification endpoints, C-06 wiring |

**Exit criteria (Aug 30 — Mid Evaluation):** open a PR on a linked JS/TS repo, and with no manual
intervention get a bot comment, a stored snapshot, and findings visible in the dashboard.

### Sprint 3 — Make it insightful · Aug 31 → Sep 20

**Sprint goal:** *Trends, debt, gates and notifications all work.*

| Who | Features | Tasks |
|---|---|---|
| **Rumesh** | F-09, F-12, F-06 | B-14/B-15/B-16 debt, B-17/B-20 gate + status, B-22 notification creation, A-13 trend, A-24 push dispatch, B-05/06/07 Python tools, then B-09/B-10 Java |
| **Nethmi** | F-08, F-09, F-10, F-11 | D-10 trend chart, A-14 debt endpoint, D-11 debt chart, D-15 gate page, D-16 notification bell |
| **Vidushi** | F-10, F-11 | A-19 gate endpoints, A-23 devices, E-07 notification screen, E-08/E-09 push |

**Exit criteria (Sep 20 — feature freeze):** every feature F-01 through F-12 meets its Definition
of Done, or has been formally cut per §8.

### Sprint 4 — Make it shippable · Sep 21 → Oct 3

| Who | Tasks |
|---|---|
| **Rumesh** | A-25 validation, A-26 rate limiting, A-27 integration tests, B-24 Docker image, B-27 e2e test, doc F-05 Testing (Sep 27), doc F-06 Final report, doc F-07 video |
| **Nethmi** | D-17 states, D-18 responsive, D-19 tests, bug fixes |
| **Vidushi** | E-10 polish, C-05 index validation, A-31 metrics, bug fixes |

**Hard dates:** Testing doc Sep 27 · Review 2 Sep 28 – Oct 2 · Video Oct 2 · Final report + zip Oct 3.

---

## 7. Ownership summary

| Person | Owns end-to-end | Contributes to | Writes code in |
|---|---|---|---|
| **Rumesh** | F-01, F-04, F-06, F-09, F-12, F-13, F-14 | F-03, F-10, F-11 | api, worker, db, docs |
| **Nethmi** | F-02, F-03, F-05, F-07, F-08 | F-09, F-10, F-11 | **web + api** (A-11, A-14, A-16, A-17, A-21) |
| **Vidushi** | F-10, F-11 | F-01, F-02, F-05, F-13 | **db + mobile + api** (A-19, A-20, A-22, A-23, A-31) |

Every person now writes API code. Every person owns at least two features end-to-end. That is the
structural change the mentor asked for.

**Load check** — hours carried over from `project_plan.md` estimates:

| Person | Remaining hours | Over 10 weeks |
|---|---|---|
| Rumesh | ~205h | ~20.5 h/week |
| Nethmi | ~90h | ~9 h/week |
| Vidushi | ~62h | ~6 h/week |

Rumesh is still carrying roughly twice the load, mostly because the worker service (91h) and all
seven documents (56h) sit with him and can't easily be split. If either teammate has spare
capacity in S2, the first things to hand over are **B-05/B-06/B-07 (the Python analyzer wrappers)**
— they're independent, self-contained, and each follows the identical pattern established by
B-04, so they're the cheapest possible thing to learn from.

---

## 8. Cut list, restated as features

Ranked safest-to-cut first. Same ranking as `project_plan.md` §4, expressed in feature terms.

| Order | Cut this | Feature | Consequence |
|---|---|---|---|
| 1 | Cppcheck / C++ | part of F-12 | Least common target language. |
| 2 | Checkstyle + PMD / Java | part of F-12 | JS/TS + Python still proves multi-language. |
| 3 | Mobile push notifications | E-08, E-09 in F-11 | In-app notifications still work. |
| 4 | Commit status posting | B-20 in F-10 | Bot comment still conveys the gate result. |
| 5 | Hotspot analysis | A-15, D-12 in F-07 | Findings list covers it. |
| 6 | Debt in remediation minutes | F-09 | Health Score alone still demos. |
| 7 | Mobile app entirely | F-11 mobile half, F-05 mobile half | Last resort — it's named in the scope doc. |
| — | **F-02, F-03, F-04, F-05, F-06, F-08** | | **Never cut. These are the product.** |

**Minimum viable demo** (from `project_plan.md`), in feature terms:
**F-02 → F-03 → F-04 → F-05 → F-06 → F-08.** Everything else is negotiable.

---

## 9. Traceability — every WBS ID has a home

Confirms nothing was lost in the reorganization.

| Feature | WBS IDs absorbed |
|---|---|
| F-01 Foundation | A-01, A-02, A-03, A-04, A-28, A-29, C-01, C-02, C-03, C-04, D-01, D-02, D-03 |
| F-02 Sign in | A-05, A-06, D-04, D-05, E-01, E-02, E-03, E-04 |
| F-03 Link repo | A-11, A-21, A-32, C-08, D-06, D-07 |
| F-04 Analysis pipeline | A-07, A-08, A-09, A-10, A-18, A-30, B-01, B-02, B-03, B-04, B-08, B-12, B-13, B-21, B-23, B-25, B-26 |
| F-05 Health at a glance | A-12, A-22, D-08, D-09, E-05, E-06 |
| F-06 PR bot | B-17, B-18, B-19, B-20 |
| F-07 PRs & findings | A-15, A-16, A-17, D-12, D-13, D-14 |
| F-08 Trend | A-13, D-10 |
| F-09 Debt tracking | A-14, B-14, B-15, B-16, D-11 |
| F-10 Quality gates | A-19, B-17, D-15 |
| F-11 Notifications | A-20, A-23, A-24, B-22, C-06, D-16, E-07, E-08, E-09 |
| F-12 Multi-language | B-05, B-06, B-07, B-09, B-10, B-11, B-24 |
| F-13 Trust & correctness | A-25, A-26, A-27, A-31, B-27, C-05, D-19 |
| F-14 Polish & submission | C-07, D-17, D-18, E-10, doc F-01…F-07 |

All WBS IDs from `project_plan.md` §1 are accounted for. B-11 (SpotBugs) remains dropped for the
reason given there — it needs compiled bytecode and the worker only shallow-clones.

---

## 10. New risks introduced by this change

Additions to the `project_plan.md` §3 register; the existing R-01…R-13 all still apply.

| # | Risk | Like. | Impact | Mitigation |
|---|---|---|---|---|
| R-14 | **Teammates writing API code produce inconsistent endpoints** (different error shapes, missing auth) | High | Medium | Every cross-trained endpoint is reviewed by Rumesh before merge. `api_design.md` §10 defines the error shape and pagination — copy the pattern in `authService.ts`, don't invent one. |
| R-15 | **Mobile is at 0% with 10 weeks left** | High | High | Scaffold + auth pulled forward into Sprint 1 rather than Week 9. If mobile auth isn't working by Aug 9, escalate immediately — it's cut-list item 7 and we need the lead time to decide. |
| R-16 | **Sprint 1 integration reveals unknown breakage** — client and server have literally never spoken | High | High | Deliberately front-loaded: F-02 is the *easiest* integration (the API side is already written and working) so problems surface in week 1, not week 8. |
| R-17 | **Two people editing `apps/web` at once causes conflicts** (§2.3 vs the `CLAUDE.md` ownership rule) | Medium | Low | Nethmi stays the reviewer on every `apps/web` PR. Vidushi's web work is limited to D-16, one isolated component. |
| R-18 | **Feature Owner accountability doesn't stick** and we drift back to "my half is done" | Medium | High | Fifteen-minute standup Mon/Thu. The only question asked is *"which feature reached Done this week?"* — not "what did you work on." |

---

## 11. Decisions Rumesh needs to make before Sprint 1 starts

Three open items. Nobody should start Sprint 1 work that depends on them until they're settled.

1. **Does the `CLAUDE.md` app-ownership rule relax?** This plan has Nethmi writing API endpoints
   in `apps/api` and Vidushi writing one component in `apps/web`. That's the whole point of
   feature-wise delivery, but it directly contradicts *"don't edit another teammate's app without
   asking first."* Suggested resolution: ownership becomes **review authority** rather than write
   authority — anyone may open a PR against any app, but the app owner must approve it.

2. **Is mobile still in scope?** It's 0% with 10 weeks left and it's cut-list item 7. Deciding
   *now* to keep it (and protecting Vidushi's time accordingly) or to cut it (and moving her onto
   backend features) is far better than discovering the answer in September. This plan assumes
   **keep**, with mobile auth pulled into Sprint 1 as the go/no-go checkpoint.

3. **Do we tell the mentor about the reorganization?** Recommended yes, at the next check-in — it's
   a direct response to their feedback and the traceability matrix in §9 shows scope is unchanged.
   Worth confirming the feature list matches what they had in mind before we commit three sprints
   to it.

Also needing a follow-up, but not blocking: **`docs/gantt_schedule.csv` still reflects the
layer-first schedule** and will need regenerating from §6 before the next document submission.

---

*Living document. Update the status columns at every Monday standup. If a feature slips, move it
whole — do not ship half a feature and call it progress.*
