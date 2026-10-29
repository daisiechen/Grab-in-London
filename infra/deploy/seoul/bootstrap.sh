#!/usr/bin/env bash
# One-time (re-runnable) server preparation for Fancy production on the Seoul server.
#
#   sudo bash bootstrap.sh [--dry-run] [--yes]
#
# Installs: Node 24 under /opt (system Node 20 untouched), pnpm, PostgreSQL 17 (PGDG,
# 127.0.0.1 only, TLS), nginx (127.0.0.1 only), cloudflared, age, unattended security
# updates; creates the `fancy` and `fancy-tunnel` system users, directories, systemd units,
# a private journal namespace and log rotation. Does not start the API/worker (no release
# yet), does not create the tunnel (needs the owner's Cloudflare login, see tunnel.sh) and
# does not write secrets (secrets.sh, run by the owner).
#
# Safety: package maintainer scripts are prevented from starting or restarting any service
# while this runs (policy-rc.d), needrestart is told never to restart the owner's proxy,
# and nothing binds a public interface. /home/ubuntu/fancy (development) is only listed.
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
parse_common_flags "$@"
require_root
require_ubuntu_2204
proxy_guard_begin

export DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=l NEEDRESTART_SUSPEND=1
APT_INSTALL=(apt-get install -y --no-install-recommends -o Dpkg::Options::=--force-confold)
PGDG_FINGERPRINT=B97B0AFCAA1A47F044F244A07FCC7D46ACCC4CF8

step "1/12 Read-only inventory"
log "  system node: $(command -v node || echo none) $(node -v 2>/dev/null || true) (left alone)"
if [[ -d /home/ubuntu/fancy ]]; then
  log "  existing development tree (kept as-is, nothing is moved or deleted):"
  find /home/ubuntu/fancy -mindepth 1 -maxdepth 1 -printf '    %p\n' 2>/dev/null || true
fi
free -m | sed 's/^/  /'
df -h / | sed 's/^/  /'
require_port_free_or_ours "$PG_PORT" postgres
require_port_free_or_ours "$API_PORT" node
require_port_free_or_ours "$API_CANDIDATE_PORT" node
require_port_free_or_ours "$GATEWAY_PORT" nginx
require_port_free_or_ours "$TUNNEL_METRICS_PORT" cloudflared

step "2/12 Keep package maintenance away from the owner's proxy"
ss_pkg=""; ss_unit=""
if ss_bin="$(command -v ss-server 2>/dev/null)"; then
  ss_pkg="$(dpkg -S "$ss_bin" 2>/dev/null | head -n1 | cut -d: -f1 || true)"
fi
ss_pid="$(pgrep -x ss-server | head -n1 || true)"
if [[ -n "$ss_pid" ]]; then ss_unit="$(ps -o unit= -p "$ss_pid" 2>/dev/null | tr -d ' ' || true)"; fi
log "  proxy package: ${ss_pkg:-not from a deb package}; unit: ${ss_unit:-unknown} (read-only detection)"
# shellcheck disable=SC2016 # Perl source written literally
{
  echo '# Fancy deploy kit: never let needrestart restart the owner proxy automatically.'
  echo '$nrconf{override_rc}{qr(^shadowsocks)} = 0;'
  echo '$nrconf{override_rc}{qr(^ss-server)} = 0;'
  if [[ -n "$ss_unit" && "$ss_unit" != "-" ]]; then printf '$nrconf{override_rc}{qr(^\\Q%s\\E$)} = 0;\n' "$ss_unit"; fi
} | install_content /etc/needrestart/conf.d/fancy-protect-proxy.conf 0644 root:root
if [[ -n "$ss_pkg" ]]; then
  printf '// Fancy deploy kit: unattended upgrades never upgrade (and so never restart) the owner proxy.\n// Remove this file if the owner wants it updated automatically.\nUnattended-Upgrade::Package-Blacklist { "%s"; };\n' "$ss_pkg" \
    | install_content /etc/apt/apt.conf.d/53fancy-protect-proxy 0644 root:root
fi
if [[ -e /usr/sbin/policy-rc.d ]]; then
  grep -qx 'exit 101' /usr/sbin/policy-rc.d || die "/usr/sbin/policy-rc.d already exists with another policy; refusing to change it"
  ok "an existing policy-rc.d already blocks service starts; leaving it in place"
elif [[ "$DRY_RUN" != 1 ]]; then
  log "  block service starts/restarts from package scripts for the duration of this run"
  printf '#!/bin/sh\n# Temporary (Fancy bootstrap): no service starts/restarts from package scripts.\nexit 101\n' >/usr/sbin/policy-rc.d
  chmod 0755 /usr/sbin/policy-rc.d
  add_exit_hook 'rm -f /usr/sbin/policy-rc.d'
