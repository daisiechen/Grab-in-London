#!/bin/sh
# CI uses the same pinned PG17 image for dump/restore as its service. No host client install.
set -eu
client_dir=${FANCY_CI_CLIENT_DIR:-/tmp/fancy-pg17-clients}
case "$client_dir" in /*) ;; *) exit 2 ;; esac
mkdir -p "$client_dir"
for client in pg_dump pg_restore; do
  cat > "$client_dir/$client" <<'WRAPPER'
#!/bin/sh
exec docker run --rm --network host --volume /tmp:/tmp postgres:17.11-bookworm "$(basename "$0")" "$@"
WRAPPER
  chmod 700 "$client_dir/$client"
done
