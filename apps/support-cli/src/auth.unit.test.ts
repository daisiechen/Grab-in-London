import { createHash } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import { browserLogin, LoginError } from './auth.ts';
import { run, safeFailure } from './commands.ts';
const state = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', code = 'C'.repeat(43), token = 'T'.repeat(43);
const origin = 'https://api.example.test';
const credentials = () => ({ client: 'SUPPORT_CLI', accessToken: token, accessExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString() });
const response = (data: unknown, status = 200) => new Response(JSON.stringify({ data }), { status, headers: { 'content-type': 'application/json' } });
async function callback(uri: string, options: { path?: string; method?: string; host?: string; origin?: string } = {}): Promise<{status: number; body: string}> {
  const url = new URL(uri);
  return new Promise((resolve, reject) => {
    const req = httpRequest({ hostname: '127.0.0.1', port: url.port, method: options.method ?? 'GET', path: options.path ?? `${url.pathname}?code=${code}&state=${state}`, headers: { host: options.host ?? url.host, ...(options.origin ? { origin: options.origin } : {}) } }, res => {
      const chunks: Buffer[] = []; res.on('data', chunk => chunks.push(Buffer.from(chunk))); res.on('end', () => resolve({ status: res.statusCode!, body: Buffer.concat(chunks).toString() }));
    }); req.once('error', reject); req.end();
  });
}
function rig(result: unknown = credentials(), authorizationUrl = 'https://identity.example.test/authorize') {
  let uri = '', challenge = '';
  const fetcher = vi.fn<typeof fetch>(async (target, init) => {
    const body = JSON.parse(init?.body as string ?? '{}');
    if (String(target).endsWith('/oauth/start')) {
      expect(body).toMatchObject({ client: 'SUPPORT_CLI', provider: 'GOOGLE' });
      expect(body.loopbackRedirectUri).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/auth\/callback$/);
      expect(Number(new URL(body.loopbackRedirectUri).port)).toBeGreaterThanOrEqual(1024);
      uri = body.loopbackRedirectUri; challenge = body.appChallenge;
      expect(init?.headers).not.toHaveProperty('authorization');
      return response({ authorizationUrl, stateTransactionId: state }, 201);
    }
    if (String(target).endsWith('/handoff')) {
      expect(body.code).toBe(code); expect(createHash('sha256').update(body.appVerifier).digest('base64url')).toBe(challenge);
      expect(body).toHaveProperty('clientRequestId'); expect(init?.headers).not.toHaveProperty('authorization');
      return response(result);
    }
    expect(init?.headers).toHaveProperty('authorization', `Bearer ${token}`);
    return response({ id: state, details: 'Explicit view facts', version: '1' });
  });
  return { fetcher, uri: () => uri };
}
describe('same-process browser OAuth and guarded loopback callback', () => {
  it('uses RAM PKCE and validates state, then exchanges once without returning tokens to the browser', async () => {
    const r = rig();
    const result = await browserLogin(origin, { fetch: r.fetcher, timeoutMs: 5000, openBrowser: async url => {
      expect(url).toBe('https://identity.example.test/authorize');
      const browser = await callback(r.uri()); expect(browser.status).toBe(200); expect(browser.body).not.toContain(token); expect(browser.body).not.toContain(code);
    } });
    expect(result.accessToken).toBe(token); expect(r.fetcher).toHaveBeenCalledTimes(2);
    await expect(callback(r.uri())).rejects.toBeDefined();
    expect(r.fetcher.mock.calls.every(([, init]) => init?.redirect === 'error' && init?.credentials === 'omit')).toBe(true);
  });
  it('rejects wrong host, route, method, cross-origin request, duplicate parameters and state without consuming the real callback', async () => {
    const r = rig();
    await browserLogin(origin, { fetch: r.fetcher, timeoutMs: 5000, openBrowser: async () => {
      for (const options of [ { host: 'evil.example.test' }, { path: '/other' }, { path: `/other/../auth/callback?code=${code}&state=${state}` }, { path: `//evil.example.test/auth/callback?code=${code}&state=${state}` }, { path: `/%61uth/callback?code=${code}&state=${state}` }, { method: 'POST' }, { origin: 'https://evil.example.test' }, { path: `/auth/callback?code=${code}&state=wrong` }, { path: `/auth/callback?code=${code}&state=${state}&state=${state}` }, { path: `/auth/callback?code=short&state=${state}` } ]) {
        expect((await callback(r.uri(), options)).status).toBe(400);
      }
      expect((await callback(r.uri())).status).toBe(200);
    } }); expect(r.fetcher).toHaveBeenCalledTimes(2);
  });
  it.each([
    { ...credentials(), client: 'IOS', refreshToken: 'R'.repeat(43) },
    { ...credentials(), refreshToken: 'R'.repeat(43) },
    { ...credentials(), accessExpiresAt: new Date(Date.now() - 1000).toISOString() },
    { ...credentials(), accessExpiresAt: new Date(Date.now() + 30 * 60_000).toISOString() },
  ])('rejects wrong client, refresh-bearing or invalid-lifetime credentials', async result => {
    const r = rig(result);
    await expect(browserLogin(origin, { fetch: r.fetcher, timeoutMs: 5000, openBrowser: async () => { await callback(r.uri()); } })).rejects.toBeInstanceOf(LoginError);
  });
  it('expires the local listener and never exchanges when browser login does not finish', async () => {
    const r = rig();
    await expect(browserLogin(origin, { fetch: r.fetcher, timeoutMs: 200, openBrowser: async () => undefined })).rejects.toBeInstanceOf(LoginError);
    expect(r.fetcher).toHaveBeenCalledTimes(1); await expect(callback(r.uri())).rejects.toBeDefined();
  });
  it('default run logs in then executes exactly one stdin command and never outputs credentials', async () => {
    const r = rig(), out = vi.fn(), error = vi.fn();
    const status = await run(['view'], JSON.stringify({ caseId: state }), { FANCY_API_URL: origin }, { out, error }, r.fetcher, { timeoutMs: 5000, openBrowser: async () => { await callback(r.uri()); } });
    expect(status).toBe(0); expect(r.fetcher).toHaveBeenCalledTimes(3);
    expect(out).toHaveBeenCalledWith(JSON.stringify({ id: state, details: 'Explicit view facts', version: '1' }));
    expect(out.mock.calls.flat().join('')).not.toContain(token); expect(error).not.toHaveBeenCalled();
  });
  it('invalid input never opens the browser and provider/browser errors remain fixed diagnostics', async () => {
    const out = vi.fn(), error = vi.fn(), openBrowser = vi.fn();
    expect(await run(['bad-command'], '{}', { FANCY_API_URL: origin }, { out, error }, vi.fn(), { openBrowser })).toBe(2); expect(openBrowser).not.toHaveBeenCalled();
    const r = rig(); await expect(browserLogin(origin, { fetch: r.fetcher, timeoutMs: 1000, openBrowser: async () => { throw Error(`SECRET ${token}`); } })).rejects.toMatchObject({ message: 'Browser sign-in was not completed. Start again using the approved MFA login.' });
    expect(safeFailure(new LoginError())).not.toContain(token); await expect(callback(r.uri())).rejects.toBeDefined();
  });
  it('never launches an arbitrary OS protocol or URL containing userinfo from the API response', async () => {
    for (const url of ['file:///private/data', 'https://secret@identity.example.test/authorize']) {
      const r = rig(credentials(), url), openBrowser = vi.fn();
      await expect(browserLogin(origin, { fetch: r.fetcher, openBrowser, timeoutMs: 1000 })).rejects.toBeInstanceOf(LoginError);
      expect(openBrowser).not.toHaveBeenCalled(); await expect(callback(r.uri())).rejects.toBeDefined();
    }
  });
});