fi

step "3/12 Base packages (Ubuntu archive)"
run apt-get update
run "${APT_INSTALL[@]}" ca-certificates curl gnupg xz-utils git rsync jq openssl age \
  unattended-upgrades logrotate postgresql-common

step "4/12 PostgreSQL (PGDG) and cloudflared (Cloudflare) apt repositories"
key=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc
if [[ ! -s "$key" ]]; then
  run install -d -m 0755 /usr/share/postgresql-common/pgdg
  run curl -fsSL -o "$key" https://www.postgresql.org/media/keys/ACCC4CF8.asc
fi
if [[ "$DRY_RUN" != 1 ]]; then
  gpg --show-keys --with-colons "$key" | grep -q "fpr:::::::::$PGDG_FINGERPRINT:" || die "PGDG key fingerprint mismatch"
  ok "PGDG key fingerprint $PGDG_FINGERPRINT"
fi
echo "deb [signed-by=$key] https://apt.postgresql.org/pub/repos/apt jammy-pgdg main" \
  | install_content /etc/apt/sources.list.d/pgdg.list 0644 root:root
if [[ ! -s /usr/share/keyrings/cloudflare-main.gpg ]]; then
  run install -d -m 0755 /usr/share/keyrings
  run curl -fsSL -o /usr/share/keyrings/cloudflare-main.gpg https://pkg.cloudflare.com/cloudflare-main.gpg
fi
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' \
  | install_content /etc/apt/sources.list.d/cloudflared.list 0644 root:root

step "5/12 PostgreSQL $PG_MAJOR, nginx, cloudflared"
if dpkg -s nginx >/dev/null 2>&1; then
  others="$(find /etc/nginx/sites-enabled -mindepth 1 ! -name default ! -name fancy.conf -printf '%f ' 2>/dev/null || true)"
  [[ -z "$others" ]] || die "nginx already serves other sites ($others); refusing to take it over"
fi
run apt-get update
run "${APT_INSTALL[@]}" "postgresql-$PG_MAJOR" nginx cloudflared

step "6/12 Service users and directories"
if ! id "$FANCY_USER" >/dev/null 2>&1; then
  run useradd --system --home-dir "$FANCY_ROOT" --no-create-home --shell /usr/sbin/nologin "$FANCY_USER"
fi
if ! id fancy-tunnel >/dev/null 2>&1; then
  run useradd --system --home-dir /nonexistent --no-create-home --shell /usr/sbin/nologin fancy-tunnel
fi
run install -d -m 0755 -o root -g root "$FANCY_ROOT" "$FANCY_RELEASES" "$FANCY_STATE"
run install -d -m 0750 -o "$FANCY_USER" -g "$FANCY_USER" "$FANCY_CACHE" "$FANCY_ROOT/build"
run install -d -m 0750 -o root -g "$FANCY_USER" "$FANCY_ETC"
run install -d -m 0700 -o root -g root "$FANCY_BACKUPS"
run install -d -m 0750 -o root -g adm /var/log/fancy
run install -d -m 0750 -o root -g fancy-tunnel /etc/cloudflared

step "7/12 Node $NODE_VERSION under /opt (private to Fancy) and pnpm $PNPM_VERSION"
case "$(dpkg --print-architecture)" in amd64) narch=x64 ;; arm64) narch=arm64 ;; *) die "unsupported architecture" ;; esac
node_name="node-v$NODE_VERSION-linux-$narch"
node_real="/opt/$node_name"
if [[ -e "$NODE_DIR" && ! -L "$NODE_DIR" ]]; then die "$NODE_DIR exists and is not a symlink; refusing to replace it"; fi
if [[ ! -x "$node_real/bin/node" ]]; then
  tmp="$(mktemp -d)"; add_exit_hook "rm -rf '$tmp'"
  run curl -fsSL -o "$tmp/$node_name.tar.xz" "https://nodejs.org/dist/v$NODE_VERSION/$node_name.tar.xz"
  run curl -fsSL -o "$tmp/SHASUMS256.txt" "https://nodejs.org/dist/v$NODE_VERSION/SHASUMS256.txt"
  if [[ "$DRY_RUN" != 1 ]]; then
    (cd "$tmp" && grep " $node_name.tar.xz\$" SHASUMS256.txt | sha256sum -c -) || die "Node checksum mismatch"
  fi
  run tar -xJf "$tmp/$node_name.tar.xz" -C /opt
  run chown -R root:root "$node_real"
