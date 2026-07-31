# System Architecture & Design Document

> **Project:** Automated Code Review & Technical Debt Tracking Dashboard (PID 4)
> **Module:** CS3023 — University of Moratuwa
> **Date:** 21 June 2026

---

## 1. High-Level System Architecture

### 1.1 Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          EXTERNAL SYSTEMS                                    │
│                                                                              │
│  ┌─────────────┐          ┌──────────────────┐          ┌─────────────────┐  │
│  │   GitHub     │          │  Expo Push       │          │  GitHub API     │  │
│  │  Webhooks    │          │  Service (APNs/  │          │  (Octokit)      │  │
│  │             │          │   FCM)           │          │                 │  │
│  └──────┬──────┘          └────────▲─────────┘          └────────▲────────┘  │
│         │                          │                             │           │
└─────────┼──────────────────────────┼─────────────────────────────┼───────────┘
          │ [A] webhook payload      │ [G] push notification       │ [F] PR comment /
          │ (POST, JSON,             │     payload (JSON)          │     commit status
          │  HMAC-SHA256 signed)     │                             │     (REST + token)
          │                          │                             │
┌─────────▼──────────────────────────┼─────────────────────────────┼───────────┐
│                        BACKEND SERVICES                                      │
│                                                                              │
│  ┌─────────────────────────────────┼───────────┐                             │
│  │        API SERVICE (Express)    │           │                             │
│  │                                 │           │                             │
│  │  • Auth (GitHub OAuth)          │           │                             │
│  │  • Webhook receiver + verify    │           │                             │
│  │  • REST API (repos, scores,     │           │                             │
│  │    analyses, gates, notifs)     │           │                             │
│  │  • Job dispatch (enqueue)       │           │                             │
│  │  • Notification dispatch ───────┘           │                             │
│  │                                             │                             │
│  └──────┬──────────────────┬───────────────────┘                             │
│         │                  │                                                 │
│         │ [B] enqueue      │ [D] SQL queries                                 │
│         │ job (JSON)       │ (Prisma ORM)                                    │
│         │                  │                                                 │
│  ┌──────▼──────┐    ┌──────▼──────────────┐                                  │
│  │    Redis    │    │    PostgreSQL        │                                  │
│  │  (BullMQ)  │    │    (shared DB)       │                                  │
│  │            │    │                      │                                  │
│  │  • Job     │    │  • Users             │                                  │
│  │    queue   │    │  • Repositories      │                                  │
│  │  • Job     │    │  • Analyses          │                                  │
│  │    state   │    │  • QualityGates      │                                  │
│  └──────┬──────┘    │  • Notifications     │                                  │
│         │           └──────▲──────────────┘                                  │
│         │ [C] dequeue              │                                         │
│         │ job (JSON)               │ [E] write results                       │
│         │                          │ (Prisma ORM)                            │
│  ┌──────▼──────────────────────────┼───┐                                     │
│  │       WORKER SERVICE (TS)       │   │                                     │
│  │                                 │   │                                     │
│  │  • Clone target repo           │   │──── [F] POST PR comment             │
│  │  • Detect languages            │   │     + commit status                  │
│  │  • Run linters (ESLint,        │   │                                     │
│  │    PyLint, Bandit, Radon,      │   │                                     │
│  │    Checkstyle, PMD, Cppcheck,  │   │                                     │
│  │    jscpd)                      │   │                                     │
│  │  • Normalize + score           │   │                                     │
│  │  • Evaluate quality gates      │   │                                     │
│  │  • Persist results to DB       │   │                                     │
│  │  • Cleanup temp files          │   │                                     │
│  └─────────────────────────────────┘                                         │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
          ▲                                      ▲
          │ [H] REST API responses               │ [H] REST API responses
          │ (JSON over HTTPS)                    │ (JSON over HTTPS)
          │                                      │
