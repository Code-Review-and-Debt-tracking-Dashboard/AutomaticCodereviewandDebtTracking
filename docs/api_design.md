# REST API Design

> **Base URL:** `https://api.example.com/v1`
> **Auth:** Bearer token (JWT) unless noted otherwise
> **Content-Type:** `application/json`

---

## 1. Authentication (GitHub OAuth)

Authentication uses a **short-lived access token plus a rotating refresh token**.

| Token | Form | Lifetime | Where it lives |
|---|---|---|---|
| Access | JWT, claims `sub` / `jti` / `username` / `platformRole` / `typ: "access"` | 15 min (`ACCESS_TOKEN_EXPIRES_IN`) | Browser memory; `Authorization: Bearer` header |
| Refresh | Opaque 256-bit random, stored SHA-256 hashed in `Session.tokenHash` | 7 days (`REFRESH_TOKEN_TTL_DAYS`) | `ch_refresh` cookie — `HttpOnly`, `SameSite=Lax`, `Path=/auth` |

`requireAuth` verifies the access token's signature only — no database read — so the hot path stays cheap. Revocation happens on the refresh token instead, which means a revoked session keeps working for at most one access-token lifetime.

**Rotation and reuse detection.** Every refresh spends the presented token and issues a replacement in the same `familyId`. A token presented *after* it was already spent means a copy exists, so the entire family is revoked. A 10-second grace window exempts the common case of two browser tabs refreshing at once, which would otherwise look identical to theft.

The refresh token is returned on whichever transport asked for it: a browser sends the cookie and gets a `Set-Cookie` back with nothing in the body; a non-browser client (mobile) sends `refreshToken` in the JSON body and gets the new one back the same way.

### `GET /auth/github`

Redirects browser to GitHub OAuth consent screen.

- **Auth:** None
- **Query:** `?redirect=/dashboard` (optional — where to go after login), `?client=web|native` (default `web`)
- **Response:** `302 Redirect` → `https://github.com/login/oauth/authorize?client_id=...&scope=repo,user:email`
- **Also sets:** `ch_oauth_state` — `HttpOnly`, `SameSite=Lax`, `Path=/auth`, 10 min. Holds the same nonce that is inside the signed `state`, which is what ties the login to this browser.

### `GET /auth/github/callback`

GitHub redirects here after the user approves. Exchanges the code, creates/updates the user, opens a session.

The code exchange happens entirely server-side and the browser is **redirected**, not answered with JSON — setting the refresh cookie on a top-level navigation is what keeps `SameSite=Lax` working, and it keeps every secret out of the URL and out of browser history.

- **Auth:** None
- **Query:** `?code=abc123&state=xyz`
- **Success (`client=web`):** `302 Redirect` → `WEB_APP_URL` + the state's sanitized `redirect` (default `/auth/callback`), with `Set-Cookie: ch_refresh=...`
- **Failure (`client=web`):** `302 Redirect` → `WEB_APP_URL/login?error=CODE`
- **Success (`client=native`):** `200` with the tokens in the body, no cookie:

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "0J8fS2...",
  "expiresAt": "2026-08-17T10:00:00Z",
  "user": {
    "id": "clxyz...",
    "username": "rumeshc",
    "email": "rumesh@example.com",
    "avatarUrl": "https://avatars.githubusercontent.com/u/12345",
    "platformRole": "USER"
  }
}
```

The `state` is checked three ways before the code is exchanged: the signature must verify, the nonce must match the `ch_oauth_state` cookie (so the login has to finish in the browser that started it), and the nonce must be unused in Redis (so a callback URL can't be replayed). The cookie is cleared on every callback, success or failure — a failed login starts over.

> The GitHub OAuth App's Authorization callback URL must equal `GITHUB_OAUTH_CALLBACK_URL` — i.e. the **API**, not the web app.

> New GitHub accounts default to `platformRole: "USER"` (see §2 Roles & Authorization). There is no self-service admin signup. Per-repository roles (Team Lead / Developer / Viewer) are separate and are established by linking or being added to a repo.

### `POST /auth/refresh`

Spends the refresh token and returns a new access token.

- **Auth:** None — the point is that the access token has expired. The refresh token itself is the credential.
- **Body:** `{ "refreshToken": "..." }` — only for clients that can't use cookies. Browsers send nothing; the cookie is read instead.
- **Success `200`:**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresAt": "2026-08-17T10:00:00Z",
  "user": { "id": "clxyz...", "username": "rumeshc", "email": null, "avatarUrl": null, "platformRole": "USER" }
}
```

