# Automated Code Review & Technical Debt Tracking Dashboard

## Project Breakdown & Technical Guide

> **Module:** CS3023 — Software Engineering Group Project, University of Moratuwa
> **Team Size:** 3 | **Budget:** Zero | **Timeline:** ~16 weeks
> **Today:** 21 June 2026

---

## 1. Scope Alignment Check

I've read the official scope document (PID 4) in full. Here's how your **baseline decisions** map to the official scope:

| Scope Item | Official Doc | Your Decision | ✅/⚠️ |
|---|---|---|---|
| Web dashboard | React/Next.js | React (Vite) | ✅ Aligned — Next.js is suggested, not mandated |
| Mobile app | React Native/Flutter | React Native + Expo | ✅ |
| Backend | Node.js/Go/Python | Node.js/TypeScript | ✅ |
| Worker service | Async worker for cloning/scanning | Separate service via BullMQ/Redis | ✅ Perfect match |
| Database | PostgreSQL + Redis | PostgreSQL (Prisma) + Redis (BullMQ) | ✅ |
| VCS integration | GitHub/GitLab | GitHub only | ✅ GitLab listed as optional |
| Analysis approach | ESLint, PyLint, Radon, etc. | Deterministic static analysis (ESLint, Bandit, PyLint, Radon, Checkstyle, PMD, Cppcheck, jscpd) | ✅ |
| Out of scope | AI fixing, SVN, IDE extension | Same | ✅ |

### Honest Assessment of Baseline Decisions

> All your architectural decisions are **sound** for the constraints. Two minor observations:

1. **Two-service (not microservice) is the right call.** A monolith would block on long scans; full microservices would drown a 3-person team in infrastructure. The API + Worker + shared DB pattern is a well-proven "mini distributed system" that demonstrates architectural thinking without operational overhead.

2. **Deterministic analysis is the correct choice for your core feature.** The Health Score trend only works if the same code always produces the same score. This is well-justified and I would **not** recommend changing it.

---

## 2. Architecture Overview

```
┌─────────────┐     webhook / REST      ┌──────────────────┐
│   GitHub     │ ──────────────────────> │   API Service    │
│  (Webhooks)  │                         │  (Express + TS)  │
└─────────────┘                         │                  │
                                         │  - Auth (OAuth)  │
┌─────────────┐     REST API             │  - Webhook recv  │
│  React Web  │ <────────────────────── │  - REST endpoints│
│  Dashboard  │                         │  - Job dispatch  │
└─────────────┘                         └────────┬─────────┘
                                                  │ BullMQ
┌─────────────┐     REST API             ┌────────▼─────────┐
│ React Native│ <────────────────────── │     Redis         │
│  Mobile App │                         │  (Job Queue)      │
└─────────────┘                         └────────┬─────────┘
                                                  │
                                         ┌────────▼─────────┐
                                         │  Worker Service   │
                                         │  (TS + BullMQ)    │
                                         │                   │
                                         │  - Clone repo     │
                                         │  - Run linters    │
                                         │  - Compute score  │
                                         │  - Post PR comment│
                                         └────────┬─────────┘
                                                  │
                                         ┌────────▼─────────┐
                                         │   PostgreSQL      │
                                         │   (via Prisma)    │
                                         └──────────────────┘
```

---

## 3. Timeline & Milestones

### Deadline Calendar

| # | Milestone | Date | Days Left | Status |
|---|---|---|---|---|
| 1 | **Project Proposal** | 5 Jul | 14 | 🟡 Upcoming |
| 2 | **Feasibility Study + Gantt** | 12 Jul | 21 | 🟡 Upcoming |
| 3 | **SRS + Architecture Doc** | 9 Aug | 49 | ⬜ |
| 4 | **Progress Review 1** | 10–14 Aug | 50–54 | ⬜ Demo: GUI + DB + connected |
| 5 | **Mid Evaluation** | 15–30 Aug | 55–70 | ⬜ |
| 6 | **Dev Iteration 2** | 30 Aug – 27 Sep | 70–98 | ⬜ Full system + testing |
| 7 | **Testing Document** | 27 Sep | 98 | ⬜ |
| 8 | **Progress Review 2** | 28 Sep – 2 Oct | 99–103 | ⬜ |
| 9 | **Marketing Video** | 2 Oct | 103 | ⬜ |
| 10 | **Final Evaluation** | 3–11 Oct | 104–112 | ⬜ |
| 11 | **Final Report + Zip** | 3 Oct | 104 | ⬜ |

### Suggested Sprint Plan

#### Sprint 0 — Docs & Foundation (21 Jun – 12 Jul, 3 weeks)

