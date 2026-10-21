// Test-only isolated fetch double for the typed SDK. Never imported by production code.
export interface Call {
  method: string;
  path: string;
  query: URLSearchParams;
  headers: Record<string, string>;
  body: unknown;
}
type Reply = { status: number; body?: unknown; contentType?: string };
type Handler = (call: Call) => Reply | Promise<Reply>;

export const ok = (data: unknown): Reply => ({ status: 200, body: { data, meta: { requestId: 'req-1', serverNow: '2026-10-18T13:00:00Z' } } });
export const list = (data: unknown[]): Reply => ({ status: 200, body: { data, page: { nextCursor: null, hasMore: false }, meta: { requestId: 'req-1', serverNow: '2026-10-18T13:00:00Z' } } });
export const fail = (status: number, code: string): Reply => ({ status, body: { error: { code, message: code }, meta: { requestId: `req-${code}` } } });

export function mockFetch(routes: Record<string, Handler>) {
  const calls: Call[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://admin.test');
    const method = init?.method ?? 'GET';
    const call: Call = {
      method,
      path: url.pathname,
      query: url.searchParams,
      headers: { ...(init?.headers as Record<string, string>) },
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    };
    calls.push(call);
    const route = Object.keys(routes).find((key) => {
      const [m, pattern] = key.split(' ');
      return m === method && new RegExp(`^${pattern}$`).test(url.pathname);
    });
    const reply = route ? await routes[route]!(call) : fail(404, 'NOT_FOUND');
    const isText = reply.contentType && !reply.contentType.includes('json');
    return new Response(isText ? String(reply.body) : JSON.stringify(reply.body ?? null), {
      status: reply.status,
      headers: { 'content-type': reply.contentType ?? 'application/json' },
    });
  }) as typeof fetch;
  return { fetch: fetchImpl, calls };
}

export const SNAP_A = '11111111-1111-4111-8111-111111111111';
export const SNAP_B = '22222222-2222-4222-8222-222222222222';
export const HASH = 'a'.repeat(64);

export const snapshot = (id: string, asOf: string, status: 'SEALED' | 'REVOKED' = 'SEALED') => ({
  id, asOf, createdAt: asOf, definitionVersion: '4', classificationRevision: '7', status,
  dimensions: {
    areas: [{ code: 'soho', label: 'Soho' }, { code: 'kings-cross', label: "King's Cross" }],
    sources: [{ code: 'user', label: 'User-led' }, { code: 'assisted', label: 'Assisted' }],
  },
});

export const session = (roles: string[] = ['analyst']) => ({
  user: { roles },
  csrfToken: 'csrf-token-0123456789',
  authTime: '2026-10-18T12:30:00Z',
  amr: ['google', 'mfa'],
});

export const pageData = (page: string, snap: ReturnType<typeof snapshot>, metrics: Record<string, unknown> = {}) => ({
  page, snapshot: snap, filterHash: HASH, metrics, series: {}, privacyExcludedCount: 0,
});
