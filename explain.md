# A-09 — BullMQ queue setup

## What this session did

Built the bridge between the API and the (not yet written) worker. Before this, the webhook handler
parsed a PR event, checked the repo was linked, and then just... stopped and returned `202 Received`.
Nothing was handed off anywhere. Now there's a real Redis connection, a real queue, and one function
that puts a job on it.

Four files, three layers:

| File | What it is |
|---|---|
| `packages/shared/src/queue.ts` | Queue name + job payload type — the API↔worker contract |
| `apps/api/src/lib/redis.ts` | The Redis connection (one per process) |
| `apps/api/src/lib/queue.ts` | The `analysis-queue` definition + retry policy |
| `apps/api/src/services/queueService.ts` | `enqueueAnalysisJob()` — creates the DB row, enqueues, links them |

Plus: `REDIS_URL` in env config, and `/health` now reports `redis: true/false` alongside `database`.

## Why it's split into three layers

Could have been one file. Kept separate because each has a different reason to change:

- **`lib/redis.ts`** is infrastructure, sits next to `logger.ts` and `jwt.ts`. A-34 (token denylist)
  and A-35 (OAuth nonce) both need a Redis client and will import *this*, not the queue.
- **`lib/queue.ts`** is just the queue object + its options.
- **`services/queueService.ts`** is the business logic. Sits in `services/` with the other
  `*Service.ts` files, and matches the `QueueService` the architecture doc already named.

**`packages/shared` got scaffolded** (it was an empty `.gitkeep`) because the queue name and payload
shape are by definition shared between two apps. If the worker redeclared them, they'd drift and the
bug would be silent — worker deserialising a payload the API stopped sending.

## Scope call: A-09 vs A-10

Both tasks literally say "job dispatch" in their titles. Decision: **A-09 ships the callable
function, A-10 wires it into the webhook route.** `webhooks.ts` is untouched.

Reason: A-10 (webhook) *and* A-18 (manual trigger) both need to enqueue. If A-09 had wired the route
directly, A-18 would duplicate the row-creation logic. One function, two callers.

`enqueueAnalysisJob()` returns `{ analysisId, jobId }` because that's what both callers need —
webhook returns just `jobId`, manual trigger returns both.

## The interesting bug (good viva material)

The plan said "if Redis is down, enqueue fails fast and we mark the row FAILED." Wrote it that way,
then actually tested it with Redis stopped. **It didn't work.** `queue.add()` never threw — it hung
forever, so the catch block never ran and the row sat at `PENDING`.

Cause: BullMQ waits for the connection to be *ready* before running a command. With Redis down,
"ready" never happens.

Why it matters: GitHub needs a webhook answered in ~10s or it marks the delivery failed. And a
permanently-`PENDING` row is exactly the state A-18's "429 analysis already in progress" guard reads
— so one Redis blip would have wedged that repo forever. Two silent failures stacked.

Fix was two options, measured each time:

| | time to fail | row ends up |
|---|---|---|
| original | never (hung) | stuck `PENDING` ❌ |
| `+ skipWaitingForReady: true` | 13s — still over budget | `FAILED` ✓ |
| `+ maxRetriesPerRequest: 3` | **2s** | `FAILED` ✓ |

Takeaway: the happy path passed on the first try. Only deliberately breaking the dependency exposed
it. Worth remembering that "I wrote error handling" and "the error handling runs" are different
claims.

## Decisions where the docs were wrong or silent

1. **Added `branch` to the job payload.** Docs say `{ analysisId, repoId, prNumber, commitSha,
   cloneUrl }` — but `AnalysisJob.branch` is a non-null column and the worker's clone step runs
   `git clone --branch=<x>`. The documented payload literally cannot do the job.
2. **`prNumber` is nullable** — manual whole-repo analyses aren't tied to a PR.
3. **`attempts: 3`.** Docs say "retried up to 3 times" twice and "3 attempts" once. In BullMQ
   `attempts: 3` = 1 try + 2 retries. Went with the literal reading.
4. **Pinned BullMQ v5.** npm wanted to install v6 (and ioredis v6). The locked version is v5, so
   pinned back rather than silently taking a major bump. Open question whether to move up later.
5. **`REDIS_URL` is defaulted, not required.** Everything else critical uses fail-fast `required()`,
   but defaulting to `redis://localhost:6379` means a fresh checkout boots without extra setup, and
   `/health` tells the truth if it's wrong.
6. **No `maxRetriesPerRequest: null`.** BullMQ *Workers* need that for blocking connections — the
   worker is a separate process and will set it itself. On the producer side we want the opposite.

## How to test it

```bash
docker compose up -d          # postgres + redis
npm run dev --workspace apps/api
curl -s localhost:4000/health | jq
# → 200, checks: { database: true, redis: true }

docker compose stop redis
curl -s localhost:4000/health | jq
# → 503, redis: false — and the API process must NOT die
docker compose start redis
```

That last bit is a real check, not a formality: ioredis emits an `error` event on every failed
reconnect, and Node kills the process on an unhandled `error` event. Hence the listener in
`lib/redis.ts`.

For dispatch itself there's no automated test — see below. Manual check was a throwaway `tsx` script
calling `enqueueAnalysisJob()` with a seeded repo id, then confirming:
`redis-cli LLEN bull:analysis-queue:wait` → 1, and the `AnalysisJob` row is `PENDING` with
`bullJobId` matching the returned `jobId`.

## Two things left open

- **No test framework exists in this repo at all** — no vitest/jest, CI runs typecheck only. So
  everything above was verified by hand. Standing one up is a bigger decision than this task should
  make alone, but it should probably become its own task soon.
- The existing comment in `webhooks.ts` references a doc filename and a task id, which our comment
  convention forbids. Left it alone since it's outside this task's diff — whoever picks up A-10 will
  be rewriting those lines anyway.

## What this unblocks

A-10 (webhook dispatch), A-18 (manual trigger), A-30 (Bull Board), B-01 (worker scaffold) — all four
listed A-09 as a dependency. B-01 is the critical path one.
