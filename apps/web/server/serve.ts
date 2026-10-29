/**
 * Fancy web server: serves the built SPA (apps/web/dist) and writes the page head on the server for
 * public pages, so link-preview bots and crawlers that don't run JavaScript get the title,
 * description, canonical URL, OG tags and JSON-LD (web spec §8). Meal pages answer 301 to their
 * canonical `/meals/{id}/{slug}`. `/v1/*` is proxied to the API so the browser stays same-origin
 * (session cookie + CSRF). No dependencies beyond Node 24.
 *
 *   FANCY_API_ORIGIN=http://127.0.0.1:3000 PORT=8080 node apps/web/server/serve.ts
 */
import { createServer, request as httpRequest, type IncomingMessage, type ServerResponse } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LONDON_AREA_NAMES } from '../../../packages/client/src/london-area-names.ts';
import { injectHead } from '../src/seo/head.ts';
import { SITE_ORIGIN } from '../src/seo/meal-seo.ts';
import { headFor, robotsTxt, sitemapXml, type PageLoaders } from '../src/seo/pages.ts';

const DIST = resolve(fileURLToPath(new URL('../dist', import.meta.url)));
const API = (process.env.FANCY_API_ORIGIN ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
const ORIGIN = (process.env.FANCY_PUBLIC_ORIGIN ?? SITE_ORIGIN).replace(/\/$/, '');
const PORT = Number(process.env.PORT ?? 8080);
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.json': 'application/json', '.map': 'application/json', '.txt': 'text/plain; charset=utf-8',
};
const SECURITY = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'strict-transport-security': 'max-age=31536000',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
};

const titleArea = (code: string) => (code === 'unknown' ? 'London' : Object.hasOwn(LONDON_AREA_NAMES, code) ? LONDON_AREA_NAMES[code]! : code.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '));

/** Public reads only, without the visitor's cookie: the head must never depend on who is asking. */
async function publicJson<T>(path: string): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(API + path, { headers: { accept: 'application/json' }, signal: controller.signal });
    if (!res.ok) return null;
    return ((await res.json()) as { data: T }).data;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

type MealT = NonNullable<Awaited<ReturnType<PageLoaders['meal']>>>;
type ProfileT = NonNullable<Awaited<ReturnType<PageLoaders['profile']>>>;
const loaders: PageLoaders = {
  meal: async (id) => (await publicJson<{ meal: MealT }>(`/v1/meals/${id}`))?.meal ?? null,
  profile: async (id) => (await publicJson<{ profile: ProfileT }>(`/v1/profiles/${id}`))?.profile ?? null,
  areaName: titleArea,
  now: () => Date.now(),
};

let indexHtml: string | null = null;
const index = async () => (indexHtml ??= await readFile(join(DIST, 'index.html'), 'utf8'));

async function staticFile(pathname: string): Promise<{ body: Buffer; type: string; immutable: boolean } | null> {
  let rel: string;
  try { rel = normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, ''); } catch { return null; }
  let file = resolve(DIST, rel);
  if (file !== DIST && !file.startsWith(DIST + sep)) return null;
  try {
    const info = await stat(file);
    if (info.isDirectory()) { file = join(file, 'index.html'); await stat(file); }
    if (file === join(DIST, 'index.html')) return null;
    return { body: await readFile(file), type: TYPES[extname(file)] ?? 'application/octet-stream', immutable: rel.startsWith('assets/') };
  } catch {
    return null;
  }
}

function proxy(req: IncomingMessage, res: ServerResponse) {
  const target = new URL(req.url ?? '/', API);
  const send = target.protocol === 'https:' ? httpsRequest : httpRequest;
    // Like a reverse proxy: append the peer to X-Forwarded-For (the API trusts it only from configured proxies).
  const forwarded = [req.headers['x-forwarded-for'], req.socket.remoteAddress].filter(Boolean).join(', ');
  const upstream = send(target, { method: req.method, headers: { ...req.headers, host: target.host, 'x-forwarded-for': forwarded } }, (up) => {
    res.writeHead(up.statusCode ?? 502, up.headers);
    up.pipe(res);
  });
  upstream.on('error', () => { if (!res.headersSent) res.writeHead(502, { 'content-type': 'application/json' }); res.end('{"error":{"code":"PROVIDER_UNAVAILABLE","message":"API unreachable"}}'); });
  req.pipe(upstream);
}

async function sitemap(): Promise<string> {
  const meals: Array<{ id: string; title: string }> = [];
  let cursor: string | null = null;
  for (let pageNo = 0; pageNo < 10; pageNo++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    try {
      const res = await fetch(`${API}/v1/meals${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, { headers: { accept: 'application/json' }, signal: controller.signal });
      if (!res.ok) break;
      const body = (await res.json()) as { data: Array<{ id: string; title: string }>; page: { nextCursor: string | null } };
      meals.push(...body.data.map(({ id, title }) => ({ id, title })));
      cursor = body.page.nextCursor;
      if (!cursor) break;
    } catch { break; } finally { clearTimeout(timer); }
  }
  return sitemapXml(ORIGIN, meals);
}

export async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://local');
  if (url.pathname.startsWith('/v1/')) return proxy(req, res);
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { allow: 'GET, HEAD' }); res.end(); return; }
  if (url.pathname === '/robots.txt') { res.writeHead(200, { ...SECURITY, 'content-type': 'text/plain; charset=utf-8' }); res.end(robotsTxt(ORIGIN)); return; }
  if (url.pathname === '/sitemap.xml') { res.writeHead(200, { ...SECURITY, 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=900' }); res.end(await sitemap()); return; }
  const file = await staticFile(url.pathname);
  if (file) {
    res.writeHead(200, { ...SECURITY, 'content-type': file.type, 'cache-control': file.immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=300' });
    res.end(req.method === 'HEAD' ? undefined : file.body);
    return;
  }
  const page = await headFor(url.pathname, url.search, loaders);
  if (page.kind === 'redirect') { res.writeHead(page.status, { ...SECURITY, location: page.location, 'cache-control': 'public, max-age=300' }); res.end(); return; }
  res.writeHead(page.status, { ...SECURITY, 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' });
  res.end(req.method === 'HEAD' ? undefined : injectHead(await index(), page.head));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createServer((req, res) => { handle(req, res).catch(() => { if (!res.headersSent) res.writeHead(500); res.end(); }); })
    .listen(PORT, () => console.warn(`fancy web on :${PORT} (API ${API})`));
}
