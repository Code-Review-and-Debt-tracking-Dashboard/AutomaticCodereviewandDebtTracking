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
    "avatarUrl": "https://avatars.githubusercontent.com/u/12345",
    "role": "DEVELOPER"
  }
}
```

- **Errors:** `400` invalid/missing code | `502` GitHub API unreachable

> New GitHub accounts default to `role: "DEVELOPER"` (see §2 Roles & Authorization). There is no self-service admin signup.

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
  "role": "DEVELOPER",
  "createdAt": "2026-06-21T10:00:00Z"
}
```

- **Errors:** `401` missing/invalid token

### `POST /auth/logout`

Invalidates the session.

- **Auth:** Required
- **Success:** `204 No Content`

---

## 2. Roles & Authorization

Three roles exist on `User.role` (see `database_design.md` §3.7 for the schema rationale):

| Role | Can do | Sees |
|---|---|---|
| `ADMIN` | Everything a Team Lead can do, plus `GET /api/metrics` | All repositories |
| `TEAM_LEAD` | Link/unlink repos, configure quality gates, trigger manual analysis, add/remove repo members | Repos they own |
| `DEVELOPER` | Read-only: view findings, trends, hotspots; manage own notifications/devices | Repos where they are a `RepositoryMember` |

**Defaults and promotion:**
- Every new GitHub login defaults to `DEVELOPER`.
- A `DEVELOPER` is auto-promoted to `TEAM_LEAD` the moment they successfully link their first repository (`POST /api/repos`) — owning a repo requires Team Lead permissions, so this happens transparently rather than requiring a manual role request.
- `ADMIN` is never self-service. The first admin for a deployment is set directly in the database; existing admins cannot currently promote others via the API (no endpoint for this — out of scope for MVP).

**How endpoints enforce this:** every route below that says "**Auth:** Required (must be owner)" means "the requester is the repo's `Repository.userId` (Team Lead owner) **or** has `role: ADMIN`." Routes open to `DEVELOPER`s additionally check for a `RepositoryMember` row (see the new member endpoints in §4).

**Error:** `403 FORBIDDEN` if the requester is authenticated but is neither the owner, a member, nor an admin.

---

## 3. Webhook

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

## 4. Repository Management

### `GET /api/repos`

List repositories the current user can see: repos they own (Team Lead), repos they are a member of (Developer), or all repos if `role: ADMIN`.

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

- **Errors:** `409` already linked | `403` no admin access to repo on GitHub's side (not our platform role) | `502` webhook registration failed

> If the requester's platform role is still `DEVELOPER`, a successful link auto-promotes them to `TEAM_LEAD` (see §2 Roles & Authorization). The response does not echo the new role — call `GET /auth/me` to refresh it client-side.

### `DELETE /api/repos/:repoId`

Unlink repository and remove GitHub webhook.

- **Auth:** Required (must be owner or `ADMIN`)
- **Params:** `repoId` (string)
- **Success:** `204 No Content`
- **Errors:** `404` not found | `403` not owner/admin

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

### `GET /api/repos/:repoId/members`

List developers with read access to this repository (does not include the owner — see §2).

- **Auth:** Required (owner, member, or `ADMIN`)
- **Success `200`:**

```json
{
  "data": [
    {
      "id": "clmem...",
      "userId": "clusr...",
      "username": "vidushi",
      "avatarUrl": "https://avatars.githubusercontent.com/u/54321",
      "addedAt": "2026-06-25T09:00:00Z"
    }
  ]
}
```

### `POST /api/repos/:repoId/members`

Grant a developer read access to this repository, by GitHub username.

- **Auth:** Required (must be owner or `ADMIN`)
- **Body:**

```json
{ "username": "vidushi" }
```

- **Success `201`:** same shape as one item in the GET list above
- **Errors:** `404` GitHub username not found among existing platform users | `409` already a member | `403` not owner/admin

> The target user must already have logged into the platform at least once (we can only add existing `User` rows — there is no invite-by-email flow in MVP).

### `DELETE /api/repos/:repoId/members/:userId`

Revoke a developer's read access.

- **Auth:** Required (must be owner or `ADMIN`)
- **Success:** `204 No Content`
- **Errors:** `404` membership not found | `403` not owner/admin

---

## 5. Health Score & Trend

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

## 6. Pull Requests & Findings

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

- **Auth:** Required (must be owner or `ADMIN`)
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