- [ ] Write Project Proposal
- [ ] Write Feasibility Study
- [ ] Create Gantt chart
- [ ] Set up monorepo structure (`/api`, `/worker`, `/web`, `/mobile`, `/prisma`)
- [ ] Initialize all packages (package.json, tsconfig, ESLint configs)
- [ ] Docker Compose for local dev (PostgreSQL + Redis)
- [ ] CI pipeline skeleton (GitHub Actions: lint → typecheck → test → build)
- [ ] Health check endpoint (`GET /health`)
- [ ] Structured logging setup (Pino + pino-pretty)

#### Sprint 1 — Core Backend + DB + Basic UI (13 Jul – 9 Aug, 4 weeks)

- [ ] Prisma schema design & initial migration
- [ ] GitHub OAuth flow (API service)
- [ ] Webhook endpoint (receive `pull_request` events)
- [ ] BullMQ job dispatch from API to Worker
- [ ] Bull Board dashboard at `/admin/queues` (real-time queue monitoring)
- [ ] Worker: clone repo, run ESLint on JS/TS files
- [ ] Worker: compute basic Health Score, write to DB
- [ ] Worker: compute Debt Score (remediation minutes per finding)
- [ ] Worker: post PR comment via Octokit (include Health Score + Debt summary)
- [ ] React dashboard: login page, repo list, basic charts
- [ ] SRS + Architecture document

> **CRITICAL — Progress Review 1 (10–14 Aug)** requires a live demo of: frontend GUI + database + connection between them. Prioritize having the dashboard showing real data from the DB by Aug 9.

#### Sprint 2 — Full Feature Build (10 Aug – 27 Sep, 7 weeks)

- [ ] Multi-language analysis (PyLint, Bandit, Radon, Checkstyle, PMD, Cppcheck, jscpd)
- [ ] Health Score algorithm (weighted composite of all metrics)
- [ ] **Technical Debt tracking:**
  - [ ] Debt Score per snapshot (sum of remediation minutes per finding)
  - [ ] Debt Delta computation (current vs previous snapshot)
  - [ ] Finding matcher — classify findings as `isNew` vs `carriedOver` vs `resolved`
  - [ ] Debt trend over time (historical debt score per snapshot, queryable by date range)
  - [ ] Debt breakdown by category (vulnerability / complexity / duplication / code_smell)
- [ ] Quality Gates (block PR if score < threshold)
- [ ] Trend charts (historical Health Score + Debt Score over time)
- [ ] Dashboard: debt trend line chart + debt category breakdown chart
- [ ] Mobile app: push notifications, quick-view summaries
- [ ] Repository management (link/unlink repos)
- [ ] User/team management
- [ ] Testing (unit + integration + E2E)
- [ ] Testing document

#### Sprint 3 — Polish & Submission (28 Sep – 3 Oct, 1 week)

- [ ] Bug fixes from Progress Review 2 feedback
- [ ] Marketing video (10–15 min)
- [ ] Final report
- [ ] Package product zip

---

## 4. Team Task Assignment

### Teammate 0 — Backend API, Worker, Webhooks, Docs

| Priority | Task | Sprint |
|---|---|---|
| P0 | Monorepo setup, Docker Compose, CI | 0 |
| P0 | Express API scaffold + middleware | 1 |
| P0 | GitHub OAuth integration | 1 |
| P0 | Webhook listener (`/api/webhooks/github`) | 1 |
| P0 | BullMQ job queue setup | 1 |
| P0 | Worker service: clone, scan, score, comment | 1–2 |
| P1 | Multi-language linter integration | 2 |
| P1 | Health Score algorithm | 2 |
| P1 | **Debt Score computation** (remediation minutes per finding) | 2 |
| P1 | **Debt Delta + finding matcher** (isNew / carriedOver / resolved) | 2 |
| P1 | **Debt trend API** (`GET /api/repos/:id/debt` + `/trend`) | 2 |
| P1 | Quality Gates logic | 2 |
| P1 | Push notification dispatch (FCM/Expo Push) | 2 |
| P1 | Health check endpoints + metrics endpoint | 1 |
| P1 | Structured logging (Pino) across API + Worker | 0–1 |
| P1 | Bull Board queue dashboard (`/admin/queues`) | 1 |
| P2 | All documentation (Proposal, Feasibility, SRS, Testing, Final) | 0–3 |

### Teammate 1 — Frontend (React Web Dashboard)

| Priority | Task | Sprint |
|---|---|---|
| P0 | React + Vite project scaffold | 0 |
| P0 | Auth flow (GitHub OAuth redirect/callback UI) | 1 |
| P0 | Dashboard layout: sidebar, header, repo list | 1 |
| P0 | Repository detail page with score display | 1 |
| P1 | Trend charts — Health Score + **Debt Score over time** (Recharts) | 2 |
| P1 | **Debt breakdown chart** (donut/bar by category: vuln/complexity/dup/smell) | 2 |
| P1 | PR analysis results view (findings list + **debt delta indicator**) | 2 |
| P1 | Quality Gate configuration UI | 2 |
| P1 | Team/user management pages | 2 |
| P2 | Responsive design, dark mode, polish | 2–3 |