┌─────────┴──────────┐              ┌────────────┴─────────┐
│   React Web        │              │  React Native        │
│   Dashboard        │              │  Mobile App          │
│   (Vite SPA)       │              │  (Expo)              │
│                    │              │                      │
│  • Repo management │              │  • Health summaries  │
│  • Trend charts    │              │  • Push notification │
│  • Quality gates   │              │    receiver          │
│  • Analysis results│              │  • Code smell viewer │
└────────────────────┘              └──────────────────────┘
```

### 1.2 Data Flow Labels

| Label | Boundary Crossed | Payload | Protocol |
|---|---|---|---|
| **[A]** | GitHub → API | Webhook JSON (`pull_request` event) + HMAC signature header | HTTPS POST |
| **[B]** | API → Redis | BullMQ job data: `{ analysisId, repoId, prNumber, commitSha, cloneUrl }` (no raw token — the worker loads and decrypts the owner's token from `GitHubCredential` when needed) | Redis protocol (TCP) |
| **[C]** | Redis → Worker | Same job data dequeued by BullMQ processor | Redis protocol (TCP) |
| **[D]** | API → PostgreSQL | Prisma-generated SQL (SELECT, INSERT for repos, users, notifications) | PostgreSQL wire protocol |
| **[E]** | Worker → PostgreSQL | Prisma-generated SQL (INSERT/UPDATE analysis results, notification records) | PostgreSQL wire protocol |
| **[F]** | Worker → GitHub API | PR comment body + commit status (pass/fail) via Octokit | HTTPS REST (OAuth token) |
| **[G]** | API → Expo Push | Push notification payload `{ to, title, body, data }` | HTTPS POST |
| **[H]** | Clients → API | REST requests/responses (JSON) | HTTPS |

---

## 2. Component-Responsibility Breakdown

### 2.1 What Lives Where

| Responsibility | API Service | Worker Service | Why This Placement |
|---|---|---|---|
| GitHub OAuth login/callback | ✅ | — | Must respond instantly; user-facing auth flow |
| Webhook receipt + signature verification | ✅ | — | Must ACK within 10s; no heavy processing |
| REST API (CRUD repos, scores, gates) | ✅ | — | Synchronous request/response; needs low latency |
| Job enqueue (BullMQ `.add()`) | ✅ | — | Fire-and-forget; takes <50ms |
| Push notification dispatch | ✅ | — | Lightweight HTTP POST to Expo; <200ms |
| Repo cloning (git clone) | — | ✅ | Network + disk I/O heavy; 10s–120s |
| Linter execution | — | ✅ | CPU-bound; 30s–300s per repo |
| Score computation | — | ✅ | Depends on linter output; must run after analysis |
| Quality gate evaluation | — | ✅ | Needs computed score; runs immediately after scoring |
| PR comment posting | — | ✅ | Happens after scoring; worker has the full context |
| Result persistence (write analysis) | — | ✅ | Atomic write of all results at pipeline end |
| Temp directory cleanup | — | ✅ | Cleanup of cloned files; worker's responsibility |

### 2.2 The Dividing Line — Why Here?

The split is driven by one constraint: **GitHub requires a webhook response within 10 seconds, but a full code analysis takes 1–5 minutes.**

Everything that a user or GitHub expects a fast response from lives in the **API service**. Everything that involves cloning, scanning, or computing lives in the **Worker service**. The Redis queue is the bridge — the API drops a lightweight job message (~500 bytes) and immediately responds 202 Accepted, while the worker picks it up asynchronously.

This also means:
- The API can be horizontally scaled for request throughput without affecting analysis capacity
- The Worker can be scaled independently (more replicas = more concurrent scans)
- A worker crash does not take down the API; jobs remain in Redis and are reprocessed

---

## 3. Internal Architecture Sketches

### 3.1 API Service — Layered Architecture

```
  HTTP Request
       │
       ▼
  ┌─────────────────────────────────────────────┐
  │  MIDDLEWARE LAYER                            │
  │  • CORS, helmet, rate limiter               │
  │  • Request logging (morgan/pino)            │
  │  • Auth middleware (JWT/session validation)  │
  │  • TENANT GUARD (org membership, per request)│
  │  • Repo authorization guard                 │
  │  • Webhook signature verification           │
  │  • Error handler (global catch)             │
  └──────────────────┬──────────────────────────┘
                     │
  ┌──────────────────▼──────────────────────────┐
  │  ROUTES LAYER                               │
  │  • /auth/github, /auth/github/callback      │
  │  • /api/orgs, /api/orgs/:orgId/...          │
  │  • /api/repos, /api/repos/:id/...           │
  │  • /api/notifications                       │
  │  • /webhooks/github                         │
  │  Responsibility: URL mapping, HTTP method   │
  │  binding, request validation (zod/joi)      │
  └──────────────────┬──────────────────────────┘
                     │
  ┌──────────────────▼──────────────────────────┐
  │  CONTROLLERS LAYER                          │
  │  • AuthController                           │
  │  • RepoController                           │
  │  • AnalysisController                       │
  │  • WebhookController                        │
  │  • NotificationController                   │
  │  • QualityGateController                    │
  │  Responsibility: parse request, call        │
  │  service, format HTTP response              │
  └──────────────────┬──────────────────────────┘
                     │
  ┌──────────────────▼──────────────────────────┐
  │  SERVICES LAYER (business logic)            │
  │  • AuthService       — OAuth token exchange │
  │  • OrgService        — sync tenants from GH │
  │  • RepoService       — link/unlink repos    │
  │  • WebhookService    — validate + dispatch  │
  │  • AnalysisService   — query results        │
  │  • QueueService      — BullMQ .add()        │
  │  • NotificationService — create + push      │
  │  • QualityGateService — CRUD gate rules     │
  │  Responsibility: orchestrate logic,         │
  │  enforce business rules, call repositories  │
  └──────────────────┬──────────────────────────┘
                     │
  ┌──────────────────▼──────────────────────────┐
  │  REPOSITORY LAYER (data access)             │
  │  • UserRepository                           │
  │  • RepoRepository                           │
  │  • AnalysisRepository                       │
  │  • NotificationRepository                   │
  │  • QualityGateRepository                    │
  │  Responsibility: Prisma queries only;       │
  │  no business logic, no HTTP awareness       │
  └──────────────────┬──────────────────────────┘
                     │
                     ▼
              PostgreSQL (via Prisma)
