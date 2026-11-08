#!/usr/bin/env bash
# Point traffic back at an earlier release (code only; the database is never rolled back).
#
#   sudo rollback.sh [--to <release-id>] [--allow-newer-schema] [--dry-run]
#
# Default target: the release that was live before the last switch ($FANCY_STATE/previous).
# Migrations are forward-only. If the database already has migrations the target release
# does not know, the target may not work; the script refuses unless --allow-newer-schema is
# given after checking that those migrations were additive. To undo data changes, restore
# a backup instead (runbook section "恢复").
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
parse_common_flags "$@"
set -- "${REST_ARGS[@]}"
TARGET=""; ALLOW_NEWER=0
while (($#)); do
  case "$1" in
    --to) TARGET="$FANCY_RELEASES/${2:?--to needs a release id}"; shift ;;
    --allow-newer-schema) ALLOW_NEWER=1 ;;
    *) die "unknown argument: $1" ;;
  esac
  shift
done
require_root
acquire_lock
CUR="$(current_release_dir)"
TARGET="${TARGET:-$(cat "$FANCY_STATE/previous" 2>/dev/null || true)}"

step "1/3 Choose target"
log "  available releases:"
find "$FANCY_RELEASES" -mindepth 1 -maxdepth 1 -type d -name '20*' -printf '    %f\n' 2>/dev/null | sort || true
log "  current: $(basename "${CUR:-none}")"
is_release_dir "$TARGET" || [[ "$DRY_RUN" == 1 ]] || die "no valid rollback target (${TARGET:-none}); pass --to <release-id>"
if [[ -n "$TARGET" && "$TARGET" == "$CUR" ]]; then die "target is already live"; fi
log "  target:  $(basename "${TARGET:-?}")"

step "2/3 Schema compatibility"
want="$(release_latest_migration "$TARGET" 2>/dev/null || true)"; have="$(db_latest_migration)"
log "  database: ${have:-?}; target knows up to: ${want:-?}"
if [[ -n "$have" && -n "$want" && "$have" > "$want" ]]; then
  if [[ "$ALLOW_NEWER" == 1 ]]; then
    warn "database has migrations newer than the target; continuing because --allow-newer-schema was given"
  else
    die "database has migrations newer than the target ($have > $want). Check they are additive, then re-run with --allow-newer-schema"
  fi
fi
confirm "Switch live traffic from $(basename "${CUR:-none}") to $(basename "${TARGET:-?}")?" || die "cancelled"

step "3/3 Activate $(basename "${TARGET:-?}")"
if activate_release "$TARGET"; then
  if is_release_dir "$CUR" && [[ "$DRY_RUN" != 1 ]]; then printf '%s\n' "$CUR" >"$FANCY_STATE/previous"; fi
  record_history rollback "$TARGET"
  ok "rolled back; roll forward again with: sudo $FANCY_KIT_DIR/rollback.sh --to $(basename "${CUR:-none}")"
else
  journalctl --namespace=fancy -u fancy-api -u fancy-worker -n 40 --no-pager || true
  die "target release is not healthy; current symlink now points at it. Re-run rollback.sh --to $(basename "${CUR:-none}") to return"
fi
