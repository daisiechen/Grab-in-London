#!/usr/bin/env bash
# Full deploy: build a release from a Git ref, migrate, switch (with automatic rollback).
#
#   sudo /opt/fancy-deploy/deploy.sh [--ref main] [--dry-run]
#
# Each stage can also be run on its own: release.sh, migrate.sh, switch.sh, rollback.sh.
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
parse_common_flags "$@"
set -- "${REST_ARGS[@]}"
REF="$FANCY_DEFAULT_REF"
while (($#)); do
  case "$1" in
    --ref) REF="${2:?--ref needs a value}"; shift ;;
    *) die "unknown argument: $1" ;;
  esac
  shift
done
require_root
proxy_guard_begin
acquire_lock
flags=(--yes); [[ "$DRY_RUN" == 1 ]] && flags+=(--dry-run)

step "Deploy $REF"
out="$("$KIT_DIR/release.sh" --ref "$REF" "${flags[@]}" | tee /dev/stderr)"
rel="$(sed -n 's/^RELEASE_DIR=//p' <<<"$out" | tail -n1)"
[[ -n "$rel" ]] || die "release.sh did not report a release directory"
"$KIT_DIR/migrate.sh" --release "$rel" "${flags[@]}"
"$KIT_DIR/switch.sh" --release "$rel" "${flags[@]}"
if [[ "$DRY_RUN" == 1 ]]; then
  log "  would run: $KIT_DIR/healthcheck.sh"
else
  "$KIT_DIR/healthcheck.sh" || die "post-deploy health check failed (the release is live; consider rollback.sh)"
fi