```

#### 3.1.1 Tenancy & Data Isolation

The deployment is shared by multiple organizations, and each organization's data must be
unreachable from any other. Isolation is enforced in the middleware layer, not left to
individual handlers, so that a route cannot leak data by forgetting to filter.

**One tenant anchor.** `Repository.orgId` is the only place tenancy is recorded. Every other
table reaches its tenant through `repoId`, which it already carries — snapshots, findings,
analysis jobs and pull requests deliberately do **not** get their own copy of `orgId`. A
second copy could drift out of sync with its repository and silently become a leak, and one
anchor means one place to get right.

**Two guards, in order.** `requireAuth` establishes *who* the caller is from the JWT.
`requireOrgAccess` (for `/api/orgs/:orgId/...`) and `requireRepoAccess` (for
`/api/repos/:repoId/...`) then establish *which tenant* they may act in, by reading
`OrganizationMember` from the database. The repo guard resolves the repository and the
caller's org membership in a single query, so the tenant check costs one extra index lookup
rather than an extra round trip.

**Membership is not carried in the token.** The JWT holds no `orgId` and no membership list.
Had it done so, a user removed from an organization would retain access until their token
expired — up to seven days. Checking the database per request means revocation is effective
on the next request. This is a deliberate trade of a small, indexed read for correctness.

**Cross-tenant responses are `404`, not `403`.** A `403` would confirm that a repository or
organization exists, and that existence belongs to another tenant. A `403` is still used once
the caller is inside the correct tenant but lacks a grant on a specific repository.

**No operator exception.** The platform `ADMIN` role grants no access to tenant data; it
guards operational routes (`GET /api/metrics`, the queue dashboard) only. An administrator who
can read every organization would make the isolation claim untrue.

**The webhook path has no caller**, and needs none: it authenticates by HMAC and resolves the
repository by `githubRepoId`, which carries `orgId` with it. Tenancy is therefore correct on
that path without a membership check, because no user is being authorized.

### 3.2 Worker Service — Pipeline Architecture

```
  BullMQ dequeues job
       │
       ▼
  ┌─────────────────────────────────────────────────────┐
  │  STAGE 1: CLONE                                     │
  │  • Create temp directory                            │
  │  • git clone --depth=1 --branch=<pr-branch> <url>   │
  │  • Update analysis status → RUNNING                 │
  │  Output: path to cloned repo                        │
  └──────────────────┬──────────────────────────────────┘
                     │
  ┌──────────────────▼──────────────────────────────────┐
  │  STAGE 2: DETECT                                    │
  │  • Scan file extensions to determine languages      │
  │  • Map languages to analyzer set:                   │
  │    .js/.ts → ESLint                                 │
  │    .py → PyLint + Bandit + Radon                    │
  │    .java → Checkstyle + PMD                         │
  │    .c/.cpp/.h → Cppcheck                            │
  │    all → jscpd (duplication)                         │
  │  Output: { language: string, analyzers: Analyzer[] }│
  └──────────────────┬──────────────────────────────────┘
                     │
  ┌──────────────────▼──────────────────────────────────┐
  │  STAGE 3: ANALYZE                                   │
  │  • Run each selected analyzer via child_process     │
  │  • Capture stdout/stderr as JSON or parsed text     │
  │  • Apply per-analyzer timeout (default 2 min each)  │
  │  Output: raw linter results per tool                │
  └──────────────────┬──────────────────────────────────┘
                     │
  ┌──────────────────▼──────────────────────────────────┐
  │  STAGE 4: NORMALIZE                                 │
  │  • Transform each tool's output into unified format │
  │    { category, severity, file, line, message, rule }│
  │  • Count issues by category (smells, security,      │
  │    complexity, duplication, maintainability)         │
  │  • Calculate lines of code (LOC) for normalization  │
  │  Output: normalized metrics object                  │
  └──────────────────┬──────────────────────────────────┘
                     │
  ┌──────────────────▼──────────────────────────────────┐
  │  STAGE 5: SCORE                                     │
  │  • Apply the penalty-based formula from             │
  │    scoring_algorithm.md (start at 100, deduct per   │
  │    finding by category weight × severity           │
  │    multiplier × diminishing-return factor, plus a   │
  │    continuous duplication-% penalty, normalized by  │
  │    linesOfCode for repos > 1000 LOC)                │
  │  • Also computes debtMinutes (SQALE-style           │
  │    remediation-cost sum, no diminishing returns)    │
  │  Output: healthScore (float 0-100) + debtMinutes    │
  └──────────────────┬──────────────────────────────────┘
                     │
  ┌──────────────────▼──────────────────────────────────┐
  │  STAGE 6: GATE                                      │
  │  • Fetch QualityGate config for this repo (or       │
  │    built-in defaults if none configured)            │
  │  • Compare healthScore/vulnerabilityCount/           │
  │    duplicationPct/complexityCount against the       │
  │    configured thresholds                            │
  │  • Determine: PASS or FAIL                          │
  │  Output: gateResult (GateResult enum, persisted on  │
  │  the HealthSnapshot in Stage 8)                     │
  └──────────────────┬──────────────────────────────────┘
                     │
  ┌──────────────────▼──────────────────────────────────┐
  │  STAGE 7: COMMENT                                   │
  │  • Build markdown summary (score, top issues, gate) │
  │  • POST/PATCH PR comment via Octokit                │
  │  • POST commit status (success/failure) via Octokit │
  │  Output: commentId, statusId                        │
  └──────────────────┬──────────────────────────────────┘
                     │
  ┌──────────────────▼──────────────────────────────────┐
  │  STAGE 8: PERSIST                                   │
  │  • Write HealthSnapshot result row (score, metrics, │
  │    debtMinutes, debtDeltaMinutes, gateResult),      │
  │    linked 1:1 to this AnalysisJob via analysisId    │
  │  • Create Notification records if gate failed or    │
  │    score dropped >10 points from last analysis      │
  │  • Set AnalysisJob.status → COMPLETED (status lives │
  │    on the job, not the snapshot)                    │
  │  Output: snapshotId, analysisId                     │
  └──────────────────┬──────────────────────────────────┘
                     │
  ┌──────────────────▼──────────────────────────────────┐
  │  STAGE 9: CLEANUP                                   │
  │  • rm -rf temp clone directory                      │
  │  • Runs in finally block (even on error/timeout)    │
  │  Output: none                                       │
  └─────────────────────────────────────────────────────┘
