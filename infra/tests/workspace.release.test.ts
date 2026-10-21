import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONFIG_KEYS } from '../../packages/config/src/index.ts';
// @ts-expect-error plain .mjs script without type declarations
import { scan } from '../scripts/secret-scan.mjs';

const ROOT = join(import.meta.dirname, '../..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');
const node = (args: string[], env: Record<string, string> = {}) =>
  spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', env: { PATH: process.env.PATH ?? '', ...env } });

describe('workspace boundaries', () => {
  it('keeps demo/ and admin/ outside the production workspace', () => {
    const workspace = read('pnpm-workspace.yaml');
    const members = [...workspace.matchAll(/^\s+-\s+(\S+)/gm)].map((m) => m[1]);
    expect(members).toEqual(['apps/*', 'packages/*']);
  });

  it('leaves the prototype entry points and lockfiles untouched', () => {
    const protectedFiles = [
      'demo/package.json', 'demo/pnpm-lock.yaml', 'demo/package-lock.json',
      'admin/package.json', 'admin/pnpm-lock.yaml',
    ];
    const tracked = execFileSync('git', ['ls-files', ...protectedFiles], { cwd: ROOT, encoding: 'utf8' }).trim().split('\n');
    expect(tracked.sort()).toEqual([...protectedFiles].sort());
    const diff = spawnSync('git', ['diff', '--quiet', 'HEAD', '--', ...protectedFiles], { cwd: ROOT });
    expect(diff.status).toBe(0);
  });

  it('wires every core script to a real test layer or a failing placeholder', () => {
    const scripts: Record<string, string> = JSON.parse(read('package.json')).scripts;
    for (const [name, command] of Object.entries(scripts)) {
      expect(command, name).not.toMatch(/passWithNoTests|\|\|\s*true|exit 0/);
    }
    for (const layer of ['unit', 'db', 'release']) expect(scripts[`core:test:${layer}`]).toBe(`vitest run --project ${layer}`);
    for (const layer of ['api', 'web', 'ios']) expect(scripts[`core:test:${layer}`]).toMatch(/^node infra\/scripts\/not-implemented\.mjs /);
  });

  it('fails unimplemented test layers instead of reporting success', () => {
    const result = node(['infra/scripts/not-implemented.mjs', 'core:test:web', 'T05']);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('refusing to report success');
  });
});

describe('environment template and secrets', () => {
  it('lists exactly the configuration keys with no values', () => {
    const lines = read('.env.example').split('\n').filter((l) => l && !l.startsWith('#'));
    expect(lines).toEqual(CONFIG_KEYS.map((key) => `${key}=`));
  });

  it('detects planted credentials and passes on the repository', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fancy-scan-'));
    try {
      mkdirSync(join(dir, 'packages/x'), { recursive: true });
      writeFileSync(join(dir, 'packages/x/a.ts'), `const k = "${'AKIA' + 'ABCDEFGHIJKLMNOP'}";`);
      writeFileSync(join(dir, '.env.example'), 'DATABASE_URL=postgres://real\n');
      expect(scan(dir)).toEqual(['packages/x/a.ts: AWS access key', '.env.example: value present for DATABASE_URL']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
    expect(scan(ROOT)).toEqual([]);
  });
});

describe('startup preflight', () => {
  const real = {
    ENVIRONMENT: 'production',
    DATABASE_URL: 'postgres://app@db.internal/fancy?sslmode=verify-full',
    AUTH_ADAPTER: 'auth0', PLACES_ADAPTER: 'google', MAIL_ADAPTER: 'provider', AI_PROVIDER: 'disabled',
    WEB_ORIGIN: 'https://app.example.test', PRIVACY_POLICY_VERSION: 'v1', RETENTION_POLICY_JSON: '{}',
  };

  it('starts with a real production configuration', () => {
    const result = node(['packages/config/src/check-env.ts'], real);
    expect(result.stderr).toContain('configuration ok for production');
    expect(result.status).toBe(0);
  });

  it('refuses to start production with fixture places', () => {
    const result = node(['packages/config/src/check-env.ts'], { ...real, PLACES_ADAPTER: 'fixture' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('PLACES_ADAPTER=fixture is test-only and refused in production');
  });
});