`refreshToken` is additionally present in the body **only** when the request supplied it in the body.

- **Errors** — all `401`, and all clear the refresh cookie:

| Code | Means |
|---|---|
| `MISSING_REFRESH_TOKEN` | Neither cookie nor body carried one |
| `INVALID_REFRESH_TOKEN` | Unknown token, or the session was ended by logout / admin / an earlier reuse |
| `REFRESH_TOKEN_EXPIRED` | Past `expiresAt`; nothing is revoked, the family was already dead |
| `REFRESH_TOKEN_REUSED` | Already-spent token replayed outside the grace window. **The whole family is revoked.** Clients should surface this differently from an ordinary expiry |
| `ACCOUNT_INACTIVE` | `User.active` is false; the family is revoked |

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
  "platformRole": "USER",
  "createdAt": "2026-06-21T10:00:00Z"
}
```

- **Errors:** `401` missing/invalid token

### `POST /auth/logout`

Revokes the session family the refresh token belongs to.

- **Auth:** None — deliberately. Requiring a valid access token would stop anyone whose token had already expired from logging out.
- **Body:** `{ "refreshToken": "..." }` for non-cookie clients.
- **Success:** `204 No Content` — always, even for an unknown or absent token, so this can't be used to probe which tokens exist. Safe to call twice.

### `DELETE /api/admin/users/:userId/sessions`

Force-logout: revokes every live session for one user.

- **Auth:** Required, platform `ADMIN`
- **Success `200`:** `{ "revoked": 3 }`
- **Errors:** `401` missing/invalid token | `403` `FORBIDDEN` not a platform admin

> `requirePlatformRole` re-reads the role from the database rather than trusting the access token's `platformRole` claim, so a demoted admin loses access immediately instead of keeping it until their token expires. This is the only place `platformRole` gates access, and it does not cross a tenant boundary — see §2.

### `POST /auth/dev-login` *(local only)*

Signs in as any username without GitHub, going through the same session path as a real login.

Registered **only** when `ENABLE_DEV_LOGIN=true` and `NODE_ENV !== "production"` — the route is not mounted otherwise, rather than being guarded inside the handler. The API logs a warning at boot when it is on.

- **Body:** `{ "username": "demo_developer" }`
- **Success `200`:** same shape as `POST /auth/refresh`, plus the refresh cookie

---

## 2. Roles & Authorization

The system is **multi-tenant at the organization level**. An organization is the tenant, every repository belongs to exactly one, and a user can never reach data in an organization they do not belong to. Authorization has **three axes** (see `database_design.md` §3.7 and §3.12 for the schema rationale):

**1. Organization membership** — the tenant boundary. `OrganizationMember` rows carrying an `OrgRole` and a `MemberStatus`:

| Org role | Can do |
|---|---|
| `OWNER` | The user's own personal account org, and GitHub org owners. Full control of the tenant's repositories |
| `ADMIN` | Mapped from GitHub org role `admin`. Same repository control as `OWNER` |
| `MEMBER` | In the tenant, but still needs a per-repository grant to open a given repository |

Organizations mirror **GitHub account owners** — both real GitHub organizations and personal accounts. Membership is synced from GitHub (`read:org` scope) and is never granted through this API.

**2. Per-repository relationship** — repo ownership (`Repository.ownerId`) plus `RepositoryMember` rows carrying a `RepositoryRole` (`TEAM_LEAD` / `DEVELOPER` / `VIEWER`) and a `MemberStatus`:

| Relationship | Can do |
|---|---|
| Owner (`Repository.ownerId`) | Link/unlink the repo, configure quality gates, trigger manual analysis, add/remove members |
| Member, `TEAM_LEAD` | Same repo-management actions as the owner |
| Member, `DEVELOPER` | Read-only: view findings, trends, hotspots; manage own notifications/devices |
| Member, `VIEWER` | Read-only (reserved; not yet exercised in MVP) |

**3. Platform role** — `User.platformRole` (`PlatformRole` enum):

| Platform role | Can do | Sees |
|---|---|---|
| `ADMIN` | `GET /api/metrics` and the queue dashboard — **operational routes only** | No tenant data. An admin has no more access to any organization's repositories than any other user |
| `USER` | Default. Capabilities depend on the two axes above | Repos in their orgs that they own or are a member of |

**Defaults:**
- Every new GitHub login defaults to `platformRole: USER`, and their organizations are synced from GitHub on each login.
- A user's own GitHub account is always one of their organizations, so personal repositories still live in a tenant.
- Linking a repository makes the caller that repo's **owner** (`ownerId`), inside the organization that owns it on GitHub.
- `ADMIN` is never self-service. The first admin for a deployment is set directly in the database; there is no admin-promotion endpoint in MVP.

**How endpoints enforce this.** Every repo-scoped route checks two layers, in order:

1. **Tenant** — is the caller an `ACTIVE` `OrganizationMember` of the repository's `orgId`? Checked against the database on every request, never from the token, so revoking membership takes effect immediately rather than when the token expires.
2. **Repository** — "**Auth:** Required (must be owner)" means the requester is the repo's `Repository.ownerId`, is an `ACTIVE` `RepositoryMember` with `role = TEAM_LEAD`, or is an `OWNER`/`ADMIN` of the organization. Read routes additionally accept any `ACTIVE` `RepositoryMember` (any repo role).

**Errors:**
- `404 NOT_FOUND` if the caller is outside the repository's or organization's tenant. This is deliberately **not** `403` — a `403` would confirm that the resource exists, and its existence is itself information belonging to another tenant.
- `403 FORBIDDEN` if the caller is inside the right tenant but lacks a grant on that specific repository. At that point they are entitled to know it exists.

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

## 3a. Organizations (Tenants)

Organizations are not created through this API — they mirror the GitHub account owners the user already belongs to, and are synced from GitHub on login. These endpoints let the user see and choose among them.

### `GET /api/orgs`

Organizations the caller currently belongs to. This is what the UI uses to let them pick which organization to work in.

- **Auth:** Required
- **Success `200`:**

```json
{
  "data": [
    {
      "id": "clorg1...",
      "githubOrgId": "20001",
      "login": "acme-corp",
      "name": "Acme Corp",
      "avatarUrl": "https://avatars.githubusercontent.com/u/20001",
      "type": "ORGANIZATION",
      "role": "MEMBER"
    },
    {
      "id": "clorg2...",
      "githubOrgId": "1234",
      "login": "rumeshc",
      "name": "rumeshc",
      "avatarUrl": "https://avatars.githubusercontent.com/u/1234",
      "type": "USER",
      "role": "OWNER"
    }
  ]
}
```

`type: "USER"` is the caller's own GitHub account, which is always present so that personal repositories have a tenant.

### `POST /api/orgs/sync`

Re-reads the caller's organizations from GitHub using their stored token, for when they have just joined or left one and do not want to log out and back in. Organizations GitHub no longer reports are revoked.

- **Auth:** Required
- **Success `200`:** same shape as `GET /api/orgs` (the refreshed list)
- **Errors:** `401` no GitHub credential on file (sign in again) | `502` GitHub unreachable

### `GET /api/orgs/:orgId/members`

Everyone in the organization.

- **Auth:** Required (must be an active member of this organization)
- **Success `200`:**

```json
{
  "data": [
    {
      "userId": "clxyz...",
      "username": "rumeshc",
      "avatarUrl": "https://avatars.githubusercontent.com/u/1234",
      "role": "ADMIN",
      "status": "ACTIVE",
      "syncedAt": "2026-07-31T09:00:00Z"
    }
  ]
}
```

- **Errors:** `404` caller is not a member of this organization (**not** `403` — see §2)

### `GET /api/orgs/:orgId/repos`

Linked repositories in this organization that the caller can actually open. Being in the organization is not on its own enough — a repository still needs ownership or an active repository membership — so a `MEMBER` with no grants correctly receives an empty list.

- **Auth:** Required (must be an active member of this organization)
- **Success `200`:**

```json
{
  "data": [
    {
      "id": "clxyz...",
      "name": "my-project",
      "fullName": "acme-corp/my-project",
      "language": "TypeScript",
      "defaultBranch": "main",
      "isActive": true,
      "orgId": "clorg1..."
    }
  ]
}
```

- **Errors:** `404` caller is not a member of this organization

---

## 4. Repository Management

### `GET /api/repos`

List repositories the current user can see: within the organizations they belong to, repos they own or are a member of. There is no platform-admin shortcut — the tenant boundary applies to every caller, including `platformRole: ADMIN` (see §2 Roles & Authorization).

- **Auth:** Required
- **Query:** `?page=1&limit=20&search=my-proj&sort=name|updatedAt&order=asc|desc`
- **Errors:** `400` invalid `page`, `limit`, `sort` or `order`

> `sort=healthScore` is **not supported**. Ordering by health score means ordering on each repo's *latest* snapshot, which cannot be pushed down to the database from the ORM, and sorting in memory would silently break pagination. Supporting it properly needs a denormalized latest-score column on `Repository`; until then the endpoint returns `400` for that value. `search` matches `fullName`, case-insensitively.
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
  "fullName": "acme-corp/my-project",
  "language": "TypeScript",
  "isActive": true,
  "orgId": "clorg1...",
  "webhookId": "gh-webhook-789"
}
```

