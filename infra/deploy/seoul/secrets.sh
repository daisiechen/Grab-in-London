#!/usr/bin/env bash
# Production secrets and settings for Fancy. OWNER runs this in her own terminal:
#
#   ssh -t tencent-seoul sudo /opt/fancy-deploy/secrets.sh
#
# Prompts for each missing value from fancy.env.template and web-build.env.template
# (secrets with echo off), generates SESSION_SECRET, the database password and the deletion
# mail key ring on the server, and asks for the backup encryption public key. Values are
# written to root-owned 0600 files and are never printed, logged or sent anywhere.
#
#   --check              non-interactive report (key names and status only); safe for the
#                        Claude session to run. Exits 1 when a required value is missing.
#   --reset KEY[,KEY]    ask again for these keys (e.g. after rotating a credential)
#   --import FILE        offer values from an existing dotenv file (e.g. the development
#                        .env) for missing keys, one confirmation per key, values not shown
#   --dry-run            show what would be asked/generated; writes nothing
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
parse_common_flags "$@"
set -- "${REST_ARGS[@]}"
CHECK_ONLY=0; RESET=","; IMPORT_FILE=""
while (($#)); do
  case "$1" in
    --check) CHECK_ONLY=1 ;;
    --reset) RESET=",${2:?--reset needs KEY[,KEY]},"; shift ;;
    --import) IMPORT_FILE="$(abs_path "${2:?--import needs a file}")"; shift ;;
    *) die "unknown argument: $1" ;;
  esac
  shift
done
require_root

ENV_TEMPLATE="$KIT_DIR/fancy.env.template"
WEB_TEMPLATE="$KIT_DIR/web-build.env.template"
MISSING=0

