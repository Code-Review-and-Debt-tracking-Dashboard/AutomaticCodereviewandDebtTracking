# Analysis Depth, Repository Access & PR Reporting — Design

> **Date:** 24 August 2026 | **Revised:** 29 August 2026 | **Status:** Proposed, not implemented
> **Supersedes nothing.** This is an addendum to `tool_matrix.md`, `system_architecture.md` and
> `scoring_algorithm.md`. Where it contradicts them, the contradiction is called out explicitly in §8.
>
> **Revision note.** §3 was rewritten following mentor guidance to frame repository access as a
> control plane / data plane separation with a hybrid deployment model, rather than as a list of
> credential options. §4 (webhook registration) was added in response to a follow-up question at the
> same review.

---

## 1. Why this document exists

Three findings came out of the mid-evaluation:

| # | Finding | Fair? |
|---|---|---|
| **F1** | JS/TS analysis is ESLint-only. Developers already run ESLint locally and fix errors before pushing, so the pipeline surfaces nothing they haven't already seen. | Partly — see §2.1 |
| **F2** | The system clones private repositories. Companies will not grant a third party clone access to private source. | Yes, fully |
| **F3** | The PR bot comment should report **metrics** — a compact table showing each metric, its threshold, and which ones failed — not just a score and a findings list. | Yes, and it exposes an unspecified area of the design |
| **F4** | How are webhooks set up? Must repositories be added to the system one at a time? | Registration is already automated, but only per-repository — see §4 |

This document specifies a response to all four. It does **not** commit to building any of it; §7
separates what fits inside the remaining schedule from what is specified and defended but deferred.

---

## 2. Part A — Analysis depth beyond ESLint

### 2.1 What the finding gets right, and what it misses

**The counter-argument, which is worth keeping for the viva:**

- A developer's local ESLint runs *their* config, which they own and can weaken — `eslint-disable`
  comments, rule overrides, or `lint-staged` so that only changed files are ever checked and
  existing code is never re-examined. The worker runs a fixed config across every repository, which
  is the entire purpose of a centralised quality dashboard. This is the same relationship SonarQube
  has to a local linter.
- A linter answers *"is this commit clean?"*. This system answers *"is this codebase getting worse,
  where, and how fast?"*. Those are different questions requiring different inputs.

**Where the finding lands:**

That second argument is only credible if the pipeline actually consumes inputs a local linter cannot
produce. Today it does not. The Health Score claims five categories — vulnerability, complexity,
duplication, code smell, maintainability — and for JS/TS the current tooling covers roughly one and a
half of them:

| Category | Current JS/TS coverage | Honest assessment |
|---|---|---|
| Vulnerability | `eslint-plugin-security` | A small set of pattern rules. Not a SAST engine. No dependency awareness, no taint analysis. |
| Complexity | ESLint `complexity`, `max-depth` | Cyclomatic only, per-function, threshold-based. No aggregate metric. |
| Duplication | jscpd | Genuine coverage. A local linter does not do this. |
| Code smell | ESLint recommended | Genuine coverage, but this is exactly the part developers already run. |
| Maintainability | *none* | `tool_matrix.md` §3 Gap 1 acknowledges this and proposes a hand-derived proxy. |

The gap is real. The response is to add inputs that are **structurally impossible** for a local
linter to produce, not simply more lint rules.

### 2.2 Candidate additions

All candidates are deterministic and rule-based. None introduce an LLM or AI step — the constraint
in `CLAUDE.md` holds throughout, and the Health Score remains reproducible.

