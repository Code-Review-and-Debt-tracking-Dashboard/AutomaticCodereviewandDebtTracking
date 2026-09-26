#!/usr/bin/env bash
# Redeploys the prod stack from the current checkout. Pull first, not in
# here, since bash would be running this file while git rewrites it:
#   git pull --ff-only origin main && ./scripts/deploy.sh
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

C="docker compose -f docker-compose.prod.yml"

# one at a time, 2 GB of RAM can't build all three together
$C build api
$C build worker
$C build caddy

# migrate with the new image before swapping containers, so new code never
# starts against an old schema
$C run --rm -T --no-deps -w /app/packages/db api npx prisma migrate deploy

$C up -d
# old images pile up after every rebuild and fill the disk
docker image prune -f
