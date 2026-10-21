/**
 * Isolated fetch double for tests only. Each route matches method + path (string or RegExp on the
 * pathname) and returns a JSON envelope. Unmatched requests fail the test loudly.
 */
export interface RecordedCall {
  method: string;
  url: string;
  path: string;
  query: URLSearchParams;
  headers: Record<string, string>;
  body: unknown;
}

export interface MockReply {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
}

type Handler = MockReply | ((call: RecordedCall) => MockReply | Promise<MockReply>);
interface Route { method: string; path: string | RegExp; handler: Handler; times: number }

export const META = { requestId: 'req-test', serverNow: '2026-10-21T10:00:00Z' };
export const ok = (data: unknown, status = 200): MockReply => ({ status, body: { data, meta: META } });
export const page = (data: unknown[], nextCursor: string | null = null): MockReply => ({ status: 200, body: { data, page: { nextCursor, hasMore: nextCursor !== null }, meta: META } });
export const fail = (status: number, code: string, extra: Record<string, unknown> = {}): MockReply => ({
  status,
  body: { error: { code, message: code, ...extra }, meta: META },
});
export const noContent = (): MockReply => ({ status: 204 });
export const networkDown = (): never => {
  throw new TypeError('Network request failed');
};

export function createMockFetch() {
  const routes: Route[] = [];
  const calls: RecordedCall[] = [];

  const fetchImpl = async (input: string | URL | Request, init: RequestInit = {}): Promise<Response> => {
    const url = new URL(String(input));
    const method = (init.method ?? 'GET').toUpperCase();
    const headers = { ...(init.headers as Record<string, string> | undefined) };
    const call: RecordedCall = {
      method,
      url: url.toString(),
      path: url.pathname,
      query: url.searchParams,
      headers,
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
    };
    calls.push(call);
    const route = routes.find((r) => r.times !== 0 && r.method === method && (typeof r.path === 'string' ? r.path === url.pathname : r.path.test(url.pathname)));
    if (!route) throw new Error(`mock-fetch: unexpected ${method} ${url.pathname}`);
    if (route.times > 0) route.times -= 1;
    const reply = typeof route.handler === 'function' ? await route.handler(call) : route.handler;
    const responseHeaders: Record<string, string> = { ...(reply.body === undefined ? {} : { 'content-type': 'application/json' }), ...reply.headers };
    return {
      status: reply.status,
      ok: reply.status >= 200 && reply.status < 300,
      headers: { get: (name: string) => responseHeaders[name.toLowerCase()] ?? null },
      json: async () => {
        if (reply.body === undefined) throw new SyntaxError('No body');
        return JSON.parse(JSON.stringify(reply.body));
      },
      text: async () => (reply.body === undefined ? '' : JSON.stringify(reply.body)),
    } as unknown as Response;
  };

  return {
    fetch: fetchImpl as typeof fetch,
    calls,
    /** Registers a route; `times` limits how often it answers (-1 = always). Earlier routes win. */
    on(method: string, path: string | RegExp, handler: Handler, times = -1) {
      routes.push({ method, path, handler, times });
      return this;
    },
    callsTo(method: string, path: string | RegExp) {
      return calls.filter((c) => c.method === method && (typeof path === 'string' ? c.path === path : path.test(c.path)));
    },
  };
}

export type MockFetch = ReturnType<typeof createMockFetch>;