| Tool | New signal | Category mapping | Runtime | Notes |
|---|---|---|---|---|
| **eslint-plugin-sonarjs** | Cognitive complexity, identical functions, duplicated branches, collapsible conditionals — bug and smell rules absent from `eslint:recommended` | `COMPLEXITY`, `CODE_SMELL` | none (existing ESLint run) | MIT, by SonarSource. Drops into the flat config already specified in `tool_matrix.md` §4.2. |
| **TODO/FIXME/HACK scan** | Self-admitted technical debt (SATD) — a recognised concept in the maintenance literature | `MAINTAINABILITY` | none | Regex over source files. Near-zero cost, and it is literally the product's subject matter. |
| **Semgrep OSS** | Real AST pattern-matching SAST. Community rulesets span JS/TS, Python, Java and C/C++ | `VULNERABILITY` | Python | LGPL-2.1 engine. Rule licensing varies by ruleset — **verify before adopting**. Vendor rule YAML locally so analysis does not depend on a network fetch and stays reproducible. |
| **Gitleaks** *or* **detect-secrets** | Committed credentials — API keys, tokens, private keys | `VULNERABILITY` (`CRITICAL`) | Go binary / Python | Regex plus entropy. An entire category no linter touches, and the most demonstrable finding available. |
| **OSV-Scanner** | Known CVEs in declared dependencies, read from lockfiles | `VULNERABILITY` | Go binary | Apache-2.0, by Google. Covers npm, pip and Maven from one tool. A local ESLint run will never report a vulnerable transitive dependency. |
| **lizard** | Uniform cyclomatic complexity and NLOC across JS/TS, Java and C/C++ | `COMPLEXITY`, `MAINTAINABILITY` | Python | MIT. Already referenced in `tool_matrix.md` §3 as a mitigation for the C/C++ gap. Would close Gaps 1 and 2 with one tool instead of a hand-derived proxy. |
| **Git churn → hotspots** | Change frequency per file. Combined with complexity this yields genuine hotspot ranking (high complexity × high churn = the files that actually cost money) | feeds hotspot ranking, not a finding category | none | Requires history, therefore structurally impossible for any linter. **Blocked by the current clone strategy — see §2.5.** |

### 2.3 The real work is mapping, not invocation

Invoking a tool and parsing its JSON is the easy half. Every new tool needs a deliberate mapping into
the two enums the scoring engine consumes (`packages/db/prisma/schema.prisma`):

```
Severity        = CRITICAL | HIGH | MEDIUM | LOW | INFO
FindingCategory = VULNERABILITY | COMPLEXITY | DUPLICATION | CODE_SMELL | MAINTAINABILITY
```

Two mapping hazards are worth stating up front, because both silently corrupt the score:

1. **Category weight is 4.0 for `VULNERABILITY`** (`scoring_algorithm.md` §1.2), the highest of the
   five. A secret-scanner or dependency-scanner emitting hundreds of `VULNERABILITY` findings will
   dominate the score and flatten it to zero across every repository, destroying the trend chart —
   which the Cut List ranks as "do not cut". Severity mapping for these tools must be conservative,
   and the diminishing-returns rule (`scoring_algorithm.md` §1.5) must be verified to apply per rule
   ID for them.
2. **Duplication is deliberately not a per-finding category** (`scoring_algorithm.md` §1.6) — it
   enters the score as a
   continuous percentage penalty. Any new tool reporting duplication-like results must not be routed
   through the per-finding path, or duplication gets counted twice.

A short mapping table per tool belongs in the implementation plan, not here.

### 2.4 Runtime prerequisites — an unacknowledged constraint

`docker-compose.yml` currently contains **only Postgres and Redis**. There is no Dockerfile anywhere
in the repository; the worker runs directly on the host. Every tool in the table above that is not an
npm package is therefore a host-level prerequisite until B-24 (Docker image, Week 14) lands:

- Python 3 — Semgrep, detect-secrets, lizard (also Bandit, PyLint and Radon, already scheduled)
- Go binaries — Gitleaks, OSV-Scanner (distributed as static binaries, no toolchain needed)
- JRE — Checkstyle, PMD (already scheduled, and already first on the Cut List)

`tool_matrix.md` §4.1 states installation as `npm install --save-dev …` on the worker, which is only
true for the ESLint family. This should be corrected there regardless of what else is adopted.

### 2.5 Clone strategy blocks hotspot analysis

`apps/worker/src/stages/clone.ts:74` performs:

```
git clone --depth=1 --branch <branch> <url> <path>
```

`--depth=1` fetches exactly one commit, so there is no history to compute churn from. The fix is to
swap the shallow clone for a **blobless** clone:

```
git clone --filter=blob:none --branch <branch> <url> <path>
```

This retains full commit metadata — enough for `git log --numstat` — while still declining to
download historical file contents, so transfer cost stays close to the shallow clone. `cloneRepository`
already returns `commitSha` from a `rev-parse HEAD` and that behaviour is unchanged.