fi
if [[ "$(readlink "$NODE_DIR" 2>/dev/null || true)" != "$node_real" ]]; then
  run ln -sfn "$node_real" "$NODE_DIR.tmp"
  run mv -Tf "$NODE_DIR.tmp" "$NODE_DIR"
fi
if [[ "$("$node_real/bin/pnpm" -v 2>/dev/null || true)" != "$PNPM_VERSION" ]]; then
  run env PATH="$node_real/bin:/usr/bin:/bin" "$node_real/bin/npm" install -g --prefix "$node_real" "pnpm@$PNPM_VERSION"
fi
if [[ "$DRY_RUN" != 1 ]]; then ok "node $("$NODE_BIN" -v), pnpm $("$PNPM_BIN" -v); system node still $(/usr/local/bin/node -v 2>/dev/null || echo absent)"; fi

step "8/12 PostgreSQL $PG_MAJOR: loopback-only, TLS with a local CA, tuned for 3.6 GB"
pg_conf_dir="/etc/postgresql/$PG_MAJOR/$PG_CLUSTER"
tls_dir="$pg_conf_dir/fancy-tls"
if [[ "$DRY_RUN" != 1 && ! -d "$pg_conf_dir" ]]; then
  run pg_createcluster "$PG_MAJOR" "$PG_CLUSTER" --port "$PG_PORT"
fi
INSTALL_CHANGED=0
if [[ ! -s "$tls_dir/server.crt" ]]; then
  INSTALL_CHANGED=1
  log "  generating a local CA and a 127.0.0.1 server certificate (CA key is discarded after signing)"
  run install -d -m 0700 -o postgres -g postgres "$tls_dir"
  if [[ "$DRY_RUN" != 1 ]]; then
    work="$(mktemp -d)"; add_exit_hook "rm -rf '$work'"
    (
      cd "$work"
      openssl req -x509 -new -nodes -newkey rsa:3072 -days 3650 -subj '/CN=Fancy local PostgreSQL CA' \
        -addext 'basicConstraints=critical,CA:TRUE' -addext 'keyUsage=critical,keyCertSign,cRLSign' \
        -keyout ca.key -out ca.crt 2>/dev/null
      openssl req -new -nodes -newkey rsa:3072 -subj '/CN=127.0.0.1' -keyout server.key -out server.csr 2>/dev/null
      printf 'subjectAltName=IP:127.0.0.1,DNS:localhost\nbasicConstraints=CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\n' >server.ext
      openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -days 3650 -extfile server.ext -out server.crt 2>/dev/null
      openssl verify -CAfile ca.crt server.crt >/dev/null
    )
    install -m 0600 -o postgres -g postgres "$work/server.key" "$tls_dir/server.key"
    install -m 0644 -o postgres -g postgres "$work/server.crt" "$tls_dir/server.crt"
    install -m 0644 -o root -g root "$work/ca.crt" "$tls_dir/ca.crt"
  fi
fi
if [[ "$DRY_RUN" != 1 ]]; then install -m 0644 -o root -g root "$tls_dir/ca.crt" "$FANCY_PG_CA"; fi
run install -d -m 0700 -o postgres -g postgres /var/log/postgresql/fancy
install_template postgresql/fancy.conf "$pg_conf_dir/conf.d/fancy.conf" 0644 postgres:postgres
if [[ -f "$pg_conf_dir/pg_hba.conf" ]]; then
  grep -Eq '^host[[:space:]]+all[[:space:]]+all[[:space:]]+127\.0\.0\.1/32[[:space:]]+scram-sha-256' "$pg_conf_dir/pg_hba.conf" \
    || warn "pg_hba.conf has no 'host all all 127.0.0.1/32 scram-sha-256' line; check it before secrets.sh"
fi
run systemctl enable "postgresql@$PG_MAJOR-$PG_CLUSTER"
if [[ "$INSTALL_CHANGED" == 1 ]] || ! systemctl is-active --quiet "postgresql@$PG_MAJOR-$PG_CLUSTER"; then
  run systemctl restart "postgresql@$PG_MAJOR-$PG_CLUSTER"
else
  ok "PostgreSQL configuration unchanged; not restarting"
fi
if [[ "$DRY_RUN" != 1 ]]; then
  for _ in $(seq 1 20); do pg_super -d postgres -c 'SELECT 1' >/dev/null 2>&1 && break; sleep 1; done
  pg_super -d postgres <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$PG_ROLE') THEN CREATE ROLE $PG_ROLE LOGIN; END IF;
