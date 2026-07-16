# Project Scope & Requirements Analysis

> **Project:** Automated Code Review and Technical Debt Tracking Dashboard (PID 4)
> **Module:** CS3023 — Software Engineering, University of Moratuwa
> **Prepared:** 21 June 2026

---

## 1. Plain-Language Project Summary

We are building a cloud-hosted platform that plugs into a team's GitHub repositories and automatically reviews every Pull Request the moment it is opened. Instead of making senior developers waste time catching style errors and copy-paste bugs, our system clones the code, runs a battery of open-source linters (ESLint, PyLint, Bandit, Radon, Checkstyle, PMD, Cppcheck, jscpd), computes a single 0–100 "Health Score," and posts the findings as a comment directly on the PR. A web dashboard lets users link repositories, view the score for every analysis, watch trends over time (is our code getting healthier or sicker each sprint?), and configure "Quality Gates" that can block a PR from merging if the score drops below a threshold. A companion mobile app gives team leads real-time push notifications when something critical is flagged so they can react immediately. The heavy analysis work happens in a separate background worker so the webhook response stays fast and the main API never blocks.

---

## 2. Scope Classification

### Mandatory / Included Scope

| # | Scope Item | Details from Brief | Primary Owner |
|---|---|---|---|
| S-1 | **Web dashboard — repo linking** | Administrative dashboard for linking GitHub repositories to the platform | Teammate 1 (Frontend) |
| S-2 | **Web dashboard — trend visualizations** | Charts (D3.js / Chart.js) showing code quality trends over time | Teammate 1 (Frontend) |
| S-3 | **Web dashboard — Quality Gates** | Configure rules (e.g. block PRs if score < threshold); manage gate settings per repo | Teammate 1 (Frontend) + You (Backend logic) |
| S-4 | **Mobile app — push notifications** | Real-time push notifications for PR updates, build failures, high-severity debt | Teammate 2 (Mobile) + You (dispatch) |
| S-5 | **Mobile app — code smell summaries** | Quick-view summaries of code smells detected in the latest commit | Teammate 2 (Mobile) |
| S-6 | **Backend — webhook listener** | Securely receive events from GitHub (PR opened/updated/closed) | You (Backend) |
| S-7 | **Backend — analysis engine** | Integrate open-source linters/static analysis (ESLint, PyLint, Radon, etc.) | You (Worker) |
| S-8 | **Backend — data persistence** | PostgreSQL for relational data; Redis for caching/queue | Teammate 2 (DB) + You (API) |
| S-9 | **Worker service** | Async worker that clones repos and runs scans without blocking the API | You (Worker) |
| S-10 | **GitHub OAuth login** | User can log in with GitHub and see their repo stats (Expected Outcome 1) | You (Backend) + Teammate 1 (UI) |
| S-11 | **Automated PR bot** | Bot leaves comments on GitHub PRs with analysis results (Expected Outcome 2) | You (Worker + Octokit) |
| S-12 | **Technical documentation** | Data pipeline and scoring logic documentation (Expected Outcome 3) | You (Docs) |
| S-13 | **Before/after comparison report** | Final report comparing manual review times before and after using the tool (Expected Outcome 4) | You (Docs) — needs user study data |

### Optional / Out-of-Scope Items

| # | Item | Status | Justification |
|---|---|---|---|
| O-1 | Automated "AI" code fixing | Excluded | Non-deterministic; breaks reproducible Health Score; out of scope per brief |
| O-2 | SVN / legacy VCS support | Excluded | Not needed for target audience; additional complexity for no evaluated benefit |
| O-3 | IDE extensions (VS Code) | Excluded | Separate distribution channel; out of timeline for 3-person team |
| O-4 | GitLab webhook support | Deferred | Brief says "GitHub/GitLab" but we scoped to GitHub-only; can extend later |

---

## 3. Functional Requirements

### 3.1 Authentication & Authorization

