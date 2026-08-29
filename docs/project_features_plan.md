# Coding Workflow — Linear Flow

> **Scope:** development tasks only. SRS, Architecture, Testing document, Final report and Marketing video (`F-03`–`F-07`) run on a separate track and are not listed here.
>
> **Written:** 26 July 2026 (end of Week 5) · **Runs:** Week 6 → Week 15 · **Ends:** 3 October 2026
>
> **Revised:** 31 July 2026 — steps `5a`, `5b` and `12a` inserted after the mentor confirmed that
> org-level multi-tenancy is a hard requirement (`requirements_analysis.md` Q-1). Existing step
> numbers were **not** renumbered, so every other reference in this document still resolves.
>
> **Revised:** 29 August 2026 — Weeks 11–15 re-issued after the mid-evaluation. Steps `95`–`108`
> appended for the work specified in `analysis_access_and_reporting_design.md` §7; mobile push
> notifications cut; four existing steps moved between people to absorb Week 10 spillover. Following
> the 31 Jul precedent, **nothing was renumbered** — new steps append, cut steps are listed rather
> than deleted, so every existing reference still resolves. Weeks 6–10 are untouched historical
> record.
>
> **Team:** Rumesh (lead) · Nethmi · Vidushi

---
 
## How to read this

One continuous chain, **step 1 to step 94, top to bottom**.

- **Within one person's steps, the order is strict** — do not start your next step until the previous one is merged to `develop`.
- **Across people, steps run in parallel.** Step 8 and step 9 sit next to each other because they happen at the same time, not because one waits for the other.
- The **Waits for** column is the only real blocker. If it names a step, that step must be merged first.
- Rows marked **⛔** are hard gates. Do not cross one with the previous week unfinished.

---

## WEEK 6 · 27 Jul – 2 Aug
**Goal: the web dashboard reads real data out of Postgres over HTTP, scoped to an organization.**

