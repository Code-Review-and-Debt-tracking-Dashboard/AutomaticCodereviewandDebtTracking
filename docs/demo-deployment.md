# Demo Deployment — AWS (single server)

How we put CodeHealth online for the demo and final evaluation, from a brand-new AWS account to a
working `https://app.<domain>`. Replaces the Railway / Render / Vercel / Supabase / Upstash plan in
`system_architecture.md` §5.

---

## 1. Why AWS, and why only one server

We get **$100 in credits** on a new AWS account, plus up to **$100 more** for doing five onboarding
tasks. That's enough to run the whole thing for the rest of the semester.

The old free-tier plan had real problems for *this* project:

| Problem with the free tiers | Why it hurts us |
|---|---|
| Render free services sleep after ~15 min idle; waking takes longer than 10 s | GitHub gives up on a webhook after 10 s → pushes after idle time get lost (breaks NFR-1) |
| Serverless Redis free tiers cap the number of commands | BullMQ polls Redis constantly, even with no jobs — it eats the quota |
| Free app tiers give ~512 MB RAM | The worker runs ESLint + PyLint on cloned repos; that needs more |
| Railway no longer has a real free tier | Only trial credit |

**Why one EC2 server instead of "proper" AWS (ECS, load balancer, RDS…)?** Cost and time. A load
balancer is ~$16/month, a NAT gateway ~$32/month, Fargate for a 2 GB worker ~$30/month — that burns
$100 in weeks. One server running Docker Compose costs ~$23/month and is easy to explain. The
architecture doc already describes ECS/Kubernetes as the *future* scaling path; we keep it that way.

---

## 2. What we're building

```
        GitHub (webhooks, OAuth)                  Expo mobile app
                  │                                      │
                  ▼                                      ▼
        https://api.<domain>                  https://app.<domain>
                  └─────────────────┬────────────────────┘
                                    │  ports 80/443 only
        ┌───────────── EC2 t3.small · Ubuntu 24.04 · Elastic IP ─────────────┐
        │                         docker compose                              │
        │                                                                     │
        │   caddy ── HTTPS certs (Let's Encrypt), serves web build files      │
        │     │                                                               │
        │     └──► api:4000 ──► postgres:5432 ◄──┐                            │
        │            │                           │                            │
        │            └──► redis:6379 ◄── worker ─┴─► api:4000 (results)       │
        │                                                                     │
        └───────────────────────────────────────────────────────────────────┘
               nightly pg_dump → S3            weekly EBS snapshot
```

- **caddy** — reverse proxy. Gets HTTPS certificates automatically, serves the built React app on
  `app.<domain>`, forwards `api.<domain>` to the API container.
- **api** — Express. Handles web/mobile requests and GitHub webhooks.
- **worker** — BullMQ consumer. Clones repos, runs the analyzers, reports results back to the API
  over the internal Docker network (`http://api:4000`). It still reads Postgres directly for a few
  things (repo lookup before cloning, PR comment/status, bulk repo linking), so it needs
  `DATABASE_URL` too.
- **postgres / redis** — same images we use locally in `docker-compose.yml`. Never exposed to the
  internet.

### Why two subdomains (`app.` and `api.`) and not one

The refresh token cookie is set with `path: '/auth'`. If we served the API under `/api/...` on the
same host, the browser would call `/api/auth/refresh` and never send the cookie. If we put the web
and API on two *unrelated* domains (e.g. `cloudfront.net` + `sslip.io`), Safari blocks the cookie as
third-party. Two subdomains of one domain are **same-site**, so `SameSite=Lax` cookies just work —
no code changes needed.

---

## 3. Cost and credits

Region: **ap-south-1 (Mumbai)** — closest to Sri Lanka and one of the cheaper regions.

| Item | ≈ per month |
|---|---|
| EC2 t3.small (2 vCPU, 2 GB RAM), 24/7 | $16 |
| EBS gp3 disk, 30 GB | $3 |
| Public IPv4 (Elastic IP) | $3.6 |
| S3 backups + snapshots + data transfer | $1–2 |
| **Total** | **≈ $23** |

