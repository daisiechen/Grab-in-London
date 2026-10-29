#!/usr/bin/env bash
# Restore drill: prove the newest encrypted backup restores, and measure how long it takes.
#
#   sudo restore-drill.sh --identity /root/fancy-backup-key.txt [--backup FILE] [--keep] [--shred-identity]
#
# The age PRIVATE key is the owner's: she copies it to the server only for the drill (or for
# a real restore) and removes it afterwards (--shred-identity does that). The drill restores
# into a separate database `fancy_restore_drill` on the same cluster; production data, the
# API and the worker are not touched. Nothing restored is printed: only counts and timings.
# A real restore follows the runbook (stop ingress/API/worker, restore, migrate, arm and
# replay the deletion ledger with infra/recovery.ts, then start); this drill covers the
# decrypt + restore + ledger-decrypt part and records the timing toward the 4-hour RTO.
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
parse_common_flags "$@"
set -- "${REST_ARGS[@]}"
IDENTITY=""; BACKUP=""; KEEP=0; SHRED_ID=0
while (($#)); do
  case "$1" in
    --identity) IDENTITY="$(abs_path "${2:?--identity needs a file}")"; shift ;;
    --backup) BACKUP="$(abs_path "${2:?--backup needs a file}")"; shift ;;
    --keep) KEEP=1 ;;
    --shred-identity) SHRED_ID=1 ;;
    *) die "unknown argument: $1" ;;
  esac
  shift
done
require_root
acquire_lock
DRILL_DB=fancy_restore_drill
[[ -n "$IDENTITY" ]] || die "--identity <age private key file> is required (owner provides it)"
if [[ "$DRY_RUN" != 1 ]]; then
  [[ -r "$IDENTITY" ]] || die "cannot read $IDENTITY"
  [[ "$(stat -c %a "$IDENTITY")" == 600 || "$(stat -c %a "$IDENTITY")" == 400 ]] || die "$IDENTITY must be mode 0600"
fi
if [[ "$SHRED_ID" == 1 && "$DRY_RUN" != 1 ]]; then add_exit_hook "shred -u '$IDENTITY' 2>/dev/null && echo '  identity file shredded'"; fi
BACKUP="${BACKUP:-$(find "$FANCY_BACKUPS/db" -maxdepth 1 -name 'fancy-*.dump.age' -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -n1 | cut -d' ' -f2- || true)}"
[[ -n "$BACKUP" && -f "$BACKUP" ]] || [[ "$DRY_RUN" == 1 ]] || die "no backup found in $FANCY_BACKUPS/db"

step "1/4 Integrity of $(basename "${BACKUP:-?}")"
if [[ "$DRY_RUN" != 1 && -f "$BACKUP.sha256" ]]; then
  [[ "$(sha256sum "$BACKUP" | awk '{print $1}')" == "$(cat "$BACKUP.sha256")" ]] || die "checksum mismatch"
  ok "sha256 matches"
fi

step "2/4 Restore into $DRILL_DB (isolated database)"
run runuser -u postgres -- dropdb -p "$PG_PORT" --if-exists "$DRILL_DB"
run runuser -u postgres -- createdb -p "$PG_PORT" -T template0 -E UTF8 --lc-collate=C.UTF-8 --lc-ctype=C.UTF-8 "$DRILL_DB"
if [[ "$KEEP" == 0 && "$DRY_RUN" != 1 ]]; then add_exit_hook "runuser -u postgres -- dropdb -p '$PG_PORT' --if-exists '$DRILL_DB' && echo '  drill database dropped'"; fi
log "  + age -d -i <identity> $(basename "${BACKUP:-?}") | pg_restore --no-owner --no-privileges -d $DRILL_DB"
start=$SECONDS
if [[ "$DRY_RUN" != 1 ]]; then
  age -d -i "$IDENTITY" "$BACKUP" | runuser -u postgres -- pg_restore -p "$PG_PORT" --no-owner --no-privileges --exit-on-error -d "$DRILL_DB"
fi
restore_s=$((SECONDS - start))
ok "restored in ${restore_s}s"

step "3/4 Sanity checks (counts only)"
result=PASS
if [[ "$DRY_RUN" != 1 ]]; then
  q() { pg_super -d "$1" -tA -c "$2"; }
  tables_drill="$(q "$DRILL_DB" "SELECT count(*) FROM pg_tables WHERE schemaname = 'public'")"
  tables_live="$(q "$PG_DB" "SELECT count(*) FROM pg_tables WHERE schemaname = 'public'")"
  mig_drill="$(q "$DRILL_DB" "SELECT coalesce(max(version), '') FROM schema_migrations" 2>/dev/null || true)"
  mig_live="$(db_latest_migration)"
  log "  tables: drill $tables_drill / live $tables_live; latest migration: drill ${mig_drill:-none} / live ${mig_live:-none}"
  [[ "$tables_drill" -gt 0 && -n "$mig_drill" ]] || result=FAIL
  [[ "$mig_drill" == "$mig_live" ]] || warn "backup predates the latest migration (expected right after a deploy)"
  for t in users meals deletion_requests; do
    if [[ "$(q "$DRILL_DB" "SELECT to_regclass('public.$t') IS NOT NULL")" == t ]]; then
      log "  rows in $t: drill $(q "$DRILL_DB" "SELECT count(*) FROM $t") / live $(q "$PG_DB" "SELECT count(*) FROM $t")"
    fi
  done
fi

step "4/4 Newest deletion ledger decrypts"
ledger="$(find "$FANCY_BACKUPS/ledger" -maxdepth 1 -name 'ledger-*.json.age' -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -n1 | cut -d' ' -f2- || true)"
if [[ -z "$ledger" ]]; then
  warn "no ledger export yet"
elif [[ "$DRY_RUN" != 1 ]]; then
  entries="$(age -d -i "$IDENTITY" "$ledger" | jq -e 'select(.version == 1) | .entries | length')" || { result=FAIL; entries="unreadable"; }
  log "  $(basename "$ledger"): $entries entries; newer than backup: $([[ "$ledger" -nt "$BACKUP" ]] && echo yes || echo no)"
fi

if [[ "$DRY_RUN" != 1 ]]; then
  printf '%s backup=%s restore_seconds=%s result=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$(basename "$BACKUP")" "$restore_s" "$result" >>"$FANCY_STATE/restore-drills.log"
fi
[[ "$result" == PASS ]] || die "restore drill FAILED"
if [[ "$DRY_RUN" == 1 ]]; then ok "dry run complete (nothing restored)"; exit 0; fi
ok "restore drill PASS (logged in $FANCY_STATE/restore-drills.log)"