### Teammate 2 — Database + Mobile

| Priority | Task | Sprint |
|---|---|---|
| P0 | Prisma schema design | 0–1 |
| P0 | Seed scripts + migrations | 1 |
| P0 | Database indexes, relations validation | 1 |
| P1 | React Native + Expo scaffold | 1 |
| P1 | Mobile auth (token-based) | 1–2 |
| P1 | Push notification receiver (Expo Notifications) | 2 |
| P1 | Mobile: repo health summary cards | 2 |
| P1 | Mobile: PR update feed | 2 |
| P2 | Offline caching, mobile polish | 2–3 |

---

## 5. Proposed Monorepo Structure

```
AutomaticCodereviewandDebtTracking/
├── apps/
│   ├── api/                    # Express API service
│   │   ├── src/
│   │   │   ├── routes/         # Express routers
│   │   │   ├── controllers/    # Request handlers
│   │   │   ├── services/       # Business logic
│   │   │   ├── middleware/     # Auth, validation, error handling
│   │   │   ├── webhooks/      # GitHub webhook handlers
│   │   │   ├── lib/           # Logger (Pino), Bull Board setup
│   │   │   └── index.ts       # Entry point
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── worker/                 # Async analysis worker
│   │   ├── src/
│   │   │   ├── processors/    # BullMQ job processors
│   │   │   ├── analyzers/     # Linter wrappers (eslint, pylint, etc.)
│   │   │   ├── scoring/       # Health Score computation
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── web/                    # React (Vite) dashboard
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   ├── hooks/
│   │   │   ├── services/      # API client
│   │   │   └── App.tsx
│   │   ├── package.json
│   │   └── vite.config.ts
│   │
│   └── mobile/                 # React Native + Expo
│       ├── src/
│       │   ├── screens/
│       │   ├── components/
│       │   └── services/
│       ├── app.json
│       └── package.json
│
├── packages/
│   ├── db/                     # Prisma schema + client
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   ├── src/
│   │   │   └── index.ts       # Re-export PrismaClient
│   │   └── package.json
│   │
│   └── shared/                 # Shared types, constants, utils
│       ├── src/
│       │   ├── types/
│       │   └── constants/
│       └── package.json
│
├── docker-compose.yml          # PostgreSQL + Redis for local dev
├── package.json                # Root workspace config
├── turbo.json                  # Turborepo config (optional)
└── .github/
    └── workflows/
        └── ci.yml
```

---

## 6. Database Schema (Prisma — Outline)

```prisma
model User {
  id            String   @id @default(cuid())
  githubId      Int      @unique
  username      String
  email         String?
  avatarUrl     String?
  accessToken   String   // encrypted
  repositories  Repository[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model Repository {
  id            String   @id @default(cuid())
  githubRepoId  Int      @unique
  name          String
  fullName      String   // e.g. "user/repo"
  owner         User     @relation(fields: [ownerId], references: [id])
  ownerId       String
  defaultBranch String   @default("main")
  isActive      Boolean  @default(true)
  qualityGate   QualityGate?
  analyses      Analysis[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model Analysis {
  id            String   @id @default(cuid())
  repository    Repository @relation(fields: [repoId], references: [id])
  repoId        String
  commitSha     String
  branch        String
  prNumber      Int?
  healthScore   Float    // 0-100
  metrics       Json     // { complexity, duplication, smells, security, ... }
  status        AnalysisStatus @default(PENDING)
  triggeredBy   String   // "webhook" | "manual"
  startedAt     DateTime?
  completedAt   DateTime?
  createdAt     DateTime @default(now())
}

model QualityGate {
  id              String   @id @default(cuid())
  repository      Repository @relation(fields: [repoId], references: [id])
  repoId          String   @unique
  minHealthScore  Float    @default(60)
  maxComplexity   Float?
  maxDuplication  Float?
  blockPR         Boolean  @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model Notification {
  id          String   @id @default(cuid())
  userId      String
  type        String   // "pr_review" | "quality_gate_fail" | "score_drop"
  title       String
  body        String
  data        Json?
  read        Boolean  @default(false)
  createdAt   DateTime @default(now())
}

enum AnalysisStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
}
```

---

## 7. Health Score Algorithm (Proposed)

The score is a **weighted average** of normalized sub-scores (each 0–100):

