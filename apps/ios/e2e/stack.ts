/**
 * Local stack for the real-API end-to-end run (development only, never staging/production):
 * a fresh migrated PostgreSQL database, the real API process (apps/api/src/main.ts) with the
 * test-only adapters and a fixed dev OTP, the real background worker (apps/worker/src/main.ts:
 * meal lifecycle jobs, account purge), the iOS app's web export with preview mode switched off,
 * and one same-origin server that serves the export and proxies /v1 to the API (the app uses the
 * native bearer credential path, so no cookies or CORS are involved).
 *
 * The /v1 proxy behaves like a production reverse proxy: it appends the peer address to
 * X-Forwarded-For, and the API trusts exactly 127.0.0.1 through the production TRUSTED_PROXY_CIDRS
 * setting. Each simulated device (browser profile or Node actor) declares its own documentation-range
 * client address, so per-IP limits (5 OTP codes per IP per 15 minutes) apply per device exactly as in
 * production, without any limit being relaxed.
 *
 * Secrets are throwaway values generated per run and live only in the child process environment.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, request as httpRequest, type Server } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { createPool, migrate } from '../../../packages/db/src/index.ts';

export const REPO = resolve(import.meta.dirname, '../../..');
const IOS = resolve(REPO, 'apps/ios');

export interface StackOptions {
  /** Admin connection to the local PostgreSQL that may create/drop the e2e database. */
  adminUrl: string;
  database: string;
  apiPort: number;
  webPort: number;
  /** Directory of an existing `expo export -p web` build; built fresh when absent. */
  webDir: string;
  rebuildWeb: boolean;
  otp: string;
  /** false: API only (no web export or static server). */
  serveWeb?: boolean;
}

export interface Stack {
  apiUrl: string;
  webUrl: string;
  databaseUrl: string;
  stop(): Promise<void>;
}

function assertLocal(url: URL) {
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new Error('The e2e stack only runs against a local PostgreSQL');
}

export async function resetDatabase(adminUrl: string, database: string): Promise<string> {
  if (!/^fancy_e2e[a-z0-9_]*$/.test(database)) throw new Error('E2E database name must start with fancy_e2e');
  const admin = new URL(adminUrl);
  assertLocal(admin);
  const pool = createPool(admin.toString(), { max: 1, application: 'fancy-e2e-admin' });
  try {
    await pool.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
    await pool.query(`CREATE DATABASE ${database}`);
  } finally {
    await pool.end();
  }
  const url = new URL(admin.toString());
  url.pathname = `/${database}`;
  await migrate(url.toString());
  return url.toString();
}

