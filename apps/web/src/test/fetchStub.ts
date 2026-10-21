import { OPERATIONS } from '@fancy/client';
import type { OperationId } from '@fancy/contracts';

/**
 * Isolated fetch stub for web unit tests. Requests are matched to an operationId through the
 * generated OPERATIONS table (method + path template), so a test fails if the UI calls a
 * path/method the contract does not define. This is mock evidence only: it never closes a
 * real API/S-gate.
 */
export interface RecordedCall {
  operationId: OperationId;
  method: string;
  url: URL;
  params: Record<string, string>;
  headers: Record<string, string>;
  body: unknown;
}

export interface StubResponse { status: number; body?: unknown; headers?: Record<string, string> }
export type Handler = (call: RecordedCall) => StubResponse | Promise<StubResponse>;

const ops = Object.entries(OPERATIONS) as Array<[OperationId, (typeof OPERATIONS)[OperationId]]>;

function match(method: string, pathname: string): { operationId: OperationId; params: Record<string, string> } | null {
  for (const [operationId, meta] of ops) {
    if (meta.method !== method) continue;
    const names: string[] = [];
    const re = new RegExp('^' + meta.path.replace(/\{([^}]+)\}/g, (_m: string, n: string) => { names.push(n); return '([^/]+)'; }) + '$');
    const m = re.exec(pathname);
    if (m) return { operationId, params: Object.fromEntries(names.map((n, i) => [n, decodeURIComponent(m[i + 1]!)])) };
  }
  return null;
}

export const meta = () => ({ requestId: 'req-test', serverNow: '2026-10-21T12:00:00.000Z' });
export const ok = (data: unknown, status = 200): StubResponse => ({ status, body: { data, meta: meta() } });
export const page = (data: unknown[], nextCursor: string | null = null): StubResponse => ({ status: 200, body: { data, page: { nextCursor, hasMore: nextCursor !== null }, meta: meta() } });
export const fail = (status: number, code: string, extra: Record<string, unknown> = {}): StubResponse => ({
  status, body: { error: { code, message: code, ...extra }, meta: meta() },
});
export const noContent = (): StubResponse => ({ status: 204 });

export function createFetchStub(handlers: Partial<Record<OperationId, Handler>> = {}) {
  const calls: RecordedCall[] = [];
  const table = { ...handlers };
  const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, 'http://web.test');
    const method = (init?.method ?? 'GET').toUpperCase();
    const found = match(method, url.pathname);
    if (!found) throw new Error(`fetchStub: ${method} ${url.pathname} is not a contract operation`);
    const headers = Object.fromEntries(Object.entries((init?.headers ?? {}) as Record<string, string>).map(([k, v]) => [k.toLowerCase(), v]));
    const call: RecordedCall = {
      operationId: found.operationId, method, url, params: found.params, headers,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    };
    calls.push(call);
    const handler = table[found.operationId];
    if (!handler) throw new Error(`fetchStub: no handler for ${found.operationId}`);
    const res = await handler(call);
    const status = res.status;
    if (status === 204) return new Response(null, { status });
    return new Response(JSON.stringify(res.body ?? {}), { status, headers: { 'content-type': 'application/json', ...(res.headers ?? {}) } });
  };
  return {
    fetch: fetchImpl as typeof fetch,
    calls,
    on(operationId: OperationId, handler: Handler) { table[operationId] = handler; },
    callsTo(operationId: OperationId) { return calls.filter((c) => c.operationId === operationId); },
  };
}

/** Promise whose resolution the test controls, for race/ordering regressions. */
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
