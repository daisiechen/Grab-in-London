#!/usr/bin/env bash
# Encrypted PostgreSQL backup and deletion-ledger export. Run daily/hourly by systemd timers.
#
#   sudo backup.sh [--tag NAME] [--ledger-only] [--dry-run]
#
# Full backup: pg_dump (custom format) streamed straight into `age` with the owner's PUBLIC
# key; plaintext never touches disk and the server cannot decrypt its own backups.
# Ledger: infra/recovery.ts export (read-only query of deletion_requests), encrypted the same
# way. A restore must replay deletions accepted after the backup (infra/README.md).
# Retention: files older than BACKUP_RETENTION_DAYS are deleted (the newest full backup is
# always kept). This must equal {{BACKUP_RETENTION}} in the privacy notice.
# Off-site copy: if /etc/fancy/backup-offsite.sh exists and is executable, it is called with
# each new encrypted file (owner decides the destination; see the runbook).
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
parse_common_flags "$@"
set -- "${REST_ARGS[@]}"
TAG=""; LEDGER_ONLY=0
while (($#)); do
  case "$1" in
    --tag) TAG="${2:?--tag needs a name}"; shift ;;
    --ledger-only) LEDGER_ONLY=1 ;;
    *) die "unknown argument: $1" ;;
  esac
  shift
done
[[ -z "$TAG" || "$TAG" =~ ^[A-Za-z0-9._-]+$ ]] || die "invalid tag"
require_root
acquire_lock
[[ -s "$FANCY_BACKUP_RECIPIENTS" ]] || [[ "$DRY_RUN" == 1 ]] || die "no backup public key ($FANCY_BACKUP_RECIPIENTS); owner runs secrets.sh"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
run install -d -m 0700 -o root -g root "$FANCY_BACKUPS/db" "$FANCY_BACKUPS/ledger"

offsite() {
  if [[ -x /etc/fancy/backup-offsite.sh ]]; then run /etc/fancy/backup-offsite.sh "$1" || warn "off-site copy failed for $1"; fi
}

if [[ "$LEDGER_ONLY" == 0 ]]; then
  step "Full database backup"
  out="$FANCY_BACKUPS/db/fancy-$TS${TAG:+-$TAG}.dump.age"
  log "  + pg_dump -Fc $PG_DB | age -R $FANCY_BACKUP_RECIPIENTS > $out"
  if [[ "$DRY_RUN" != 1 ]]; then
    start=$SECONDS
    runuser -u postgres -- pg_dump -p "$PG_PORT" -Fc -Z 6 "$PG_DB" \
      | age -R "$FANCY_BACKUP_RECIPIENTS" -o "$out.partial"
    mv -f "$out.partial" "$out"
    chmod 0600 "$out"
    size="$(stat -c %s "$out")"
    ((size > 1024)) || die "backup suspiciously small ($size bytes)"
    sha256sum "$out" | awk '{print $1}' >"$out.sha256"
    printf 'at=%s file=%s bytes=%s seconds=%s\n' "$TS" "$(basename "$out")" "$size" "$((SECONDS - start))" >"$FANCY_STATE/last-backup"
    ok "$(basename "$out") ($((size / 1024)) KiB, $((SECONDS - start)) s)"
    offsite "$out"
  fi
fi

step "Deletion-ledger export"
rel="$(current_release_dir)"
has_table="$(pg_super -d "$PG_DB" -tA -c "SELECT to_regclass('public.deletion_requests') IS NOT NULL" 2>/dev/null || true)"
if ! is_release_dir "$rel" || [[ "$has_table" != t ]]; then
  log "  skipped: no live release or schema yet"
else
  work="$FANCY_ROOT/build/ledger-$TS"
  run install -d -m 0700 -o "$FANCY_USER" -g "$FANCY_USER" "$work"
  if [[ "$DRY_RUN" != 1 ]]; then add_exit_hook "[[ -d '$work' ]] && find '$work' -type f -exec shred -u {} + ; rm -rf '$work'"; fi
  run_as_service "$rel" -p ReadWritePaths="$work" -E FANCY_OFFLINE_RECOVERY=1 \
    "$NODE_BIN" infra/recovery.ts export "$work/ledger.json"
  lout="$FANCY_BACKUPS/ledger/ledger-$TS.json.age"
  run age -R "$FANCY_BACKUP_RECIPIENTS" -o "$lout" "$work/ledger.json"
  run chmod 0600 "$lout"
  if [[ "$DRY_RUN" != 1 ]]; then printf 'at=%s file=%s\n' "$TS" "$(basename "$lout")" >"$FANCY_STATE/last-ledger"; fi
  ok "$(basename "$lout")"
  if [[ "$DRY_RUN" != 1 ]]; then offsite "$lout"; fi
fi

step "Retention: delete encrypted files older than $BACKUP_RETENTION_DAYS days"
newest="$(find "$FANCY_BACKUPS/db" -maxdepth 1 -name 'fancy-*.dump.age' -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -n1 | cut -d' ' -f2- || true)"
while IFS= read -r f; do
  [[ -z "$f" || "$f" == "$newest" ]] && continue
  run rm -f "$f" "$f.sha256"
done < <(find "$FANCY_BACKUPS/db" "$FANCY_BACKUPS/ledger" -maxdepth 1 -type f -name '*.age' -mtime +"$((BACKUP_RETENTION_DAYS - 1))" 2>/dev/null)
ok "retention applied"