```

**Error handling:** If any stage fails, the pipeline jumps to PERSIST (mark status=FAILED with error message) then CLEANUP. BullMQ retries up to 3 times with exponential backoff.

---

## 4. Architecture Decision Record (ADR-001)

### ADR-001: Two-Service Queue-Based Architecture

**Status:** Accepted

**Date:** June 2026

**Context:**
Our system must receive GitHub webhooks (which timeout after 10 seconds without response) and perform code analysis (which takes 1–5 minutes per repository). These two concerns have fundamentally different latency requirements. We are a 3-person student team with ~16 weeks, zero budget, and must demo frontend+DB connectivity by 10–14 August.

**Options Considered:**

| Criterion | (A) Single Monolith | (B) Two-Service + Queue | (C) Full Microservices |
|---|---|---|---|
| **Webhook responsiveness** | ❌ Blocks if analysis runs in-process; requires complex async within single process | ✅ API responds instantly; analysis is fully decoupled | ✅ Each service independent |
| **Development complexity** | ✅ One codebase, simple to start | ✅ Two codebases sharing a DB+types package; manageable | ❌ 4+ services, each with its own deploy, config, health checks |
| **Team coordination** | ✅ Everyone works in one repo | ✅ Clear ownership: API vs Worker | ❌ Cross-service contracts, versioning, service mesh — overkill for 3 people |
| **Deployment cost** | ✅ One process | ✅ Two processes + Redis (free tiers available) | ❌ 4+ processes; may exceed free tier limits |
| **Failure isolation** | ❌ Worker crash takes down API | ✅ Worker crash doesn't affect API; jobs stay in Redis | ✅ Full isolation |
| **Scaling** | ❌ Scale everything together | ✅ Scale workers independently | ✅ Scale anything independently |
| **Time to Progress Review 1** | ✅ Fastest initial setup | ✅ Slightly more setup, but shared Prisma package means DB work is reusable | ❌ Too much infra work before first demo |
| **Shared state** | ✅ Direct function calls | ✅ Shared DB; simple | ⚠️ Would need inter-service APIs or event bus for data sharing |

**Decision:** Option (B) — Two-service, event-driven via Redis/BullMQ with shared PostgreSQL.

**Consequences:**

*Positive:*
- Webhook endpoint always responds within seconds regardless of analysis load
- Worker can be scaled horizontally by adding replicas — each picks jobs from the same queue
- Worker crashes are non-fatal to the user-facing API
- Shared Prisma schema ensures type-safe data access from both services without API contracts
- BullMQ provides retry, backoff, concurrency control, and job state tracking out of the box

*Negative:*
- Two deployment targets instead of one (minor; both are Node.js processes)
- Redis is an additional infrastructure dependency (mitigated: free tiers available on Upstash/Railway)
- Shared database means both services must coordinate on schema migrations (mitigated: Prisma handles this centrally in `packages/db`)

*Risks accepted:*
- Shared PostgreSQL is a coupling point, but acceptable for team size and timeline
- If Redis goes down, new jobs cannot be enqueued (but API still serves cached data)

---

## 5. Deployment View

### 5.1 Proposed Deployment Topology

```
┌──────────────────────────────────────────────────────────────┐
│                    CLOUD DEPLOYMENT                          │
│                                                              │
│  ┌────────────────┐  ┌────────────────┐  ┌───────────────┐  │
│  │  API Service   │  │ Worker Service │  │ Web Dashboard │  │
│  │  (Railway /    │  │ (Railway /     │  │ (Vercel /     │  │
│  │   Render)      │  │  Render)       │  │  Netlify)     │  │
│  │                │  │                │  │               │  │
│  │  Node.js       │  │  Node.js +     │  │  Static SPA   │  │
│  │  Express       │  │  Python, Java  │  │  (React+Vite) │  │
│  │                │  │  C++ runtimes  │  │               │  │
│  └───────┬────────┘  └───────┬────────┘  └───────────────┘  │
│          │                   │                               │
│          │    ┌──────────────┤                               │
│          │    │              │                               │
│  ┌───────▼────▼───┐  ┌──────▼──────────┐                    │
│  │   PostgreSQL   │  │     Redis       │                    │
│  │  (Supabase /   │  │  (Upstash /     │                    │
│  │   Neon /       │  │   Railway)      │                    │
│  │   Railway)     │  │                 │                    │
│  └────────────────┘  └─────────────────┘                    │
│                                                              │
│  ┌────────────────┐                                          │
│  │  Mobile App    │  ← Distributed via Expo Go / TestFlight │
│  │  (Expo EAS)    │    (no app store publish needed for demo)│
│  └────────────────┘                                          │
└──────────────────────────────────────────────────────────────┘
```

### 5.2 Platform Mapping

| Component | Recommended Platform | Notes |
|---|---|---|
| API Service | Railway or Render | Free/hobby tier; supports Node.js; auto-deploy from GitHub |
| Worker Service | Railway or Render | Same platform as API for simplicity. **Note:** needs a custom Docker image with Python, Java, C++ runtimes alongside Node.js |
| PostgreSQL | Supabase (free tier) or Neon | ⚠️ Verify current free-tier limits (row counts, storage, connections) |
| Redis | Upstash (free tier) | ⚠️ Verify current free-tier limits (commands/day, memory). Upstash offers serverless Redis with a generous free tier |
| Web Dashboard | Vercel or Netlify | Free tier for static sites; auto-deploy from GitHub; global CDN |
| Mobile App | Expo EAS | Free builds; distribute via Expo Go for dev/demo; no app store needed |

> **⚠️ IMPORTANT:** Free-tier pricing and limits change frequently. Before committing to any platform, verify current offerings as of July 2026. The above are recommendations based on historically available free tiers, not guaranteed current availability.

### 5.3 Worker Docker Image Consideration

The worker needs multi-language runtimes. A custom Dockerfile is required:

```dockerfile
# Sketch — not production-ready
FROM node:20-slim

