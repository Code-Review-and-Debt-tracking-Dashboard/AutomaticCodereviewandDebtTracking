# Coding Workflow — Linear Flow

> **Scope:** development tasks only. SRS, Architecture, Testing document, Final report and Marketing video (`F-03`–`F-07`) run on a separate track and are not listed here.
>
> **Written:** 26 July 2026 (end of Week 5) · **Runs:** Week 6 → Week 15 · **Ends:** 3 October 2026
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
**Goal: the web dashboard reads real data out of Postgres over HTTP.**

| # | Name | WBS | Task | Waits for | Hrs |
|---|---|---|---|---|---|
| 1 | Rumesh | `A-28` | `GET /health` endpoint | — | 1 |
| 2 | Rumesh | `A-29` | Pino structured logging + pino-pretty | — | 2 |
| 3 | Nethmi | `D-05` | API client module — fetch wrapper, base URL, auth interceptor | — | 4 |
| 4 | Vidushi | `C-04` | Confirm seed script on `develop`, runs clean from `migrate reset` | — | 2 |
| 5 | Rumesh | `A-32` | Role authorisation middleware + `/api/repos/:id/members` | 1, 2 | 4 |
| 6 | Nethmi | `D-04a` | Auth context provider + protected route wrapper | 3 | 3 |
| 7 | Vidushi | `C-05` | Index validation — `EXPLAIN ANALYZE` on trend, findings, repo list | 4 | 3 |
| 8 | Rumesh | `A-11` | `GET / POST / DELETE /api/repos` — list, link, unlink | 5 | 5 |
| 9 | Nethmi | `D-04b` | Login page wired to real `GET /auth/github` + callback | 6 | 2 |
| 10 | Vidushi | `A-13` | `GET /api/repos/:id/trend` | 7 | 3 |
| 11 | Rumesh | `A-12` | `GET /api/repos/:id` — detail + latest snapshot | 8 | 3 |
| 12 | Nethmi | `D-06` | Repo list page — delete `mockRepositories`, fetch real data | 8, 9 | 3 |
| 13 | Vidushi | `A-14` | `GET /api/repos/:id/debt` — breakdown by category | 10 | 2 |
| 14 | Nethmi | `A-21` | `GET /api/repos/available` — user's GitHub repos via Octokit | 12 | 3 |
| 15 | Vidushi | `E-01` | Expo project scaffold in `apps/mobile` | 13 | 3 |
| 16 | Vidushi | `E-02` | Bottom tab navigator + empty screen scaffolds | 15 | 3 |

> **Steps 1–2 are 3 hours combined and were due in Week 2.** Clear them Monday morning before anything else.
> **Step 3 blocks nine pages.** Pair on it with Rumesh for the first two hours, screen shared.
> **Steps 15–16 are already two weeks late.** They ship this week regardless of what else slips.

**⛔ GATE — Sunday 2 Aug:** the repositories page renders rows that came out of Postgres. If false, Week 7 becomes a rescue week.

---

## WEEK 7 · 3 Aug – 9 Aug
**Goal: the full demo path works end to end. Code freeze Sunday 9 Aug.**

| # | Name | WBS | Task | Waits for | Hrs |
|---|---|---|---|---|---|
| 17 | Rumesh | `A-09` | BullMQ setup — Redis connection, queue definition | 11 | 4 |
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
| 29 | Rumesh | — | Integration pass: full path via `ngrok` + real test repo | 26 | 6 |

> **Step 26 is demo infrastructure.** It lets you trigger analysis on command instead of praying GitHub delivers a webhook in front of an evaluator.
> **Step 18 is why the trend chart won't demo as a single dot.**

**⛔ GATE — Friday 8 Aug, full dress rehearsal:** log in → link a repo → open repo detail → trend chart draws a real curve. Run it three times. Freeze Saturday.

---

## WEEK 8 · 10 Aug – 16 Aug — **PROGRESS REVIEW 1**
**No new features until the review is done.**

| # | Name | WBS | Task | Waits for | Hrs |
|---|---|---|---|---|---|
| 30 | All | — | Demo rehearsal, fallback script, bug triage (Mon 10 Aug) | 29 | 4 |
| 31 | All | — | **PROGRESS REVIEW 1** (10–14 Aug) | 30 | — |
| 32 | Rumesh | `B-01` | Worker scaffold — BullMQ consumer, job processor registration | 31 | 4 |
| 33 | Nethmi | `D-13` | PR scan history table + debt delta indicator | 31 | 4 |
| 34 | Vidushi | `E-04` | API client module for mobile | 31 | 3 |