**Risk:** on very large repositories a blobless clone is slower than `--depth=1`, and
`env.cloneTimeoutMs` may need raising. This should be measured before adoption, not assumed.

---

## 3. Part B — Repository access: control plane / data plane

### 3.1 The current model, stated plainly

`apps/worker/src/stages/clone.ts:23-33` resolves a clone credential by reading
`repository.owner.githubCredential.encryptedAccessToken` and decrypting it. That is a **long-lived
GitHub OAuth user token** belonging to whoever linked the repository. It is then embedded into the
clone URL as a password.

The implementation is careful in the ways that matter locally — the token is redacted from error
messages before they reach logs or `AnalysisJob.errorMessage`, and `GIT_TERMINAL_PROMPT=0` prevents
an interactive hang. Those are good properties.

But read through a security reviewer's eyes, the model says:

> *A third-party service holds a credential that can read everything this developer can read, for as
> long as the credential lives, and uses it to pull our source onto their infrastructure.*

That is the objection, and it is correct. The token's scope is the union of the developer's access,
not the repository in question. There is no per-repository grant, no expiry, and revocation requires
the developer to find and revoke the authorisation manually.

Scoping the credential better — a shorter-lived or narrower token — improves this but does not
resolve it. The objection is not really about the token. It is about **where the source code ends
up**. Any design that pulls a customer's private source onto infrastructure the customer does not
control faces the same question, no matter how good the credential hygiene is.

### 3.2 The architecture: control plane / data plane

The resolution is to split the system along the line the source code cares about. This is a standard
distributed-systems pattern — GitLab runners, Datadog agents, Snyk Broker, Databricks and Confluent
all use it — and it maps onto the existing monorepo almost exactly.

| | **Control plane** | **Data plane** |
|---|---|---|
| Code | `apps/api`, `apps/web`, `apps/mobile`, `packages/db` | `apps/worker` |
| Responsibility | Orchestration, identity, storage, presentation | Execution of analysis |
| Contains | Express API, PostgreSQL, dashboard, mobile app, OAuth, webhook receiver, job dispatch, notifications | Clone → analyzers → normalize → score |
| **Sees source code** | **Never** | Yes, ephemerally |
| Persists | Findings metadata, snapshots, users, orgs, quality gates | Nothing |
| Who runs it | Always the SaaS operator | Either party — see §3.3 |

The important observation is that this split is **already latent in the repository**. The monorepo
boundary between `apps/api` and `apps/worker` is exactly the control/data plane boundary; the queue
between them is exactly the dispatch mechanism the pattern calls for. What is missing is not the
separation — it is a defined contract across it (§3.4).

### 3.3 The hybrid deployment model

One control plane, two supported data plane topologies. The customer chooses.

```
  TOPOLOGY A — cloud data plane (default)

    GitHub ──webhook──▶ ┌──────────── operator's infrastructure ────────────┐
                        │  API  ──▶  queue  ──▶  worker  ──▶  PostgreSQL   │
                        │                         (clones)                  │
                        └───────────────────────────────────────────────────┘

  TOPOLOGY B — self-hosted data plane

    GitHub ──webhook──▶ ┌── operator ──┐
                        │  API ──▶ DB  │
                        └──────▲───────┘
                               │  HTTPS, outbound only
                               │  (lease job / post findings)
                        ┌──────┴──────────── customer's network ───────────┐
                        │  worker (clones)  ──▶  GitHub (their own creds)  │
                        └──────────────────────────────────────────────────┘
```

- **Topology A** — zero setup, the demo path, appropriate for public repositories, trials and small
  teams. This is what exists today.
- **Topology B** — the answer to F2. Source is cloned inside the customer's own network and never
  crosses their perimeter. The customer's data plane holds its **own** GitHub credential locally;
  the control plane never sees it, which removes the objection in §3.1 entirely rather than
  mitigating it.

### 3.4 The boundary contract — what may cross

This is the decision that makes the split real rather than cosmetic.

**The problem with the current arrangement.** `apps/worker` imports `@codehealth/db` and writes
through Prisma. Deploying that worker into a customer network would mean the customer's machine
holds the operator's database credentials, and the operator's PostgreSQL accepts connections from
the public internet. That is not a control/data plane split; it is a shared database with a longer
network path, and a security reviewer will say so.