## 7. Quality Gate Configuration

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
  "maxComplexityCount": null,
  "blockPR": true,
  "repoId": "clxyz..."
}
```

- **If no gate configured, still `200`** — returns the built-in defaults instead of a 404, since "no gate configured" is a valid, expected state (every repo implicitly has the default gate until someone customizes it):

```json
{
  "minHealthScore": 60,
  "maxVulnerabilities": null,
  "maxDuplicationPct": null,
  "maxComplexityCount": null,
  "blockPR": false,
  "isDefault": true
}
```

### `PUT /api/repos/:repoId/quality-gate`

Create or update quality gate thresholds.

- **Auth:** Required (must be owner or `ADMIN`)
- **Body:**

```json
{
  "minHealthScore": 70,
  "maxVulnerabilities": 3,
  "maxDuplicationPct": 8.0,
  "maxComplexityCount": null,
  "blockPR": true
}
```

- **Success `200`:** returns the updated gate object (same shape as GET)
- **Errors:** `400` validation (minHealthScore must be 0-100, etc.) | `403` not owner/admin

> `maxComplexityCount` is an **integer count** of complexity-category findings (matches `HealthSnapshot.complexityCount`), not a "complexity score" — the scoring algorithm (`scoring_algorithm.md`) never produces a standalone complexity sub-score, only a finding count.

---

## 8. Notifications

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

## 9. Mobile-Specific Endpoints

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

> The `Device` model is defined in `database_design.md` §2/§3.8 and the schema at `packages/db/prisma/schema.prisma`.

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

## 10. Common Patterns

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

## 11. Endpoint Summary Table

| # | Method | Path | Auth | Purpose |
|---|---|---|---|---|
| 1 | `GET` | `/auth/github` | None | Redirect to GitHub OAuth |
| 2 | `GET` | `/auth/github/callback` | None | Exchange code for JWT |
| 3 | `GET` | `/auth/me` | Bearer | Get current user |
| 4 | `POST` | `/auth/logout` | Bearer | Invalidate session |
| 5 | `POST` | `/webhooks/github` | HMAC | Receive GitHub events |
| 6 | `GET` | `/api/repos` | Bearer | List repos user can see |
| 7 | `GET` | `/api/repos/available` | Bearer | List unlinkable GitHub repos |
| 8 | `POST` | `/api/repos` | Bearer | Link a repository (auto-promotes to Team Lead) |
| 9 | `DELETE` | `/api/repos/:repoId` | Bearer (owner/admin) | Unlink a repository |
| 10 | `GET` | `/api/repos/:repoId` | Bearer | Repo detail + latest snapshot |
| 11 | `GET` | `/api/repos/:repoId/members` | Bearer (owner/member/admin) | List repo members |
| 12 | `POST` | `/api/repos/:repoId/members` | Bearer (owner/admin) | Add a developer to a repo |
| 13 | `DELETE` | `/api/repos/:repoId/members/:userId` | Bearer (owner/admin) | Remove a repo member |
| 14 | `GET` | `/api/repos/:repoId/trend` | Bearer | Health score trend data |
| 15 | `GET` | `/api/repos/:repoId/debt` | Bearer | Debt summary by category |
| 16 | `GET` | `/api/repos/:repoId/hotspots` | Bearer | Worst files by findings |
| 17 | `GET` | `/api/repos/:repoId/pulls` | Bearer | List PRs |
| 18 | `GET` | `/api/repos/:repoId/pulls/:prNumber` | Bearer | PR detail + snapshots |
| 19 | `GET` | `/api/snapshots/:snapshotId/findings` | Bearer | Findings for a snapshot |
| 20 | `POST` | `/api/repos/:repoId/analyze` | Bearer (owner/admin) | Trigger manual analysis |
| 21 | `GET` | `/api/repos/:repoId/quality-gate` | Bearer | Get gate config |
| 22 | `PUT` | `/api/repos/:repoId/quality-gate` | Bearer (owner/admin) | Set gate config |
| 23 | `GET` | `/api/notifications` | Bearer | List notifications |
| 24 | `PATCH` | `/api/notifications/:id/read` | Bearer | Mark one read |
| 25 | `PATCH` | `/api/notifications/read-all` | Bearer | Mark all read |
| 26 | `POST` | `/api/devices` | Bearer | Register push device |
| 27 | `DELETE` | `/api/devices/:deviceId` | Bearer | Unregister device |
| 28 | `GET` | `/api/mobile/summary` | Bearer | Mobile home screen data |
| 29 | `GET` | `/api/mobile/repos/:repoId/smells` | Bearer | Mobile code smell view |

---

## 12. Observability & Admin Endpoints

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

- **Auth:** Required, `role: ADMIN` only (see §2 Roles & Authorization)
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

## 13. Scope Gaps Flagged

| # | Gap | Impact | Recommendation |
|---|---|---|---|
| 1 | **`GET /api/repos/available`** not in original scope | Frontend cannot show a repo picker without it | Add to Sprint 1 — simple GitHub API proxy |
| 2 | **`GET /api/mobile/summary`** not in original scope | Mobile will make 3+ calls on launch without it | Add as convenience endpoint — aggregates existing queries |
| 3 | **Snapshot status SSE/WebSocket** | Frontend has no way to know when an analysis completes without polling | Options: (a) poll `GET /api/repos/:repoId` every 10s, (b) add SSE endpoint `/api/events`. Recommend polling for MVP, SSE in Sprint 2 |
| 4 | **`resolvedIssues` count on PRs** | Frontend wants to show "this PR fixed N issues" | Requires worker to compute resolved count during isNew comparison — add to worker pipeline |
| 5 | **No admin-promotion endpoint** | First `ADMIN` must be set directly in the DB; existing admins cannot promote others via the API | Acceptable for MVP (small, trusted team). Add `PATCH /api/users/:userId/role` (admin-only) post-MVP if needed. |

> Resolved since the previous revision of this document: the `Device` model gap (now in `database_design.md` §2/§3.8) and the missing user-role/repo-membership model (now `UserRole` enum + `RepositoryMember`, §2 above and `database_design.md` §3.7).

---

*This document serves as the API contract. Frontend and mobile teammates can start building against these shapes immediately using mock data. All types should be codified in `packages/shared/src/types/api.ts`. Total endpoint count: 32 (29 REST + 3 observability/admin).*
