import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { createApiClient } from '@fancy/client';

export class LoginError extends Error {
  constructor() { super('Browser sign-in was not completed. Start again using the approved MFA login.'); }
}
export interface LoginOptions {
  fetch?: typeof fetch;
  openBrowser?: (url: string) => Promise<void>;
  /** Test seam only; production uses the server's 10-minute OAuth lifetime. */
  timeoutMs?: number;
}
export interface CliAccess { accessToken: string; accessExpiresAt: string }

/** Official OS URL handler, argument array only; no shell interpolation or output inheritance. */
export async function openSystemBrowser(url: string): Promise<void> {
  const target = new URL(url);
  if ((target.protocol !== 'https:' && !(target.protocol === 'http:' && target.hostname === '127.0.0.1')) || target.username || target.password) throw new LoginError();
  const platform = process.platform;
  const command = platform === 'darwin' ? '/usr/bin/open' : platform === 'linux' ? '/usr/bin/xdg-open' : platform === 'win32' ? 'C:\\Windows\\System32\\rundll32.exe' : null;
  if (!command) throw new LoginError();
  const args = platform === 'win32' ? ['url.dll,FileProtocolHandler', url] : [url];
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { shell: false, stdio: 'ignore', windowsHide: true });
    child.once('error', () => reject(new LoginError()));
    child.once('spawn', () => { child.unref(); resolve(); });
  });
}

/** One browser login and its callback stay inside the process executing the support command. */
export async function browserLogin(baseUrl: string, options: LoginOptions = {}): Promise<CliAccess> {
  const verifier = randomBytes(48).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const abort = new AbortController(), transport = options.fetch ?? fetch;
  let expectedState: string | null = null, accepted = false, port = 0;
  let handoffTimeout: ReturnType<typeof setTimeout> | undefined;
  let resolveCode: (code: string) => void = () => undefined, rejectCode: (error: Error) => void = () => undefined;
  const callback = new Promise<string>((resolve, reject) => { resolveCode = resolve; rejectCode = reject; });
  void callback.catch(() => undefined);
  const server = createServer({ maxHeaderSize: 8192 }, (request, response) => {
    response.setHeader('cache-control', 'no-store');
    response.setHeader('referrer-policy', 'no-referrer');
    response.setHeader('content-security-policy', "default-src 'none'; frame-ancestors 'none'");
    response.setHeader('x-content-type-options', 'nosniff');
    response.setHeader('content-type', 'text/plain; charset=utf-8');
    const fail = () => { response.writeHead(400); response.end('Sign-in callback rejected.'); };
    if (accepted || request.method !== 'GET' || request.headers.host !== `127.0.0.1:${port}` || request.headers.origin || request.url?.split('?')[0] !== '/auth/callback' || request.url.length > 1024 || request.headers['transfer-encoding'] || request.headers['content-length'] && request.headers['content-length'] !== '0') return fail();
    let url: URL;
    try { url = new URL(request.url, `http://127.0.0.1:${port}`); } catch { return fail(); }
    const state = url.searchParams.get('state'), code = url.searchParams.get('code');
    if (url.origin !== `http://127.0.0.1:${port}` || url.pathname !== '/auth/callback' || url.hash || url.searchParams.size !== 2 || url.searchParams.getAll('state').length !== 1 || url.searchParams.getAll('code').length !== 1 || !expectedState || !state || Buffer.byteLength(state) !== Buffer.byteLength(expectedState) || !timingSafeEqual(Buffer.from(state), Buffer.from(expectedState)) || !code || !/^[A-Za-z0-9_-]{32,128}$/.test(code)) return fail();
    accepted = true;
    response.writeHead(200); response.end('Sign-in received. Return to the support terminal.');
    handoffTimeout = setTimeout(() => abort.abort(), 60_000);
    resolveCode(code); server.close(() => undefined);
  });
  server.headersTimeout = 5000; server.requestTimeout = 5000;
  const timeout = setTimeout(() => { abort.abort(); rejectCode(new LoginError()); server.close(() => undefined); server.closeAllConnections(); }, options.timeoutMs ?? 10 * 60_000);
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', () => reject(new LoginError()));
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    if (!address || typeof address === 'string' || address.port < 1024) throw new LoginError();
    port = address.port;
    const api = createApiClient({ baseUrl, credentials: { kind: 'none' }, fetch: (url, init) => transport(url, { ...init, redirect: 'error', signal: abort.signal }) });
    const started = await api.call('startOAuth', { body: { clientRequestId: randomUUID(), provider: 'GOOGLE', client: 'SUPPORT_CLI', appChallenge: challenge, loopbackRedirectUri: `http://127.0.0.1:${port}/auth/callback` } });
    if (!/^[0-9a-f-]{36}$/i.test(started.data.stateTransactionId)) throw new LoginError();
    expectedState = started.data.stateTransactionId;
    // Reject non-HTTP URL handlers even if a malformed provider response suggests one.
    const authorization = new URL(started.data.authorizationUrl);
    if ((authorization.protocol !== 'https:' && !(authorization.protocol === 'http:' && authorization.hostname === '127.0.0.1')) || authorization.username || authorization.password) throw new LoginError();
    await (options.openBrowser ?? openSystemBrowser)(authorization.href);
    const code = await callback;
    const result = await api.call('exchangeHandoff', { body: { clientRequestId: randomUUID(), code, appVerifier: verifier } });
    const credentials = result.data;
    if (credentials.client !== 'SUPPORT_CLI' || Object.keys(credentials).sort().join(',') !== 'accessExpiresAt,accessToken,client' || !/^[A-Za-z0-9_-]{32,512}$/.test(credentials.accessToken) || !Number.isFinite(Date.parse(credentials.accessExpiresAt)) || Date.parse(credentials.accessExpiresAt) <= Date.now() || Date.parse(credentials.accessExpiresAt) > Date.now() + 15 * 60_000 + 5000) throw new LoginError();
    return { accessToken: credentials.accessToken, accessExpiresAt: credentials.accessExpiresAt };
  } catch { throw new LoginError(); }
  finally { clearTimeout(timeout); clearTimeout(handoffTimeout); abort.abort(); server.close(() => undefined); server.closeAllConnections(); }
}