**The contract.** The data plane communicates with the control plane over an authenticated HTTPS
API and nothing else:

| Direction | Call | Carries |
|---|---|---|
| data → control | lease next job | — |
| control → data | job descriptor | repo id, clone URL, branch, commit sha |
| data → control | post results | findings metadata, snapshot metrics, tool versions |
| data → control | report failure | error message, stage |

Properties this buys:

- **Outbound-only from the customer's network.** No inbound firewall rule, no VPN, no exposed port.
  This is why the pattern is deployable in practice.
- **Authenticated per deployment**, with an agent token belonging to the deployment rather than to
  any human user. Revoking one data plane does not disturb anything else.
- **The privacy guarantee becomes structural.** The results endpoint has no field capable of
  carrying source code, so source cannot cross the boundary even by mistake. The existing `Finding`
  model already reflects this — it stores `file`, `line`, `rule`, `message`, `severity`, `category`
  and **no snippet column** (`schema.prisma:223-249`). What was an implementation detail becomes an
  enforced architectural property.
- **Ephemerality is unchanged and still holds.** `createWorkspace()` creates a temp directory via
  `mkdtemp` and `analysisProcessor` removes it in a `finally`, so it is cleaned up on the failure
  path too.

So the system can state, and demonstrate: *source exists only inside the data plane, only in a
temporary directory, only for the lifetime of a single job. The control plane stores finding
metadata and aggregate metrics, and has no mechanism to receive anything else.*

**BullMQ is unaffected as a decision.** The queue remains the orchestration mechanism. For Topology A
the worker connects to Redis exactly as designed. For Topology B the API exposes a lease endpoint in
front of the same queue, acting as a transport shim. The locked architecture decision stands; what is
added is a second transport for remote data planes.

⚠️ **The fiddly part is lease semantics over HTTP.** BullMQ workers hold locks and heartbeat against
Redis directly. Exposing that to a remote data plane means implementing lease → renew → complete/fail
with a visibility timeout, so that a data plane which dies mid-job does not strand the job forever. A
simplified version (fixed visibility timeout, no renew) is sufficient for this project, but it should
be a deliberate simplification rather than an oversight.

### 3.5 What this settles

- **Webhooks are unambiguously a control-plane concern.** They always arrive at the operator's API
  regardless of where the data plane runs. Part C (§4) is therefore fully independent of this choice.
- **Clone credentials live in the data plane.** In Topology B the customer configures their own
  GitHub credential locally. In Topology A the operator's stored credential is used as today.
- **Cloud versus self-hosted is a deployment decision, not two code paths.** If the data plane always
  speaks HTTP to the control plane, the same artifact runs in both topologies. This matters for cost:
  the hybrid model is close to free *provided the contract is adopted from the start*.

### 3.6 Consequences for the build

| Change | Notes |
|---|---|
| B-21 (persistence) becomes an API client, not Prisma writes | **This is the whole cost, and B-21 is not yet built.** Writing it once against the contract is cheap; retrofitting it after Week 13 is not. |
| `@codehealth/db` leaves the worker's dependencies | Touches the ownership boundary with the DB owner — needs agreement before starting. |
| Results-ingest and job-lease endpoints on the API | New, and they need their own auth path distinct from user sessions. |
| Agent identity in the schema | A record per data plane deployment: token hash, org, last-seen. Additive. |
| Shared DTOs for the contract | Belongs in `packages/shared`, alongside the existing `AnalysisJobData`. |

**Estimated marginal cost: 1.5–2 days**, and it *replaces* B-21 rather than adding to it, so the net
addition to the schedule is smaller than the raw figure suggests.

### 3.7 Alternatives considered

**GitHub App with installation tokens.** An organisation admin installs the App and selects
repositories; the operator stores a private key rather than user tokens, and mints installation
tokens that expire after one hour with explicit permissions (`contents: read`,
`pull_requests: write`, `checks: write`, `metadata: read`).

This remains the better answer to one specific problem the hybrid model does **not** solve:
**identity independence**. A GitHub App acts under its own identity and never depends on a particular
human's token remaining valid, whereas every OAuth-based approach breaks when that person leaves or
revokes access. It also removes the per-repository admin requirement discussed in §4.