async function waitFor(url: string, timeoutMs: number, child?: ChildProcess) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (child && child.exitCode !== null) throw new Error(`${url}: process exited with ${child.exitCode}`);
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch { /* not up yet */ }
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${url}`);
    await new Promise((r) => setTimeout(r, 250));
  }
}

function apiEnv(databaseUrl: string, opts: StackOptions, webOrigin: string, secret: string) {
  return {
    PATH: process.env.PATH ?? '',
    HOME: process.env.HOME ?? '',
    ENVIRONMENT: 'development',
    DATABASE_URL: databaseUrl,
    AUTH_ADAPTER: 'test',
    PLACES_ADAPTER: 'fixture',
    MAIL_ADAPTER: 'outbox_test',
    AI_PROVIDER: 'mock',
    DEV_FIXED_OTP: opts.otp,
    WEB_ORIGIN: webOrigin,
    SESSION_SECRET: secret,
    IOS_REDIRECT_URI: 'fancy://auth/callback',
    // Only the local /v1 proxy below is trusted to forward client addresses (production setting).
    TRUSTED_PROXY_CIDRS: '127.0.0.1',
    PORT: String(opts.apiPort),
    LOG_LEVEL: 'warn',
  };
}

function startProcess(name: string, entry: string, env: Record<string, string>): ChildProcess {
  const child = spawn(process.execPath, [join(REPO, entry)], { cwd: REPO, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const log: string[] = [];
  const keep = (chunk: Buffer) => { log.push(chunk.toString()); if (log.length > 200) log.shift(); };
  child.stdout?.on('data', keep);
  child.stderr?.on('data', keep);
  child.on('exit', (code) => { if (code) console.error(`${name} exited with ${code}\n${log.join('').slice(-4000)}`); });
  return child;
}

export function buildWeb(outDir: string, apiBaseUrl: string): Promise<void> {
  return new Promise((ok, fail) => {
    // --clear: the export cache does not key on app config, so a stale extra.apiBaseUrl would survive.
    const child = spawn('npx', ['expo', 'export', '-p', 'web', '--clear', '--output-dir', outDir], {
      cwd: IOS,
      env: { ...process.env, CI: '1', EXPO_PUBLIC_FANCY_PREVIEW: '0', EXPO_PUBLIC_API_BASE_URL: apiBaseUrl },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout?.on('data', (c: Buffer) => { out += c.toString(); });
    child.stderr?.on('data', (c: Buffer) => { out += c.toString(); });
    child.on('exit', (code) => (code === 0 ? ok() : fail(new Error(`expo export failed (${code})\n${out.slice(-3000)}`))));
  });
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

/** Static export with single-page fallback, plus a transparent /v1 proxy to the API. */
function startWebServer(webDir: string, port: number, apiPort: number): Promise<Server> {
  const root = resolve(webDir);
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://local');
    if (url.pathname.startsWith('/v1/')) {
      // Like a production reverse proxy: append the peer to X-Forwarded-For (the API trusts only 127.0.0.1).
      const forwarded = [req.headers['x-forwarded-for'], req.socket.remoteAddress].filter(Boolean).join(', ');
      const upstream = httpRequest({ host: '127.0.0.1', port: apiPort, method: req.method, path: req.url, headers: { ...req.headers, host: `127.0.0.1:${apiPort}`, 'x-forwarded-for': forwarded } }, (up) => {
        res.writeHead(up.statusCode ?? 502, up.headers);
        up.pipe(res);
      });
      upstream.on('error', () => { res.writeHead(502); res.end(); });
      req.pipe(upstream);
      return;
    }
    let file = normalize(join(root, decodeURIComponent(url.pathname)));
    if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html');
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    createReadStream(file).pipe(res);
  });
  return new Promise((ok) => server.listen(port, '127.0.0.1', () => ok(server)));
}

export async function startStack(opts: StackOptions): Promise<Stack> {
  const webUrl = `http://127.0.0.1:${opts.webPort}`;
  const apiUrl = `http://127.0.0.1:${opts.apiPort}`;
  const databaseUrl = await resetDatabase(opts.adminUrl, opts.database);
  const env = apiEnv(databaseUrl, opts, webUrl, randomBytes(32).toString('hex'));
  const api = startProcess('API', 'apps/api/src/main.ts', env);
  // The worker runs meal lifecycle jobs (close → start roster → completed) and the account purge.
  const worker = startProcess('Worker', 'apps/worker/src/main.ts', env);
  const stopProcesses = () => { api.kill('SIGTERM'); worker.kill('SIGTERM'); };
  try {
    await waitFor(`${apiUrl}/v1/meals`, 30_000, api);
    let web: Server | null = null;
    if (opts.serveWeb !== false) {
      if (opts.rebuildWeb || !existsSync(join(opts.webDir, 'index.html'))) await buildWeb(opts.webDir, webUrl);
      web = await startWebServer(opts.webDir, opts.webPort, opts.apiPort);
    }
    return {
      apiUrl, webUrl, databaseUrl,
      async stop() {
        if (web) await new Promise<void>((ok) => web.close(() => ok()));
        stopProcesses();
      },
    };
  } catch (error) {
    stopProcesses();
    throw error;
  }
}
