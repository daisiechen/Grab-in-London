import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
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
    const allowed = /^(fancy-[a-z-]+(\.service|\.timer)?|\$CANDIDATE\.service|nginx|postgresql@\$PG_MAJOR-\$PG_CLUSTER|daemon-reload)$/;
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
    for (const port of ['PG_PORT', 'API_PORT', 'API_CANDIDATE_PORT', 'GATEWAY_PORT', 'TUNNEL_METRICS_PORT']) {
      expect(['22', '443', '53', '3000', '5174', '5175', '5432', '8388', '18741', '18742', '45845']).not.toContain(deployConf[port]);
    }
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
      ETHAN_MODERATION_URL: 'https://ethan.example.invalid/moderation',
      ETHAN_MODERATION_TOKEN: 'token-example',
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
    for (const key of [...keys, 'PORT', 'VITE_PUBLIC_GOOGLE_MAPS_KEY', 'VITE_PUBLIC_GOOGLE_MAPS_ID', 'EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY']) {
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