END \$\$;
SQL
  if [[ -z "$(pg_super -d postgres -tA -c "SELECT 1 FROM pg_database WHERE datname = '$PG_DB'")" ]]; then
    pg_super -d postgres -c "CREATE DATABASE $PG_DB OWNER $PG_ROLE ENCODING 'UTF8' TEMPLATE template0 LC_COLLATE 'C.UTF-8' LC_CTYPE 'C.UTF-8'"
  fi
  pg_super -d postgres -c "REVOKE ALL ON DATABASE $PG_DB FROM PUBLIC"
  ok "database $PG_DB owned by $PG_ROLE on 127.0.0.1:$PG_PORT (password is set by secrets.sh)"
else
  log "  would create role $PG_ROLE and database $PG_DB if missing"
fi

step "9/12 nginx: same-origin gateway on 127.0.0.1:$GATEWAY_PORT only"
INSTALL_CHANGED=0
if [[ -L /etc/nginx/sites-enabled/default ]]; then run rm -f /etc/nginx/sites-enabled/default; INSTALL_CHANGED=1; fi
install_template nginx/fancy-security-headers.conf /etc/nginx/snippets/fancy-security-headers.conf 0644 root:root
install_template nginx/fancy.conf /etc/nginx/sites-available/fancy.conf 0644 root:root
if [[ "$(readlink /etc/nginx/sites-enabled/fancy.conf 2>/dev/null || true)" != /etc/nginx/sites-available/fancy.conf ]]; then
  run ln -sfn /etc/nginx/sites-available/fancy.conf /etc/nginx/sites-enabled/fancy.conf
  INSTALL_CHANGED=1
fi
run install -d -m 0755 -o root -g root "$FANCY_ROOT/placeholder/site"
if [[ "$DRY_RUN" != 1 && ! -e "$FANCY_CURRENT" ]]; then
  printf '<!doctype html><title>Fancy</title><p>Fancy is getting ready.</p>\n' >"$FANCY_ROOT/placeholder/site/index.html"
  ln -sfn "$FANCY_ROOT/placeholder" "$FANCY_CURRENT"
fi
run nginx -t
run systemctl enable nginx
if ! systemctl is-active --quiet nginx; then
  run systemctl start nginx
elif [[ "$INSTALL_CHANGED" == 1 ]]; then
  run systemctl reload nginx
fi
if [[ "$DRY_RUN" != 1 ]]; then
  if ss -Hltn | awk '{print $4}' | grep -Eq '^(0\.0\.0\.0|\*|\[::\]):80$'; then die "something listens on public port 80 after nginx start; inspect /etc/nginx"; fi
  ok "nginx listens on 127.0.0.1:$GATEWAY_PORT only"
fi

step "10/12 Logs: private journal namespace, log rotation (${LOG_RETENTION_DAYS} days)"
install_template journald/journald@fancy.conf /etc/systemd/journald@fancy.conf 0644 root:root
install_template logrotate/fancy /etc/logrotate.d/fancy 0644 root:root

step "11/12 Unattended security updates (no automatic reboot)"
printf 'APT::Periodic::Update-Package-Lists "1";\nAPT::Periodic::Unattended-Upgrade "1";\n' \
  | install_content /etc/apt/apt.conf.d/20auto-upgrades 0644 root:root
install_template apt/52fancy-unattended-upgrades /etc/apt/apt.conf.d/52fancy-unattended-upgrades 0644 root:root

step "12/12 systemd units and the deploy kit in $FANCY_KIT_DIR"
for unit in fancy-api.service fancy-worker.service fancy-tunnel.service fancy-backup.service fancy-backup.timer \
            fancy-ledger.service fancy-ledger.timer fancy-healthcheck.service fancy-healthcheck.timer; do
  install_template "systemd/$unit" "/etc/systemd/system/$unit" 0644 root:root
done
run systemctl daemon-reload
if [[ "$KIT_DIR" != "$FANCY_KIT_DIR" ]]; then
  run install -d -m 0755 -o root -g root "$FANCY_KIT_DIR"
  run rsync -a --delete --chown=root:root --chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r "$KIT_DIR/" "$FANCY_KIT_DIR/"
  run find "$FANCY_KIT_DIR" -maxdepth 1 -name '*.sh' -exec chmod 0755 {} +
fi

step "Bootstrap complete"
log "  Next (see docs/operations/seoul-production-deploy.zh-CN.md):"
log "    owner:  sudo $FANCY_KIT_DIR/tunnel.sh login        (Cloudflare authorisation in her browser)"
log "    owner:  sudo $FANCY_KIT_DIR/secrets.sh             (types secrets; never in chat)"
log "    session: sudo $FANCY_KIT_DIR/deploy.sh --ref main  (build, migrate, switch)"
