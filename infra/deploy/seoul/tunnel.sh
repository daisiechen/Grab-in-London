#!/usr/bin/env bash
# Cloudflare Tunnel for fancyabite.uk (locally managed; outbound only, no inbound port).
#
#   sudo tunnel.sh login         OWNER: prints a Cloudflare URL; she opens it and authorises
#                                the fancyabite.uk zone. Writes /root/.cloudflared/cert.pem.
#   sudo tunnel.sh create        create (or reuse) the tunnel; credentials stay on the server
#   sudo tunnel.sh route         CNAME fancyabite.uk and www.fancyabite.uk to the tunnel
#   sudo tunnel.sh install       write /etc/cloudflared/fancy.yml, validate, start fancy-tunnel
#   sudo tunnel.sh forget-login  delete cert.pem (account-level credential) once routed
#   sudo tunnel.sh status
# All subcommands accept --dry-run.
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
parse_common_flags "$@"
set -- "${REST_ARGS[@]}"
require_root
export HOME=/root # cloudflared keeps cert.pem and new credentials under $HOME/.cloudflared
TUNNEL_NAME="${TUNNEL_NAME:-fancy-prod}"
ORIGIN_CERT=/root/.cloudflared/cert.pem
CF=(cloudflared --no-autoupdate)

tunnel_id() {
  "${CF[@]}" tunnel --origincert "$ORIGIN_CERT" list --output json 2>/dev/null \
    | jq -r --arg n "$TUNNEL_NAME" '[.[] | select(.name == $n and (.deleted_at == null or .deleted_at == "0001-01-01T00:00:00Z"))][0].id // empty'
}

configured_id() {
  sed -n 's/^tunnel: *//p' /etc/cloudflared/fancy.yml 2>/dev/null | head -n1 || true
}

case "${1:-}" in
  login)
    step "Cloudflare login (owner authorises in her browser)"
    if [[ -s "$ORIGIN_CERT" ]]; then ok "$ORIGIN_CERT already present"; exit 0; fi
    log "  A URL will be printed. The owner opens it on her Mac, signs in to Cloudflare and"
    log "  selects the zone fancyabite.uk. This command waits until she has done so."
    run "${CF[@]}" tunnel login
    ;;
  create)
    step "Create or reuse tunnel '$TUNNEL_NAME'"
    [[ -s "$ORIGIN_CERT" || "$DRY_RUN" == 1 ]] || die "run 'tunnel.sh login' first (owner step)"
    id="$(tunnel_id || true)"
    if [[ -z "$id" ]]; then
      run "${CF[@]}" tunnel --origincert "$ORIGIN_CERT" create "$TUNNEL_NAME"
      id="$(tunnel_id || true)"
    else
      ok "tunnel exists: $id"
    fi
    [[ -n "$id" || "$DRY_RUN" == 1 ]] || die "tunnel id not found after create"
    if [[ -n "$id" && ! -s "/etc/cloudflared/$id.json" ]]; then
      [[ -s "/root/.cloudflared/$id.json" ]] || die "credentials for $id are not on this server; delete the tunnel in the Cloudflare dashboard and run create again"
      run install -m 0400 -o fancy-tunnel -g fancy-tunnel "/root/.cloudflared/$id.json" "/etc/cloudflared/$id.json"
      run rm -f "/root/.cloudflared/$id.json"
    fi
    ok "credentials: /etc/cloudflared/${id:-<id>}.json (0400, fancy-tunnel)"
    ;;
  route)
    step "DNS: $PUBLIC_HOSTNAME and www.$PUBLIC_HOSTNAME -> tunnel '$TUNNEL_NAME'"
    log "  If Cloudflare reports an existing record, the owner removes the old apex/www record"
    log "  in the dashboard first (mail.$PUBLIC_HOSTNAME records for Resend are not affected)."
    run "${CF[@]}" tunnel --origincert "$ORIGIN_CERT" route dns "$TUNNEL_NAME" "$PUBLIC_HOSTNAME"
    run "${CF[@]}" tunnel --origincert "$ORIGIN_CERT" route dns "$TUNNEL_NAME" "www.$PUBLIC_HOSTNAME"
    ;;
  install)
    step "Install tunnel configuration and start fancy-tunnel"
    id="$(configured_id)"
    if [[ -z "$id" ]]; then id="$(find /etc/cloudflared -maxdepth 1 -name '*-*-*-*-*.json' -printf '%f\n' 2>/dev/null | head -n1 | sed 's/\.json$//' || true)"; fi
    [[ -n "$id" || "$DRY_RUN" == 1 ]] || die "no tunnel credentials in /etc/cloudflared; run create first"
    id="${id:-00000000-0000-0000-0000-000000000000}"
    install_template cloudflared/fancy.yml /etc/cloudflared/fancy.yml 0640 root:fancy-tunnel "TUNNEL_ID=$id"
    run cloudflared --config /etc/cloudflared/fancy.yml tunnel ingress validate
    run systemctl enable fancy-tunnel
    if [[ "$INSTALL_CHANGED" == 1 ]] || ! systemctl is-active --quiet fancy-tunnel; then run systemctl restart fancy-tunnel; fi
    if [[ "$DRY_RUN" != 1 ]]; then
      wait_http_ok "http://127.0.0.1:$TUNNEL_METRICS_PORT/ready" 30 || die "tunnel not ready; see: journalctl --namespace=fancy -u fancy-tunnel"
      ok "tunnel connected"
    fi
    ;;
  forget-login)
    step "Remove the account-level origin certificate"
    log "  The tunnel keeps running on its own credentials; login is needed again only to"
    log "  create tunnels or DNS routes."
    if [[ -e "$ORIGIN_CERT" ]]; then run rm -f "$ORIGIN_CERT"; else ok "already removed"; fi
    ;;
  status)
    step "Tunnel status"
    log "  configured tunnel id: $(configured_id || true)"
    systemctl --no-pager --lines=0 status fancy-tunnel || true
    if curl -fsS --max-time 3 "http://127.0.0.1:$TUNNEL_METRICS_PORT/ready"; then echo; else warn "metrics endpoint not ready"; fi
    ;;
  *)
    die "usage: tunnel.sh login|create|route|install|forget-login|status [--dry-run]"
    ;;
esac