# --- file helpers ------------------------------------------------------------------------
declare -A CUR=() IMPORTED=()
load_env_file() { # file -> CUR
  CUR=()
  [[ -r "$1" ]] || return 0
  local line key val
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^([A-Z][A-Z0-9_]*)=(.*)$ ]] || continue
    key="${BASH_REMATCH[1]}"; val="${BASH_REMATCH[2]}"
    if [[ "$val" =~ ^\'(.*)\'$ || "$val" =~ ^\"(.*)\"$ ]]; then val="${BASH_REMATCH[1]}"; fi
    CUR["$key"]="$val"
  done <"$1"
}
load_import_file() {
  [[ -n "$IMPORT_FILE" ]] || return 0
  [[ -r "$IMPORT_FILE" ]] || die "cannot read $IMPORT_FILE"
  local line key val
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line#export }"
    [[ "$line" =~ ^([A-Z][A-Z0-9_]*)=(.*)$ ]] || continue
    key="${BASH_REMATCH[1]}"; val="${BASH_REMATCH[2]}"
    if [[ "$val" =~ ^\'(.*)\'$ || "$val" =~ ^\"(.*)\"$ ]]; then val="${BASH_REMATCH[1]}"; fi
    [[ -n "$val" ]] && IMPORTED["$key"]="$val"
  done <"$IMPORT_FILE"
}
template_entries() { # file -> "KEY<TAB>SPEC" lines
  sed -nE 's/^([A-Z][A-Z0-9_]*)=(.*)$/\1\t\2/p' "$1"
}
valid_value() { # key value
  local key="$1" v="$2"
  if [[ "$v" == *"'"* || "$v" == *$'\n'* || "$v" == *$'\r'* ]]; then echo "must not contain quotes or line breaks"; return 1; fi
  case "$key" in
    RETENTION_POLICY_JSON) jq -e 'type == "object"' >/dev/null 2>&1 <<<"$v" || { echo "must be a JSON object on one line"; return 1; } ;;
    SUPPORT_EMAIL) [[ "$v" =~ ^[^[:space:]@\<\>]+@[^[:space:]@\<\>]+\.[^[:space:]@\<\>]+$ ]] || { echo "must be one email address"; return 1; } ;;
    AUTH0_DOMAIN) [[ "$v" =~ ^[a-z0-9.-]+\.auth0\.com$ || "$v" =~ ^[a-z0-9.-]+\.[a-z]{2,}$ ]] || { echo "must be a host name like tenant.uk.auth0.com"; return 1; } ;;
    PRIVACY_POLICY_VERSION) [[ "$v" =~ ^[A-Za-z0-9._-]{1,64}$ ]] || { echo "use a short version such as 2026-11-15"; return 1; } ;;
    DATABASE_URL) [[ "$v" =~ ^postgres(ql)?:// ]] || { echo "must be a postgresql:// URL"; return 1; } ;;
    ANALYTICS_COVERAGE_START)
      local at
      if [[ "$v" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z$ ]] && at="$(date -u -d "$v" +%s 2>/dev/null)" && ((at <= $(date -u +%s))); then
        :
      else
        echo "must be a past UTC instant like 2026-11-20T00:00:00Z"; return 1
      fi ;;
    *_URL) [[ "$v" =~ ^https:// ]] || { echo "must start with https://"; return 1; } ;;
  esac
  return 0
}
prompt_value() { # key kind -> prints value on stdout (prompts on the terminal)
  local key="$1" kind="$2" v reason label=""
  [[ "$kind" == *-optional ]] && label=", optional, Enter to skip"
  while true; do
    if [[ -n "${IMPORTED[$key]:-}" ]]; then
      local yn
      read -r -p "  $key: use the value from $(basename "$IMPORT_FILE")? (value not shown) [y/N] " yn </dev/tty
      if [[ "$yn" == y || "$yn" == Y ]]; then v="${IMPORTED[$key]}"; unset "IMPORTED[$key]"; else unset "IMPORTED[$key]"; continue; fi
    elif [[ "$kind" == secret* ]]; then
      read -r -s -p "  $key (hidden$label): " v </dev/tty; echo >/dev/tty
      [[ -z "$v" ]] || echo "    received ${#v} characters" >/dev/tty
    else
      read -r -p "  $key${label:+ (${label#, })}: " v </dev/tty
    fi
    if [[ -z "$v" ]]; then
      if [[ "$kind" == *-optional ]]; then printf ''; return 0; fi
      echo "    required" >/dev/tty; continue
    fi
    if reason="$(valid_value "$key" "$v")"; then printf '%s' "$v"; return 0; fi
    echo "    invalid: $reason" >/dev/tty
  done
}

# Fill NEW[] from a template, keeping existing values. Prints statuses only.
declare -A NEW=()
process_template() { # template current_file
  local template="$1" file="$2" key spec status
  load_env_file "$file"
  NEW=()
  for key in "${!CUR[@]}"; do NEW["$key"]="${CUR[$key]}"; done
  while IFS=$'\t' read -r key spec; do
    local have="${CUR[$key]:-}" reset=0
    [[ "$RESET" == *",$key,"* ]] && reset=1
    case "$spec" in
      @unset)
        if [[ -n "$have" ]]; then status="SET BUT MUST BE UNSET (removed)"; unset "NEW[$key]"; else status="unset (as required)"; fi ;;
      @generate)
        if [[ -n "$have" && $reset == 0 ]]; then status="kept"; else status="generated"; NEW["$key"]="$(openssl rand -hex 32)"; fi ;;
      @database)
        if [[ -n "$have" && $reset == 0 ]]; then status="kept"
        else
          status="generated (role password updated)"
          [[ "$CHECK_ONLY" == 1 || "$DRY_RUN" == 1 ]] && status="will be generated"
          if [[ "$CHECK_ONLY" != 1 && "$DRY_RUN" != 1 ]]; then
            local pw; pw="$(openssl rand -hex 24)"
            NEW["$key"]="postgresql://$PG_ROLE:$pw@127.0.0.1:$PG_PORT/$PG_DB?sslmode=verify-full&sslrootcert=$FANCY_PG_CA"
            DB_PASSWORD_TO_SET="$pw"
          fi
        fi ;;
      @deletion-keyring)
        if [[ -n "${CUR[DELETION_MAIL_KEY_VERSION]:-}" && -n "${CUR[DELETION_MAIL_KEYS_JSON]:-}" && $reset == 0 ]]; then status="kept"
        elif [[ "$key" == DELETION_MAIL_KEYS_JSON && -n "${KEYRING_DONE:-}" ]]; then status="generated"
        else
          status="generated"
          if [[ "$CHECK_ONLY" != 1 ]]; then
            NEW[DELETION_MAIL_KEY_VERSION]="v1"
            NEW[DELETION_MAIL_KEYS_JSON]="{\"v1\":\"$(openssl rand -base64 32)\"}"
            KEYRING_DONE=1
          fi
        fi ;;
      @ask|@ask-optional|@secret|@secret-optional)
        local kind="${spec#@}"
        if [[ -n "$have" && $reset == 0 ]]; then status="kept"
        elif [[ "$CHECK_ONLY" == 1 || "$DRY_RUN" == 1 ]]; then
          if [[ "$kind" == *-optional ]]; then status="empty (optional)"; else status="MISSING"; MISSING=1; fi
        else
          local v; v="$(prompt_value "$key" "$kind")"
          if [[ -n "$v" ]]; then NEW["$key"]="$v"; status="entered"; else unset "NEW[$key]"; status="left empty (optional)"; fi
        fi ;;
      @*) die "unknown directive $spec for $key in $template" ;;
      *)
        if [[ -n "$have" ]]; then
          status="kept"; [[ "$have" == "$spec" ]] || status="kept (differs from template default)"
        else
          status="default"; NEW["$key"]="$spec"
        fi ;;
    esac
    printf '  %-32s %s\n' "$key" "$status"
  done < <(template_entries "$template")
  if [[ -n "${NEW[PORT]:-}" ]]; then warn "PORT must not be in the env file (systemd sets it); removing"; unset "NEW[PORT]"; fi
}