# Python (for PyLint, Bandit, Radon)
RUN apt-get update && apt-get install -y python3 python3-pip git
RUN pip3 install pylint bandit radon

# Java (for Checkstyle, PMD)
RUN apt-get install -y default-jre-headless
# Download Checkstyle + PMD JARs

# C/C++ (for Cppcheck)
RUN apt-get install -y cppcheck

# jscpd (Node.js based)
RUN npm install -g jscpd

WORKDIR /app
COPY . .
RUN npm ci
CMD ["node", "dist/index.js"]
```

### 5.4 Docker Compose (Local Development)

All local infrastructure runs via Docker Compose — one command spins up PostgreSQL, Redis, and a Bull Board dashboard for queue monitoring:

```yaml
# docker-compose.yml (project root)
version: "3.9"

services:
  # ── PostgreSQL ────────────────────────────────────────────
  postgres:
    image: postgres:16-alpine
    container_name: codehealth-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: codehealth
      POSTGRES_PASSWORD: codehealth_dev
      POSTGRES_DB: codehealth
    ports:
      - "5432:5432"
    volumes:
      - pg_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U codehealth"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ── Redis (BullMQ job queue) ──────────────────────────────
  redis:
    image: redis:7-alpine
    container_name: codehealth-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    command: redis-server --appendonly yes  # persistence enabled

volumes:
  pg_data:
  redis_data:
```

**Usage:**

```bash
# Start infrastructure
docker compose up -d

# Verify both services are healthy
docker compose ps

# Stop everything
docker compose down