- **Errors:** `409` already linked | `403` no admin access to repo on GitHub's side (not our platform role) | `404` the repo's GitHub owner is not an organization the caller belongs to | `502` webhook registration failed

> A successful link makes the caller the repo's **owner** (`Repository.ownerId`), which grants full repo-management rights on that repo (see §2 Roles & Authorization). The caller's platform role is unaffected.
>
> **Tenant assignment is not a choice the caller makes.** `orgId` is resolved from the repository's GitHub owner (`repository.owner.id`), so a repo always lands in the organization that actually owns it on GitHub. The caller must be an active member of that organization, which is why linking a repo from an org you are not in is a `404` rather than a `403`.

### `DELETE /api/repos/:repoId`

Unlink repository and remove GitHub webhook.

- **Auth:** Required (must be the repository's owner, or an `OWNER`/`ADMIN` of the organization it belongs to — not `platformRole: ADMIN`)
- **Params:** `repoId` (string)
- **Success:** `204 No Content`
- **Errors:** `404` not found, or in an organization the caller does not belong to | `403` in the organization, but neither the repo's owner nor an org owner/admin

> A repository `TEAM_LEAD` can manage the repo's member list but **cannot** unlink it.
>
> Unlink is a soft delete: the row stays with `isActive: false` and `webhookId` cleared, so the repo's snapshots, findings and PR history survive. Linking the same repo again revives that row rather than starting a new one.

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
      "role": "DEVELOPER",
      "status": "ACTIVE",
      "addedAt": "2026-06-25T09:00:00Z"
    }
  ]
}
```

### `POST /api/repos/:repoId/members`

Grant a user access to this repository, by GitHub username.

- **Auth:** Required (must be owner or `ADMIN`)
- **Body:** `role` is optional and defaults to `DEVELOPER` (`RepositoryRole`: `TEAM_LEAD` | `DEVELOPER` | `VIEWER`):

```json
{ "username": "vidushi", "role": "DEVELOPER" }
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
  "range": { "from": "2026-05-22T00:00:00.000Z", "to": "2026-06-21T00:00:00.000Z" },
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

