#!/usr/bin/env bash
# Apply database migrations from a built release, before traffic switches to it.
#
#   sudo migrate.sh [--release /srv/fancy/releases/<id>] [--skip-backup] [--dry-run]
#
# 1. runs the production configuration guard (packages/config) with the real env file;
# 2. lists pending migrations; nothing pending -> exit 0;
# 3. takes an encrypted backup first when the database already has data (backup.sh);
# 4. runs the forward-only migrator as the service user (advisory-locked, checksummed).
# Migrations are forward-only: the running release must tolerate the new schema for the
# few seconds until switch.sh restarts it (additive migrations only; see the runbook).
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
parse_common_flags "$@"
set -- "${REST_ARGS[@]}"
REL=""; SKIP_BACKUP=0
while (($#)); do
  case "$1" in
    --release) REL="$(abs_path "${2:?--release needs a directory}")"; shift ;;
    --skip-backup) SKIP_BACKUP=1 ;;
    *) die "unknown argument: $1" ;;
  esac
  shift
done
require_root
acquire_lock
REL="${REL:-$(latest_release_dir)}"
is_release_dir "$REL" || [[ "$DRY_RUN" == 1 ]] || die "not a built release: ${REL:-none} (run release.sh)"
[[ -s "$FANCY_ENV_FILE" ]] || [[ "$DRY_RUN" == 1 ]] || die "$FANCY_ENV_FILE missing (owner runs secrets.sh)"

step "1/4 Production configuration guard ($(basename "${REL:-?}"))"
run_as_service "$REL" "$NODE_BIN" packages/config/src/check-env.ts

step "2/4 Pending migrations"
want="$(release_latest_migration "$REL" 2>/dev/null || true)"
have="$(db_latest_migration)"
log "  database: ${have:-<empty>}; release: ${want:-?}"
if [[ -n "$have" && -n "$want" && "$have" > "$want" ]]; then
  die "database schema ($have) is newer than this release ($want); deploy a newer release or use rollback.sh"
fi
if [[ -n "$have" && "$have" == "$want" ]]; then ok "database already up to date"; exit 0; fi
if [[ -d "$REL/packages/db/migrations" ]]; then
  find "$REL/packages/db/migrations" -maxdepth 1 -name '[0-9][0-9][0-9][0-9]_*.sql' -printf '%f\n' | sort \
    | sed 's/\.sql$//' | awk -v have="$have" '$0 > have { print "    pending: " $0 }'
fi

step "3/4 Backup before migrating"
if [[ -z "$have" ]]; then
  ok "empty database: nothing to back up"
elif [[ "$SKIP_BACKUP" == 1 ]]; then
  warn "backup skipped on request"
else
  run "$KIT_DIR/backup.sh" --yes --tag "pre-migrate-$(basename "$REL")"
fi

step "4/4 Migrate"
run_as_service "$REL" "$NODE_BIN" packages/db/src/migrate-cli.ts
if [[ "$DRY_RUN" != 1 ]]; then
  now="$(db_latest_migration)"
  [[ "$now" == "$want" ]] || die "after migrating the database is at '$now', expected '$want'"
  ok "database at $now"
fi
