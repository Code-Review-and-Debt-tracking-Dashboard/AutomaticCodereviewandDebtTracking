# REST API Design

> **Base URL:** `https://api.example.com/v1`
> **Auth:** Bearer token (JWT) unless noted otherwise
> **Content-Type:** `application/json`

---

## 1. Authentication (GitHub OAuth)

### `GET /auth/github`

Redirects browser to GitHub OAuth consent screen.

- **Auth:** None
- **Query:** `?redirect=/dashboard` (optional — where to go after login)
- **Response:** `302 Redirect` → `https://github.com/login/oauth/authorize?client_id=...&scope=repo,user:email`

### `GET /auth/github/callback`

GitHub redirects here after user approves. Exchanges code for token, creates/updates user, returns JWT.

- **Auth:** None
- **Query:** `?code=abc123&state=xyz`
- **Success `200`:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "clxyz...",
    "username": "rumeshc",
    "email": "rumesh@example.com",
    "avatarUrl": "https://avatars.githubusercontent.com/u/12345"
  }
}
```

- **Errors:** `400` invalid/missing code | `502` GitHub API unreachable

### `GET /auth/me`

Returns the currently authenticated user.

- **Auth:** Required
- **Success `200`:**

```json
{
  "id": "clxyz...",
  "username": "rumeshc",
  "email": "rumesh@example.com",
  "avatarUrl": "https://avatars.githubusercontent.com/u/12345",
  "createdAt": "2026-06-21T10:00:00Z"
}
```

- **Errors:** `401` missing/invalid token

### `POST /auth/logout`

Invalidates the session.

- **Auth:** Required
- **Success:** `204 No Content`

---

## 2. Webhook

### `POST /webhooks/github`

Receives GitHub webhook events. Must respond within 10 seconds.

- **Auth:** HMAC-SHA256 signature in `X-Hub-Signature-256` header (verified against `GITHUB_WEBHOOK_SECRET`)
- **Subscribed events:** `pull_request` (actions: `opened`, `synchronize`, `reopened`, `closed`)
- **Headers required:** `X-GitHub-Event`, `X-Hub-Signature-256`, `X-GitHub-Delivery`
- **What we extract before queuing:**

```json
{
  "action": "opened",
  "prNumber": 42,
  "title": "Add user auth",
  "authorLogin": "rumeshc",
  "headBranch": "feature/auth",
  "baseBranch": "main",
  "headSha": "abc123def456",
  "cloneUrl": "https://github.com/user/repo.git",
  "repoFullName": "user/repo",
  "githubRepoId": 987654
}
```

- **Success:** `202 Accepted` `{ "message": "Job queued", "jobId": "bull-job-123" }`
- **Errors:** `401` invalid signature | `404` repo not linked | `400` unsupported event

---

## 3. Repository Management

### `GET /api/repos`

List all repositories linked by the current user.

- **Auth:** Required
- **Query:** `?page=1&limit=20&search=my-proj&sort=healthScore|name|updatedAt&order=asc|desc`
- **Success `200`:**

```json
{
  "data": [
    {
      "id": "clxyz...",
      "name": "my-project",
      "fullName": "rumeshc/my-project",
      "language": "TypeScript",
      "isActive": true,
      "defaultBranch": "main",
      "latestScore": 78.5,
      "latestScoreChange": -2.3,
      "totalOpenPRs": 3,
      "lastAnalyzedAt": "2026-06-20T14:30:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 5, "totalPages": 1 }
}
```

### `GET /api/repos/available`

List GitHub repos the user has access to but hasn't linked yet.

- **Auth:** Required
- **Query:** `?page=1&per_page=30`
- **Success `200`:**

```json
{
  "data": [
    {
      "githubRepoId": 123456,
      "name": "another-repo",
      "fullName": "rumeshc/another-repo",
      "language": "Python",
      "private": false,
      "defaultBranch": "main"
    }
  ]
}
```

- **Errors:** `502` GitHub API error

> **⚠️ FLAG:** Frontend will need this endpoint to show a "Link Repository" picker. Not in original scope list but essential for the repo linking flow.

### `POST /api/repos`

Link a GitHub repository and register webhook.

- **Auth:** Required
- **Body:**

```json
{ "githubRepoId": 123456 }
```

- **Success `201`:**

```json
{
  "id": "clxyz...",
  "name": "my-project",
  "fullName": "rumeshc/my-project",
  "language": "TypeScript",
  "isActive": true,
  "webhookId": "gh-webhook-789"
}
```

- **Errors:** `409` already linked | `403` no admin access to repo | `502` webhook registration failed

### `DELETE /api/repos/:repoId`

Unlink repository and remove GitHub webhook.

- **Auth:** Required (must be owner)
- **Params:** `repoId` (string)
- **Success:** `204 No Content`
- **Errors:** `404` not found | `403` not owner

### `GET /api/repos/:repoId`

Get repository detail with latest snapshot summary.

- **Auth:** Required
- **Success `200`:**

```json
{
  "id": "clxyz...",
  "name": "my-project",
  "fullName": "rumeshc/my-project",
  "language": "TypeScript",
  "isActive": true,
  "defaultBranch": "main",
  "createdAt": "2026-06-01T10:00:00Z",
  "latestSnapshot": {
    "id": "clsnap...",
    "healthScore": 78.5,
    "debtMinutes": 240,
    "debtDelta": -15,
    "vulnerabilityCount": 2,
    "complexityCount": 8,
    "duplicationCount": 5,
    "codeSmellCount": 23,
    "duplicationPct": 4.2,
    "totalIssues": 38,
    "linesOfCode": 12500,
    "completedAt": "2026-06-20T14:30:00Z"
  },
  "qualityGate": {
    "minHealthScore": 60,
    "maxVulnerabilities": 5,
    "maxDuplicationPct": 10,
    "blockPR": true
  }
}
```

---

## 4. Health Score & Trend

### `GET /api/repos/:repoId/trend`

Health score trend over a configurable time range.

- **Auth:** Required
- **Query:** `?days=30` (default 30, max 365) or `?from=2026-05-01&to=2026-06-21`
- **Success `200`:**

```json
{
  "repoId": "clxyz...",
  "range": { "from": "2026-05-22", "to": "2026-06-21" },
  "dataPoints": [
    {
      "date": "2026-05-22T10:00:00Z",
      "healthScore": 72.1,
      "debtMinutes": 310,
      "totalIssues": 45,
      "vulnerabilityCount": 3,
      "complexityCount": 12,
      "duplicationPct": 5.1,
      "snapshotId": "clsnap1..."
    },
    {
      "date": "2026-06-01T09:00:00Z",
      "healthScore": 75.4,
      "debtMinutes": 280,
      "totalIssues": 40,
      "vulnerabilityCount": 2,
      "complexityCount": 10,
      "duplicationPct": 4.8,
      "snapshotId": "clsnap2..."
    }
  ]
}
```

### `GET /api/repos/:repoId/debt`

Debt summary and breakdown by category.

- **Auth:** Required
- **Success `200`:**

```json
{
  "totalDebtMinutes": 240,
  "debtDelta": -15,
  "breakdown": {
    "vulnerability": { "count": 2, "debtMinutes": 60 },
    "complexity": { "count": 8, "debtMinutes": 80 },
    "duplication": { "count": 5, "debtMinutes": 50 },
    "code_smell": { "count": 23, "debtMinutes": 50 },
    "maintainability": { "count": 0, "debtMinutes": 0 }
  },
  "snapshotId": "clsnap..."
}
```

### `GET /api/repos/:repoId/hotspots`

Worst-offending files by finding count.

- **Auth:** Required
- **Query:** `?limit=10&snapshotId=clsnap...` (optional — defaults to latest)
- **Success `200`:**

```json
{
  "snapshotId": "clsnap...",
  "files": [
    {
      "file": "src/services/analyzerService.ts",
      "totalFindings": 12,
      "newFindings": 3,
      "bySeverity": { "critical": 1, "high": 3, "medium": 5, "low": 2, "info": 1 },
      "debtMinutes": 95
    },
    {
      "file": "src/utils/parser.ts",
      "totalFindings": 8,
      "newFindings": 0,
      "bySeverity": { "critical": 0, "high": 1, "medium": 4, "low": 3, "info": 0 },
      "debtMinutes": 45
    }
  ]
}
```

---

## 5. Pull Requests & Findings

### `GET /api/repos/:repoId/pulls`

List PRs for a repository.

- **Auth:** Required
- **Query:** `?status=open|closed|merged&page=1&limit=20`
- **Success `200`:**

```json
{
  "data": [
    {
      "id": "clpr...",
      "prNumber": 42,
      "title": "Add user auth",
      "authorLogin": "rumeshc",
      "headBranch": "feature/auth",
      "baseBranch": "main",
      "status": "OPEN",
      "latestScore": 78.5,
      "newIssues": 3,
      "resolvedIssues": 5,
      "lastAnalyzedAt": "2026-06-20T14:30:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 12, "totalPages": 1 }
}
```

> **⚠️ FLAG:** `resolvedIssues` (findings present in base but absent in PR head) is useful for the frontend to show "this PR fixed 5 issues." Requires the `isNew` comparison logic from the worker.

### `GET /api/repos/:repoId/pulls/:prNumber`

Get PR detail with all snapshots.

- **Auth:** Required
- **Success `200`:**

```json
{
  "id": "clpr...",
  "prNumber": 42,
  "title": "Add user auth",
  "authorLogin": "rumeshc",
  "headBranch": "feature/auth",
  "baseBranch": "main",
  "status": "OPEN",
  "snapshots": [
    {
      "id": "clsnap...",
      "healthScore": 78.5,
      "debtMinutes": 240,
      "totalIssues": 38,
      "newIssues": 3,
      "status": "COMPLETED",
      "gateResult": "PASS",
      "createdAt": "2026-06-20T14:30:00Z"
    }
  ]
}
```

### `GET /api/snapshots/:snapshotId/findings`

Individual findings for a specific analysis snapshot.

- **Auth:** Required
- **Query:** `?category=VULNERABILITY|COMPLEXITY|DUPLICATION|CODE_SMELL|MAINTAINABILITY&severity=CRITICAL|HIGH|MEDIUM|LOW|INFO&isNew=true|false&file=src/...&page=1&limit=50`
- **Success `200`:**

```json
{
  "snapshotId": "clsnap...",
  "summary": {
    "total": 38,
    "new": 3,
    "carryOver": 35,
    "bySeverity": { "critical": 1, "high": 4, "medium": 15, "low": 12, "info": 6 },
    "byCategory": { "vulnerability": 2, "complexity": 8, "duplication": 5, "code_smell": 23, "maintainability": 0 }
  },
  "data": [
    {
      "id": "clfind...",
      "file": "src/services/analyzerService.ts",
      "line": 42,
      "endLine": 48,
      "severity": "HIGH",
      "category": "COMPLEXITY",
      "rule": "complexity",
      "message": "Function 'processResults' has a cyclomatic complexity of 15 (max allowed 10)",
      "tool": "eslint",
      "isNew": true,
      "debtMinutes": 20
    }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 38, "totalPages": 1 }
}
```

### `POST /api/repos/:repoId/analyze`

Manually trigger analysis on the default branch.

- **Auth:** Required (must be owner)
- **Body:** `{}` (empty — analyzes HEAD of default branch)
- **Success `202`:**

```json
{
  "message": "Analysis queued",
  "snapshotId": "clsnap...",
  "jobId": "bull-job-456"
}
```

- **Errors:** `429` analysis already in progress for this repo

---

## 6. Quality Gate Configuration

### `GET /api/repos/:repoId/quality-gate`

Get current quality gate config.

- **Auth:** Required
- **Success `200`:**

```json
{
  "id": "clgate...",
  "minHealthScore": 60,
  "maxVulnerabilities": 5,
  "maxDuplicationPct": 10.0,
  "maxComplexityScore": null,
  "blockPR": true,
  "repoId": "clxyz..."
}
```

- **`404`** if no gate configured (returns defaults in this case):

```json
{
  "minHealthScore": 60,
  "maxVulnerabilities": null,
  "maxDuplicationPct": null,
  "maxComplexityScore": null,
  "blockPR": false,
  "isDefault": true
}
```

### `PUT /api/repos/:repoId/quality-gate`

Create or update quality gate thresholds.

- **Auth:** Required (must be owner)
- **Body:**

```json
{
  "minHealthScore": 70,
  "maxVulnerabilities": 3,
  "maxDuplicationPct": 8.0,
  "maxComplexityScore": null,
  "blockPR": true
}
```

- **Success `200`:** returns the updated gate object (same shape as GET)
- **Errors:** `400` validation (minHealthScore must be 0-100, etc.) | `403` not owner

---

## 7. Notifications

### `GET /api/notifications`

Get notifications for current user.

- **Auth:** Required
- **Query:** `?read=false&page=1&limit=20`
- **Success `200`:**

```json
{
  "data": [
    {
      "id": "clnotif...",
      "type": "gate_fail",
      "title": "Quality Gate Failed",
      "body": "PR #42 on rumeshc/my-project scored 55/100 (minimum: 60)",
      "read": false,
      "repoId": "clxyz...",
      "snapshotId": "clsnap...",
      "createdAt": "2026-06-20T14:31:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 5, "totalPages": 1 },
  "unreadCount": 3
}
```

### `PATCH /api/notifications/:notificationId/read`

Mark a single notification as read.

- **Auth:** Required
- **Success:** `204 No Content`

### `PATCH /api/notifications/read-all`

Mark all notifications as read.

- **Auth:** Required
- **Success:** `204 No Content`

---

## 8. Mobile-Specific Endpoints

### `POST /api/devices`

Register a device for push notifications.

- **Auth:** Required
- **Body:**

```json
{
  "expoPushToken": "ExponentPushToken[xxxxxx]",
  "platform": "ios",
  "deviceName": "iPhone 14 Pro"
}
```

- **Success `201`:**

```json
{
  "id": "cldev...",
  "expoPushToken": "ExponentPushToken[xxxxxx]",
  "platform": "ios",
  "active": true
}
```

- **Errors:** `409` token already registered (returns existing device)

> **⚠️ FLAG:** This requires a `Device` model not yet in the Prisma schema. Add:
> ```prisma
> model Device {
>   id             String  @id @default(cuid())
>   expoPushToken  String  @unique
>   platform       String  // "ios" | "android"
>   deviceName     String?
>   active         Boolean @default(true)
>   userId         String
>   user           User    @relation(fields: [userId], references: [id], onDelete: Cascade)
>   createdAt      DateTime @default(now())
>   updatedAt      DateTime @updatedAt
>   @@index([userId])
> }
> ```

### `DELETE /api/devices/:deviceId`

Unregister a device (e.g., on logout).

- **Auth:** Required
- **Success:** `204 No Content`

### `GET /api/mobile/summary`

Lightweight summary designed for the mobile home screen. Single call, no pagination.

- **Auth:** Required
- **Success `200`:**

```json
{
  "user": {
    "username": "rumeshc",
    "avatarUrl": "https://avatars.githubusercontent.com/u/12345"
  },
  "unreadNotifications": 3,
  "repos": [
    {
      "id": "clxyz...",
      "name": "my-project",
      "fullName": "rumeshc/my-project",
      "healthScore": 78.5,
      "scoreChange": -2.3,
      "openPRs": 3,
      "criticalIssues": 1,
      "lastAnalyzedAt": "2026-06-20T14:30:00Z"
    }
  ]
}
```

> **⚠️ FLAG:** This aggregated endpoint avoids the mobile app making 3+ separate API calls on launch. The web dashboard can use the individual endpoints, but mobile benefits from this combined view.

### `GET /api/mobile/repos/:repoId/smells`

Quick-view code smells for a repo (latest snapshot), optimized for mobile card layout.

- **Auth:** Required
- **Query:** `?limit=20`
- **Success `200`:**

```json
{
  "repoName": "my-project",
  "healthScore": 78.5,
  "snapshotDate": "2026-06-20T14:30:00Z",
  "smells": [
    {
      "file": "src/services/analyzerService.ts",
      "line": 42,
      "severity": "HIGH",
      "rule": "complexity",
      "message": "Cyclomatic complexity of 15 exceeds threshold of 10",
      "isNew": true
    }
  ],
  "totalSmells": 38,
  "newSmells": 3
}
```

---

## 9. Common Patterns

### Error Response Shape

All errors follow this format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "minHealthScore must be between 0 and 100",
    "details": [
      { "field": "minHealthScore", "message": "must be >= 0 and <= 100" }
    ]
  }
}
```

### Standard Error Codes

| HTTP Status | Code | When |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Invalid request body/params |
| `401` | `UNAUTHORIZED` | Missing or invalid auth token |
| `403` | `FORBIDDEN` | Valid token but insufficient permissions |
| `404` | `NOT_FOUND` | Resource doesn't exist |
| `409` | `CONFLICT` | Duplicate resource (repo already linked, device already registered) |
| `429` | `RATE_LIMITED` | Too many requests / analysis already running |
| `500` | `INTERNAL_ERROR` | Unexpected server error |
| `502` | `UPSTREAM_ERROR` | GitHub API unreachable or returned error |

### Pagination Shape

All paginated endpoints use:

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### Auth Header

```
Authorization: Bearer <jwt-token>
```

---

## 10. Endpoint Summary Table

| # | Method | Path | Auth | Purpose |
|---|---|---|---|---|
| 1 | `GET` | `/auth/github` | None | Redirect to GitHub OAuth |
| 2 | `GET` | `/auth/github/callback` | None | Exchange code for JWT |
| 3 | `GET` | `/auth/me` | Bearer | Get current user |
| 4 | `POST` | `/auth/logout` | Bearer | Invalidate session |
| 5 | `POST` | `/webhooks/github` | HMAC | Receive GitHub events |
| 6 | `GET` | `/api/repos` | Bearer | List linked repos |
| 7 | `GET` | `/api/repos/available` | Bearer | List unlinkable GitHub repos |
| 8 | `POST` | `/api/repos` | Bearer | Link a repository |
| 9 | `DELETE` | `/api/repos/:repoId` | Bearer | Unlink a repository |
| 10 | `GET` | `/api/repos/:repoId` | Bearer | Repo detail + latest snapshot |
| 11 | `GET` | `/api/repos/:repoId/trend` | Bearer | Health score trend data |
| 12 | `GET` | `/api/repos/:repoId/debt` | Bearer | Debt summary by category |
| 13 | `GET` | `/api/repos/:repoId/hotspots` | Bearer | Worst files by findings |
| 14 | `GET` | `/api/repos/:repoId/pulls` | Bearer | List PRs |
| 15 | `GET` | `/api/repos/:repoId/pulls/:prNumber` | Bearer | PR detail + snapshots |
| 16 | `GET` | `/api/snapshots/:snapshotId/findings` | Bearer | Findings for a snapshot |
| 17 | `POST` | `/api/repos/:repoId/analyze` | Bearer | Trigger manual analysis |
| 18 | `GET` | `/api/repos/:repoId/quality-gate` | Bearer | Get gate config |
| 19 | `PUT` | `/api/repos/:repoId/quality-gate` | Bearer | Set gate config |
| 20 | `GET` | `/api/notifications` | Bearer | List notifications |
| 21 | `PATCH` | `/api/notifications/:id/read` | Bearer | Mark one read |
| 22 | `PATCH` | `/api/notifications/read-all` | Bearer | Mark all read |
| 23 | `POST` | `/api/devices` | Bearer | Register push device |
| 24 | `DELETE` | `/api/devices/:deviceId` | Bearer | Unregister device |
| 25 | `GET` | `/api/mobile/summary` | Bearer | Mobile home screen data |
| 26 | `GET` | `/api/mobile/repos/:repoId/smells` | Bearer | Mobile code smell view |

---

## 10. Observability & Admin Endpoints

### `GET /health`

Health check for API service liveness and dependency status.

- **Auth:** None (public — used by uptime monitors and load balancers)
- **Response `200`:**

```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 3600,
  "timestamp": "2026-08-01T10:00:00Z",
  "checks": {
    "database": true,
    "redis": true
  }
}
```

- **Response `503`:** Same shape but `"status": "degraded"` and at least one check is `false`

---

### `GET /api/metrics`

Application-level operational statistics.

- **Auth:** Required (admin or authenticated user)
- **Response `200`:**

```json
{
  "analysisStats": {
    "totalAnalyses": 145,
    "averageHealthScore": 72.4,
    "averageDurationSeconds": 45.2
  },
  "queueStats": {
    "pending": 2,
    "active": 1,
    "completed": 145,
    "failed": 3
  },
  "systemStats": {
    "uptimeSeconds": 86400,
    "memoryUsageMB": 128
  }
}
```

---

### `GET /admin/queues`

Bull Board web UI for real-time BullMQ job queue monitoring.

- **Auth:** Basic auth (username/password in env vars — not OAuth)
- **Response:** HTML dashboard (served by `@bull-board/express`)
- **Note:** This is a mounted Express sub-app, not a JSON API endpoint

---

## 11. Scope Gaps Flagged

| # | Gap | Impact | Recommendation |
|---|---|---|---|
| 1 | **`GET /api/repos/available`** not in original scope | Frontend cannot show a repo picker without it | Add to Sprint 1 — simple GitHub API proxy |
| 2 | **`Device` model** missing from Prisma schema | Cannot store push tokens for mobile | Add model (schema shown in §8 above) |
| 3 | **`GET /api/mobile/summary`** not in original scope | Mobile will make 3+ calls on launch without it | Add as convenience endpoint — aggregates existing queries |
| 4 | **Snapshot status SSE/WebSocket** | Frontend has no way to know when an analysis completes without polling | Options: (a) poll `GET /api/repos/:repoId` every 10s, (b) add SSE endpoint `/api/events`. Recommend polling for MVP, SSE in Sprint 2 |
| 5 | **`resolvedIssues` count on PRs** | Frontend wants to show "this PR fixed N issues" | Requires worker to compute resolved count during isNew comparison — add to worker pipeline |

---

*This document serves as the API contract. Frontend and mobile teammates can start building against these shapes immediately using mock data. All types should be codified in `packages/shared/src/types/api.ts`. Total endpoint count: 29 (26 REST + 3 observability/admin).*