# Stop and wipe all data (fresh start)
docker compose down -v
```

**Environment variables** for the API and Worker to connect to these:

```env
# .env.development
DATABASE_URL="postgresql://codehealth:codehealth_dev@localhost:5432/codehealth"
REDIS_URL="redis://localhost:6379"
```

> **Note:** The API service and Worker service run directly on the host via `npm run dev` (not inside Docker). Docker Compose is only for infrastructure dependencies (PostgreSQL + Redis). This keeps the developer feedback loop fast — file changes trigger instant TypeScript recompilation without rebuilding a container.

### 5.5 Observability

The system implements application-level observability through four mechanisms. These are lightweight and practical — they demonstrate production awareness without requiring a self-hosted monitoring stack (Grafana/Prometheus) that would be overkill at our scale.

#### 5.5.1 Health Check Endpoints

Both services expose a `GET /health` endpoint that verifies connectivity to dependencies:

```typescript
// API health check — reports status of DB + Redis
// GET /health → 200 (healthy) or 503 (degraded)
{
  "status": "healthy",          // "healthy" | "degraded" | "down"
  "version": "1.0.0",
  "uptime": 3600,               // seconds since last restart
  "timestamp": "2026-08-01T10:00:00Z",
  "checks": {
    "database": true,           // PostgreSQL responding to SELECT 1
    "redis": true               // Redis responding to PING
  }
}
```

```typescript
// Worker health check — reports queue status
// GET /worker/health → 200
{
  "status": "healthy",
  "uptime": 3600,
  "queue": {
    "waiting": 2,
    "active": 1,
    "completed": 145,
    "failed": 3
  }
}
```

#### 5.5.2 Structured Logging (Pino)

All services use [Pino](https://github.com/pinojs/pino) for structured JSON logging instead of `console.log`. This enables log searching, filtering, and aggregation in production.

```typescript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty' }    // human-readable in dev
    : undefined,                    // raw JSON in production
});

// Usage examples:
logger.info({ repoId, prNumber }, 'Webhook received');
logger.warn({ jobId, duration: 180 }, 'Analysis took longer than expected');
logger.error({ err, repoId }, 'Failed to clone repository');
```

Log output in production (JSON — searchable by any log platform):
```json
{"level":30,"time":1722470400000,"repoId":"abc123","prNumber":42,"msg":"Webhook received"}
```

#### 5.5.3 BullMQ Dashboard (Bull Board)

[Bull Board](https://github.com/felixmosh/bull-board) provides a real-time web UI for monitoring the job queue — no extra infrastructure needed, it mounts as an Express middleware on the API service.

```
┌──────────────────────────────────────────────────────┐
│  Bull Board — /admin/queues                          │
├──────────────────────────────────────────────────────┤
│  Queue: analysis-queue                               │
│                                                      │
│  Waiting: 2  │  Active: 1  │  Completed: 145  │  Failed: 3  │
│                                                      │
│  Recent Jobs:                                        │
│  ┌────────────────────────────────────────────────┐  │
│  │ Job #148  user/my-project PR#42  ⏳ Active     │  │
│  │ Job #147  user/api-svc PR#8     ✅ Completed   │  │
│  │ Job #146  user/frontend PR#15   ✅ Completed   │  │
│  │ Job #145  user/old-repo PR#3    ❌ Failed      │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

```typescript
// Mount in API service
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullMQAdapter(analysisQueue)],
  serverAdapter,
});

app.use('/admin/queues', serverAdapter.getRouter());
```

> **Demo value:** During the live demo, evaluators can open `/admin/queues` and watch jobs flow through the system in real time as PRs are analyzed. This is a powerful visual proof that the async architecture is working.

#### 5.5.4 Application Metrics Endpoint

A simple `GET /metrics` endpoint exposes operational statistics:

```typescript
// GET /api/metrics → 200
{
  "analysisStats": {
    "totalAnalyses": 145,
    "averageHealthScore": 72.4,
    "averageDuration": 45.2   // seconds
  },
  "queueStats": {
    "pending": 2,
    "active": 1,
    "failed": 3
  },
  "systemStats": {
    "uptimeSeconds": 86400,
    "memoryUsageMB": 128
  }
}
```

#### 5.5.5 Observability Architecture Summary

```
┌──────────────────────────────────────────────────────────┐
│                    OBSERVABILITY LAYER                     │
│                                                            │
│  ┌──────────┐  ┌───────────┐  ┌───────────┐  ┌─────────┐ │
│  │ /health  │  │   Pino    │  │   Bull    │  │/metrics │ │
│  │ endpoint │  │  (JSON    │  │  Board    │  │endpoint │ │
│  │          │  │   logs)   │  │  (UI)     │  │         │ │
│  └──────────┘  └───────────┘  └───────────┘  └─────────┘ │
│       │              │              │              │       │
│  Liveness &    Structured      Real-time       Operational│
│  dependency    searchable      job queue        stats for  │
│  status        log trail       monitoring       dashboards │
│                                                            │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
│  Future (production scale):                                │
│  Pino logs → Grafana Loki  |  /metrics → Prometheus       │
│  /health → Uptime Robot    |  Bull Board → secured route   │
└──────────────────────────────────────────────────────────┘
```