*Verdict: deferred, not rejected.* It is orthogonal to the control/data plane split and could be
adopted later without disturbing it. Cost is an install/callback flow, installation-to-repository
mapping, and token minting via Octokit's `createAppAuth`.

**CI-side analysis via a GitHub Action.** The customer adds an Action to their own workflow; it runs
the analyzers on their runner and posts results to the API. The operator never clones and needs no
`contents: read`.

This is effectively a third data plane topology — the customer's CI runner *as* the data plane — and
the boundary contract in §3.4 is exactly what it would need. Worth noting as a natural extension:
once the contract exists, an Action is largely a packaging exercise.

*Verdict: specify, do not build.*

---

## 4. Part C — Webhook registration

The evaluation also asked how webhooks are set up, and whether repositories must be added one at a
time.

### 4.1 The current model

Registration is already automated, not manual. `linkRepository`
(`apps/api/src/services/repoLinkService.ts:88`) calls `octokit.rest.repos.createWebhook` when a user
links a repository, using the global `env.githubWebhookSecret`, subscribing to `pull_request`, and
storing the returned id in `Repository.webhookId`. `unlinkRepository` deletes it.

### 4.2 Problems with per-repository registration

1. **It requires GitHub admin on every repository.** `listAvailableRepos` filters the picker to
   `permissions?.admin === true`, and `linkRepository` re-checks it. Most developers in a company are
   not admins on most repositories, so most users cannot onboard anything.
2. **Orphaned webhooks — a live bug.** `unlinkRepository` permits an org OWNER/ADMIN to unlink, then
   calls `githubClientFor(userId)` with *that* person's token. If they lack GitHub admin on the
   repository, or the original linker's token has been revoked, `deleteWebhook` fails, is swallowed
   as a `logger.warn`, and `webhookId` is nulled anyway. GitHub then delivers to the endpoint
   indefinitely with no matching row.
3. **Changing the webhook URL breaks every linked repository.** The URL is baked into each hook at
   creation from `env.githubWebhookUrl`. In development that is a tunnel URL that changes on restart,
   silently disabling every previously linked repository.
4. **`events: ['pull_request']` only.** No `push`, so commits landing directly on the default branch
   produce no analysis and the trend chart only receives datapoints from PR activity — despite the
   Cut List ranking trend charts as "do not cut".

### 4.3 The option ladder

GitHub offers exactly three programmatic registration mechanisms: per-repository hooks
(`POST /repos/{owner}/{repo}/hooks`), organisation hooks (`POST /orgs/{org}/hooks`), and GitHub Apps.
There is no fourth.

| Approach | New repos auto-covered | Needs repo-admin | Write scope on customer's GitHub |
|---|---|---|---|
| Per-repository, one at a time (today) | ❌ | ✅ | ✅ |
| **Bulk + reconciliation** | ✅ | ✅ | ✅ |
| Organisation webhook | ✅ | ❌ (org admin, once) | ✅ (`admin:org_hook`) |
| Manual instructions | ❌ | ✅ | **none** |
| GitHub App | ✅ | ❌ (org admin, once) | scoped, revocable |

### 4.4 Recommended: bulk enable + reconciliation

The most automatic option available without changing the permission model, and purely additive to
code that already exists.

**Flow A — bulk enable, user-initiated:**

```
GET  /orgs/:orgId/available-repos      existing listAvailableRepos
POST /orgs/:orgId/repos/bulk-link      { githubRepoIds: [...] }  → 202 { jobId }
     └─ queued job, per repo: fetchRepo → check admin → createWebhook → upsert Repository
     └─ per-repo status recorded
summary: enabled 47 · already linked 5 · skipped 7 (no admin)
```

The per-repository body is the existing `linkRepository` logic, unchanged. Two decisions matter:

- **It must be queued, not synchronous.** Several hundred sequential `createWebhook` calls will
  exceed any reasonable request timeout. Enqueuing applies the same reasoning already used for the
  webhook handler — the request path never waits on bulk work.
- **Partial failure is the normal outcome**, not an exception. Users will lack admin on some
  repositories. The job records per-repository status and the summary reports what was skipped and
  why; swallowing those failures leaves users believing repositories are enabled when they are not.

**Flow B — reconciliation, scheduled:**

A repeatable job per linked organisation:

```
list org repos from GitHub, diff against Repository rows
  ├─ in GitHub, not in DB        → new repo       → register hook + create row
  ├─ in DB, hook id 404s         → hook deleted   → re-create, update webhookId
  ├─ in DB, hook URL is stale    → URL changed    → PATCH hook config
  └─ archived/deleted on GitHub  → mark isActive = false
```

This supplies the property otherwise only a GitHub App or org webhook provides — **repositories
created later are covered with no human action** — and it repairs all three drift scenarios in §4.2.
GitHub's hook object includes `last_response`, so broken hooks can be detected from a list call
without probing each one individually.

**Auto-enrolment must be an explicit org-level setting, defaulted off.** Silently enrolling every new
repository is surprising behaviour, and "the tool started analysing repositories we never approved"
is the kind of thing that gets a tool removed.

**Two details that will otherwise cause problems:**

- **Idempotency.** GitHub returns 422 when a hook with identical config already exists on a
  repository. This must be treated as success, or reconciliation logs failures nightly for
  repositories that are perfectly healthy.
- **Credential ownership.** Flow A runs under the clicking user's token. Flow B runs unattended and
  needs a stored credential — if that person leaves or revokes access, reconciliation silently stops
  for the whole organisation. Mitigation: record which credential an organisation reconciles with,
  and fall back to any active OWNER/ADMIN member's credential on failure. This dependency on a
  particular human's token is precisely what a GitHub App would remove (§3.7).

### 4.5 Fix regardless of the option chosen

- The orphaned-webhook bug (§4.2 item 2).
- Add `push` to the subscribed events, or record a deliberate decision not to.
- If organisation webhooks are ever adopted, `findLinkedRepository`
  (`apps/api/src/services/webhookService.ts:101-109`) must return `200 ignored` rather than throwing
  404 for unknown repositories — under an org webhook that is the normal case, and GitHub treats 404
  as a failed delivery and retries it.

---

## 5. Part D — PR comment metrics table

### 5.1 The gap F3 identified

The PR comment body is **not specified anywhere**. `project_breakdown.md` says "include Health Score
+ Debt summary" and `system_architecture.md` refers to `[F] POST PR comment`. No layout, no field
list, no worked example exists. B-18 ("PR comment builder", Week 12) would otherwise have been
improvised.

### 5.2 The data already exists

The table F3 asks for is a join of two models that are already designed:

| Source | Provides |
|---|---|
| `QualityGate` | `minHealthScore`, `maxCriticalFindings`, `maxVulnerabilities`, `maxDuplicationPct`, `maxComplexityCount`, `maxCodeSmellCount`, `blockPR` |
| `HealthSnapshot` | `healthScore`, `criticalCount`, `vulnerabilityCount`, `duplicationPct`, `complexityCount`, `codeSmellCount`, `debtMinutes`, `debtDeltaMinutes`, `gateResult` |

Every threshold has a matching measurement. No new computation is required — this is a rendering
task over values the scoring stage already produces.

### 5.3 Proposed comment

```markdown
## CodeHealth — Health Score 72.4 ▼ 4.1

**Quality gate: FAILED** — 3 of 6 metrics breached.

| Metric            | Value        | Threshold |    |
|-------------------|--------------|-----------|----|
| Critical findings | 2            | ≤ 0       | ❌ |
| Vulnerabilities   | 5            | ≤ 3       | ❌ |
| Duplication       | 8.1%         | ≤ 5%      | ❌ |
| Health Score      | 72.4         | ≥ 60      | ✅ |
| Complexity issues | 12           | ≤ 20      | ✅ |
| Code smells       | 47           | ≤ 50      | ✅ |
| Technical debt    | 6h 20m       | +45m      | ⚠️ |

<details><summary>12 new findings, 3 resolved</summary>

… findings grouped by file …

</details>
```

Visible height is about 15 lines, matching the "10–20 line" expectation in F3.

### 5.4 Rendering rules

These are the decisions that make the table useful rather than decorative:

1. **Failing rows sort above passing rows.** The reason the gate failed should be the first thing
   read, not something located by scanning a fixed-order list.
2. **Rows with no configured threshold are omitted.** Every `max*` field on `QualityGate` is
   nullable; only `minHealthScore` has a default. Rendering `Complexity: 12 / no limit` is noise
   that pushes real failures further down.
