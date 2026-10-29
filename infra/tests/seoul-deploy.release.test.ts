import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer, type RequestListener, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONFIG_KEYS, loadConfig } from '../../packages/config/src/index.ts';

// Static checks for the Seoul production deploy kit (infra/deploy/seoul). The kit runs on a
// shared server whose public 443 belongs to the owner's proxy, so these tests pin the safety
// rules as well as syntax and configuration coverage.
const ROOT = join(import.meta.dirname, '../..');
const KIT = join(ROOT, 'infra/deploy/seoul');
const RUNBOOK = join(ROOT, 'docs/operations/seoul-production-deploy.zh-CN.md');
const read = (path: string) => readFileSync(path, 'utf8');
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
const files = walk(KIT);
const scripts = files.filter((f) => f.endsWith('.sh'));
const entryScripts = scripts.filter((f) => !f.endsWith('/lib.sh'));
const bash = (args: string[], cwd = KIT) => spawnSync('bash', args, { cwd, encoding: 'utf8' });
const deployConf = Object.fromEntries(
  [...read(join(KIT, 'deploy.conf')).matchAll(/^([A-Z_]+)=(.*)$/gm)].map((m) => [m[1], m[2]]),
);

/** Parse KEY=<value|@directive> lines of an env template. */
function templateEntries(file: string): [string, string][] {
  return [...read(file).matchAll(/^([A-Z][A-Z0-9_]*)=(.*)$/gm)].map((m) => [m[1]!, m[2]!]);
}

