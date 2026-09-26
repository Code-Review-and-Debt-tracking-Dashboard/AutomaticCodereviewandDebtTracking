#!/usr/bin/env bash
# Pulls main and redeploys the prod stack. CD runs this, it also works by hand.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

git pull --ff-only origin main
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