> **Mid Evaluation opens 15 Aug.** Capacity drops to ~10h/person for Weeks 9–10. Already priced in below.

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
| 43 | Rumesh | `B-04` | ESLint analyzer wrapper — invoke CLI, parse JSON | 41 | 4 |
| 44 | Nethmi | `D-16` | Notification bell + dropdown in topbar | 39, 42 | 4 |
| 45 | Vidushi | `A-22` | Mobile summary + code-smells endpoints | 40 | 3 |
| 46 | Rumesh | `B-05` | PyLint analyzer wrapper | 43 | 3 |
| 47 | Nethmi | `A-25` | zod validation middleware across all endpoints | 44 | 4 |
| 48 | Vidushi | `A-23` | Device registration endpoints (push tokens) | 45 | 2 |
| 49 | Rumesh | `D-15` | Quality gate configuration page — sliders, toggles, save | 36, 46 | 5 |
| 50 | Vidushi | `A-26` | Rate limiting middleware | 48 | 2 |
| 51 | Vidushi | `A-31` | `GET /api/metrics` — admin-only | 50 | 2 |

> **Step 49 is Rumesh's web task.** He builds the page that configures the gate because he writes the evaluator (step 70) — one owner means the two can't drift apart.

---

## WEEK 11 · 31 Aug – 6 Sep · *(full capacity resumes)*
**Goal: all analyzers done, findings normalised, first mobile screens appear.**

| # | Name | WBS | Task | Waits for | Hrs |
|---|---|---|---|---|---|
| 52 | Rumesh | `A-24` | Push notification dispatch service (Expo Push API) — **do this Monday** | 48, 49 | 4 |
| 53 | Nethmi | `B-08` | jscpd analyzer wrapper (duplication detection) | 47 | 3 |
| 54 | Vidushi | `C-07` | Migration pass for schema changes surfaced in development | 51 | 2 |
| 55 | Rumesh | `B-06` | Bandit analyzer wrapper (Python security) | 52 | 3 |
| 56 | Nethmi | `E-05` | Mobile home screen — repo list with sparklines | 34, 45, 53 | 5 |
| 57 | Vidushi | `E-08` | Push notification setup — Expo Notifications, device registration | 28, 52, 54 | 5 |
| 58 | Rumesh | `B-07` | Radon analyzer wrapper (complexity + maintainability index) | 55 | 3 |
| 59 | Nethmi | `D-17` | Loading, empty and error states across all web pages | 56 | 4 |
| 60 | Vidushi | `E-09` | Push handling — foreground / background, tap-to-navigate | 57 | 4 |
| 61 | Rumesh | `B-12` | Output normaliser — every tool → unified `Finding` shape | 43, 46, 53, 55, 58 | 5 |

> **Step 52 runs Monday.** Steps 57 and 60 are blocked behind it and there is no slack in the week.
> **Step 61 is the widest bottleneck in the project** — six analyzers feed into it, and steps 72 and 83 both wait on it. If an analyzer is late, cut it rather than delay step 61.
> **Step 56 is Nethmi's first React Native screen** — a direct re-expression of the web repo list she already built.

---

## WEEK 12 · 7 Sep – 13 Sep — **FEATURE FREEZE ENDS THIS WEEK**
**Goal: scoring engine complete.**

| # | Name | WBS | Task | Waits for | Hrs |
|---|---|---|---|---|---|
| 62 | Rumesh | `B-13` | Health Score computation — pure, testable function — **ship by Wed** | 61 | 4 |
| 63 | Rumesh | `B-14` | Debt Score — sum remediation minutes from cost table | 62 | 3 |
| 64 | Nethmi | `E-07` | Mobile notification screen — list, mark read, swipe | 39, 56 | 4 |
| 65 | Vidushi | `B-25` | Unit tests for the scoring function | 62 | 3 |
| 66 | Rumesh | `B-15` | Finding matcher — `NEW` / `EXISTING` / `RESOLVED` vs baseline | 63 | 4 |
| 67 | Vidushi | `B-18` | PR comment markdown builder — score + debt summary + delta | 63, 65 | 3 |
| 68 | Nethmi | `D-18` | Responsive layout adjustments, 1024px–1920px | 59, 64 | 3 |
| 69 | Rumesh | `B-16` | Debt delta — current debt minus baseline | 66 | 2 |
| 70 | Rumesh | `B-17` | Quality gate evaluator | 69 | 2 |
| 71 | Vidushi | `E-10` | Mobile UI polish — loading states, pull-to-refresh, empty states | 60, 67 | 4 |

> **Steps 62 and 63 must be merged by Wednesday.** Steps 65 and 67 sit directly behind them and Week 12 is the last feature week.
> **Step 65 is deliberate:** whoever writes the scoring function should not write its tests, and writing the cases is the fastest way to actually learn `scoring_algorithm.md`. Expect an evaluator to ask any member about this function.

**⛔ GATE — Sunday 13 Sep: FEATURE FREEZE.** Anything not working now gets cut per `project_plan.md` §4, not pushed forward. First cut candidates: Cppcheck `B-11`, Checkstyle `B-09`, PMD `B-10`, push notifications.

---

## WEEK 13 · 14 Sep – 20 Sep
**Goal: the loop closes — results reach GitHub and the dashboard.**