describe('Seoul deploy kit: scripts', () => {
  it('has the expected entry points', () => {
    const names = entryScripts.map((f) => relative(KIT, f)).sort();
    expect(names).toEqual([
      'backup.sh', 'bootstrap.sh', 'deploy.sh', 'healthcheck.sh', 'migrate.sh', 'release.sh',
      'restore-drill.sh', 'rollback.sh', 'secrets.sh', 'switch.sh', 'tunnel.sh',
    ]);
  });

  it.each(scripts.map((f) => [relative(KIT, f), f]))('%s passes bash -n', (_name, file) => {
    const result = bash(['-n', file]);
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
  });

  it.each(entryScripts.map((f) => [relative(KIT, f), f]))('%s is strict, executable, dry-run capable and announces steps', (_name, file) => {
    const text = read(file);
    expect(text.startsWith('#!/usr/bin/env bash\n')).toBe(true);
    expect(text).toMatch(/^\. "\$\(dirname "\$\{BASH_SOURCE\[0\]\}"\)\/lib\.sh"$/m);
    expect(text).toContain('parse_common_flags "$@"');
    expect(text).toMatch(/\bstep "/);
    expect(statSync(file).mode & 0o111).not.toBe(0);
  });

  it('lib.sh sets strict mode and implements --dry-run in run()', () => {
    const lib = read(join(KIT, 'lib.sh'));
    expect(lib).toMatch(/^set -euo pipefail$/m);
    expect(lib).toContain('--dry-run) DRY_RUN=1');
    expect(lib).toMatch(/run\(\) \{[\s\S]*?if \[\[ "\$DRY_RUN" == 1 \]\]; then return 0; fi/);
  });

  const shellcheck = process.env.FANCY_SHELLCHECK ?? 'shellcheck';
  const hasShellcheck = spawnSync(shellcheck, ['--version'], { encoding: 'utf8' }).status === 0;
  it.skipIf(!hasShellcheck)('passes shellcheck', () => {
    const result = spawnSync(shellcheck, ['-x', ...scripts.map((f) => relative(KIT, f))], { cwd: KIT, encoding: 'utf8' });
    expect(result.stdout + result.stderr).toBe('');
    expect(result.status).toBe(0);
  });
});

describe('Seoul deploy kit: the owner proxy and public ports are never touched', () => {
  const lines = files.flatMap((file) =>
    read(file).split('\n').map((line, i) => ({ where: `${relative(KIT, file)}:${i + 1}`, line })),
  );

  it('mentions port 443 only in read-only guard checks', () => {
    const offending = lines.filter(({ line }) => /\b443\b/.test(line) && !line.includes('guard:read-only'));
    expect(offending).toEqual([]);
    const guards = lines.filter(({ line }) => line.includes('guard:read-only'));
    expect(guards.length).toBeGreaterThan(0);
    for (const { line } of guards) expect(line).toMatch(/\bss -H?ltnp? '?sport = :443'?/);
  });

  it('never stops, restarts, signals, removes or reconfigures ss-server', () => {
    const mutating = /\b(systemctl\s+(stop|start|restart|reload|disable|enable|mask|kill)|kill\b|pkill|killall|apt-get\s+(remove|purge|install)|rm\s|chmod|chown|mv\s)/;
    const offending = lines.filter(({ line }) => /ss-server|shadowsocks/i.test(line) && mutating.test(line));
    expect(offending).toEqual([]);
  });

  it('contains no firewall changes or process killing', () => {
    const offending = lines.filter(({ line }) => /\b(ufw|iptables|nft|pkill|killall)\b|\bkill\s+-/.test(line));
    expect(offending).toEqual([]);
  });

  it('only manages its own systemd units', () => {
    const allowed = /^(fancy-[a-z-]+(\.service|\.timer)?|\$(WEB_)?CANDIDATE\.service|nginx|postgresql@\$PG_MAJOR-\$PG_CLUSTER|daemon-reload)$/;
    const verbs = /\bsystemctl\s+(start|stop|restart|reload|enable|disable|mask|unmask|reset-failed|daemon-reload)\b([^;|&)]*)/g;
    const offending: string[] = [];
    for (const { where, line } of lines) {
      for (const match of line.matchAll(verbs)) {
        const units = (match[2] ?? '').trim().split(/\s+/).filter((t) => t && !t.startsWith('-') && !t.startsWith('||'));
        const tokens = match[1] === 'daemon-reload' ? [] : units.map((t) => t.replace(/["']/g, ''));
        if (match[1] !== 'daemon-reload' && tokens.length === 0) offending.push(`${where}: ${line.trim()}`);
        for (const token of tokens) if (!allowed.test(token)) offending.push(`${where}: ${token}`);
      }
    }
    expect(offending).toEqual([]);
  });

  it('binds only loopback: nginx, PostgreSQL and the tunnel origin', () => {
    const nginx = read(join(KIT, 'templates/nginx/fancy.conf'));
    const listens = [...nginx.matchAll(/^\s*listen\s+([^;]+);/gm)].map((m) => m[1]);
    expect(listens).toEqual(['127.0.0.1:@@GATEWAY_PORT@@ default_server']);
    expect(read(join(KIT, 'templates/postgresql/fancy.conf'))).toMatch(/^listen_addresses = '127\.0\.0\.1'$/m);
    const services = [...read(join(KIT, 'templates/cloudflared/fancy.yml')).matchAll(/service:\s*(\S+)/g)].map((m) => m[1]);
    for (const service of services) expect(service).toMatch(/^(http:\/\/127\.0\.0\.1:@@GATEWAY_PORT@@|http_status:404)$/);
    const ports = ['PG_PORT', 'API_PORT', 'API_CANDIDATE_PORT', 'WEB_PORT', 'WEB_CANDIDATE_PORT', 'GATEWAY_PORT', 'TUNNEL_METRICS_PORT'];
    for (const port of ports) {
      expect(deployConf[port], port).toMatch(/^\d+$/);
      expect(['22', '443', '53', '3000', '5174', '5175', '5432', '8388', '18741', '18742', '45845']).not.toContain(deployConf[port]);
    }
    expect(new Set(ports.map((port) => deployConf[port])).size).toBe(ports.length);
  });

  it('blocks package scripts from (re)starting services during bootstrap', () => {
    const bootstrap = read(join(KIT, 'bootstrap.sh'));
    expect(bootstrap).toContain('exit 101');
    expect(bootstrap).toContain("add_exit_hook 'rm -f /usr/sbin/policy-rc.d'");
    expect(bootstrap).toContain('NEEDRESTART_MODE=l');
    expect(bootstrap).toContain('$nrconf{override_rc}{qr(^ss-server)} = 0;');
  });
});

describe('Seoul deploy kit: production configuration coverage', () => {
  const template = templateEntries(join(KIT, 'fancy.env.template'));
  const keys = template.map(([key]) => key);
  const OPTIONAL_EXTRA = ['ETHAN_MODERATION_URL', 'ETHAN_MODERATION_TOKEN'];

  it('lists every key read by packages/config (PORT is owned by the systemd units)', () => {
    const missing = CONFIG_KEYS.filter((key) => key !== 'PORT' && !keys.includes(key));
    expect(missing).toEqual([]);
    expect(keys).not.toContain('PORT');
    expect(read(join(KIT, 'templates/systemd/fancy-api.service'))).toContain('Environment=PORT=@@API_PORT@@');
    expect(keys.filter((key) => !(CONFIG_KEYS as readonly string[]).includes(key) && !OPTIONAL_EXTRA.includes(key))).toEqual([]);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('uses only directives secrets.sh understands', () => {
    const secrets = read(join(KIT, 'secrets.sh'));
    for (const [, spec] of [...template, ...templateEntries(join(KIT, 'web-build.env.template'))]) {
      if (spec.startsWith('@')) expect(secrets).toContain(spec === '@ask' || spec === '@secret' || spec.endsWith('-optional') ? '@ask|@ask-optional|@secret|@secret-optional)' : `${spec})`);
    }
  });

  it('filled with the values secrets.sh generates or asks for, passes the production guard', () => {
    const secrets = read(join(KIT, 'secrets.sh'));
    expect(secrets).toContain('postgresql://$PG_ROLE:$pw@127.0.0.1:$PG_PORT/$PG_DB?sslmode=verify-full&sslrootcert=$FANCY_PG_CA');
    const asked: Record<string, string> = {
      AUTH0_DOMAIN: 'fancy.uk.auth0.com',
      AUTH0_CLIENT_ID: 'client-id-example',
      AUTH0_CLIENT_SECRET: 'client-secret-example',
      AUTH0_MANAGEMENT_CLIENT_ID: 'management-id-example',
      AUTH0_MANAGEMENT_CLIENT_SECRET: 'management-secret-example',
      GOOGLE_MAPS_API_KEY: 'places-server-key-example',
      RESEND_API_KEY: 're_example_key',
      RESEND_WEBHOOK_SECRET: `whsec_${randomBytes(32).toString('base64')}`,
      PRIVACY_POLICY_VERSION: '2026-11-15',
      RETENTION_POLICY_JSON: '{"accountDeletionApproved":true,"deletionReceiptDays":30}',
      SUPPORT_EMAIL: 'support@example.invalid',
      ETHAN_MODERATION_URL: 'https://ethan.example.invalid/fancy/moderation',
      ETHAN_MODERATION_TOKEN: 't'.repeat(24),
      ANALYTICS_COVERAGE_START: '2026-01-01T00:00:00Z',
    };
    const env: Record<string, string> = {};
    for (const [key, spec] of template) {
      if (spec === '@unset') continue;
      if (spec === '@generate') env[key] = randomBytes(32).toString('hex');
      else if (spec === '@database') env[key] = `postgresql://${deployConf.PG_ROLE}:${randomBytes(24).toString('hex')}@127.0.0.1:${deployConf.PG_PORT}/${deployConf.PG_DB}?sslmode=verify-full&sslrootcert=${deployConf.FANCY_PG_CA}`;
      else if (spec === '@deletion-keyring') {
        env.DELETION_MAIL_KEY_VERSION = 'v1';
        env.DELETION_MAIL_KEYS_JSON = JSON.stringify({ v1: randomBytes(32).toString('base64') });
      } else if (spec.startsWith('@')) {
        expect(asked[key], `example value for ${key}`).toBeDefined();
        env[key] = asked[key]!;
      } else env[key] = spec;
    }
    const config = loadConfig({ ...env, PORT: deployConf.API_PORT });
    expect(config.environment).toBe('production');
    expect(config.adapters).toEqual({ AUTH_ADAPTER: 'auth0', PLACES_ADAPTER: 'google', MAIL_ADAPTER: 'provider', AI_PROVIDER: 'disabled' });
    expect(config.webOrigin).toBe('https://fancyabite.uk');
    expect(config.adminUrl).toBe('https://fancyabite.uk/admin/');
    expect(config.devFixedOtp).toBeNull();
    expect(config.resend?.from).toBe('Fancy <noreply@mail.fancyabite.uk>');
    expect(config.trustedProxyCidrs).toEqual(['127.0.0.1']);
    expect(config.port).toBe(Number(deployConf.API_PORT));
    // Required asks really are required by the guard or by launch.
    for (const key of ['AUTH0_CLIENT_SECRET', 'PRIVACY_POLICY_VERSION', 'RETENTION_POLICY_JSON']) {
      const rest = { ...env };
      delete rest[key];
      expect(() => loadConfig(rest)).toThrow();
    }
  });

  it('keeps test-only switches out of production', () => {
    const spec = Object.fromEntries(template);
    expect(spec.DEV_FIXED_OTP).toBe('@unset');
    for (const key of ['AUTH_ADAPTER', 'PLACES_ADAPTER', 'MAIL_ADAPTER', 'AI_PROVIDER']) {
      expect(['test', 'fixture', 'outbox_test', 'mock']).not.toContain(spec[key]);
    }
  });

  it('documents every variable in the runbook', () => {
    const runbook = read(RUNBOOK);
    for (const key of [...keys, 'PORT', 'HOST', 'FANCY_API_ORIGIN', 'FANCY_PUBLIC_ORIGIN', 'VITE_PUBLIC_GOOGLE_MAPS_KEY', 'VITE_PUBLIC_GOOGLE_MAPS_ID', 'EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY']) {
      expect(runbook, key).toContain(`\`${key}\``);
    }
  });
});

describe('Seoul deploy kit: templates and release layout', () => {
  const templates = walk(join(KIT, 'templates'));

  it.each(templates.map((f) => [relative(KIT, f), f]))('%s renders without unresolved placeholders', (name, file) => {
    const extra = name.startsWith('templates/cloudflared/') ? ['TUNNEL_ID=00000000-0000-0000-0000-000000000000'] : [];
    const result = bash(['-c', '. ./lib.sh && render_template "$@"', 'render', file, ...extra]);
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.stdout).not.toMatch(/@@[A-Z_]+@@/);
  });

  it('builds the site layout nginx serves, from paths that exist', () => {
    const release = read(join(KIT, 'release.sh'));
    const archived = release.match(/package\.json pnpm-lock\.yaml pnpm-workspace\.yaml tsconfig\.base\.json apps packages infra/)![0].split(' ');
    for (const path of archived) expect(statSync(join(ROOT, path))).toBeTruthy();
    expect(release).toContain('vite build --base=/admin/');
    expect(release).toContain('cp -a apps/admin/dist/. site/admin/');
    expect(read(join(KIT, 'templates/nginx/fancy.conf'))).toContain('root @@FANCY_CURRENT@@/site;');
    for (const page of ['privacy', 'terms', 'guidelines', 'support']) {
      expect(statSync(join(ROOT, 'apps/web/public', page, 'index.html')).isFile()).toBe(true);
      expect(release).toContain(`site/${page}/index.html`);
    }
  });

  it('keeps secrets out of systemd units and the repository templates', () => {
    for (const file of templates) {
      expect(read(file)).not.toMatch(/(SECRET|API_KEY|PASSWORD)=\S/);
    }
    for (const unit of ['fancy-api.service', 'fancy-worker.service']) {
      const text = read(join(KIT, 'templates/systemd', unit));
      expect(text).toContain('EnvironmentFile=@@FANCY_ENV_FILE@@');
      expect(text).toContain('User=@@FANCY_USER@@');
      expect(text).toContain('NoNewPrivileges=yes');
    }
    // The Web page-head server reads only public API responses: it never gets the secrets.
    const web = read(join(KIT, 'templates/systemd/fancy-web.service'));
    expect(web).not.toMatch(/^EnvironmentFile=/m);
    expect(web).toContain('User=@@FANCY_USER@@');
    expect(web).toContain('NoNewPrivileges=yes');
    expect(deployConf.FANCY_ENV_FILE).toBe('/etc/fancy/fancy.env');
    expect(read(join(KIT, 'secrets.sh'))).toContain('chmod 0600 "$tmp"');
  });

  it('keeps backup retention aligned with the policy placeholders', () => {
    const policies = read(join(ROOT, 'docs/policies/README.md'));
    expect(policies).toContain('{{BACKUP_RETENTION}}');
    expect(policies).toContain('{{LOG_RETENTION}}');
    const runbook = read(RUNBOOK);
    expect(runbook).toContain(`${deployConf.BACKUP_RETENTION_DAYS} 天`);
    expect(runbook).toContain(`${deployConf.LOG_RETENTION_DAYS} 天`);
  });
});

describe('Seoul deploy kit: Web page-head server (apps/web/server/serve.ts)', () => {
  const serve = read(join(ROOT, 'apps/web/server/serve.ts'));
  const unit = read(join(KIT, 'templates/systemd/fancy-web.service'));
  const nginx = read(join(KIT, 'templates/nginx/fancy.conf'));
  const proxy = read(join(KIT, 'templates/nginx/fancy-web-proxy.conf'));
  const lib = read(join(KIT, 'lib.sh'));
  const switchSh = read(join(KIT, 'switch.sh'));
  const serveEnv = [...new Set([...serve.matchAll(/process\.env\.([A-Z_]+)/g)].map((m) => m[1]!))].sort();

  it('serve.ts can be bound to loopback and reads only the variables the kit sets', () => {
    expect(serve).toMatch(/\.listen\(PORT, HOST,/);
    expect(serveEnv).toEqual(['FANCY_API_ORIGIN', 'FANCY_PUBLIC_ORIGIN', 'HOST', 'PORT']);
  });

  it('runs as a loopback systemd service reading the live API, with every variable set', () => {
    expect(unit).toContain('ExecStart=@@NODE_DIR@@/bin/node apps/web/server/serve.ts');
    expect(unit).toContain('WorkingDirectory=@@FANCY_CURRENT@@');
    expect(unit).toContain('Environment=HOST=127.0.0.1');
    expect(unit).toContain('Environment=PORT=@@WEB_PORT@@');
    expect(unit).toContain('Environment=FANCY_API_ORIGIN=http://127.0.0.1:@@API_PORT@@');
    expect(unit).toContain('Environment=FANCY_PUBLIC_ORIGIN=https://@@PUBLIC_HOSTNAME@@');
    for (const key of serveEnv) expect(unit, key).toMatch(new RegExp(`^Environment=${key}=`, 'm'));
  });

  it('only needs files the release keeps: its relative imports exist and dist stays in place', () => {
    const imports = [...serve.matchAll(/^import [^'"]*from '(\.{1,2}\/[^']+)'/gm)].map((m) => m[1]!);
    expect(imports.length).toBeGreaterThan(0);
    for (const path of imports) {
      const target = join(ROOT, 'apps/web/server', path);
      expect(statSync(target).isFile(), path).toBe(true);
      expect(relative(ROOT, target)).toMatch(/^(apps|packages)\//);
      // @fancy/* imports must be type-only so Node runs these files without a bundler.
      expect(read(target)).not.toMatch(/^import (?!type )[^'"]*from '@fancy\//m);
    }
    expect(serve).toContain("new URL('../dist', import.meta.url)");
    const release = read(join(KIT, 'release.sh'));
    expect(release).toContain('cp -a apps/web/dist/. site/');
    expect(release).not.toMatch(/rm -rf[^\n]*apps\/web\/dist/);
    expect(release).toContain('await import(\\"./apps/web/server/serve.ts\\")');
  });

  it('nginx sends HTML navigations to it and keeps serving static files and the legal pages itself', () => {
    expect(proxy).toMatch(/^proxy_pass http:\/\/127\.0\.0\.1:@@WEB_PORT@@;$/m);
    expect(proxy).toContain('proxy_set_header X-Forwarded-For $fancy_client_ip;');
    expect(proxy).toContain('include snippets/fancy-security-headers.conf;');
    expect(proxy).toContain('error_page 502 504 = @spa;');
    expect(nginx).toMatch(/location \/ \{[^}]*try_files \$uri \$uri\/index\.html @web;/);
    expect(nginx).toMatch(/location = \/ \{\s*include snippets\/fancy-web-proxy\.conf;\s*\}/);
    expect(nginx).toMatch(/location @web \{\s*include snippets\/fancy-web-proxy\.conf;\s*\}/);
    expect(nginx).toMatch(/location @spa \{[^}]*try_files \/index\.html =404;/);
    expect(nginx).toMatch(/location \/assets\/ \{[^}]*try_files \$uri =404;/);
    expect(nginx).toMatch(/location \/admin\/ \{[^}]*try_files \$uri \/admin\/index\.html;/);
    expect(nginx).toMatch(/location \/v1\/ \{[^}]*proxy_pass http:\/\/127\.0\.0\.1:@@API_PORT@@;/);
    expect(nginx).toContain('absolute_redirect off;');
  });

  it('is installed by bootstrap and covered by candidate, switch, rollback and health checks', () => {
    const bootstrap = read(join(KIT, 'bootstrap.sh'));
    expect(bootstrap).toMatch(/for unit in [^;]*\bfancy-web\.service\b/);
    expect(bootstrap).toContain('install_template nginx/fancy-web-proxy.conf /etc/nginx/snippets/fancy-web-proxy.conf');
    expect(bootstrap).toContain('require_port_free_or_ours "$WEB_PORT" node');
    expect(bootstrap).toContain('require_port_free_or_ours "$WEB_CANDIDATE_PORT" node');
    expect(lib).toContain('"WEB_PORT=$WEB_PORT"');
    // Candidate: the release's own serve.ts, reading the candidate API, must write the page head.
    expect(switchSh).toMatch(/--unit="\$WEB_CANDIDATE"[\s\S]*-E PORT="\$WEB_CANDIDATE_PORT" -E FANCY_API_ORIGIN="http:\/\/127\.0\.0\.1:\$API_CANDIDATE_PORT"[\s\S]*apps\/web\/server\/serve\.ts/);
    for (const key of serveEnv) expect(switchSh, key).toContain(`-E ${key}=`);
    expect(switchSh).toContain('serves_page_head "http://127.0.0.1:$WEB_CANDIDATE_PORT/"');
    // activate_release is shared by switch.sh (including its automatic rollback) and rollback.sh.
    const activate = lib.match(/activate_release\(\) \{[\s\S]*?\n\}/)![0];
    expect(activate).toContain('run systemctl restart fancy-web');
    expect(activate).toContain('serves_page_head "http://127.0.0.1:$GATEWAY_PORT/"');
    expect(activate).toContain('release_has_web_server "$rel"');
    expect(read(join(KIT, 'rollback.sh'))).toContain('activate_release "$TARGET"');
    const health = read(join(KIT, 'healthcheck.sh'));
    expect(health).toMatch(/for unit in [^;]*\bfancy-web\b/);
    expect(health).toContain('serves_page_head "http://127.0.0.1:$WEB_PORT/"');
  });

  it('the runbook documents the service, its ports and the routing', () => {
    const runbook = read(RUNBOOK);
    expect(runbook).toContain('fancy-web');
    expect(runbook).toContain(`${deployConf.WEB_PORT} / ${deployConf.WEB_CANDIDATE_PORT}`);
    expect(runbook).toContain('apps/web/server/serve.ts');
  });

  // Real routing check when nginx is available (FANCY_NGINX=/path/to/nginx, or nginx on PATH).
  const nginxBin = process.env.FANCY_NGINX ?? 'nginx';
  const hasNginx = spawnSync(nginxBin, ['-v'], { encoding: 'utf8' }).status === 0;
  it.skipIf(!hasNginx)('routes HTML navigations, static files and a fancy-web outage as intended (real nginx)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'fancy-nginx-'));
    const listen = (handler: RequestListener) =>
      new Promise<Server>((done) => { const server = createServer(handler).listen(0, '127.0.0.1', () => done(server)); });
    const portOf = (server: Server) => (server.address() as AddressInfo).port;
    const web = await listen((req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(`<meta property="og:site_name" content="Fancy">${req.url}`); });
    const api = await listen((_req, res) => { res.writeHead(404, { 'x-request-id': 'stub' }); res.end(); });
    const probe = await listen(() => undefined);
    const gatewayPort = portOf(probe);
    probe.close();
    const conf = join(dir, 'nginx.conf');
    try {
      const site = join(dir, 'current/site');
      for (const sub of ['assets', 'privacy', 'admin', 'images']) mkdirSync(join(site, sub), { recursive: true });
      for (const sub of ['snippets', 'logs']) mkdirSync(join(dir, sub));
      writeFileSync(join(site, 'index.html'), 'SPA SHELL');
      writeFileSync(join(site, 'assets/app.js'), 'js');
      writeFileSync(join(site, 'privacy/index.html'), 'PRIVACY');
      writeFileSync(join(site, 'admin/index.html'), 'ADMIN');
      writeFileSync(join(site, 'images/a.jpg'), 'jpg');
      writeFileSync(join(dir, 'local.conf'), `FANCY_CURRENT=${join(dir, 'current')}\nGATEWAY_PORT=${gatewayPort}\nWEB_PORT=${portOf(web)}\nAPI_PORT=${portOf(api)}\n`);
      const render = (name: string) => {
        const result = spawnSync('bash', ['-c', '. ./lib.sh && render_template "$@"', 'render', join(KIT, 'templates/nginx', name)], { cwd: KIT, encoding: 'utf8', env: { ...process.env, FANCY_LOCAL_CONF: join(dir, 'local.conf') } });
        expect(result.status, result.stderr).toBe(0);
        return result.stdout.replaceAll('/var/log/fancy/', `${dir}/logs/`);
      };
      writeFileSync(join(dir, 'fancy.conf'), render('fancy.conf'));
      writeFileSync(join(dir, 'snippets/fancy-web-proxy.conf'), render('fancy-web-proxy.conf'));
      writeFileSync(join(dir, 'snippets/fancy-security-headers.conf'), render('fancy-security-headers.conf'));
      const temp = ['client_body', 'proxy', 'fastcgi', 'uwsgi', 'scgi'].map((t) => `${t}_temp_path ${dir}/${t};`).join(' ');
      // Workers must read the 0700 temp dir: as root they run as root, otherwise as the caller.
      writeFileSync(conf, `${process.getuid?.() === 0 ? 'user root;' : ''} pid ${dir}/nginx.pid; error_log ${dir}/logs/error.log; events {} http { ${temp} include fancy.conf; }`);
      const start = spawnSync(nginxBin, ['-p', dir, '-c', conf], { encoding: 'utf8' });
      expect(start.status, start.stderr).toBe(0);
      try {
        const get = async (path: string) => {
          const res = await fetch(`http://127.0.0.1:${gatewayPort}${path}`, { redirect: 'manual' });
          return { status: res.status, body: await res.text(), location: res.headers.get('location'), frame: res.headers.get('x-frame-options') };
        };
        for (const path of ['/', '/discover', '/meals/abc/some-title', '/robots.txt', '/sitemap.xml']) {
          const res = await get(path);
          expect(res.status, path).toBe(200);
          expect(res.body, path).toBe(`<meta property="og:site_name" content="Fancy">${path}`);
          expect(res.frame, path).toBe('DENY');
        }
        expect(await get('/privacy')).toMatchObject({ status: 200, body: 'PRIVACY' });
        expect(await get('/privacy/')).toMatchObject({ status: 200, body: 'PRIVACY' });
        expect(await get('/assets/app.js')).toMatchObject({ status: 200, body: 'js' });
        expect((await get('/assets/missing.js')).status).toBe(404);
        expect(await get('/images/a.jpg')).toMatchObject({ status: 200, body: 'jpg' });
        expect(await get('/admin/reports')).toMatchObject({ status: 200, body: 'ADMIN' });
        expect(await get('/index.html')).toMatchObject({ status: 301, location: '/' });
        expect(await get('/admin')).toMatchObject({ status: 301, location: '/admin/' });
        expect((await get('/v1/anything')).status).toBe(404);
        await new Promise<void>((done) => { web.close(() => done()); web.closeAllConnections(); });
        // fancy-web down: the plain single-page app, never an error page.
        expect(await get('/discover')).toMatchObject({ status: 200, body: 'SPA SHELL' });
        expect(await get('/')).toMatchObject({ status: 200, body: 'SPA SHELL' });
        expect(await get('/privacy')).toMatchObject({ status: 200, body: 'PRIVACY' });
      } finally {
        spawnSync(nginxBin, ['-p', dir, '-c', conf, '-s', 'stop'], { encoding: 'utf8' });
      }
    } finally {
      web.close();
      api.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