$100 ≈ 4 months. With the extra $100 from onboarding tasks we're covered until the Free plan ends.
Prices are approximate — check the [AWS Pricing Calculator](https://calculator.aws/) before launch.

**Free plan vs Paid plan** (picked at sign-up):

| | Free plan | Paid plan |
|---|---|---|
| Credits | $100 + up to $100 | same |
| When credits run out | account stops, **card never charged** | normal billing starts |
| How long | 6 months or until credits are gone | credits valid 12 months |

We use the **Free plan**. Check that 6 months from sign-up covers the final evaluation date.

---

## 4. What is the "agent"?

The worker doesn't write analysis results to the database itself. When it finishes an analysis it
sends the results to the API (`POST /jobs/:id/results`, `/start`, `/fail`, `GET /jobs/:id/quality-gate`). The API
needs to know that request really came from *our* worker and not from someone on the internet
posting fake scores.

So the worker gets an ID card — the **agent token**:

1. We make up a long random string → that's `AGENT_TOKEN`, put in the worker's `.env`.
2. The database stores only its **SHA-256 hash** in the `Agent` table (like a password — if the DB
   leaks, the token doesn't).
3. Every worker request sends `Authorization: Bearer <AGENT_TOKEN>`. The `requireAgent` middleware
   hashes it, looks up the row, rejects it if missing or `revokedAt` is set, and updates
   `lastSeenAt`.
4. `orgId = null` means "platform-wide" — this one worker can analyse repos from every org. If it
   were set to one org, jobs from other orgs would 404 and stay `PENDING`.

Locally, `seed.js` creates this row using `dev_agent_token`. **In production we don't run the seed**
(it also adds fake users, orgs and notifications). Instead we insert one row by hand — see Phase 4.

Why this design: it's the "control plane / data plane" split. The worker could later run inside a
customer's own network (self-hosted data plane) and only ever send findings out — never source
code. (It isn't fully there yet: the worker still has a few direct DB reads/writes, listed in §2.)

---

## 5. Blockers to fix before deploying

| # | Issue | Fix |
|---|---|---|
| 1 | No Dockerfiles for `apps/api` or `apps/worker` yet | Phase 1 |
| 2 | `packages/db`, `packages/shared`, `packages/github` have `"main"` pointing at `.ts` files. `node dist/index.js` can't load them (checked — fails with `ERR_MODULE_NOT_FOUND`) | Simplest: run the containers with `tsx src/index.ts` (tsx is already in the repo). Alternative: add a build step to each package. Decide in Phase 1 |
| 3 | Repos linked during development have webhooks pointing at an old ngrok URL | Re-link them after going live |
| 4 | `system_architecture.md` §5 and the CI/CD section, and risk R-06 in `project_plan.md`, still name the old platforms | Update after deploy |

---

## 6. Roadmap

Each step has a **✅ check**. Don't move on until it passes.

### Phase 0 — AWS account and guardrails (~1 h)

1. Sign up at aws.amazon.com → choose **Free plan**.
   ✅ Billing → Credits shows $100.
2. Turn on **MFA for the root user**. Create an IAM Identity Center (or IAM) admin user and use that
   from now on — root stays locked away.
   ✅ You can sign in as the admin user.
3. **AWS Budgets** → cost budget with email alerts at $10, $25, $50.
   ✅ Budget exists (this is also one of the credit tasks).
4. Do the remaining onboarding tasks for the extra credit (launch + terminate an EC2 instance,
   create an RDS DB, deploy a Lambda, a Bedrock prompt in the console, the budget). Delete anything
   they create afterwards. The Bedrock one is only an account task — nothing to do with our
   analysis pipeline, which stays 100 % rule-based.
   ✅ Credits page shows the extra amount.
5. Switch the console region to **Asia Pacific (Mumbai) ap-south-1**.

### Phase 1 — Containerise (on your laptop, ~½ day)

1. `apps/api/Dockerfile` — `node:20-slim`, `npm ci` for the workspace, `prisma generate`, start the API.
   ✅ `docker run` → `curl localhost:4000/health` returns 200.
2. `apps/worker/Dockerfile` — `node:20-slim` + `python3`, `pip install -r requirements.txt`, `git`,
   runs as a **non-root user** (it executes tools against untrusted code). Only JS + Python tools —
   Java/C++ analyzers aren't implemented yet, so no JRE/Cppcheck.
   ✅ Inside the container: `pylint --version`, `bandit --version`, `radon --version` all work.
3. `docker-compose.prod.yml` with `caddy`, `api`, `worker`, `postgres`, `redis`:
   - only caddy publishes ports (80, 443)
   - redis: `--appendonly yes --maxmemory-policy noeviction` (BullMQ requires `noeviction`)
   - postgres + redis + caddy data on named volumes
   - Docker log rotation (`max-size: 10m`, `max-file: 3`) so logs can't fill the disk
4. `.dockerignore` (node_modules, dist, .env, .git).
   ✅ `docker compose -f docker-compose.prod.yml up` locally → one analysis runs end to end.

Sketch of the Caddyfile (final version written in Phase 1):

```
api.<domain> {
    reverse_proxy api:4000
}

app.<domain> {
    root * /srv/web
    try_files {path} /index.html
    file_server
}
```

`try_files ... /index.html` is what makes React Router deep links (e.g. refreshing on
`/repositories/123`) work instead of 404.

### Phase 2 — Domain and production GitHub OAuth App

1. **Domain.** Any cheap domain works — check the GitHub Student Developer Pack for a free one,
   otherwise ~$2–10/year from Namecheap/Porkbun. (Fallback with no domain:
   `app.<ip-with-dashes>.sslip.io` / `api.<ip-with-dashes>.sslip.io` — works with Let's Encrypt,
   but test that the refresh cookie survives before relying on it.)
2. After Phase 3 gives you the Elastic IP: add **A records** `app` → IP and `api` → IP.
   ✅ `dig +short api.<domain>` prints the Elastic IP.
3. GitHub → Settings → Developer settings → **new** OAuth App "CodeHealth (prod)" — keep the dev
   one for localhost.
   - Homepage URL: `https://app.<domain>`
   - Callback URL: `https://api.<domain>/auth/github/callback`
   ✅ Callback matches `GITHUB_OAUTH_CALLBACK_URL` in the prod `.env` exactly.

### Phase 3 — The EC2 server (~2 h)

1. EC2 → Launch instance:
   - AMI **Ubuntu Server 24.04 LTS**, type **t3.small**, 30 GB **gp3**
   - Advanced details → **Credit specification: Standard** (t3 defaults to *Unlimited*, which bills
     extra if CPU stays high for long)
   - IAM instance profile with `AmazonSSMManagedInstanceCore` (lets us open a shell from the browser
     console — no SSH port needed) + S3 write access to the backup bucket (Phase 6) +
     `CloudWatchAgentServerPolicy` for shipping logs (Phase 6b)
2. **Security group:** inbound 80 and 443 from `0.0.0.0/0`. Nothing else. If you want SSH too, 22
   from *your IP only*. **Never** open 5432 or 6379.
   ✅ From your laptop, `nc -zv <ip> 5432` fails.
3. **Elastic IP** → allocate → associate with the instance (so the IP survives stop/start).
4. Connect (EC2 → Connect → Session Manager) and set up:
   ```bash
   sudo apt update && sudo apt -y upgrade
   curl -fsSL https://get.docker.com | sudo sh
   sudo usermod -aG docker ubuntu
   sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
   sudo mkswap /swapfile && sudo swapon /swapfile
   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   sudo apt -y install unattended-upgrades
   ```
   ✅ `docker run hello-world` works; `free -h` shows 2 GB swap.

### Phase 4 — First deploy

1. Clone the repo on the server (read-only **deploy key** on GitHub, or HTTPS since the repo only
   needs pulling).
2. Generate secrets **fresh for production** — never reuse dev ones:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   One each for `JWT_SECRET`, `TOKEN_ENCRYPTION_KEY`, `AGENT_TOKEN`, `GITHUB_WEBHOOK_SECRET`,
   Postgres password, `ADMIN_BASIC_AUTH_PASSWORD`. Put them in `.env` files on the server,
   `chmod 600`. Values in the table in §7.
3. Build the web app with the API URL baked in:
   ```bash
   VITE_API_URL=https://api.<domain> npm run build --workspace apps/web
   ```
   and point caddy's `/srv/web` at `apps/web/dist`.
4. Start everything: `docker compose -f docker-compose.prod.yml up -d --build`
5. Apply migrations (`migrate deploy` only applies existing migrations — never `migrate dev` in prod):
   ```bash
   docker compose -f docker-compose.prod.yml exec -w /app/packages/db api npx prisma migrate deploy
   ```
   ✅ All migrations applied, no pending.
6. Create the production **agent row** (see §4):
   ```bash
   HASH=$(echo -n "$AGENT_TOKEN" | sha256sum | cut -d' ' -f1)
   docker compose -f docker-compose.prod.yml exec postgres psql -U postgres -d code_review_db \
     -c "INSERT INTO \"Agent\" (id, \"tokenHash\") VALUES ('prod-worker', '$HASH');"
   ```
   ✅ Worker logs show no 401s after the first job.
7. End-to-end checks:
   - ✅ `https://api.<domain>/health` → 200, database and Redis OK
   - ✅ `https://app.<domain>` loads, padlock shows a valid certificate
   - ✅ Log in with GitHub → lands back on the dashboard
   - ✅ Link a repo → push a commit → GitHub repo Settings → Webhooks → Recent Deliveries shows
     **2xx in under 10 s**
   - ✅ Snapshot + Health Score appear on the dashboard; PR comment/status posted
   - ✅ `https://api.<domain>/admin/queues` asks for a password
   - ✅ Wait >15 min, click around — still logged in (refresh cookie works)
   - ✅ `POST /auth/dev-login` returns 404 (dev login is off in production)

### Phase 5 — Mobile app

Set `EXPO_PUBLIC_API_URL=https://api.<domain>` in the EAS build profile and rebuild.
✅ Mobile login works and a notification arrives after an analysis finishes.

### Phase 6 — Backups and keeping it alive

1. S3 bucket `codehealth-backups-<something>` with a lifecycle rule: delete after 14 days.
2. Nightly cron on the server:
   ```bash
   docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U postgres code_review_db \
     | gzip | aws s3 cp - s3://codehealth-backups-<something>/db-$(date +%F).sql.gz
   ```
   Uses the instance IAM role — no AWS keys stored on the server.
   ✅ Download one dump and restore it into a scratch database.
3. EC2 → Lifecycle Manager → weekly EBS snapshot, keep 2.
   ✅ A snapshot appears.
4. CloudWatch alarm on `StatusCheckFailed_System` → action **Recover instance**.
   ✅ Alarm shows `OK`.

### Phase 6b — Monitoring and logs (~1–2 h, no code changes)

What we already have in the code:

| Piece | Where | What it tells us |
|---|---|---|
| Pino JSON logs | API + worker | every request error, job failure, clone timeout — with `err.stack` |
| `GET /health` | API | DB + Redis reachable? 200 or 503 |
| Bull Board | `/admin/queues` | waiting / active / failed jobs, failed job error + retry |
| `GET /api/metrics` | API (admin only) | analysis counts, avg score/duration, queue stats, memory |

What we add on AWS, four layers:

**1. Is the site up? — uptime check from outside**
[UptimeRobot](https://uptimerobot.com) free plan → HTTP monitor on `https://api.<domain>/health`
every 5 min, alert by email. It checks from outside AWS, so it also catches expired certificates
and DNS mistakes. (AWS-only alternative: Route 53 health check + CloudWatch alarm, ~$1/mo, but its
alarms must be created in `us-east-1`.)
✅ Stop the api container → alert email within ~10 min → start it → "up" email.

**2. Logs — ship container logs to CloudWatch Logs**
Change the logging block in `docker-compose.prod.yml` from `json-file` to the `awslogs` driver:

```yaml
logging:
  driver: awslogs
  options:
    awslogs-region: ap-south-1
    awslogs-group: /codehealth/prod
    awslogs-create-group: "true"
    tag: "{{.Name}}"
```

- Instance role needs `CloudWatchAgentServerPolicy` (covers creating log streams and sending logs).
- Set the log group retention to **14 days** so storage doesn't grow forever.
- `docker compose logs` still works — Docker keeps a local copy too.
- Logs survive a container being recreated, or the whole server dying.
- Always-free CloudWatch covers 5 GB of logs/month — we'll use a tiny fraction.

Because Pino writes JSON, CloudWatch **Logs Insights** can query the fields directly:

```
fields @timestamp, @logStream, msg, err.message
| filter level >= 50
| sort @timestamp desc
| limit 50
```

(`level` 50 = error, 60 = fatal in Pino.)
✅ Trigger a failing analysis (e.g. link a repo, then delete it on GitHub) → the error shows up in
the query above.

**3. Alerts on errors — metric filter + alarm**
Log group → Metric filters → pattern `{ $.level >= 50 }` → metric `CodeHealth/ErrorCount`.
CloudWatch alarm: `ErrorCount >= 1` in 5 min → SNS topic → email.
✅ Same failing analysis → alarm email.

**4. Server health — CloudWatch EC2 alarms**
Free basic metrics (5-min): CPU, network, status checks. Alarms:
- `StatusCheckFailed_System` → **Recover instance** (already in Phase 6)
- `CPUUtilization > 80 %` for 15 min → email (worker stuck in a loop / too many jobs)

Memory and disk aren't in the basic metrics. Check them with `free -h` / `df -h`, or install the
CloudWatch agent later if we actually hit a problem.
✅ Alarms show `OK` in the console.

**Not doing (and why):**

| Option | Why not |
|---|---|
| Sentry | CloudWatch alarms already catch backend errors. Its real extra value is **browser/mobile crash reports**. That's a new SDK in web + mobile (teammates' apps) and a new third-party service. Revisit after the demo if we want frontend crash reports. |
| Grafana + Prometheus + Loki | 3 more containers on a 2 GB box for ≤10 users. Same reasoning as the architecture doc |
| CloudWatch Synthetics | ~$10/mo for 5-min checks; UptimeRobot does it free |

**Known gap:** the architecture doc describes a worker `GET /worker/health`, but the worker has no
HTTP server. For now: `restart: unless-stopped` restarts it if it crashes, the error alarm catches
failing jobs, and Bull Board shows jobs piling up in *waiting* if it's stuck.

### Phase 7 — Deploying updates

**Default (manual, simplest):** open a Session Manager shell and run

```bash
cd ~/AutomaticCodereviewandDebtTracking
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec -w /app/packages/db api npx prisma migrate deploy
```

**Optional (GitOps, matches the architecture doc):** a GitHub Actions job that runs after CI passes
on `main`, authenticates to AWS with **OIDC** (no long-lived keys in GitHub secrets) and runs the
same commands through `aws ssm send-command`.
✅ Merge to `main` → site updated within a few minutes.

---

## 7. Production environment reference

**API** (`apps/api/.env` on the server)

| Variable | Production value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `4000` |
| `DATABASE_URL` | `postgresql://postgres:<pg-password>@postgres:5432/code_review_db` |
| `REDIS_URL` | `redis://redis:6379` |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | from the **prod** OAuth App |
| `GITHUB_OAUTH_CALLBACK_URL` | `https://api.<domain>/auth/github/callback` |
| `GITHUB_WEBHOOK_URL` | `https://api.<domain>/webhooks/github` |
| `GITHUB_WEBHOOK_SECRET` | new random value |
| `JWT_SECRET` | new random value |
| `TOKEN_ENCRYPTION_KEY` | new 64-hex-char value |
| `WEB_APP_URL` | `https://app.<domain>` |
| `WEB_APP_ORIGINS` | `https://app.<domain>` |
| `COOKIE_SECURE` | `true` |
| `COOKIE_SAMESITE` | `lax` (same-site subdomains) |
| `ENABLE_DEV_LOGIN` | `false` (ignored in production anyway) |
| `ADMIN_BASIC_AUTH_USER` / `_PASSWORD` | **not** admin/admin |

**Worker** (`apps/worker/.env` on the server)

| Variable | Production value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | same as API — worker still reads/writes a few tables directly |
| `REDIS_URL` | `redis://redis:6379` — same as API |
| `API_BASE_URL` | `http://api:4000` — internal Docker network, skips caddy |
| `AGENT_TOKEN` | the raw token whose hash is in the `Agent` table |
| `TOKEN_ENCRYPTION_KEY` | **exact same** value as the API |
| `GITHUB_WEBHOOK_URL` / `GITHUB_WEBHOOK_SECRET` | **exact same** values as the API |
| `WORKER_CONCURRENCY` | `1` day-to-day on t3.small. NFR-11 needs **3** simultaneous analyses — for the timing run and demo day, resize to t3.medium and set `3` |
| `CLONE_TIMEOUT_MS` | `120000` |

`trust proxy` is already set to 1 hop in the API — caddy is exactly one hop, so rate limiting sees
real client IPs.

---

## 8. Things that quietly eat credits — don't create these

| Service | Cost | Why we don't need it |
|---|---|---|
| NAT Gateway | ~$32/mo + data | Our server has a public IP |
| Application Load Balancer | ~$16/mo+ | Caddy does TLS + proxying |
| ECS Fargate / EKS | ~$30/mo+ / $73/mo control plane | One server is enough for ≤10 users |
| ElastiCache | ~$12/mo+ | Redis in Docker is fine; BullMQ also needs hash-tag key prefixes on cluster mode |
| RDS Multi-AZ | 2× RDS price | Demo accepts a single DB (see SPOF table in architecture doc) |
| Unattached Elastic IP / old snapshots / leftover onboarding resources | small but forever | Clean up |

---

## 9. Handy commands

```bash
docker compose -f docker-compose.prod.yml ps                 # what's running
docker compose -f docker-compose.prod.yml logs -f api worker  # live logs
docker compose -f docker-compose.prod.yml restart worker      # restart one service
df -h && free -h                                              # disk and memory
```

If an analysis gets killed mid-run, check `dmesg | grep -i oom` — that means the worker ran out of
memory. Keep concurrency at 1 or move to t3.medium (~$33/mo).

Resizing for demo day: EC2 → Stop → Actions → Instance settings → Change instance type →
t3.medium → Start. The Elastic IP stays attached, and billing is hourly, so a few days on
t3.medium costs about $1/day extra. Size back down afterwards.

---

## 10. After the final evaluation — tear down

Terminate the instance → release the Elastic IP → delete EBS snapshots → empty and delete the S3
bucket → delete the budget. Check Billing → Bills the next day shows nothing still running.

---

## Sources

- [AWS Free Tier: $200 credits and 6-month free plan](https://aws.amazon.com/about-aws/whats-new/2025/07/aws-free-tier-credits-month-free-plan/)
- [AWS docs — Choosing a plan](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier-plans.md)
- [AWS Free Tier in 2026: what changed](https://infratally.com/articles/aws-free-tier-2026/)