> **Architecture Decision:** We chose application-level observability (health checks + structured logging + Bull Board + metrics) over a self-hosted monitoring stack (Grafana + Prometheus + Loki). At our scale of 2 services with ≤10 concurrent users, the self-hosted stack would add 3 more services to deploy and maintain with no proportional benefit. The lightweight approach provides sufficient visibility while the documented "Future" path shows awareness of production-grade observability patterns.

### 5.6 CI/CD Pipeline (GitOps)

The project follows a **GitOps** deployment model: the Git repository is the single source of truth, and all deployments are triggered automatically by pushes to specific branches.

```
┌────────────┐    push     ┌──────────────────┐    deploy    ┌──────────────┐
│ Developer  │ ──────────> │  GitHub Actions   │ ──────────> │  Railway /   │
│            │             │                   │             │  Render /    │
│ git push   │             │  1. Lint (ESLint) │             │  Vercel      │
│ to main    │             │  2. Type check    │             │              │
│            │             │  3. Unit tests    │             │  Auto-deploy │
└────────────┘             │  4. Build         │             │  from main   │
                           │  5. Deploy        │             └──────────────┘
                           └──────────────────┘
```

#### CI Pipeline (GitHub Actions)

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - run: npm ci

      # Lint all workspaces
      - run: npm run lint --workspaces --if-present

      # TypeScript type checking
      - run: npm run typecheck --workspaces --if-present

      # Run unit tests
      - run: npm run test --workspaces --if-present

      # Build all packages
      - run: npm run build --workspaces --if-present

  # Deployment is handled by Railway/Render/Vercel auto-deploy on main branch
  # No separate deploy step needed — platforms watch the main branch directly
```

#### Branch Strategy

```
main          ← production: auto-deploys to Railway/Render/Vercel
  └── develop ← integration: PR merge target during development
       ├── feature/auth       ← individual feature branches
       ├── feature/webhook
       └── fix/score-calc