| Metric | Tool(s) | Weight | What It Measures |
|---|---|---|---|
| Code Smells | ESLint, PyLint, Checkstyle, PMD | 25% | Style issues, anti-patterns |
| Complexity | Radon (Python), ESLint complexity rule | 20% | Cyclomatic complexity |
| Duplication | jscpd | 20% | Copy-paste ratio |
| Security | Bandit (Python), ESLint security plugins | 20% | Known vulnerability patterns |
| Maintainability | Radon MI, PMD | 15% | Maintainability index |

```
Health Score = Sum of (weight_i * normalized_score_i)
```

Each sub-score normalization: `score = max(0, 100 - (issue_count / lines_of_code) * penalty_factor)`

> **TIP:** Store the raw metric values in the `Analysis.metrics` JSON field AND the computed `healthScore` as a top-level float. This lets you recalculate or re-weight scores later without re-running the analysis.

---

## 8. Key API Endpoints

| Method | Path | Description | Auth |
|---|---|---|---|
| `GET` | `/auth/github` | Redirect to GitHub OAuth | Public |
| `GET` | `/auth/github/callback` | Handle OAuth callback | Public |
| `GET` | `/api/me` | Get current user | Required |
| `GET` | `/api/repos` | List linked repositories | Required |
| `POST` | `/api/repos` | Link a new repository | Required |
| `DELETE` | `/api/repos/:id` | Unlink a repository | Required |
| `GET` | `/api/repos/:id/analyses` | Get analysis history | Required |
| `GET` | `/api/repos/:id/score` | Get latest health score | Required |
| `POST` | `/api/repos/:id/analyze` | Trigger manual analysis | Required |
| `PUT` | `/api/repos/:id/quality-gate` | Set quality gate config | Required |
| `POST` | `/webhooks/github` | Receive GitHub webhook events | Webhook secret |
| `GET` | `/api/notifications` | Get user notifications | Required |
| `PUT` | `/api/notifications/:id/read` | Mark notification read | Required |

---

## 9. Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| Long analysis times block demo | High | Medium | Set hard timeout (5 min); cache results; use small test repos for demos |
| GitHub API rate limits | Medium | Medium | Use installation tokens; cache responses; implement backoff |
| Team member unavailability | High | Low | Cross-document all work; shared Prisma package means DB knowledge isn't siloed |
| Scope creep | High | High | Stick to "included scope" from official doc; defer optional scope |
| Progress Review 1 readiness | High | Medium | Frontend + DB connection is P0; mock data if backend isn't ready |
| Multi-language analysis complexity | Medium | High | Start with JS/TS (ESLint) only; add languages incrementally |

---

## 10. Immediate Next Steps (This Week)

1. **Initialize the monorepo** — Set up the folder structure, root `package.json` with workspaces, `tsconfig` base
2. **Docker Compose** — PostgreSQL 15 + Redis 7 for local development
3. **Prisma schema** — Create the initial schema (section 6 above), run first migration
4. **Express API skeleton** — Health check endpoint, middleware stack, error handling
5. **Start Project Proposal** — Due in 14 days

> **CRITICAL PATH for Progress Review 1 (Aug 10–14):** The demo requires frontend GUI + database + connection. Work backward from that date:
> - By **Jul 27**: Prisma schema finalized, API auth working
> - By **Aug 3**: Dashboard showing repo list from DB
> - By **Aug 9**: Full demo path (login → see repos → see at least one score)

---

## 11. Tech Stack Quick Reference

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Runtime | Node.js | 20 LTS | All services |
| Language | TypeScript | 5.x | Type safety across the stack |
| API Framework | Express | 4.x | HTTP server, routing, middleware |
| Job Queue | BullMQ | 5.x | Redis-backed async job processing |
| Database | PostgreSQL | 15+ | Primary data store |
| ORM | Prisma | 5.x | Type-safe DB access, migrations |
| Cache/Queue Backend | Redis | 7.x | BullMQ backend + optional caching |
| Web Frontend | React + Vite | 18+ / 5.x | Dashboard SPA |
| Mobile | React Native + Expo | 0.74+ / 51+ | Mobile companion app |
| Charts | Recharts or Chart.js | Latest | Data visualization |
| VCS Integration | Octokit | Latest | GitHub API client |
| Push Notifications | Expo Push | Latest | Mobile notifications |
| Containerization | Docker Compose | v2 | Local dev (PostgreSQL + Redis) |
| CI/CD | GitHub Actions | — | Lint, typecheck, test, build (GitOps) |
| Logging | Pino + pino-pretty | Latest | Structured JSON logging |
| Queue Dashboard | Bull Board | Latest | Real-time job queue monitoring UI |
| Validation | Zod | Latest | Request schema validation |

---

*This document will be updated as the project evolves. Use it as a living reference alongside your formal SRS and architecture documents.*