| ID | Requirement |
|---|---|
| FR-1 | The system shall allow users to sign in via GitHub OAuth 2.0 and obtain a session/token. |
| FR-2 | The system shall store the user's GitHub access token securely (encrypted at rest) for API calls on their behalf. |
| FR-3 | The system shall display the authenticated user's profile (username, avatar, email) on the dashboard and mobile app. |
| FR-4 | The system shall allow users to log out and revoke their session. |
| FR-5 | The system shall restrict all API endpoints (except auth and webhook ingestion) to authenticated users only. |
| FR-5a | The system shall assign every user one of three roles: `ADMIN`, `TEAM_LEAD`, or `DEVELOPER`, defaulting to `DEVELOPER` on first login. |
| FR-5b | The system shall auto-promote a `DEVELOPER` to `TEAM_LEAD` upon successfully linking their first repository. |
| FR-5c | The system shall allow a `TEAM_LEAD` to grant or revoke a `DEVELOPER`'s read access to a repository they own (repository membership). |
| FR-5d | The system shall restrict repository mutation actions (link, unlink, quality gate config, manual analysis trigger, member management) to the repository's owning `TEAM_LEAD` or a user with role `ADMIN`. |
| FR-5e | The system shall restrict read access to a repository's data (findings, trends, hotspots) to the owning `TEAM_LEAD`, users with a repository membership grant, or `ADMIN`. |
| FR-5f | The system shall restrict `GET /api/metrics` (platform-wide operational statistics) to users with role `ADMIN`. |

### 3.2 Repository Management

| ID | Requirement |
|---|---|
| FR-6 | The system shall list all GitHub repositories accessible to the authenticated user. |
| FR-7 | The system shall allow a user to link (register) one or more repositories for monitoring. |
| FR-8 | The system shall allow a user to unlink (deregister) a previously linked repository. |
| FR-9 | Upon linking a repository, the system shall register a GitHub webhook for `pull_request` events on that repository. |
| FR-10 | Upon unlinking, the system shall remove the corresponding GitHub webhook. |

### 3.3 Webhook Ingestion

| ID | Requirement |
|---|---|
| FR-11 | The system shall expose an HTTPS endpoint to receive GitHub webhook payloads. |
| FR-12 | The system shall verify the webhook signature using the shared secret before processing any event. |
| FR-13 | The system shall respond to GitHub within 10 seconds (HTTP 200/202) to avoid webhook timeout/retry. |
| FR-14 | Upon receiving a `pull_request.opened` or `pull_request.synchronize` event, the system shall enqueue an analysis job. |
| FR-15 | The system shall ignore webhook events for repositories that are not linked or are inactive. |

### 3.4 Analysis Engine (Worker)

| ID | Requirement |
|---|---|
| FR-16 | The worker shall clone the target repository (or the specific PR branch) into a temporary directory. |
| FR-17 | The worker shall detect the primary language(s) of the repository and select appropriate analysis tools. |
| FR-18 | The worker shall run ESLint for JavaScript/TypeScript files. |
| FR-19 | The worker shall run PyLint and Bandit for Python files. |
| FR-20 | The worker shall run Radon for Python cyclomatic complexity and maintainability index. |
| FR-21 | The worker shall run Checkstyle and/or PMD for Java files. |
| FR-22 | The worker shall run Cppcheck for C/C++ files. |
| FR-23 | The worker shall run jscpd for cross-language code duplication detection. |
| FR-24 | The worker shall aggregate raw linter output into structured JSON metrics (issue counts by category, complexity scores, duplication percentages). |
| FR-25 | The worker shall clean up (delete) the cloned repository directory after analysis completes or fails. |
| FR-26 | The worker shall enforce a configurable timeout per analysis job (default: 5 minutes) and mark timed-out jobs as FAILED. |

### 3.5 Health Scoring

| ID | Requirement |
|---|---|
| FR-27 | The system shall compute a composite Health Score (0–100) from weighted sub-scores: code smells, complexity, duplication, security, and maintainability. |
| FR-28 | The Health Score algorithm shall be deterministic — identical code input shall always produce an identical score. |
| FR-29 | The system shall store both the composite Health Score and the individual raw metrics for every analysis run. |
| FR-30 | The system shall support per-repository historical tracking of Health Scores to enable trend analysis. |

### 3.6 Quality Gates

| ID | Requirement |
|---|---|
| FR-31 | The system shall allow users to configure a minimum Health Score threshold per repository. |
| FR-32 | The system shall allow users to enable/disable PR blocking for a repository. |
| FR-33 | When PR blocking is enabled and the analysis score falls below the threshold, the system shall post a failing commit status check on the PR via the GitHub API. |
| FR-34 | When the score meets or exceeds the threshold, the system shall post a passing commit status check. |