3. **Deltas are shown against the previous snapshot.** `debtDeltaMinutes` is already computed and
   stored. The health-score delta requires one extra query for the previous `HealthSnapshot` for the
   repository — the index `@@index([repoId, calculatedAt(sort: Desc)])` already supports it.
4. **Technical debt has no threshold** and is reported as a trend indicator only — `⚠️` when debt
   increased, `✅` when it decreased or held. It never contributes to gate pass/fail, because
   `QualityGate` has no debt field and inventing one would diverge from `database_design.md`.
5. **Findings detail is collapsed** in a `<details>` block so the comment stays readable when a
   repository has hundreds of findings.
6. **The gate verdict line restates `gateResult`** rather than recomputing it, so the comment can
   never disagree with the value stored on the snapshot or shown on the dashboard.

### 5.5 One comment per PR, updated in place

A new comment on every push turns the bot into noise and gets it muted. The comment should be
created once per pull request and updated (`PATCH /repos/{owner}/{repo}/issues/comments/{id}`) on
each subsequent analysis.

**This requires a schema change.** `PullRequest` (`schema.prisma:141-164`) has no column for the
bot's comment ID:

```prisma
model PullRequest {
  // …
  botCommentId String?   // GitHub comment id, set on first post
}
```

Additive and nullable, so it carries no migration risk of the kind R-08 in `project_plan.md`
describes. Per `CLAUDE.md` this goes through `prisma migrate dev`, and the schema is co-owned, so it
needs agreement from the DB owner before it lands.

**Fallback:** if the migration is not acceptable, the poster can list PR comments and match on a
known marker string in the body. That costs an extra API call per analysis and is more fragile. The
column is preferable.

⚠️ **Cross-plane note.** Posting the comment is a GitHub write, which in Topology B would come from
inside the customer's network. Either the data plane posts it directly using its own credential, or
it returns the rendered body to the control plane to post. The former keeps all GitHub writes on the
customer's side and is more consistent with §3.4; the latter keeps `botCommentId` handling in one
place. **This is unresolved — see §9.**

---

## 6. What this changes about the answer to the evaluation

The findings share one honest framing:

> ESLint is one input among several, not the analysis engine. The engine's distinguishing inputs are
> the ones a developer cannot run locally against a single commit — dependency CVEs, committed
> secrets, cross-file duplication, and change-history hotspots — and its output is a trend, not a
> pass/fail. The system separates a control plane from a data plane, so a customer who will not let
> source leave their network runs the data plane themselves; the control plane has no mechanism to
> receive source code. Webhooks are registered in bulk and reconciled on a schedule, not one at a
> time. The PR comment reports which metric breached which threshold, so the verdict is explainable
> rather than asserted.

Each clause is backed by a section above. None of it requires an AI-based review step, and the Health
Score stays reproducible.

---

## 7. Scope and sequencing

**Schedule reality.** `project_plan.md` places the feature freeze at end of Week 12 (**13 September
2026**), with Weeks 13–15 reserved for testing, documentation and the final report. As of 24 August
the worker has B-01 (scaffold), B-02 (clone) and B-03 (detect) complete;
`apps/worker/src/processors/analysisProcessor.ts:46` still reads
`// remaining analysis stages go here`. Everything from B-04 (first analyzer wrapper) through B-21
(persistence) — including scoring, gate evaluation and the PR comment itself — is unbuilt.

The critical path is the existing plan. Nothing in this document should displace it.

