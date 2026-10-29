#!/usr/bin/env bash
# Shared helpers for the Fancy Seoul production deploy kit. Source it; do not execute.
#
# Conventions every script follows:
#   * set -euo pipefail, run as root (sudo), idempotent: re-running converges, never duplicates.
#   * --dry-run (or DRY_RUN=1) prints every mutating command instead of running it.
#   * Each step announces itself with `step "..."` before doing anything.
#   * Nothing here stops, restarts, reconfigures or binds the owner's proxy (ss-server) or
#     its public port; the only interaction is a read-only before/after guard check.

set -euo pipefail

KIT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Commands run as other users (git/tar as fancy, pg_dump as postgres) need a readable cwd.
ORIG_PWD="$PWD"
cd /
abs_path() { if [[ "$1" == /* ]]; then printf '%s' "$1"; else printf '%s/%s' "$ORIG_PWD" "$1"; fi; }
# shellcheck source=deploy.conf
. "$KIT_DIR/deploy.conf"
FANCY_LOCAL_CONF="${FANCY_LOCAL_CONF:-/etc/fancy/deploy.local.conf}"
if [[ -f "$FANCY_LOCAL_CONF" ]]; then
  # shellcheck disable=SC1090
  . "$FANCY_LOCAL_CONF"
fi

DRY_RUN="${DRY_RUN:-0}"
ASSUME_YES="${ASSUME_YES:-0}"
# shellcheck disable=SC2034 # used by the scripts that source this file
NODE_BIN="$NODE_DIR/bin/node"
# shellcheck disable=SC2034
PNPM_BIN="$NODE_DIR/bin/pnpm"

if [[ -t 1 ]]; then C_B=$'\033[1m'; C_Y=$'\033[33m'; C_R=$'\033[31m'; C_G=$'\033[32m'; C_0=$'\033[0m'; else C_B=; C_Y=; C_R=; C_G=; C_0=; fi

log()  { printf '%s\n' "$*"; }
step() { printf '\n%s==> %s%s\n' "$C_B" "$*" "$C_0"; }
ok()   { printf '%s  ok%s %s\n' "$C_G" "$C_0" "$*"; }
warn() { printf '%s  warning:%s %s\n' "$C_Y" "$C_0" "$*" >&2; }
die()  { printf '%serror:%s %s\n' "$C_R" "$C_0" "$*" >&2; exit 1; }

# Consume the flags every script understands; leaves the rest in REST_ARGS.
parse_common_flags() {
  REST_ARGS=()
  while (($#)); do
    case "$1" in
      --dry-run) DRY_RUN=1 ;;
      --yes|-y) ASSUME_YES=1 ;;
      *) REST_ARGS+=("$1") ;;
    esac
    shift
  done
  if [[ "$DRY_RUN" == 1 ]]; then log "${C_Y}DRY RUN: commands are printed, nothing is changed.${C_0}"; fi
}

require_root() {
  if [[ "$DRY_RUN" == 1 && $EUID -ne 0 ]]; then warn "not root; dry run continues with read-only checks"; return 0; fi
  [[ $EUID -eq 0 ]] || die "run with sudo"
}

require_ubuntu_2204() {
  local id="" ver=""
  if [[ -r /etc/os-release ]]; then
    id="$(. /etc/os-release && printf '%s' "${ID:-}")"
    ver="$(. /etc/os-release && printf '%s' "${VERSION_ID:-}")"
  fi
  [[ "$id" == ubuntu && "$ver" == 22.04 ]] || die "expected Ubuntu 22.04 (found ${id:-unknown} ${ver:-unknown})"
}

# Print a command in copy-pasteable form, then run it unless this is a dry run.
run() {
  printf '  + %s\n' "$(printf '%q ' "$@")"
  if [[ "$DRY_RUN" == 1 ]]; then return 0; fi
  "$@"
}

# Exit hooks run in reverse order of registration, whatever the exit status.
EXIT_HOOKS=()
add_exit_hook() { EXIT_HOOKS+=("$1"); trap run_exit_hooks EXIT; }
run_exit_hooks() {
  local status=$? i
  for ((i = ${#EXIT_HOOKS[@]} - 1; i >= 0; i--)); do eval "${EXIT_HOOKS[$i]}" || true; done
  exit "$status"
}

confirm() {
  local prompt="$1" answer
  if [[ "$ASSUME_YES" == 1 || "$DRY_RUN" == 1 ]]; then return 0; fi
  [[ -t 0 ]] || die "$prompt (re-run with --yes to confirm non-interactively)"
  read -r -p "$prompt [y/N] " answer
  [[ "$answer" == y || "$answer" == Y ]]
}

# Replace @@NAME@@ placeholders in a template with values from deploy.conf (plus extras
# passed as NAME=value arguments). Fails on any placeholder left unresolved.
render_template() {
  local src="$1"; shift
  local -a pairs=(
    "FANCY_USER=$FANCY_USER" "FANCY_ROOT=$FANCY_ROOT" "FANCY_CURRENT=$FANCY_CURRENT"
    "FANCY_ENV_FILE=$FANCY_ENV_FILE" "FANCY_KIT_DIR=$FANCY_KIT_DIR" "NODE_DIR=$NODE_DIR"
    "API_PORT=$API_PORT" "WEB_PORT=$WEB_PORT" "GATEWAY_PORT=$GATEWAY_PORT" "TUNNEL_METRICS_PORT=$TUNNEL_METRICS_PORT"
    "PUBLIC_HOSTNAME=$PUBLIC_HOSTNAME" "PG_PORT=$PG_PORT" "PG_MAJOR=$PG_MAJOR" "PG_CLUSTER=$PG_CLUSTER"
    "LOG_RETENTION_DAYS=$LOG_RETENTION_DAYS" "FANCY_BACKUPS=$FANCY_BACKUPS" "$@"
  )
  local text pair
  text="$(cat "$src")"
  for pair in "${pairs[@]}"; do
    text="${text//@@${pair%%=*}@@/${pair#*=}}"
  done
  if [[ "$text" == *@@*@@* ]]; then die "unresolved placeholder in $src"; fi
  printf '%s\n' "$text"
}

# install_content DEST MODE OWNER:GROUP  (content on stdin). Shows whether it changes and
# sets INSTALL_CHANGED=1 when it writes, so callers restart a service only when needed.
INSTALL_CHANGED=0
install_content() {
  local dest="$1" mode="$2" owner="$3" tmp
  tmp="$(mktemp)"
  cat >"$tmp"
  if [[ -f "$dest" ]] && cmp -s "$tmp" "$dest"; then
    ok "$dest unchanged"
    if [[ "$DRY_RUN" != 1 ]]; then chmod "$mode" "$dest"; chown "$owner" "$dest"; fi
    rm -f "$tmp"; return 0
  fi
  # shellcheck disable=SC2034 # read by callers
  INSTALL_CHANGED=1
  if [[ "$DRY_RUN" == 1 ]]; then
    log "  would write $dest ($mode $owner):"
    if [[ -f "$dest" ]]; then diff -u "$dest" "$tmp" | sed 's/^/    /' || true; else sed 's/^/    | /' "$tmp"; fi
    rm -f "$tmp"; return 0
  fi
  install -D -m "$mode" -o "${owner%%:*}" -g "${owner##*:}" "$tmp" "$dest"
  rm -f "$tmp"
  ok "wrote $dest"
}

install_template() {
  local src="$1" dest="$2" mode="$3" owner="$4"; shift 4
  render_template "$KIT_DIR/templates/$src" "$@" | install_content "$dest" "$mode" "$owner"
}

# --- Guard for the owner's proxy -------------------------------------------------------
# Read-only: record which ss-server processes exist and whether its port is listening,
# then verify nothing changed at the end of a script. Never signals or reconfigures it.
PROXY_GUARD_BEFORE=""
proxy_snapshot() {
  local pids listening
  pids="$(pgrep -x ss-server | sort | tr '\n' ' ' || true)"
  listening="$(ss -Hltn 'sport = :443' 2>/dev/null | wc -l || true)" # guard:read-only
  printf 'pids=[%s] listeners=%s' "$pids" "$listening"
}
proxy_guard_begin() {
  PROXY_GUARD_BEFORE="$(proxy_snapshot)"
  log "  proxy guard (read-only): $PROXY_GUARD_BEFORE"
  add_exit_hook proxy_guard_end
}
proxy_guard_end() {
  local after
  after="$(proxy_snapshot)"
  if [[ "$after" != "$PROXY_GUARD_BEFORE" ]]; then
    warn "owner's proxy state changed during this run: before $PROXY_GUARD_BEFORE, after $after. This kit never touches it; tell the owner immediately."
  else
    log "  proxy guard unchanged: $after"
  fi
}

# Ports this kit binds must be free, or already held by our own service.
require_port_free_or_ours() {
  local port="$1" expect="$2" line
  line="$(ss -Hltnp "sport = :$port" 2>/dev/null || true)"
  if [[ -z "$line" ]]; then ok "port $port free"; return 0; fi
  if [[ "$line" == *"$expect"* ]]; then ok "port $port already served by $expect"; return 0; fi
  die "port $port is in use by something else: $line"
}

# Run a command as the service user inside a transient systemd unit, with the production
# environment file loaded exactly the way the services load it (values never printed).
run_as_service() {
  local workdir="$1"; shift
  local -a props=(--uid="$FANCY_USER" --gid="$FANCY_USER" --working-directory="$workdir"
    --pipe --wait --collect --quiet -p EnvironmentFile="$FANCY_ENV_FILE"
    -p NoNewPrivileges=yes -p ProtectSystem=strict -p ProtectHome=yes -p PrivateTmp=yes)
  while [[ "${1:-}" == -p || "${1:-}" == -E ]]; do props+=("$1" "$2"); shift 2; done
  run systemd-run "${props[@]}" "$@"
}

# psql as the postgres superuser over the local socket (peer auth), on our cluster port.
pg_super() {
  runuser -u postgres -- psql -X -q -v ON_ERROR_STOP=1 -p "$PG_PORT" "$@"
}

latest_release_dir() {
  find "$FANCY_RELEASES" -mindepth 1 -maxdepth 1 -type d -name '20*' 2>/dev/null | sort | tail -n 1 || true
}

current_release_dir() {
  if [[ -L "$FANCY_CURRENT" ]]; then readlink -f "$FANCY_CURRENT"; fi
}

release_latest_migration() {
  find "$1/packages/db/migrations" -maxdepth 1 -name '[0-9][0-9][0-9][0-9]_*.sql' -printf '%f\n' 2>/dev/null | sort | tail -n 1 | sed 's/\.sql$//' || true
}

db_latest_migration() {
  pg_super -d "$PG_DB" -tA -c "SELECT CASE WHEN to_regclass('public.schema_migrations') IS NULL THEN '' ELSE (SELECT coalesce(max(version),'') FROM schema_migrations) END" 2>/dev/null || true
}

# Serialise release/migrate/switch/rollback/backup so two sessions never interleave.
# A child script (e.g. backup.sh called by migrate.sh) inherits the parent's lock.
acquire_lock() {
  if [[ "${FANCY_LOCK_HELD:-0}" == 1 ]]; then return 0; fi
  if [[ "$DRY_RUN" == 1 && ! -w "$FANCY_STATE" ]]; then return 0; fi
  install -d -m 0755 "$FANCY_STATE"
  exec 9>"$FANCY_STATE/deploy.lock"
  flock -n 9 || die "another deploy step holds $FANCY_STATE/deploy.lock"
  export FANCY_LOCK_HELD=1
}

is_release_dir() {
  [[ -n "$1" && -d "$1" && "$(dirname "$1")" == "$FANCY_RELEASES" && -f "$1/RELEASE" ]]
}

# A release built before the Web page-head server existed has no apps/web/server/serve.ts;
# nginx then serves the plain single-page app (its @spa fallback).
release_has_web_server() { [[ -f "$1/apps/web/server/serve.ts" ]]; }

# The page head written by apps/web/server/serve.ts (og:site_name is not in the built
# index.html, so its presence proves the HTML came from the page-head server).
serves_page_head() { # URL
  curl -fsS --max-time 5 "$1" 2>/dev/null | grep -q 'property="og:site_name"'
}

# Point `current` at a release atomically, restart API + worker + Web page-head server,
# verify. Returns non-zero (without rolling back) when the release does not become healthy.
activate_release() {
  local rel="$1" web=1
  if [[ "$DRY_RUN" != 1 ]] && ! release_has_web_server "$rel"; then web=0; fi
  run ln -sfn "$rel" "$FANCY_CURRENT.tmp"
  run mv -Tf "$FANCY_CURRENT.tmp" "$FANCY_CURRENT"
  run systemctl enable fancy-api fancy-worker
  run systemctl restart fancy-api fancy-worker || { warn "restart failed"; return 1; }
  if [[ "$web" == 1 ]]; then
    run systemctl enable fancy-web
    run systemctl restart fancy-web || { warn "fancy-web restart failed"; return 1; }
  else
    warn "$(basename "$rel") has no Web page-head server: stopping fancy-web, nginx serves the plain app"
    run systemctl disable --now fancy-web || true
  fi
  run systemctl reload nginx || warn "nginx reload failed (it serves the new release anyway via the symlink)"
  if [[ "$DRY_RUN" == 1 ]]; then return 0; fi
  if ! wait_http_ok "http://127.0.0.1:$API_PORT/health/ready" 45; then
    warn "API not ready on 127.0.0.1:$API_PORT"; return 1
  fi
  if [[ "$web" == 1 ]]; then
    if ! wait_http_ok "http://127.0.0.1:$WEB_PORT/" 20; then
      warn "Web page-head server not answering on 127.0.0.1:$WEB_PORT"; return 1
    fi
    if ! serves_page_head "http://127.0.0.1:$GATEWAY_PORT/"; then
      warn "gateway does not serve the home page through the Web page-head server"; return 1
    fi
  elif ! curl -fsS -o /dev/null --max-time 5 "http://127.0.0.1:$GATEWAY_PORT/"; then
    warn "gateway does not serve the Web app"; return 1
  fi
  sleep 3
  if ! systemctl is-active --quiet fancy-worker; then warn "worker is not running"; return 1; fi
  ok "release $(basename "$rel") is live"
}

record_history() { # action release
  if [[ "$DRY_RUN" == 1 ]]; then return 0; fi
  printf '%s %s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" "$(basename "$2")" >>"$FANCY_STATE/history"
}

wait_http_ok() {
  local url="$1" tries="${2:-30}" i
  for ((i = 1; i <= tries; i++)); do
    if curl -fsS -o /dev/null --max-time 3 "$url"; then return 0; fi
    sleep 1
  done
  return 1
}
