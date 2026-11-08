#!/usr/bin/env bash
# Build a release on the server from a Git ref of the public repository. Does not migrate
# or switch traffic (migrate.sh, switch.sh; deploy.sh runs all three).
#
#   sudo release.sh [--ref main|<tag>|<40-char sha>] [--rebuild] [--dry-run]
#
# Why build on the server (not upload a tarball from the Mac): the repository is public, so
# the server fetches an exact commit without credentials; pnpm installs Linux packages for
# this machine (the Mac is darwin/arm64); and the release is tied to a commit SHA. The build
# only installs the four production workspaces (API, worker, Web, admin; ~200 MB, not the
# iOS toolchain) and runs the two Vite builds without type-checking (CI and the Mac run
# `pnpm core:check` before a deploy). nginx serves site/; apps/web/dist stays in the release
# for the Web page-head server (fancy-web, apps/web/server/serve.ts). It runs as the `fancy` user inside a transient systemd
# unit capped at BUILD_MEMORY_MAX with low CPU/IO priority, so the live API and PostgreSQL
# keep their memory on the 3.6 GB machine.
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
parse_common_flags "$@"
set -- "${REST_ARGS[@]}"
REF="$FANCY_DEFAULT_REF"; REBUILD=0
while (($#)); do
  case "$1" in
    --ref) REF="${2:?--ref needs a value}"; shift ;;
    --rebuild) REBUILD=1 ;;
    *) die "unknown argument: $1" ;;
  esac
  shift
done
[[ "$REF" =~ ^[A-Za-z0-9._/-]+$ ]] || die "invalid ref"
require_root
acquire_lock
REPO="$FANCY_CACHE/repo.git"
BUILD_HOME="$FANCY_CACHE/home"
as_fancy() { run runuser -u "$FANCY_USER" -- "$@"; }

step "1/6 Preconditions"
[[ -x "$NODE_BIN" && -x "$PNPM_BIN" ]] || [[ "$DRY_RUN" == 1 ]] || die "Node/pnpm missing; run bootstrap.sh"
avail_kb="$(df --output=avail -k "$FANCY_ROOT" 2>/dev/null | tail -n1 || echo 0)"
if [[ "$DRY_RUN" != 1 ]] && ((avail_kb < 3000000)); then die "less than 3 GB free on $FANCY_ROOT"; fi
log "  free disk on $FANCY_ROOT: $((avail_kb / 1024)) MB; memory:"; free -m | sed 's/^/    /'
[[ -f "$FANCY_WEB_BUILD_ENV" ]] || warn "$FANCY_WEB_BUILD_ENV missing: the Web map falls back to the illustrated map"
if [[ "$REF" != "$FANCY_DEFAULT_REF" ]]; then warn "building '$REF', not '$FANCY_DEFAULT_REF'; production normally deploys merged main"; fi

step "2/6 Fetch $REF from $FANCY_REPO_URL"
run install -d -m 0750 -o "$FANCY_USER" -g "$FANCY_USER" "$BUILD_HOME" "$FANCY_CACHE/pnpm-store"
if [[ ! -d "$REPO" ]]; then
  as_fancy git init --quiet --bare "$REPO"
  as_fancy git -C "$REPO" remote add origin "$FANCY_REPO_URL"
fi
as_fancy git -C "$REPO" fetch --quiet --depth=1 --no-tags origin "$REF"
if [[ "$DRY_RUN" == 1 ]]; then SHA="0000000000000000000000000000000000000000"; else SHA="$(runuser -u "$FANCY_USER" -- git -C "$REPO" rev-parse FETCH_HEAD)"; fi
log "  commit: $SHA"
existing="$(find "$FANCY_RELEASES" -mindepth 1 -maxdepth 1 -type d -name "*-${SHA:0:12}" 2>/dev/null | sort | tail -n1 || true)"
if [[ -n "$existing" && -f "$existing/RELEASE" && "$REBUILD" == 0 ]]; then
  ok "already built: $existing (use --rebuild to build again)"
  echo "RELEASE_DIR=$existing"
  exit 0
fi