| Item | Effort | Recommendation |
|---|---|---|
| `eslint-plugin-sonarjs` in the ESLint config | ~1h, rides along with B-04 | **Build** |
| TODO/FIXME/HACK scan | ~1h | **Build** |
| PR comment metrics table (§5) | Inside B-18, already scheduled | **Build** |
| `botCommentId` migration | ~30m + DB owner agreement | **Build** |
| **Boundary contract + B-21 as API client (§3.4, §3.6)** | 1.5–2 days, replaces B-21 | **Build — and decide before B-21 starts** |
| Orphaned-webhook fix + `push` events (§4.5) | ~2h | **Build** |
| Non-retention guarantee documented (§3.4) | Documentation | **Build** |
| Self-hosted data plane deployment docs (§3.3) | Documentation + compose file | **Build if time** |
| Bulk enable (§4.4 Flow A) | ~1 day | **Build if time** |
| Reconciliation job (§4.4 Flow B) | ~1 day | **Defer** — Flow A delivers most of the value |
| Blobless clone + churn hotspots | Clone change is small; hotspot ranking is not | **Defer** — Cut List ranks hotspots 5th to cut |
| Secret scanning | New tool, new runtime, mapping work | **Defer** — highest-value deferred analysis item |
| OSV-Scanner | New tool, new runtime, mapping work | **Defer** |
| Semgrep | New tool, new runtime, substantial mapping work | **Defer** |
| lizard | New tool, new runtime | **Defer** |
| GitHub App (§3.7) | Install flow, schema, token minting | **Defer** — orthogonal to the plane split, adoptable later |
| Organisation webhook (§4.3) | Moderate; needs `admin:org_hook` | **Defer** |
| CI-side Action (§3.7) | A third data plane topology | **Do not build** |

**The one item worth disrupting the plan for is the boundary contract**, because it is the only entry
whose cost rises sharply with delay. Every other deferred item can be added later at roughly the same
price. B-21 written against Prisma and then converted is strictly more work than writing it against
the contract once.

Everything under "Defer" is specified well enough to defend as designed-and-reasoned rather than
overlooked — which is what the evaluation findings actually require.

---

## 8. Conflicts with locked decisions

`CLAUDE.md` fixes several decisions that this document proposes changing. Flagging rather than
assuming, as required:

| Locked decision | Proposed change | Section |
|---|---|---|
| Analysis engine tool list is fixed at ESLint, eslint-plugin-security, Bandit, PyLint, Radon, Checkstyle, PMD, Cppcheck, jscpd | Adds `eslint-plugin-sonarjs`; potentially Semgrep, a secret scanner, OSV-Scanner, lizard | §2.2 |
| `tool_matrix.md` presents the matrix as validated and final, and its §4.1 states worker tooling is npm-only | Tool set expands; §4.1 is already inaccurate for the Python and Java tools | §2.2, §2.4 |
| Worker writes to PostgreSQL via Prisma (`packages/db` is a worker dependency) | Worker becomes an API client; `@codehealth/db` leaves its dependency list | §3.4, §3.6 |
| Repository access via a stored OAuth user token | Data plane holds its own credential in Topology B; GitHub App deferred but not rejected | §3.3, §3.7 |
| `--depth=1` shallow clone | `--filter=blob:none` blobless clone | §2.5 |
| Schema is co-owned with the DB owner | Adds `PullRequest.botCommentId` and a data plane agent record | §3.6, §5.5 |

**BullMQ + Redis is not being changed.** The queue remains the dispatch mechanism in both topologies;
§3.4 adds an HTTP transport in front of it for remote data planes rather than replacing it.

No change here touches the prohibition on LLM/AI-based review steps, the deterministic scoring
requirement, GitHub-only VCS integration, or any out-of-scope item.

---

## 9. Assumptions and open questions

1. **Interpretation of F3.** This document reads the feedback as *a compact per-metric table in the
   PR comment showing measured value against threshold and which metrics failed*. If the intent was
   **per-file** metrics, or metrics computed over **the pull request diff only** rather than the
   whole repository, §5 changes substantially — diff-scoped metrics in particular would require a
   second scoring path and are not costed here. **This needs confirmation before B-18 is built.**
2. **Who posts the PR comment in Topology B** is unresolved (§5.5). The choice affects whether the
   data plane needs `pull_requests: write` on its local credential.
3. **Lease semantics over HTTP** (§3.4) are specified only in outline. Visibility timeout duration
   and whether renew is supported need deciding before implementation.
4. **Semgrep rule licensing** is mixed across rulesets and must be verified against §6 of
   `tool_matrix.md` before adoption.
5. **Blobless clone performance** on large repositories is assumed comparable to shallow clone. This
   is unmeasured.
6. **Severity mapping** for secret and dependency scanners is unresolved and is the main risk to
   score stability if those tools are adopted (§2.3).
7. Tool versions are deliberately not pinned here. `tool_matrix.md` pins versions as of June 2026;
   anything adopted should be re-verified at implementation time rather than trusted from this
   document.