| # | Name | WBS | Task | Waits for | Hrs |
|---|---|---|---|---|---|
| 1 | Rumesh | `A-28` | `GET /health` endpoint | — | 1 |
| 2 | Rumesh | `A-29` | Pino structured logging + pino-pretty | — | 2 |
| 3 | Nethmi | `D-05` | API client module — fetch wrapper, base URL, auth interceptor | — | 4 |
| 4 | Vidushi | `C-04` | Confirm seed script on `develop`, runs clean from `migrate reset` | — | 2 |
| 5 | Rumesh | `A-32` | Role authorisation middleware + `/api/repos/:id/members` | 1, 2 | 4 |
| **5a** | Rumesh | `C-09` | **Organization tenancy schema — `Organization`, `OrganizationMember`, `Repository.orgId`, backfill migration, two-tenant seed** | 5 | 3 |
| **5b** | Rumesh | `A-33` | **Tenant enforcement — GitHub org sync, `requireOrgAccess`, rewrite `requireRepoAccess`, `/api/orgs` endpoints, drop the platform-admin bypass** | 5a | 6 |
| 6 | Nethmi | `D-04a` | Auth context provider + protected route wrapper | 3 | 3 |
| 7 | Vidushi | `C-05` | Index validation — `EXPLAIN ANALYZE` on trend, findings, repo list | 4 | 3 |
| 8 | Rumesh | `A-11` | `GET / POST / DELETE /api/repos` — list, link, unlink (link resolves `orgId` from the repo's GitHub owner) | **5b** | 5 |
| 9 | Nethmi | `D-04b` | Login page wired to real `GET /auth/github` + callback | 6 | 2 |
| 10 | Vidushi | `A-13` | `GET /api/repos/:id/trend` | 7 | 3 |
| 11 | Rumesh | `A-12` | `GET /api/repos/:id` — detail + latest snapshot | 8 | 3 |
| 12 | Nethmi | `D-06` | Repo list page — delete `mockRepositories`, fetch real data | 8, 9 | 3 |
| **12a** | Nethmi | `D-20` | **Organization switcher in the topbar, fed by `GET /api/orgs`; selected org scopes the repo list** | 5b, 12 | 3 |
| 13 | Vidushi | `A-14` | `GET /api/repos/:id/debt` — breakdown by category | 10 | 2 |
| 14 | Nethmi | `A-21` | `GET /api/repos/available` — user's GitHub repos via Octokit, filtered to the selected org | 12a | 3 |
| 15 | Vidushi | `E-01` | Expo project scaffold in `apps/mobile` | 13 | 3 |
| 16 | Vidushi | `E-02` | Bottom tab navigator + empty screen scaffolds | 15 | 3 |

> **Steps 1–2 are 3 hours combined and were due in Week 2.** Clear them Monday morning before anything else.
> **Step 3 blocks nine pages.** Pair on it with Rumesh for the first two hours, screen shared.
> **Steps 15–16 are already two weeks late.** They ship this week regardless of what else slips.
> **Steps 5a–5b are the mentor's multi-tenancy correction.** They land *before* `A-11` deliberately: `POST /api/repos` writes `Repository.orgId`, so linking a repo without the tenant model in place would create rows that have to be migrated again a week later. Doing it now costs 9h; doing it after `A-11` costs that plus a second backfill.
> **Step 12a is new work for Nethmi (+3h).** The dashboard now has to answer "which organization am I looking at", and the placeholder pages already reserved for this (`GlobalMembersPage`, `GlobalAnalyticsPage`) are the natural home. Flag it at Monday standup rather than discovering it in step 14.

**⛔ GATE — Sunday 2 Aug:** the repositories page renders rows that came out of Postgres, **for the signed-in user's organization only**. A second account in a different organization must not see them. If false, Week 7 becomes a rescue week.

---

## WEEK 7 · 3 Aug – 9 Aug
**Goal: the full demo path works end to end. Code freeze Sunday 9 Aug.**

| # | Name | WBS | Task | Waits for | Hrs |
|---|---|---|---|---|---|
| 17 | Rumesh | `A-09` | BullMQ setup — Redis connection, queue definition | 11 | 4 |
| **17a** | ~~Nethmi~~ **Rumesh** | `A-34` | ✅ **Done 10 Aug.** Session-backed revocation: 15-min access JWT + rotating 7-day refresh token hashed into `Session`, family-wide reuse detection, real `POST /auth/logout`, admin force-logout. Removed the `demo-token` backdoor. **Reassigned to Rumesh and rescoped — see the note below** | 17 | ~~4~~ 14 |
| **17b** | Vidushi → **Rumesh** | `A-35` | ✅ **Done 11 Aug.** Single-use Redis nonce shipped in `0779659`; browser binding completed on top — `/auth/github` sets the nonce in an `HttpOnly; SameSite=Lax` cookie and the callback rejects any state whose nonce doesn't match, closing the login-CSRF where an attacker could hand a victim a login landing in the attacker's account | 17 | 2 |
| 18 | Nethmi | `C-04b` | Extend seed with ~30 days of `HealthSnapshot` history | 4 | 3 |
| 19 | Vidushi | `A-15` | `GET /api/repos/:id/hotspots` — worst files | 16 | 3 |
| 20 | Rumesh | `A-10` | Enqueue analysis job from webhook handler (replace the `202` drop) | 17 | 2 |
| 21 | Nethmi | `D-07` | Link repository modal wired to `/available` + `POST /api/repos` | 14, 18 | 4 |
| 22 | Vidushi | `A-16` | `GET /api/repos/:id/pulls` + `/:prNumber` | 19 | 4 |
| 23 | Rumesh | `A-30` | Bull Board at `/admin/queues` + basic auth on `/admin` | 20 | 1 |
| 24 | Nethmi | `D-09` | Repo detail page — hero section + tabs, fed by real API | 11, 21 | 3 |
| 25 | Vidushi | `A-17` | `GET /api/snapshots/:id/findings` — paginated + filtered | 22 | 4 |
| 26 | Rumesh | `A-18` | `POST /api/repos/:id/analyze` — manual trigger | 23 | 2 |
| 27 | Nethmi | `D-10` | Trend chart wired to `/trend`, range selector live | 10, 18, 24 | 4 |
| 28 | Vidushi | `E-03` | Mobile auth — token exchange, persist in SecureStore | 25 | 5 |

> **Step 26 is demo infrastructure.** It lets you trigger analysis on command instead of praying GitHub delivers a webhook in front of an evaluator.
> **Step 29 moved to Week 8 (now 32a).** The row waited on step 26, but its real prerequisite is a queue consumer — `apps/worker/` is still empty, so a webhook delivered over `ngrok` enqueues a job nothing picks up. It also leaves `AnalysisJob` rows `PENDING`, and the manual trigger returns `429` while any `PENDING` job exists for the repo, so the gate's "run it three times" would fail on the second run. It now sits directly behind `B-01`.
> **Step 18 is why the trend chart won't demo as a single dot.**
> **Step 17a was reassigned from Nethmi to Rumesh and grew from 4h to ~14h.** Two reasons. First, the mechanism changed: the row said "Redis denylist", but the submitted architecture document specifies `Session.tokenHash` with `validateSession()` / `revokeSession()` and states that session tokens are stored hashed — none of which was true of the code. Building the denylist would have satisfied the row while leaving three submitted claims false, so the design moved to the `Session` table the SAD already describes. Second, it stopped being a backend-only task: the OAuth callback now redirects instead of returning JSON, so `apiClient.ts`, `AuthContext.tsx`, `AuthCallbackPage.tsx` and `LoginPage.tsx` all changed. **That is Nethmi's app — the web half needs her review before merge**, which inverts the row's original "reviewed by Rumesh".
> **The `demo-token` backdoor is gone, which changes how you run the app locally.** Until now every anonymous visitor was silently signed in as a platform ADMIN, so the dashboard "worked" with no login at all. It now redirects to `/login` like a real app. Set `ENABLE_DEV_LOGIN=true` and use `POST /auth/dev-login` if your GitHub OAuth credentials aren't configured.
> **Step 28 is unblocked and better specified than when it was written.** The API now issues tokens on two transports; mobile sends `?client=native` to `/auth/github` and gets JSON with a `refreshToken` instead of a cookie, so there is nothing left to design — it's SecureStore plumbing plus a deep link.

**⛔ GATE — Friday 8 Aug, full dress rehearsal:** log in → link a repo → open repo detail → trend chart draws a real curve. Run it three times. Freeze Saturday.

---

## WEEK 8 · 10 Aug – 16 Aug — **PROGRESS REVIEW 1**
**No new features until the review is done.**

| # | Name | WBS | Task | Waits for | Hrs |
|---|---|---|---|---|---|
| 30 | All | — | Demo rehearsal, fallback script, bug triage (Mon 10 Aug) | 28 | 4 |
| 31 | All | — | **PROGRESS REVIEW 1** (10–14 Aug) | 30 | — |
| 32 | Rumesh | `B-01` | Worker scaffold — BullMQ consumer, job processor registration | 31 | 4 |
| **32a** | Rumesh | — | **Moved from Week 7 (was step 29).** Integration pass: full path via `ngrok` + real test repo | 32 | 6 |
| 33 | Nethmi | `D-13` | PR scan history table + debt delta indicator | 31 | 4 |
| 34 | Vidushi | `E-04` | API client module for mobile | 31 | 3 |

> **Mid Evaluation opens 15 Aug.** Capacity drops to ~10h/person for Weeks 9–10. Already priced in below.
> **Step 32a puts Rumesh at 10h this week** instead of 4h, still under his ~15h/wk average. The hours moved from Week 7, they aren't new. Run it as soon as 32 merges — risk `R-03` in `project_plan.md` wants real webhooks tested by Week 8, and this is the last position that still honours that.
> **Step 32a stops at the queue draining, not at a real score.** A consumer that flips `AnalysisJob` to `COMPLETED` is enough to prove the tunnel, the HMAC check, the payload shape and GitHub's redelivery behaviour. Verifying that the pipeline produces a real `HealthSnapshot` is already a separate row — step 86 (`B-27`, Week 14).

---

## WEEK 9 · 17 Aug – 23 Aug · *(Mid Eval — reduced capacity)*
**Goal: the worker starts consuming jobs. Cross-platform rotation begins.**

| # | Name | WBS | Task | Waits for | Hrs |
|---|---|---|---|---|---|
| 35 | Rumesh | `B-02` | Clone stage — `git clone --depth=1`, temp directory management | 32 | 4 |
| 36 | Nethmi | `A-19` | `GET` / `PUT` quality gate endpoints | 33 | 3 |
| 37 | Vidushi | `D-11` | Debt breakdown donut chart wired to `/debt` | 34 | 4 |
| 38 | Rumesh | `B-03` | Language detection — scan extensions, map to tools | 35 | 3 |
| 39 | Nethmi | `A-20` | Notification endpoints — list, mark read, mark all | 36 | 3 |
| 40 | Vidushi | `D-12` | Hotspot table — sortable, wired to `/hotspots` | 37 | 4 |
| 41 | Rumesh | `B-23` | Cleanup stage — remove temp directory, always runs | 38 | 2 |
| 42 | Nethmi | `D-14` | PR finding drill-down page — filter bar, finding cards | 25, 39 | 6 |

> **Steps 36 and 39 are Nethmi's first backend endpoints** — they feed pages she already built, so she knows the exact JSON shape needed.
> **Steps 37 and 40 are Vidushi's first web components** — both backed by endpoints she wrote herself, so nobody can block her.

---

## WEEK 10 · 24 Aug – 30 Aug · *(Mid Eval ends 30 Aug — reduced capacity)*
**Goal: first analyzers producing real findings.**

| # | Name | WBS | Task | Waits for | Hrs |
|---|---|---|---|---|---|
| 43 | Rumesh | `B-04` | ESLint analyzer wrapper — invoke CLI, parse JSON · **→ carried to W11** | 41 | — |
| 44 | Nethmi | `D-16` | Notification bell + dropdown in topbar | 39, 42 | 4 |
| 45 | Vidushi | `A-22` | Mobile summary + code-smells endpoints | 40 | 3 |
| 46 | Rumesh | `B-05` | PyLint analyzer wrapper · **→ carried to W11** | 43 | — |
| 47 | Nethmi | `A-25` | zod validation middleware across all endpoints | 44 | 4 |
| 48 | Vidushi | `A-23` | Device registration endpoints (push tokens) · **→ cut** | 45 | — |
| 49 | Rumesh | `D-15` | Quality gate configuration page — sliders, toggles, save · **→ carried to W11, now Vidushi** | 36 | — |
| 50 | Vidushi | `A-26` | Rate limiting middleware · **→ carried to W11** | — | — |
| 51 | Vidushi | `A-31` | `GET /api/metrics` — admin-only · **→ carried to W11** | 50 | — |

> **Step 49 was Rumesh's web task**, on the reasoning that whoever writes the gate evaluator should also build the page that configures it. The 29 Aug replan moved it to Vidushi for capacity — see Week 11.
>
> ⚠️ **This week did not close.** As of 29 Aug, steps **43**, **46**, **49**, **50** and **51** were unmerged — roughly 12h of Rumesh's and 4h of Vidushi's work. They are carried into Week 11 rather than restarted, and step 48 was cut outright. Everything else in Weeks 6–10 stands as recorded.


---

## WEEK 11 · 31 Aug – 6 Sep · *(full capacity resumes)*
**Goal: Week 10 spillover cleared, all analyzers done and normalised, data plane contract started.**

| # | Name | WBS | Task | Waits for | Hrs |
|---|---|---|---|---|---|
| 43 | Rumesh | `B-04` | ESLint analyzer wrapper — invoke CLI, parse JSON · *carried from Week 10* | 41 | 4 |
| 95 | Rumesh | `B-29` | `eslint-plugin-sonarjs` added to the worker's ESLint config | 43 | 1 |
| 46 | Rumesh | `B-05` | PyLint analyzer wrapper · *carried from Week 10* | 43 | 3 |
| 55 | Nethmi | `B-06` | Bandit analyzer wrapper (Python security) · *reassigned* | 47 | 3 |
| 58 | Nethmi | `B-07` | Radon analyzer wrapper (complexity + maintainability index) · *reassigned* | 55 | 3 |
| 49 | Vidushi | `D-15` | Quality gate configuration page — sliders, toggles, save · *carried, reassigned* | 36 | 5 |
| 50 | Vidushi | `A-26` | Rate limiting middleware · *carried from Week 10* | — | 2 |
| 51 | Vidushi | `A-31` | `GET /api/metrics` — admin-only · *carried from Week 10* | 50 | 2 |
| 54 | Vidushi | `C-07` | Migration pass for schema changes surfaced in development | 51 | 2 |
| 96 | Rumesh | `B-28` | Contract DTOs in `packages/shared` — job descriptor, results payload | — | 2 |
| 103 | Vidushi | `C-10` | Data plane agent record + migration — token hash, org, last-seen | 54 | 2 |
| 102 | Nethmi | `A-40` | Subscribe webhook registration to `push` events | — | 1 |
| 107 | Vidushi | `A-39` | Orphaned-webhook fix in `unlinkRepository` | — | 2 |
| 56 | Nethmi | `E-05` | Mobile home screen — repo list with sparklines | 34, 45, 53 | 5 |
| 61 | Rumesh | `B-12` | Output normaliser — every tool → unified `Finding` shape | 43, 46, 53, 55, 58 | 5 |

**Load: Rumesh 15h · Nethmi 12h · Vidushi 15h**

> **Steps 43, 46, 49, 50 and 51 are Week 10 spillover.** They are carried, not restarted. Week 11 is
> the week the schedule reabsorbs them, which is why three steps changed owner.
> **Steps 55 and 58 moved to Nethmi.** She wrote the jscpd wrapper (step 53) so the shape is familiar,
> and running them in parallel with Rumesh's B-04/B-05 is what makes five analyzers inside one week
> possible at all.
> **Step 49 moved to Vidushi.** The original single-owner rationale — the person who writes the gate
> evaluator also builds its page — is deliberately given up here for capacity. Vidushi builds the page
> against `QualityGate`'s field list; **Rumesh still owns the evaluator (step 70)**, so the two must be
> checked against each other at review rather than by shared authorship.
> **Step 61 remains the widest bottleneck in the project.** Five analyzers feed it; steps 97 and 106
> wait behind it. If an analyzer is late, cut it rather than delay step 61.
> **Steps 96, 102, 103 and 107 are new.** 96 and 103 are the foundations everything in Week 12 builds
> on; 102 and 107 are small independent fixes parked here because they block nothing.

---

## WEEK 12 · 7 Sep – 13 Sep — **FEATURE FREEZE ENDS THIS WEEK**
**Goal: scoring engine complete, control plane contract endpoints live, PR comment reports metrics.**

| # | Name | WBS | Task | Waits for | Hrs |
|---|---|---|---|---|---|
| 62 | Rumesh | `B-13` | Health Score computation — pure, testable function — **ship by Wed** | 61 | 4 |
| 63 | Rumesh | `B-14` | Debt Score — sum remediation minutes from cost table | 62 | 3 |
| 99 | Nethmi | `A-36` | Agent authentication + results-ingest endpoint | 96, 103 | 5 |
| 65 | Vidushi | `B-25` | Unit tests for the scoring function | 62 | 3 |
| 66 | Rumesh | `B-15` | Finding matcher — `NEW` / `EXISTING` / `RESOLVED` vs baseline | 63 | 4 |
| 104 | Vidushi | `C-11` | `PullRequest.botCommentId` migration | 54 | 1 |
| 67 | Vidushi | `B-18` | PR comment markdown builder — score + debt summary + delta | 63, 65 | 3 |
| 100 | Nethmi | `A-37` | Job-lease endpoint — lease / complete / fail, fixed visibility timeout | 99 | 5 |
| 105 | Vidushi | `B-31` | PR comment metrics table — per-metric value / threshold / status | 67, 104 | 3 |
| 69 | Rumesh | `B-16` | Debt delta — current debt minus baseline | 66 | 2 |
| 70 | Rumesh | `B-17` | Quality gate evaluator | 69 | 2 |
| 101 | Nethmi | `D-21` | Bulk enable UI — multi-select picker, progress, per-repo result summary | 98 | 3 |
| 106 | Vidushi | `B-30` | TODO / FIXME / HACK scan analyzer (self-admitted debt) | 61 | 2 |

**Load: Rumesh 15h · Nethmi 13h · Vidushi 12h**

> **Steps 62 and 63 must be merged by Wednesday.** Steps 65 and 67 sit directly behind them.
> **Step 65 is deliberate:** whoever writes the scoring function should not write its tests, and
> writing the cases is the fastest way to actually learn `scoring_algorithm.md`. Expect an evaluator
> to ask any member about this function.
> **Steps 99 and 100 are the control plane half of the data plane contract.** Step 97 in Week 13
> cannot start until 100 is merged, so these two are the week's real deadline, not the scoring chain.
> **Step 105 extends step 67 rather than replacing it** — 67 renders the body, 105 adds the metrics
> table that reports which threshold each metric breached.
> **Steps 59, 64, 68 and 71 moved to Weeks 13–14.** All four are polish (loading states, responsive
> layout, mobile screens) and were the only things in this week that could move.

**⛔ GATE — Sunday 13 Sep: FEATURE FREEZE.** Anything not working now gets cut per `project_plan.md`
§4, not pushed forward. Note that the Week 13 pipeline steps (97, 75, 76, 77, 98) are *completion of
already-started work*, not new features, and are inside the freeze by design. Genuine cut candidates
at this gate, in order: **step 106** (TODO scan), **step 108** (self-hosted deployment docs), and the
reconciliation job already deferred in `analysis_access_and_reporting_design.md` §4.4.

---

## WEEK 13 · 14 Sep – 20 Sep
**Goal: the loop closes — results reach GitHub and the dashboard, across the plane boundary.**

| # | Name | WBS | Task | Waits for | Hrs |
|---|---|---|---|---|---|
| 97 | Rumesh | `B-21` | Result persistence as an authenticated API client — replaces direct Prisma writes | 61, 69, 96, 100 | 6 |
| 73 | Nethmi | `D-19` | Frontend unit and component tests | 68 | 5 |
| 74 | Vidushi | `A-27` | API integration tests across all endpoints — **must include the cross-tenant matrix** (second org's token → 404 on every repo-scoped route) | 47, 71 | 6 |
| 75 | Rumesh | `B-19` | GitHub PR comment poster (Octokit, updates existing comment) | 67, 97, 105 | 4 |
| 98 | Rumesh | `A-38` | Bulk repository enable — endpoint + queued registration job | 96 | 5 |
| 76 | Vidushi | `B-20` | GitHub commit status poster — pass / fail · *reassigned* | 70, 75 | 2 |
| 77 | Rumesh | `B-22` | Notification creation — gate fail, score drop, critical vulnerability | 76 | 3 |
| 59 | Nethmi | `D-17` | Loading, empty and error states across all web pages | 56 | 4 |
| 64 | Nethmi | `E-07` | Mobile notification screen — list, mark read, swipe | 39, 56 | 4 |
| 71 | Vidushi | `E-10` | Mobile UI polish — loading states, pull-to-refresh, empty states | 67 | 4 |
| 78 | Nethmi | — | **Cross-test the mobile app and the API** — not her own code | 73 | 4 |
| 79 | Vidushi | — | **Cross-test the web dashboard** — not her own code | 74 | 4 |

**Load: Rumesh 18h · Nethmi 17h · Vidushi 16h**

> **Step 97 replaces the original step 72.** Persistence is written once, against the contract, rather
> than as Prisma writes that would have to be unpicked later. This is the single item whose cost rises
> if it slips — everything else deferred can be added later at roughly the same price.
> **Step 76 moved to Vidushi** purely to keep Rumesh's week under 20h; it is small and self-contained.
> **Steps 78 and 79 are mandatory and nobody tests their own platform.** Finding someone else's bug is
> the fastest route into their code, and every bug you find is one the evaluator doesn't.
> **Step 74's tenant matrix is not optional.** The two-tenant seed fixture from step 5a exists
> precisely so these tests are cheap to write. A missing authorisation guard is the one bug class that
> ships silently and looks like a working feature — `A-33` had to fix exactly that on `/trend`, where
> the route's own comment claimed a check the middleware chain did not have.

---

## WEEK 14 · 21 Sep – 27 Sep
**Goal: packaged, deployed, running on real infrastructure — in both deployment topologies.**

| # | Name | WBS | Task | Waits for | Hrs |
|---|---|---|---|---|---|
| 80 | Rumesh | `B-24` | Worker Docker image with multi-language runtimes | 61, 77 | 5 |
| 81 | Nethmi | — | Fix bugs raised by step 79, final web polish | 79 | 6 |
| 82 | Vidushi | — | Fix bugs raised by step 78, final mobile polish | 78 | 5 |
| 83 | Rumesh | `B-26` | Unit tests for the normalisers | 80 | 4 |
| 68 | Nethmi | `D-18` | Responsive layout adjustments, 1024px–1920px | 59 | 3 |
| 108 | Vidushi | `B-32` | Self-hosted data plane — compose file + deployment docs | 80, 97, 100 | 3 |
| 84 | Nethmi | — | Deploy the web dashboard to cloud hosting | 81 | 4 |
| 85 | Vidushi | — | Build and distribute the mobile app via Expo EAS | 82 | 4 |
| 86 | Rumesh | `B-27` | End-to-end integration test of the analysis pipeline | 83 | 5 |
| 88 | Rumesh + Vidushi | — | Deploy API, worker, Postgres and Redis to cloud | 86 | 6 |
| 89 | All | — | Cross-platform integration test on the deployed stack | 84, 88 | 5 |

**Load: Rumesh ~19h · Nethmi ~15h · Vidushi ~17h** *(88 split two ways, 89 three ways)*

> **Step 108 is what makes the hybrid model demonstrable.** Running the same worker image twice — once
> beside the API, once as a "customer" deployment talking over HTTPS — is the demo that answers the
> private-repo objection. It depends on 80, so it cannot start earlier.

---

## WEEK 15 · 28 Sep – 3 Oct — **REVIEW 2 & FINAL EVALUATION**
**No new code. Regression fixes only.**

| # | Name | WBS | Task | Waits for | Hrs |
|---|---|---|---|---|---|
| 90 | All | — | Production smoke test on the deployed environment | 89 | 4 |
| 91 | All | — | Fix integration bugs, retest regressions | 90 | 6 |
| 92 | All | — | Demo preparation — script the run-through, rehearse three times | 91 | 4 |
| 93 | All | — | **PROGRESS REVIEW 2** (28 Sep – 2 Oct) | 92 | — |
| 94 | All | — | **FINAL EVALUATION** (3 Oct) | 93 | — |

---

## Cut at the 29 Aug replan

Removed to make room for the mid-evaluation work. Per `project_plan.md` §4 these are Cut List rank 3,
marked **Safe** — in-app notifications still ship on both web (`D-16`, step 44) and mobile (`E-07`,
step 64); only device push is gone.

| # | WBS | Task | Was | Hrs |
|---|---|---|---|---|
| 48 | `A-23` | Device registration endpoints (push tokens) | Vidushi | 2 |
| 52 | `A-24` | Push notification dispatch service (Expo Push API) | Rumesh | 4 |
| 57 | `E-08` | Push notification setup — Expo Notifications | Vidushi | 5 |
| 60 | `E-09` | Push handling — foreground / background, tap-to-navigate | Vidushi | 4 |
| 87 | — | Physical device testing (`R-09`) | Vidushi | 3 |

Frees **18h** — Rumesh 4h, Vidushi 14h — and removes an entire critical link from Week 11, which was
the week carrying the Week 10 spillover.

> The `Device` model (`C-06`) stays in the schema, unused. Leaving it is cheaper than a migration and
> it documents the intent if push is ever restored.
> **Step 77 no longer waits on step 52.** It now waits on 76. In-app notification rows are still
> created; only the push dispatch that would have consumed them is gone.

---

## Chain summary — who runs where

| Person | Steps | Hours | Weeks 6–14 avg |
|---|---|---|---|
| **Rumesh** | 1, 2, 5, **5a**, **5b**, 8, 11, 17, **17a**, 20, 23, 26, 32, **32a**, 35, 38, 41, 43, 46, 61, 62, 63, 66, 69, 70, 75, 77, 80, 83, 86, 88, **95**, **96**, **97**, **98** | ~125h | ~13.3h/wk |
| **Nethmi** | 3, 6, 9, 12, **12a**, 14, 18, 21, 24, 27, 33, 36, 39, 42, 44, 47, 53, 55, 56, 58, 59, 64, 68, 73, 78, 81, 84, **99**, **100**, **101**, **102** | ~119h | ~12.7h/wk |
| **Vidushi** | 4, 7, 10, 13, 15, 16, **17b**, 19, 22, 25, 28, 34, 37, 40, 45, 49, 50, 51, 54, 65, 67, 71, 74, 76, 79, 82, 85, 88, **103**, **104**, **105**, **106**, **107**, **108** | ~112h | ~11.9h/wk |

New steps from the 29 Aug replan are in bold. They total **14h Rumesh · 14h Nethmi · 13h Vidushi** —
the new work is split evenly by design, which was the explicit requirement for this replan.

Hours are summed from the week tables above and include the shared steps (30, 31, 88–94), which are
not listed in the Steps column. Carried steps are counted once, in the week they are actually done.

> **The totals moved a long way.** Before this replan the split was ~135h / ~79h / ~85h — the lead
> carrying more than the other two combined. Cutting push, moving `B-06`, `B-07`, `D-15` and `B-20`,
> and splitting the new work three ways brings it to roughly 125 / 119 / 112. That is close enough to
> even that no one person is now the schedule's single point of failure.

Lighter than the original plan because documentation sits on a separate track. Treat the difference as
buffer for exam weeks and integration bugs — both consistently cost more than anyone budgets.

> **The 31 Jul revision costs 12h in total** — 9h on Rumesh (steps 5a, 5b) and 3h on Nethmi (step 12a),
> all inside Week 6.
> **The 29 Aug replan is net −18h of cuts and +41h of new work.** It moves four existing steps between
> people (55, 58 and 49 off Rumesh; 76 off Rumesh) to keep Week 11 inside capacity after absorbing the
> Week 10 spillover — without which Rumesh's Week 11 would have been ~27h.

---

## The six critical links in the chain

If any one of these slips, the chain behind it stalls. Watch these more than anything else.

| Link | Step | Why |
|---|---|---|
| 1 | **3** — `D-05` API client | Nine pages sit behind it. Week 6, Monday. |
| 2 | **5b** — `A-33` tenant enforcement | Every repo-scoped endpoint written after it inherits the tenant guard for free; anything written before it has to be revisited. |
| 3 | **8** — `A-11` repo CRUD | First real endpoint. Step 12 and the Review 1 demo depend on it. |
| 4 | **96** — contract DTOs | Steps 97, 99 and 108 all depend on it. Two hours of work that three larger steps sit behind — do it in the first days of Week 11. |
| 5 | **61** — `B-12` normaliser | Five analyzers in, persistence and tests out. Widest bottleneck in the project. |
| 6 | **100** — job-lease endpoint | Step 97 blocks on it, and 97 is the last chance to write persistence once instead of twice. Last feature week. |

> Link 4 was `A-24` push dispatch before the 29 Aug replan. Cutting push removed that link entirely.
> Steps **62/63** (scoring) remain tight — 65 and 67 sit directly behind them — but they are no longer
> the week's binding constraint; steps 99 and 100 are.

---

## Working rules

1. **Sequential within your own steps.** Do not start your next until the previous is merged to `develop`.
2. **Cross-platform review.** No PR merges with only a same-platform approval. The reviewer's job is to be able to explain the change afterwards, not to catch bugs.
3. **One log row per merged step.** In your `learning-log-*.md`: what it does, why that approach, the question you'd be asked.
4. **24-hour blocker rule.** Blocked longer than a day and it becomes the lead's problem. Silent blockage is how three-person teams fail.
5. **Gates are hard.** Weeks 6, 7 and 12. Miss one and re-plan that Sunday rather than hoping the next week absorbs it.