> The `debtDelta` JSON field maps to the schema column `HealthSnapshot.debtDeltaMinutes` (both are minutes; negative = debt decreased). Per-severity counts (`criticalCount`, `highCount`, ...) are also available on the snapshot for callers that need them.

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

> **⚠️ DRIFT (2026-08-06):** the implementation (`apps/api/src/services/repoService.ts` `getRepoPullRequests`) does not match this shape yet — it returns `id/author/branch/score/findings/debtDelta/status/time/htmlUrl` instead of the fields above, and has no pagination. Check apps/web isn't already depending on the current field names before renaming anything.

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

> `isNew` is a convenience filter derived from the schema's `Finding.state` enum: `isNew=true` ⇔ `state = NEW`, `isNew=false` ⇔ `state = EXISTING`. The per-finding `isNew` in the response body is likewise `state == NEW`.
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
  "analysisId": "clanl...",
  "jobId": "bull-job-456"
}
```

> Returns the `AnalysisJob` id, not a snapshot id — a `HealthSnapshot` does not exist until the job completes. Poll `GET /api/repos/:repoId` (or the job) for the result.

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
  "maxCriticalFindings": 0,
  "maxVulnerabilities": 5,
  "maxDuplicationPct": 10.0,
  "maxComplexityCount": null,
  "maxCodeSmellCount": null,
  "blockPR": true,
  "repoId": "clxyz..."
}
```

- **If no gate configured, still `200`** — returns the built-in defaults instead of a 404, since "no gate configured" is a valid, expected state (every repo implicitly has the default gate until someone customizes it):