| # | Name | WBS | Task | Waits for | Hrs |
|---|---|---|---|---|---|
| 72 | Rumesh | `B-21` | Result persistence — immutable `HealthSnapshot` + findings, transition job status | 61, 69 | 4 |
| 73 | Nethmi | `D-19` | Frontend unit and component tests | 68 | 5 |
| 74 | Vidushi | `A-27` | API integration tests across all endpoints | 47, 71 | 6 |
| 75 | Rumesh | `B-19` | GitHub PR comment poster (Octokit, updates existing comment) | 67, 72 | 4 |
| 76 | Rumesh | `B-20` | GitHub commit status poster — pass / fail | 70, 75 | 2 |
| 77 | Rumesh | `B-22` | Notification creation — gate fail, score drop, critical vulnerability | 52, 76 | 3 |
| 78 | Nethmi | — | **Cross-test the mobile app and the API** — not her own code | 73 | 4 |
| 79 | Vidushi | — | **Cross-test the web dashboard** — not her own code | 74 | 4 |

> **Steps 78 and 79 are mandatory and nobody tests their own platform.** Finding someone else's bug is the fastest route into their code, and every bug you find is one the evaluator doesn't.

---

## WEEK 14 · 21 Sep – 27 Sep
**Goal: packaged, deployed, running on real infrastructure.**

| # | Name | WBS | Task | Waits for | Hrs |
|---|---|---|---|---|---|
| 80 | Rumesh | `B-24` | Worker Docker image with multi-language runtimes | 61, 77 | 5 |
| 81 | Nethmi | — | Fix bugs raised by step 79, final web polish | 79 | 6 |
| 82 | Vidushi | — | Fix bugs raised by step 78, final mobile polish | 78 | 5 |
| 83 | Rumesh | `B-26` | Unit tests for the normalisers | 80 | 4 |
| 84 | Nethmi | — | Deploy the web dashboard to cloud hosting | 81 | 4 |
| 85 | Vidushi | — | Build and distribute the mobile app via Expo EAS | 82 | 4 |
| 86 | Rumesh | `B-27` | End-to-end integration test of the analysis pipeline | 83 | 5 |
| 87 | Vidushi | — | Physical device testing — push does not work on simulators (`R-09`) | 85 | 3 |
| 88 | Rumesh + Vidushi | — | Deploy API, worker, Postgres and Redis to cloud | 86, 87 | 6 |
| 89 | All | — | Cross-platform integration test on the deployed stack | 84, 88 | 5 |

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

## Chain summary — who runs where

| Person | Steps | Hours | Weeks 6–14 avg |
|---|---|---|---|
| **Rumesh** | 1, 2, 5, 8, 11, 17, 20, 23, 26, 29, 32, 35, 38, 41, 43, 46, 49, 52, 55, 58, 61, 62, 63, 66, 69, 70, 72, 75, 76, 77, 80, 83, 86, 88 | ~112h | ~12.5h/wk |
| **Nethmi** | 3, 6, 9, 12, 14, 18, 21, 24, 27, 33, 36, 39, 42, 44, 47, 53, 56, 59, 64, 68, 73, 78, 81, 84 | ~76h | ~8.5h/wk |
| **Vidushi** | 4, 7, 10, 13, 15, 16, 19, 22, 25, 28, 34, 37, 40, 45, 48, 50, 51, 54, 57, 60, 65, 67, 71, 74, 79, 82, 85, 87, 88 | ~83h | ~9h/wk |

Lighter than the original plan because documentation sits on a separate track. Treat the difference as buffer for exam weeks and integration bugs — both consistently cost more than anyone budgets.

---

## The five critical links in the chain

If any one of these slips, the chain behind it stalls. Watch these more than anything else.

| Link | Step | Why |
|---|---|---|
| 1 | **3** — `D-05` API client | Nine pages sit behind it. Week 6, Monday. |
| 2 | **8** — `A-11` repo CRUD | First real endpoint. Step 12 and the Review 1 demo depend on it. |
| 3 | **52** — `A-24` push dispatch | Steps 57 and 60 block on it with no slack in Week 11. |
| 4 | **61** — `B-12` normaliser | Six analyzers in, persistence and tests out. Widest bottleneck in the project. |
| 5 | **62/63** — `B-13`/`B-14` scoring | Last feature week. Steps 65 and 67 sit right behind. |

---

## Working rules

1. **Sequential within your own steps.** Do not start your next until the previous is merged to `develop`.
2. **Cross-platform review.** No PR merges with only a same-platform approval. The reviewer's job is to be able to explain the change afterwards, not to catch bugs.
3. **One log row per merged step.** In your `learning-log-*.md`: what it does, why that approach, the question you'd be asked.
4. **24-hour blocker rule.** Blocked longer than a day and it becomes the lead's problem. Silent blockage is how three-person teams fail.
5. **Gates are hard.** Weeks 6, 7 and 12. Miss one and re-plan that Sunday rather than hoping the next week absorbs it.
6. **Cut, don't slip.** After step 71, apply the cut list in `project_plan.md` §4 instead of extending the schedule.