### 3.7 PR Commenting (Bot)

| ID | Requirement |
|---|---|
| FR-35 | Upon completing analysis, the worker shall post a summary comment on the GitHub PR with: the Health Score, top issues found, and a breakdown by category. |
| FR-36 | If a previous bot comment exists on the same PR, the system shall update it rather than posting a duplicate. |
| FR-37 | The comment shall include a clear visual indicator of pass/fail against the quality gate (if configured). |

### 3.8 Web Dashboard

| ID | Requirement |
|---|---|
| FR-38 | The dashboard shall display a list of all linked repositories with their latest Health Score. |
| FR-39 | The dashboard shall provide a detail view per repository showing analysis history and score trend chart. |
| FR-40 | The dashboard shall visualize code quality metrics (maintainability index, duplication %, complexity, etc.) in intuitive charts. |
| FR-41 | The dashboard shall allow users to configure Quality Gate settings per repository. |
| FR-42 | The dashboard shall allow users to manually trigger a re-analysis of a repository. |
| FR-43 | The dashboard shall provide a view of individual PR analysis results with issue details. |

### 3.9 Mobile App

| ID | Requirement |
|---|---|
| FR-44 | The mobile app shall authenticate using the same GitHub OAuth flow (or token exchange) as the web app. |
| FR-45 | The mobile app shall display a summary list of linked repositories with current Health Scores. |
| FR-46 | The mobile app shall receive real-time push notifications when a PR analysis completes, a quality gate fails, or a high-severity issue is detected. |
| FR-47 | The mobile app shall provide a quick-view screen showing code smells detected in the latest commit for a selected repository. |
| FR-48 | The mobile app shall allow users to mark notifications as read. |

### 3.10 Notifications

| ID | Requirement |
|---|---|
| FR-49 | The system shall generate in-app notifications for: analysis completed, quality gate failed, significant score drop (>10 points). |
| FR-50 | The system shall dispatch push notifications to registered mobile devices via Expo Push Notifications. |
| FR-51 | The system shall store notification history and read/unread status in the database. |

---

## 4. Non-Functional Requirements

### 4.1 Performance & Latency

| ID | Requirement |
|---|---|
| NFR-1 | The webhook endpoint shall respond to GitHub within **10 seconds** (acknowledgement only; analysis is async). |
| NFR-2 | A typical analysis for a small-to-medium repository (< 50k LOC) shall complete within **5 minutes**. |
| NFR-3 | Dashboard API responses (repo list, score queries, trend data) shall return within **500ms** under normal load. |
| NFR-4 | The system shall use a Redis-backed job queue (BullMQ) to decouple webhook receipt from analysis execution, ensuring the API process never blocks on long-running scans. |

### 4.2 Security

| ID | Requirement |
|---|---|
| NFR-5 | GitHub OAuth access tokens shall be encrypted at rest in the database (e.g., AES-256). |
| NFR-6 | Webhook payloads shall be validated using HMAC-SHA256 signature verification before processing. |
| NFR-7 | All communication between clients and the API shall use HTTPS/TLS. |
| NFR-8 | Cloned repository data shall exist only in temporary directories and be deleted immediately after analysis completes or fails. |
| NFR-9 | The system shall implement rate limiting on public-facing API endpoints to prevent abuse. |
| NFR-10 | Environment secrets (database URL, GitHub client secret, webhook secret, encryption keys) shall never be committed to version control; they shall be managed via environment variables or a secrets manager. |

### 4.3 Scalability

| ID | Requirement |
|---|---|
| NFR-11 | **Demo scale:** The system shall support at least 5 concurrent users, 10 linked repositories, and 3 simultaneous analysis jobs during a live demonstration. |
| NFR-12 | **Realistic SaaS scale (design target):** The architecture shall be designed such that adding worker replicas enables horizontal scaling of analysis throughput, even if not demonstrated at this scale. |
| NFR-13 | The BullMQ queue shall support configurable concurrency per worker instance (default: 2 concurrent jobs). |
| NFR-14 | Database queries for trend data shall be efficient over at least 1,000 analysis records per repository (indexed on `repoId` + `createdAt`). |

### 4.4 Usability