```json
{
  "minHealthScore": 60,
  "maxCriticalFindings": null,
  "maxVulnerabilities": null,
  "maxDuplicationPct": null,
  "maxComplexityCount": null,
  "maxCodeSmellCount": null,
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
  "maxCriticalFindings": 0,
  "maxVulnerabilities": 3,
  "maxDuplicationPct": 8.0,
  "maxComplexityCount": null,
  "maxCodeSmellCount": null,
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
      "type": "QUALITY_GATE_FAILED",
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

> `type` is a `NotificationType` enum value (e.g. `ANALYSIS_COMPLETED`, `QUALITY_GATE_FAILED`, `SCORE_DROPPED`, `CRITICAL_FINDING`, `MEMBER_ADDED`). The `read` boolean is derived from the schema's `readAt` timestamp (`read = readAt != null`); `PATCH .../read` sets `readAt`.

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
  "deviceName": "iPhone 14 Pro",
  "installationId": "a1b2c3d4-..."
}
```

> `platform` (`ios`/`android`) maps to the `DevicePlatform` enum (`IOS`/`ANDROID`). `installationId` is optional; when supplied it lets the same app installation re-register idempotently (unique in the schema).

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
| 2 | `GET` | `/auth/github/callback` | None | Exchange code, open session, redirect back |
| 2a | `POST` | `/auth/refresh` | Refresh token | Rotate the refresh token, issue a new access token |
| 3 | `GET` | `/auth/me` | Bearer | Get current user |
| 4 | `POST` | `/auth/logout` | Refresh token | Revoke the session family |
| 4a | `DELETE` | `/api/admin/users/:userId/sessions` | Bearer, platform ADMIN | Force-logout every session for a user |
| 5 | `POST` | `/webhooks/github` | HMAC | Receive GitHub events |
| 5a | `GET` | `/api/orgs` | Bearer | List the caller's organizations (tenants) |
| 5b | `POST` | `/api/orgs/sync` | Bearer | Re-sync organizations from GitHub |
| 5c | `GET` | `/api/orgs/:orgId/members` | Bearer (org member) | List organization members |
| 5d | `GET` | `/api/orgs/:orgId/repos` | Bearer (org member) | Repos in this org the caller can open |
| 6 | `GET` | `/api/repos` | Bearer | List repos user can see |
| 7 | `GET` | `/api/repos/available` | Bearer | List unlinkable GitHub repos |
| 8 | `POST` | `/api/repos` | Bearer | Link a repository (caller becomes repo owner) |
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

- **Auth:** Required, `platformRole: ADMIN` only (see §2 Roles & Authorization)
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
| 5 | **No admin-promotion endpoint** | First `ADMIN` must be set directly in the DB; existing admins cannot promote others via the API | Acceptable for MVP (small, trusted team). Add `PATCH /api/users/:userId/role` (admin-only) post-MVP if needed. Lower priority now that `platformRole` no longer grants access to any tenant's data. |
| 6 | **Org membership is only as fresh as the last sync** | A user removed from a GitHub organization keeps access until the next login or `POST /api/orgs/sync` | Accepted for MVP. The window is bounded and closable on demand; closing it fully would mean calling GitHub on every request. Revoking in our own database takes effect immediately. |
| 7 | **One shared `GITHUB_WEBHOOK_SECRET` across all tenants** | Anyone holding that secret can forge webhook events for any linked repository, in any organization | Per-repository secrets stored alongside `Repository.webhookId`. Needs `webhookId` to actually be written first (repo linking is not implemented yet), so it is sequenced after that. |
| 8 | **An access token stays valid for up to 15 minutes after its session is revoked** | Logout, admin force-logout and account deactivation all kill the refresh token immediately, but the access token already in the client's hands is verified by signature alone | Inherent to not touching the database on every request. The window is bounded and short. Closing it fully would mean a session lookup per request, which is the design this replaced |
| 9 | **No rate limiting on `/auth/*`** | `POST /auth/refresh` and `POST /auth/dev-login` are unauthenticated endpoints | Guessing a 256-bit refresh token is infeasible, so this is not urgent. Add `express-rate-limit` per-IP on `/auth/*` when convenient |

> Resolved since the previous revision of this document: the `Device` model gap (now in `database_design.md` §2/§3.8); the missing role/membership model (now `OrgRole` + `RepositoryRole`, §2 above); and **org-level multi-tenancy** — the brief's "multi-tenant system" is now an actual `Organization` entity with enforced isolation, closing `requirements_analysis.md` Q-1 (`database_design.md` §3.12).

---

*This document serves as the API contract. Frontend and mobile teammates can start building against these shapes immediately using mock data. All types should be codified in `packages/shared/src/types/api.ts`. Total endpoint count: 36 (33 REST + 3 observability/admin).*
