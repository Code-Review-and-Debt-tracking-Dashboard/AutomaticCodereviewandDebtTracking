#!/usr/bin/env bash
# starts/stops the local stack (postgres, redis, api, worker, web, ngrok)
#   ./scripts/dev.sh start     containers + all services
#   ./scripts/dev.sh stop      services (containers stay up, data is kept)
#   ./scripts/dev.sh stop --all    services and containers
#   ./scripts/dev.sh status    what is running
#   ./scripts/dev.sh logs api  tail one service log
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT/.dev"
LOG_DIR="$RUN_DIR/logs"
mkdir -p "$LOG_DIR"

API_PORT=4000
WEB_PORT=5173
# taken from GITHUB_WEBHOOK_URL in apps/api/.env
NGROK_DOMAIN="$(sed -n 's|^GITHUB_WEBHOOK_URL=https://\([^/]*\)/.*|\1|p' "$ROOT/apps/api/.env" 2>/dev/null)"

SERVICES="api worker web ngrok"

c_ok()   { printf '\033[32m%s\033[0m\n' "$1"; }
c_warn() { printf '\033[33m%s\033[0m\n' "$1"; }
c_err()  { printf '\033[31m%s\033[0m\n' "$1"; }

pidfile() { echo "$RUN_DIR/$1.pid"; }

is_running() {
  local pf; pf="$(pidfile "$1")"
  [ -f "$pf" ] || return 1
  local pid; pid="$(cat "$pf" 2>/dev/null)"
  [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null
}

# setsid gives each service its own process group so stop can kill it
spawn() {
  local name="$1" dir="$2"; shift 2
  if is_running "$name"; then
    c_warn "  $name already running (pid $(cat "$(pidfile "$name")"))"
    return 0
  fi
  local pf; pf="$(pidfile "$name")"
  # shellcheck disable=SC2016  # $$ and $@ must expand in the inner shell, not here
  ( cd "$dir" && setsid nohup bash -c 'echo $$ > "$1"; shift; exec "$@"' _ "$pf" "$@" \
      > "$LOG_DIR/$name.log" 2>&1 < /dev/null & )
  sleep 2
  if is_running "$name"; then
    c_ok "  $name started (pid $(cat "$(pidfile "$name")"))"
  else
    c_err "  $name failed to start — see $LOG_DIR/$name.log"
  fi
}

# kills the whole group since tsx and vite fork children
stop_one() {
  local name="$1" pf; pf="$(pidfile "$name")"
  if ! is_running "$name"; then
    rm -f "$pf"
    return 0
  fi

  local pid pgid own
  pid="$(cat "$pf")"
  pgid="$(ps -o pgid= -p "$pid" 2>/dev/null | tr -d ' ')"
  own="$(ps -o pgid= -p $$ 2>/dev/null | tr -d ' ')"

  if [ -n "$pgid" ] && [ "$pgid" != "$own" ]; then
    kill -TERM "-$pgid" 2>/dev/null
  else
    kill -TERM "$pid" 2>/dev/null
  fi

  for _ in 1 2 3 4 5; do
    kill -0 "$pid" 2>/dev/null || break
    sleep 1
  done

  if kill -0 "$pid" 2>/dev/null; then
    if [ -n "$pgid" ] && [ "$pgid" != "$own" ]; then
      kill -KILL "-$pgid" 2>/dev/null
    else
      kill -KILL "$pid" 2>/dev/null
    fi
  fi

  rm -f "$pf"
  c_ok "  $name stopped"
}

wait_for_http() {
  local url="$1" name="$2" tries=${3:-40}
  for _ in $(seq 1 "$tries"); do
    curl -sf -m 3 -o /dev/null "$url" && { c_ok "  $name is responding"; return 0; }
    sleep 1
  done
  c_err "  $name did not respond at $url"
  return 1
}

cmd_start() {
  echo "Starting containers…"
  if docker compose -f "$ROOT/docker-compose.yml" up -d >/dev/null 2>&1; then
    c_ok "  postgres + redis up"
  else
    c_err "  docker compose failed"
  fi

  # wait for postgres
  for _ in $(seq 1 30); do
    docker exec codepulse-db pg_isready -U postgres >/dev/null 2>&1 && break
    sleep 1
  done

  echo "Starting services…"
  spawn api    "$ROOT/apps/api"    npm run dev
  spawn worker "$ROOT/apps/worker" npm run dev
  spawn web    "$ROOT/apps/web"    npm run dev

  if [ -n "$NGROK_DOMAIN" ]; then
    spawn ngrok "$ROOT" ngrok http "$API_PORT" --url="$NGROK_DOMAIN" --log=stdout
  else
    c_warn "  ngrok skipped — could not read GITHUB_WEBHOOK_URL from apps/api/.env"
  fi

  echo "Waiting for the API…"
  wait_for_http "http://localhost:$API_PORT/health" "API"

  echo
  cmd_status
}

cmd_stop() {
  echo "Stopping services…"
  for s in $SERVICES; do stop_one "$s"; done

  if [ "${1:-}" = "--all" ]; then
    echo "Stopping containers…"
    if docker compose -f "$ROOT/docker-compose.yml" stop >/dev/null 2>&1; then
      c_ok "  postgres + redis stopped (data kept in volumes)"
    else
      c_err "  docker compose stop failed"
    fi
  else
    c_warn "  containers left running — use 'stop --all' to stop them too"
  fi
}

cmd_status() {
  echo "Containers:"
  docker ps --filter name=codepulse --format '  {{.Names}}  {{.Status}}' 2>/dev/null | grep . \
    || c_warn "  none running"

  echo "Services:"
  for s in $SERVICES; do
    if is_running "$s"; then
      c_ok "  $s  running (pid $(cat "$(pidfile "$s")"))"
    else
      c_warn "  $s  stopped"
    fi
  done

  echo "Endpoints:"
  printf '  api   http://localhost:%s/health  -> %s\n' "$API_PORT" \
    "$(curl -s -m 3 -o /dev/null -w '%{http_code}' "http://localhost:$API_PORT/health")"
  printf '  web   http://localhost:%s          -> %s\n' "$WEB_PORT" \
    "$(curl -s -m 3 -o /dev/null -w '%{http_code}' "http://localhost:$WEB_PORT")"
  if [ -n "$NGROK_DOMAIN" ]; then
    printf '  ngrok https://%s/health -> %s\n' "$NGROK_DOMAIN" \
      "$(curl -s -m 10 -o /dev/null -w '%{http_code}' "https://$NGROK_DOMAIN/health")"
  fi
  echo "  (000 means nothing answered)"
}

cmd_logs() {
  local name="${1:-}"
  if [ -z "$name" ] || [ ! -f "$LOG_DIR/$name.log" ]; then
    echo "usage: $0 logs <$(echo "$SERVICES" | tr ' ' '|')>"
    return 1
  fi
  tail -f "$LOG_DIR/$name.log"
}

case "${1:-}" in
  start)   cmd_start ;;
  stop)    shift; cmd_stop "${1:-}" ;;
  restart) cmd_stop; echo; cmd_start ;;
  status)  cmd_status ;;
  logs)    shift; cmd_logs "${1:-}" ;;
  *)
    echo "usage: $0 {start|stop [--all]|restart|status|logs <service>}"
    exit 1
    ;;
esac
