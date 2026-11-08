#!/usr/bin/env bash
# Read-only health check of Fancy production. Exit status 1 when any check FAILs.
#
#   sudo healthcheck.sh [--public] [--quiet]
#
# --public additionally checks https://fancyabite.uk through Cloudflare (from the server).
# --quiet prints only warnings and failures (used by fancy-healthcheck.timer).
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
parse_common_flags "$@"
set -- "${REST_ARGS[@]}"
PUBLIC=0; QUIET=0
while (($#)); do
  case "$1" in
    --public) PUBLIC=1 ;;
    --quiet) QUIET=1 ;;
    *) die "unknown argument: $1" ;;
  esac
  shift
done
FAILS=0
section() { if [[ "$QUIET" != 1 ]]; then step "$*"; fi; }
pass() { if [[ "$QUIET" != 1 ]]; then printf '  PASS %s\n' "$*"; fi; }
fail() { printf '  FAIL %s\n' "$*"; FAILS=$((FAILS + 1)); }
note() { printf '  WARN %s\n' "$*"; }
http_code() { curl -s -o /dev/null -w '%{http_code}' --max-time 8 "$1" || true; }
# expect LABEL COMMAND...: PASS when the command succeeds, FAIL otherwise.
expect() { local label="$1"; shift; if "$@"; then pass "$label"; else fail "$label"; fi; }
# advise LABEL COMMAND...: PASS or WARN (does not fail the check).
advise() { local label="$1"; shift; if "$@"; then pass "$label"; else note "$label"; fi; }
code_is() { [[ "$(http_code "$2")" == "$1" ]]; }
robots_ok() { curl -fsS --max-time 8 "$1" 2>/dev/null | grep -q '^Sitemap:'; }
reaches_api() { # URL: an unknown /v1 path must come back as the API's own 404 with a request id
  local headers
  headers="$(curl -s -D - -o /dev/null --max-time 8 "$1" || true)"
  grep -qi '^x-request-id:' <<<"$headers" && grep -q '^HTTP/[0-9.]* 404' <<<"$headers"
}

section "Services"
for unit in "postgresql@$PG_MAJOR-$PG_CLUSTER" nginx fancy-api fancy-worker fancy-web fancy-tunnel; do
  expect "$unit active" systemctl is-active --quiet "$unit"
done

section "API and gateway (loopback)"
local_gw="http://127.0.0.1:$GATEWAY_PORT"
expect "API /health/live" code_is 200 "http://127.0.0.1:$API_PORT/health/live"
expect "API /health/ready (schema current, recovery gate open)" code_is 200 "http://127.0.0.1:$API_PORT/health/ready"
expect "gateway serves the Web app" code_is 200 "$local_gw/"
expect "Web page-head server on 127.0.0.1:$WEB_PORT writes the page head" serves_page_head "http://127.0.0.1:$WEB_PORT/"
expect "gateway sends HTML navigations to the Web page-head server" serves_page_head "$local_gw/discover"
expect "gateway /robots.txt (from the Web page-head server)" robots_ok "$local_gw/robots.txt"
for path in /privacy /terms /guidelines /support /admin/; do
  expect "gateway $path" code_is 200 "$local_gw$path"
done
expect "gateway /v1 reaches the API" reaches_api "$local_gw/v1/__healthcheck"
expect "gateway /healthz" code_is 200 "$local_gw/healthz"

section "Tunnel"
expect "cloudflared connected to Cloudflare" code_is 200 "http://127.0.0.1:$TUNNEL_METRICS_PORT/ready"

section "Configuration, backups, resources"
if [[ -f "$FANCY_ENV_FILE" ]]; then
  expect "env file is 0600 root" test "$(stat -c '%a %U' "$FANCY_ENV_FILE")" = "600 root"
  expect "PORT is set by systemd, not the env file" bash -c "! grep -q '^PORT=' '$FANCY_ENV_FILE'"
else
  fail "$FANCY_ENV_FILE missing"
fi
if systemctl is-enabled --quiet fancy-backup.timer 2>/dev/null; then
  expect "backup newer than 26 h" test -n "$(find "$FANCY_BACKUPS/db" -maxdepth 1 -name 'fancy-*.dump.age' -mmin -1560 2>/dev/null | head -n1)"
else
  note "backup timer not enabled yet"
fi
use="$(df --output=pcent / | tail -n1 | tr -dc 0-9)"
expect "disk ${use}% used (limit 85%)" test "$use" -lt 85
availmb="$(awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo)"
advise "memory available ${availmb} MB" test "$availmb" -gt 300
if [[ -L "$FANCY_CURRENT" ]]; then pass "current -> $(basename "$(readlink -f "$FANCY_CURRENT")")"; fi

section "Owner's proxy (read-only observation, never modified)"
advise "ss-server running (not managed by this kit)" bash -c 'pgrep -x ss-server >/dev/null'
advise "port 443 still held by the owner's proxy" bash -c "ss -Hltn 'sport = :443' | grep -q ." # guard:read-only

if [[ "$PUBLIC" == 1 ]]; then
  section "Public (https://$PUBLIC_HOSTNAME via Cloudflare)"
  base="https://$PUBLIC_HOSTNAME"
  expect "$base/" code_is 200 "$base/"
  expect "$base/ carries the server-written page head (link previews)" serves_page_head "$base/"
  expect "$base/healthz" code_is 200 "$base/healthz"
  for path in /privacy /terms /guidelines /support /admin/; do
    expect "$base$path" code_is 200 "$base$path"
  done
  expect "$base/v1 reaches the API" reaches_api "$base/v1/__healthcheck"
  advise "www.$PUBLIC_HOSTNAME redirects to the apex" code_is 301 "https://www.$PUBLIC_HOSTNAME/"
fi

if ((FAILS > 0)); then printf '%s health check: %d failure(s)\n' "$(date -u +%FT%TZ)" "$FAILS"; exit 1; fi
if [[ "$QUIET" != 1 ]]; then ok "all checks passed"; fi