write_env_file() { # template file
  local template="$1" file="$2" key tmp
  if [[ "$CHECK_ONLY" == 1 || "$DRY_RUN" == 1 ]]; then log "  (not writing $file)"; return 0; fi
  for key in "${!NEW[@]}"; do
    local reason; reason="$(valid_value "$key" "${NEW[$key]}")" || die "$key: $reason"
  done
  tmp="$(umask 077 && mktemp "$FANCY_ETC/.env.XXXXXX")"
  {
    echo "# Generated by secrets.sh on $(date -u +%Y-%m-%dT%H:%M:%SZ). Root only. Never copy into Git or chat."
    while IFS=$'\t' read -r key _; do
      [[ -n "${NEW[$key]+x}" ]] && printf "%s='%s'\n" "$key" "${NEW[$key]}"
    done < <(template_entries "$template")
    for key in "${!NEW[@]}"; do
      grep -qE "^$key=" "$template" || printf "%s='%s'\n" "$key" "${NEW[$key]}"
    done
  } >"$tmp"
  chown root:root "$tmp"; chmod 0600 "$tmp"
  mv -f "$tmp" "$file"
  ok "wrote $file (0600 root)"
}

# --- run ----------------------------------------------------------------------------------
if [[ "$CHECK_ONLY" != 1 && "$DRY_RUN" != 1 ]]; then
  [[ -t 0 ]] || die "interactive: the owner runs this in her own terminal (ssh -t ... sudo $0). The Claude session uses --check."
fi
[[ -d "$FANCY_ETC" ]] || die "$FANCY_ETC missing; run bootstrap.sh first"
load_import_file
DB_PASSWORD_TO_SET=""

step "Production environment ($FANCY_ENV_FILE)"
process_template "$ENV_TEMPLATE" "$FANCY_ENV_FILE"
# File first: if the role update then fails, `--reset DATABASE_URL` regenerates both.
write_env_file "$ENV_TEMPLATE" "$FANCY_ENV_FILE"
if [[ -n "$DB_PASSWORD_TO_SET" ]]; then
  log "  setting the password of database role $PG_ROLE (sent over the local socket, not in argv)"
  pg_super -d postgres >/dev/null <<SQL
ALTER ROLE $PG_ROLE WITH LOGIN PASSWORD '$DB_PASSWORD_TO_SET';
SQL
  DB_PASSWORD_TO_SET=""
fi

step "Web build values ($FANCY_WEB_BUILD_ENV; public browser key, not a secret but kept out of Git)"
process_template "$WEB_TEMPLATE" "$FANCY_WEB_BUILD_ENV"
write_env_file "$WEB_TEMPLATE" "$FANCY_WEB_BUILD_ENV"

step "Backup encryption public key ($FANCY_BACKUP_RECIPIENTS)"
if [[ -s "$FANCY_BACKUP_RECIPIENTS" && "$RESET" != *",BACKUP_RECIPIENT,"* ]]; then
  printf '  %-32s %s\n' BACKUP_RECIPIENT kept
elif [[ "$CHECK_ONLY" == 1 || "$DRY_RUN" == 1 ]]; then
  printf '  %-32s %s\n' BACKUP_RECIPIENT MISSING; MISSING=1
else
  log "  Paste the age PUBLIC key (starts with age1...). The private key stays with the owner"
  log "  (password manager); the server can encrypt backups but never decrypt them."
  while true; do
    read -r -p "  age public key: " recipient </dev/tty
    [[ "$recipient" =~ ^age1[0-9a-z]{58}$ ]] && break
    echo "    not an age public key"
  done
  printf '%s\n' "$recipient" | install_content "$FANCY_BACKUP_RECIPIENTS" 0644 root:root
fi

step "Verification"
rel="$(current_release_dir)"
[[ -n "$rel" && -f "$rel/packages/config/src/check-env.ts" ]] || rel="$(latest_release_dir)"
if [[ "$DRY_RUN" == 1 ]]; then
  log "  (dry run: skipped)"
elif [[ -n "$rel" && -f "$rel/packages/config/src/check-env.ts" && -s "$FANCY_ENV_FILE" ]]; then
  run_as_service "$rel" "$NODE_BIN" packages/config/src/check-env.ts || MISSING=1
  run_as_service "$rel/packages/db" "$NODE_BIN" --input-type=module -e "
    import pg from 'pg';
    const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await c.connect();
    const { rows: [r] } = await c.query('SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()');
    await c.end();
    console.warn(r?.ssl ? 'database ok: TLS verified (verify-full)' : 'database reachable WITHOUT TLS');
    process.exit(r?.ssl ? 0 : 1);" || MISSING=1
else
  log "  no release built yet: the configuration guard runs again in deploy.sh before migrating"
fi
if [[ "$MISSING" == 1 ]]; then die "required values are missing or invalid (see above)"; fi
ok "secrets complete"