```

| Branch | CI Runs? | Auto-Deploy? | Purpose |
|---|---|---|---|
| `main` | ✅ Yes | ✅ Yes (to production) | Stable, deployable code only |
| `develop` | ✅ Yes | ❌ No (optional: staging) | Integration branch for PRs |
| `feature/*` | ✅ Yes (on PR) | ❌ No | Individual work branches |

---

## 6. Single Points of Failure & Scaling Bottlenecks

| # | Component | Failure / Bottleneck | Academic Demo Impact | "Real SaaS" Impact | Mitigation |
|---|---|---|---|---|---|
| 1 | **PostgreSQL (single instance)** | DB crash = entire system down | **Low** — single free-tier instance is fine for demo | **Critical** — need replicas, backups, connection pooling | Demo: accept the risk. Production: managed DB with auto-failover (RDS, Supabase Pro) |
| 2 | **Redis (single instance)** | Redis crash = no new jobs enqueued; API still serves reads | **Low** — can restart; BullMQ jobs are persisted to disk if configured | **High** — queue loss means missed webhooks | Demo: accept. Production: Redis Cluster or managed Redis with persistence |
| 3 | **Worker (single instance)** | Worker crash = analysis jobs pile up in queue (not lost) | **Medium** — restart worker; queued jobs process automatically | **High** — single worker limits throughput | Demo: one worker with concurrency=2. Production: multiple worker replicas |
| 4 | **Worker disk space** | Cloning large repos fills disk | **Low** — demo uses small repos | **High** — 100 concurrent clones could exhaust disk | Demo: accept. Production: ephemeral storage, cleanup on every run, disk quotas |
| 5 | **GitHub API rate limit** | 5,000 req/hr per user token | **Low** — demo has few repos | **Medium** — many repos = many Octokit calls | Cache API responses; use conditional requests (ETags); batch where possible |
| 6 | **API service (single instance)** | API crash = no requests served | **Low** — fast restart | **Critical** — all users affected | Demo: single instance. Production: 2+ instances behind load balancer |
| 7 | **Shared DB between API & Worker** | Schema coupling; long write locks from worker could slow API reads | **Negligible** at demo scale | **Medium** — write-heavy worker analysis could contend with read-heavy dashboard queries | Use read replicas or separate read/write connection pools at scale |

### Severity Summary

For an **academic demo**: risks 1–7 are all acceptable. The system can recover from any single crash by restarting the affected service, and BullMQ ensures no analysis jobs are lost.

For a **"pretend real SaaS"** framing in the report: acknowledge these as known limitations and document the production mitigations (replicas, managed services, horizontal worker scaling) as future work.

---

## 7. Production Scalability Path

> **Architecture Decision:** The system is designed to scale horizontally without requiring a container orchestration platform like Kubernetes. At our current scale (2 services, ≤10 concurrent users), Kubernetes would introduce significant operational complexity with no proportional benefit. The following section documents how each scalability concern is addressed, and what the upgrade path looks like at higher scale.

### 7.1 Rate Limiting

Rate limiting is implemented at the **application level** using `express-rate-limit` with a Redis-backed store:

```
┌──────────┐    request     ┌──────────────────────┐
│  Client  │ ──────────────>│  express-rate-limit   │
│          │                │  (Redis store)         │
│          │  429 Too Many  │                        │
│          │ <────────────  │  Checks: IP + user ID  │
│          │                │  Window: 15 min        │
│          │   200 OK       │  Max: 100 requests     │
│          │ <────────────  │                        │
└──────────┘                └──────────────────────┘
```

| Route | Window | Max Requests | Scope |
|---|---|---|---|
| Global (`/api/*`) | 15 min | 100 | Per IP |
| Webhook (`/api/webhooks/*`) | 1 min | 30 | Per IP |
| Analysis trigger (`POST /api/repos/:id/analyze`) | 5 min | 5 | Per user |

Using a **Redis-backed store** (`rate-limit-redis`) ensures rate limits are consistent across multiple API instances — all instances share the same counter via Redis.

### 7.2 Load Balancing

Load balancing is **not implemented by the application** — it is delegated to the deployment platform or a reverse proxy:

| Scale | Load Balancing Solution | Config Required |
|---|---|---|
| **Demo** (1 instance) | None needed | — |
| **Small production** (2-5 instances) | Railway/Render built-in LB | Click "scale to N instances" |
| **Medium production** (5-20 instances) | Cloudflare / AWS ALB / Nginx reverse proxy | Config file |
| **Large production** (20+ instances) | AWS ALB + Auto Scaling Groups | Infrastructure as Code (Terraform) |

### 7.3 Horizontal Scaling Strategy

The system is designed so that **each component scales independently**:

```
── PRODUCTION TOPOLOGY ──────────────────────────────────────

                    ┌── Cloudflare (CDN + DDoS + SSL) ──┐
                    │                                     │
                    ▼                                     │
              ┌──────────┐                                │
              │  Nginx / │                                │
              │  AWS ALB │                                │
              └────┬─────┘                                │
                   │                                      │
        ┌──────────┼──────────┐                           │
        ▼          ▼          ▼                           │
   ┌─────────┐ ┌─────────┐ ┌─────────┐                   │
   │  API 1  │ │  API 2  │ │  API 3  │  ← stateless,     │
   └────┬────┘ └────┬────┘ └────┬────┘    scale by       │
        │           │           │          adding more    │
        └───────────┼───────────┘                         │
                    │                                      │
         ┌──────────┼──────────┐                           │
         ▼                     ▼                           │
   ┌───────────┐         ┌───────────┐                     │
   │ PostgreSQL│         │   Redis   │                     │
   │  (RDS /   │         │(ElastiCache│                    │
   │  Supabase)│         │ / Upstash) │                    │
   └───────────┘         └─────┬─────┘                     │
                               │ BullMQ                    │
                    ┌──────────┼──────────┐                │
                    ▼          ▼          ▼                │
              ┌──────────┐ ┌──────────┐ ┌──────────┐      │
              │ Worker 1 │ │ Worker 2 │ │ Worker 3 │      │
              └──────────┘ └──────────┘ └──────────┘      │
              ← stateless, scale independently             │
              ← all consume from same BullMQ queue         │
              ← adding a worker = instant throughput boost │
└──────────────────────────────────────────────────────────┘
```

| Component | Scaling Method | Why It Works |
|---|---|---|
| **API Service** | Add more instances behind load balancer | Stateless — all state is in PostgreSQL + Redis. Any instance can handle any request. |
| **Worker Service** | Add more instances consuming from same BullMQ queue | Stateless — each worker picks up the next job from Redis. BullMQ handles job distribution automatically. No coordination needed. |
| **PostgreSQL** | Vertical scaling → read replicas → managed DB (RDS) | Connection pooling via PgBouncer for many API instances. Read replicas for dashboard queries. |
| **Redis** | Vertical scaling → Redis Cluster | Upstash/ElastiCache handles this automatically. |
| **Web Dashboard** | CDN (Vercel/Netlify) | Static SPA — scales infinitely via CDN edge caching. |

### 7.4 Why Not Kubernetes?

| Factor | Our Project | When K8s Makes Sense |
|---|---|---|
| Number of services | 2 (API + Worker) | 20+ microservices |
| Team size | 3 students | Dedicated DevOps/SRE team |
| Operational complexity | Must be zero — no DevOps specialist on team | Organization has K8s expertise |
| Scale | < 100 concurrent users for demo | Thousands of concurrent users |
| Cost | $0 (free tiers) | $200+/month minimum for K8s cluster |
| Deployment speed | `git push` → auto-deploy in 60s | K8s: build image → push registry → update manifests → rolling update |

**Verdict:** Platforms like Railway, Render, and AWS ECS provide all the scaling primitives we need (load balancing, auto-scaling, health checks, zero-downtime deploys) without the operational burden of managing a Kubernetes cluster. The upgrade path from Railway → AWS ECS → Kubernetes is incremental and can happen when the product actually needs it — not before.

---

*This document is ready to be incorporated into the SRS & System Architecture deliverable (due 9 August 2026).*