| ID | Requirement |
|---|---|
| NFR-15 | The web dashboard shall be responsive and usable on screen widths from 1024px to 1920px. |
| NFR-16 | The Health Score shall be presented as a single, easy-to-understand 0–100 number with color coding (red/amber/green) so that non-technical stakeholders (project managers) can interpret it without explanation. |
| NFR-17 | The dashboard shall provide meaningful empty states and loading indicators; no raw JSON or stack traces shall be shown to end users. |
| NFR-18 | The mobile app shall function on both iOS and Android via Expo. |

### 4.5 Reliability

| ID | Requirement |
|---|---|
| NFR-19 | Failed analysis jobs shall be retried up to 3 times with exponential backoff before being marked as permanently FAILED. |
| NFR-20 | The system shall gracefully handle GitHub API rate limiting (HTTP 429) by queuing retries with appropriate delays. |
| NFR-21 | If the worker service crashes mid-analysis, the job shall remain in the queue and be re-processed on restart (BullMQ's at-least-once semantics). |

### 4.6 Maintainability

| ID | Requirement |
|---|---|
| NFR-22 | The codebase shall use TypeScript throughout (API, worker, web, shared packages) for type safety and self-documentation. |
| NFR-23 | Database schema changes shall be managed exclusively through Prisma migrations, never raw SQL. |
| NFR-24 | Each analyzer (ESLint wrapper, PyLint wrapper, etc.) shall be implemented as an independent module behind a common interface, allowing new languages to be added without modifying existing code. |
| NFR-25 | The project shall include a `docker-compose.yml` for one-command local environment setup (PostgreSQL + Redis). |
| NFR-26 | The CI pipeline (GitHub Actions) shall run linting and tests on every push/PR. |

### 4.7 Testability

| ID | Requirement |
|---|---|
| NFR-27 | The system shall have unit tests for the Health Score computation and each analyzer wrapper. |
| NFR-28 | The system shall have integration tests for the webhook ingestion and job dispatch pipeline. |
| NFR-29 | Test coverage across the backend shall target a minimum of 60%. |

---

## 5. Ambiguities & Questions for the Industry Mentor

The following are genuine underspecified areas in the brief that could lead to wrong assumptions. Each is phrased as a concrete question.

| # | Question | Why It Matters |
|---|---|---|
| Q-1 | **Multi-tenant definition:** The brief says "multi-tenant system" — does this mean multiple independent organizations with data isolation, or simply multiple individual GitHub users sharing one deployment? This significantly affects the database schema (tenant ID columns, row-level security) and auth flow. **Partial answer since the `UserRole`/`RepositoryMember` model was added** (see §3.1 FR-5a–5f, `database_design.md` §3.7): a `TEAM_LEAD` can now share a repo's read access with specific `DEVELOPER`s, and `ADMIN` sees everything platform-wide. This covers per-repo access sharing but is **not** org-level tenancy — there is no "organization" entity, and an `ADMIN` can see data across every Team Lead's repos with no isolation boundary. Still needs mentor clarification if true org-level isolation is expected. | Architecture & DB design |
| Q-2 | **"Block PRs if coverage < 80%":** The brief mentions code coverage as a quality gate example, but our analysis tools (ESLint, PyLint, etc.) do not measure test coverage — that requires running the project's test suite, which is an entirely different pipeline. Should we treat "coverage" as an example placeholder and implement gates on metrics we *can* compute (Health Score, complexity, duplication)? Or is actual coverage measurement expected? | Scope of Quality Gates |
| Q-3 | **"Various Git providers" vs GitHub-only:** One objective says "securely handling webhooks from various Git providers," but we've scoped to GitHub only. Do evaluators expect at least a second provider (e.g., GitLab) to be demonstrated, or is GitHub-only acceptable with the architecture designed to be extensible? | Evaluation criteria |
| Q-4 | **"Predicting potential software bugs":** Objective 5 says "evaluate the effectiveness of the Health Score algorithm in predicting potential software bugs." What constitutes valid evidence here? Do we need to correlate our scores with actual bug reports on real-world repos, or is a theoretical argument with sample data sufficient for the final report? | Final report content |
| Q-5 | **"Comparing manual review times before and after":** Expected Outcome 4 requires a comparison of review times. Does this require a controlled user study with real developers, or can we use synthetic benchmarks / literature-based estimates? A proper user study has ethics approval and scheduling implications on a 16-week timeline. | Research methodology |
| Q-6 | **"Real-time" notification granularity:** The brief says "real-time push notifications" and "alerts developers of critical code regressions in real-time." What defines "real-time" here — within seconds of analysis completion, or within seconds of the PR being opened (which would include the full scan time)? | Notification design |
| Q-7 | **"Build fails" notifications:** The mobile app section mentions notifications "when a build fails." Our system does not run builds — it runs static analysis. Should we interpret "build fails" as "analysis fails / quality gate fails," or is actual CI build integration expected? | Feature scope |
| Q-8 | **Evaluation weighting:** Is the mobile app weighted equally with the web dashboard and backend in final evaluation, or is it treated as a companion/secondary deliverable? This affects how much time Teammate 2 should spend on mobile polish vs DB robustness. | Time allocation |
| Q-9 | **Language support breadth vs depth for evaluation:** We plan to support 6+ languages (JS/TS, Python, Java, C/C++). For the evaluation, is it better to deeply support 2–3 languages with rich analysis, or superficially support many? | Development priority |
| Q-10 | **"Sprint cycles" in trend analysis:** The brief mentions showing trends "over sprint cycles." Should the system have an explicit concept of sprints/time-ranges, or is a simple chronological timeline of scores sufficient? | Dashboard design |

---

## 6. Gaps vs Our Baseline Tech Stack

Comparison of what the scope document requires against our locked-in stack:

| Scope Requirement | Our Stack Covers It? | Gap / Action Needed |
|---|---|---|
| Web dashboard (React) | ✅ Yes — React + Vite | None |
| Mobile app (React Native) | ✅ Yes — React Native + Expo | None |
| Backend (Node.js) | ✅ Yes — Express + TypeScript | None |
| Worker service (async) | ✅ Yes — BullMQ | None |
| PostgreSQL | ✅ Yes — Prisma ORM | None |
| Redis | ✅ Yes — BullMQ backend | None |
| GitHub webhooks + OAuth | ✅ Yes — Octokit + passport-github2 | None |
| ESLint, PyLint, Radon | ✅ Yes — planned analyzers | Tools must be installed on the worker runtime (Python + pip for PyLint/Bandit/Radon, Java JRE for Checkstyle/PMD, apt for Cppcheck). **Requires a Docker image with multi-language runtimes.** |
| Code coverage measurement | ⚠️ **Gap** | The brief uses "coverage < 80%" as a quality gate example. Our tools do NOT measure test coverage. **Recommendation:** Treat this as an example; implement gates on Health Score, complexity, and duplication instead. Clarify with mentor (see Q-2). |
| GitLab webhook support | ⚠️ **Deferred** | Brief mentions "GitHub/GitLab." We scoped GitHub-only. The webhook handler should use a provider-adapter pattern so GitLab can be added later without rearchitecting. Clarify with mentor (see Q-3). |
| D3.js / Chart.js visualizations | ✅ Yes — Recharts or Chart.js | Either library works; no gap. |
| "Multi-tenant" support | ⚠️ **Ambiguous** | If full org-level multi-tenancy with data isolation is required, we need tenant-scoped queries and possibly row-level security in Postgres. Clarify with mentor (see Q-1). |
| Push notifications | ✅ Yes — Expo Push Notifications | None for demo; production would need FCM/APNs certificates. |
| Before/after comparison report | ⚠️ **Process gap, not tech gap** | This requires user study data, not a technology. We need to plan for collecting timing data from at least a few real users. |

### Summary

**No fundamental technology gaps.** The locked-in stack covers every mandatory scope item. The three flagged items (⚠️) are:

1. **Coverage measurement** — scope language is ambiguous; likely an example, not a hard requirement.
2. **GitLab support** — deferred by design; architecture should be extensible.
3. **Multi-tenancy depth** — needs mentor clarification; impacts DB schema design.
4. **Worker Docker image** — needs Python, Java, and C/C++ runtimes alongside Node.js for multi-language analysis. This is an infrastructure task, not a stack change.

---

*This document is ready to be incorporated into the SRS. All requirement IDs (FR-xx, NFR-xx) can be referenced in design documents, test plans, and traceability matrices.*