ID="$(date -u +%Y%m%dT%H%M%SZ)-${SHA:0:12}"
STAGING="$FANCY_ROOT/build/$ID"
step "3/6 Extract production sources into $STAGING"
run install -d -m 0755 -o "$FANCY_USER" -g "$FANCY_USER" "$STAGING"
if [[ "$DRY_RUN" != 1 ]]; then
  add_exit_hook "[[ -d '$STAGING' ]] && rm -rf '$STAGING'"
  runuser -u "$FANCY_USER" -- git -C "$REPO" archive --format=tar "$SHA" \
    package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json apps packages infra \
    | runuser -u "$FANCY_USER" -- tar -x -C "$STAGING"
else
  log "  + git archive $SHA <production paths> | tar -x -C $STAGING"
fi

step "4/6 Install production workspaces and build Web + admin (memory cap $BUILD_MEMORY_MAX)"
# shellcheck disable=SC2016 # expanded by the build shell, not here
BUILD_SCRIPT='
set -euo pipefail
pnpm install --frozen-lockfile --prefer-offline --store-dir "$FANCY_PNPM_STORE" \
  --filter "@fancy/api..." --filter "@fancy/worker..." --filter "@fancy/web..." --filter "@fancy/admin..."
pnpm --filter @fancy/web exec vite build
pnpm --filter @fancy/admin exec vite build --base=/admin/
rm -rf site && mkdir -p site/admin
cp -a apps/web/dist/. site/
cp -a apps/admin/dist/. site/admin/
find site apps/web/dist -name "*.map" -delete
for f in site/index.html site/admin/index.html site/privacy/index.html site/terms/index.html site/guidelines/index.html site/support/index.html; do
  test -s "$f" || { echo "missing $f" >&2; exit 1; }
done
# Module graph resolves for every runtime entry point (import only; nothing starts).
# The Web page-head server only listens when run as the main script, so importing it is safe.
node --input-type=module -e "await import(\"./apps/api/src/main.ts\"); await import(\"./apps/worker/src/main.ts\"); await import(\"./packages/db/src/migrate.ts\"); await import(\"./apps/web/server/serve.ts\"); console.warn(\"entry points resolve\")"
'
run systemd-run --uid="$FANCY_USER" --gid="$FANCY_USER" --working-directory="$STAGING" \
  --pipe --wait --collect --quiet \
  -p MemoryMax="$BUILD_MEMORY_MAX" -p CPUWeight=20 -p Nice=10 -p IOSchedulingClass=idle \
  -p EnvironmentFile=-"$FANCY_WEB_BUILD_ENV" \
  -E HOME="$BUILD_HOME" -E PATH="$NODE_DIR/bin:/usr/bin:/bin" -E CI=true \
  -E FANCY_PNPM_STORE="$FANCY_CACHE/pnpm-store" \
  -E NODE_OPTIONS="--max-old-space-size=$BUILD_NODE_HEAP_MB" \
  /bin/bash -c "$BUILD_SCRIPT"

step "5/6 Seal the release (root-owned, read-only for the service user)"
if [[ "$DRY_RUN" != 1 ]]; then
  {
    echo "id=$ID"
    echo "commit=$SHA"
    echo "ref=$REF"
    echo "built_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "node=$("$NODE_BIN" -v)"
    echo "latest_migration=$(release_latest_migration "$STAGING")"
  } >"$STAGING/RELEASE"
fi
run chown -R root:root "$STAGING"
run chmod -R go-w,a+rX "$STAGING"
run mv -T "$STAGING" "$FANCY_RELEASES/$ID"
ok "built $FANCY_RELEASES/$ID"

step "6/6 Prune old releases (keep $KEEP_RELEASES newest plus current and previous)"
cur="$(current_release_dir)"; prev="$(cat "$FANCY_STATE/previous" 2>/dev/null || true)"
mapfile -t all < <(find "$FANCY_RELEASES" -mindepth 1 -maxdepth 1 -type d -name '20*' 2>/dev/null | sort -r)
for ((i = KEEP_RELEASES; i < ${#all[@]}; i++)); do
  dir="${all[$i]}"
  [[ "$dir" == "$cur" || "$dir" == "$prev" ]] && continue
  run rm -rf "$dir"
done
echo "RELEASE_DIR=$FANCY_RELEASES/$ID"
