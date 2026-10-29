#!/usr/bin/env bash
# Switch live traffic to a built, migrated release; roll back automatically if it fails.
#
#   sudo switch.sh [--release /srv/fancy/releases/<id>] [--dry-run]
#
# 1. refuses unless the database schema equals the release's latest migration;
# 2. starts the release as a throwaway candidate API on 127.0.0.1:API_CANDIDATE_PORT and
#    waits for /health/ready (the live API keeps serving meanwhile);
# 3. moves the `current` symlink atomically, restarts API + worker, checks health;
# 4. on failure, moves `current` back to the previous release and restarts it;
# 5. records history, refreshes the deploy kit from the release, enables timers.
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
parse_common_flags "$@"
set -- "${REST_ARGS[@]}"
REL=""
while (($#)); do
  case "$1" in
    --release) REL="$(abs_path "${2:?--release needs a directory}")"; shift ;;
    *) die "unknown argument: $1" ;;
  esac
  shift
done
require_root
acquire_lock
REL="${REL:-$(latest_release_dir)}"
is_release_dir "$REL" || [[ "$DRY_RUN" == 1 ]] || die "not a built release: ${REL:-none}"
PREV="$(current_release_dir)"

step "1/5 Schema check"
want="$(release_latest_migration "$REL" 2>/dev/null || true)"; have="$(db_latest_migration)"
if [[ "$DRY_RUN" != 1 && "$have" != "$want" ]]; then die "database is at '${have:-empty}', release expects '$want': run migrate.sh first"; fi
ok "schema ${have:-?} matches $(basename "${REL:-?}")"
if [[ "$REL" == "$PREV" ]]; then ok "already live: $REL"; fi

step "2/5 Candidate API on 127.0.0.1:$API_CANDIDATE_PORT"
CANDIDATE=fancy-api-candidate
if systemctl list-units --all --plain --no-legend "$CANDIDATE.service" | grep -q .; then
  run systemctl stop "$CANDIDATE.service" || true
  run systemctl reset-failed "$CANDIDATE.service" || true
fi
run systemd-run --unit="$CANDIDATE" --uid="$FANCY_USER" --gid="$FANCY_USER" --working-directory="$REL" \
  --collect --quiet -p EnvironmentFile="$FANCY_ENV_FILE" -p LogNamespace=fancy -p MemoryMax=900M \
  -p NoNewPrivileges=yes -p ProtectSystem=strict -p ProtectHome=yes -p PrivateTmp=yes \
  -E PORT="$API_CANDIDATE_PORT" -E NODE_ENV=production \
  "$NODE_BIN" apps/api/src/main.ts
if [[ "$DRY_RUN" != 1 ]]; then
  if wait_http_ok "http://127.0.0.1:$API_CANDIDATE_PORT/health/ready" 45; then
    ok "candidate ready"
    systemctl stop "$CANDIDATE.service" || true
  else
    journalctl --namespace=fancy -u "$CANDIDATE" -n 40 --no-pager || true
    systemctl stop "$CANDIDATE.service" || true
    die "candidate did not become ready; live traffic was not touched"
  fi
fi

step "3/5 Switch current -> $(basename "${REL:-?}")"
if is_release_dir "$PREV" && [[ "$PREV" != "$REL" && "$DRY_RUN" != 1 ]]; then printf '%s\n' "$PREV" >"$FANCY_STATE/previous"; fi
if ! activate_release "$REL"; then
  journalctl --namespace=fancy -u fancy-api -u fancy-worker -n 40 --no-pager || true
  if is_release_dir "$PREV" && [[ "$PREV" != "$REL" ]]; then
    warn "rolling back to $(basename "$PREV")"
    activate_release "$PREV" || warn "previous release is not healthy either: investigate now"
    record_history auto-rollback "$PREV"
  fi
  die "switch failed"
fi
record_history switch "$REL"

step "4/5 Refresh the deploy kit from this release"
if [[ -d "$REL/infra/deploy/seoul" && "$REL/infra/deploy/seoul" != "$KIT_DIR" ]]; then
  if ! diff -rq "$REL/infra/deploy/seoul/templates" "$FANCY_KIT_DIR/templates" >/dev/null 2>&1; then
    warn "server templates changed in this release: run 'sudo $FANCY_KIT_DIR/bootstrap.sh' afterwards (idempotent)"
  fi
  run rsync -a --delete --chown=root:root --chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r "$REL/infra/deploy/seoul/" "$FANCY_KIT_DIR/"
  run find "$FANCY_KIT_DIR" -maxdepth 1 -name '*.sh' -exec chmod 0755 {} +
fi

step "5/5 Timers"
run systemctl enable --now fancy-healthcheck.timer
if [[ -s "$FANCY_BACKUP_RECIPIENTS" ]]; then
  run systemctl enable --now fancy-backup.timer fancy-ledger.timer
else
  warn "no backup public key yet ($FANCY_BACKUP_RECIPIENTS): backup timers stay off; owner runs secrets.sh"
fi
ok "deployed $(basename "${REL:-?}"); previous: $(basename "${PREV:-none}")"
