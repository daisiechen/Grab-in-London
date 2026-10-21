import { describe, expect, it, vi } from 'vitest';
import { operations } from '@fancy/contracts';
import { ApiError, createApiClient, OPERATIONS, withRetry } from './index.ts';

const MEAL = '6a1f6c32-6c4e-4c4d-9a51-6c1d0e5f9b11';
const KEY = '0b8a7c55-4d0f-4d55-8c5a-2b0f6c9d1e22';
const ok = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: body === undefined ? {} : { 'content-type': 'application/json' } });

function capture(response: Response | (() => Response)) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return typeof response === 'function' ? response() : response.clone();
  }) as unknown as typeof globalThis.fetch;
  return { calls, fetch };
}

describe('generated SDK metadata', () => {
  it('covers exactly the registry operations', () => {
    expect(Object.keys(OPERATIONS).sort()).toEqual(operations.map((o) => o.operationId).sort());
  });
});

describe('createApiClient', () => {
  it('adds operation-scoped AI headers while preserving authoritative session CSRF', async () => {
    let responses=0;
    const {calls,fetch}=capture(()=>ok(responses++===0?201:200,{data:{},meta:{requestId:'r',serverNow:'2026-10-21T10:00:00Z'}}));
    const client=createApiClient({baseUrl:'',credentials:{kind:'cookie',csrfToken:()=> 'session-csrf'},fetch,headers:id=>id==='bootstrapAI'?{'ai-device-token':'device-token','x-csrf-token':'guest-csrf'}:{}});
    await client.call('bootstrapAI',{body:{deviceChallenge:'a'.repeat(43)},idempotencyKey:KEY});
    expect(calls[0]!.init.headers).toMatchObject({'ai-device-token':'device-token','x-csrf-token':'session-csrf','idempotency-key':KEY});
    await client.call('getSession',{});
    expect(calls[1]!.init.headers).not.toHaveProperty('ai-device-token');
  });
  it('sends idempotency key, quoted If-Match and CSRF on cookie writes', async () => {
    const { calls, fetch } = capture(ok(200, { data: {}, meta: { requestId: 'r1', serverNow: '2026-10-21T10:00:00Z' } }));
    const client = createApiClient({ baseUrl: 'https://app.example.test/', credentials: { kind: 'cookie', csrfToken: () => 'csrf-token-123456' }, fetch });
    await client.call('cancelMeal', { params: { mealId: MEAL }, body: { reason: 'host' }, idempotencyKey: KEY, ifMatch: '7' });
    const [call] = calls;
    expect(call!.url).toBe(`https://app.example.test/v1/meals/${MEAL}/cancel`);
    expect(call!.init.method).toBe('POST');
    expect(call!.init.credentials).toBe('include');
    expect(call!.init.cache).toBe('no-store');
    expect(call!.init.headers).toMatchObject({ 'idempotency-key': KEY, 'if-match': '"7"', 'x-csrf-token': 'csrf-token-123456', 'content-type': 'application/json' });
    expect(JSON.parse(String(call!.init.body))).toEqual({ reason: 'host' });
  });

  it('uses bearer tokens without cookies and encodes path and query values', async () => {
    const { calls, fetch } = capture(ok(200, { data: [], page: { nextCursor: null, hasMore: false }, meta: { requestId: 'r', serverNow: '2026-10-21T10:00:00Z' } }));
    const client = createApiClient({ baseUrl: 'https://api.example.test', credentials: { kind: 'bearer', accessToken: () => 'tok' }, fetch });
    await client.call('discoverMeals', { query: { dates: '2026-11-07,2026-11-08', keyword: 'ramen & chat' } });
    expect(calls[0]!.url).toBe('https://api.example.test/v1/meals?dates=2026-11-07%2C2026-11-08&keyword=ramen+%26+chat');
    expect(calls[0]!.init.credentials).toBe('omit');
    expect(calls[0]!.init.headers).toMatchObject({ authorization: 'Bearer tok' });
    expect(calls[0]!.init.headers).not.toHaveProperty('x-csrf-token');
  });

  it('keeps the query string when URLSearchParams has no size property (React Native polyfill)', async () => {
    const { calls, fetch } = capture(ok(200, { data: [], page: { nextCursor: null, hasMore: false }, meta: { requestId: 'r', serverNow: '2026-10-21T10:00:00Z' } }));
    const descriptor = Object.getOwnPropertyDescriptor(URLSearchParams.prototype, 'size')!;
    Object.defineProperty(URLSearchParams.prototype, 'size', { configurable: true, get: () => undefined });
    try {
      await createApiClient({ baseUrl: '', credentials: { kind: 'none' }, fetch }).call('discoverMeals', { query: { timeOfDay: 'dinner' } });
    } finally {
      Object.defineProperty(URLSearchParams.prototype, 'size', descriptor);
    }
    expect(calls[0]!.url).toBe('/v1/meals?timeOfDay=dinner');
  });

  it('refuses to send a write without its key, version or path parameter', async () => {
    const { calls, fetch } = capture(ok(200, {}));
    const client = createApiClient({ baseUrl: '', credentials: { kind: 'none' }, fetch });
    // @ts-expect-error idempotencyKey and ifMatch are required by the operation type
    await expect(client.call('cancelMeal', { params: { mealId: MEAL }, body: { reason: 'host' } })).rejects.toThrow(/idempotencyKey is required/);
    await expect(client.call('cancelMeal', { params: { mealId: MEAL }, body: { reason: 'host' }, idempotencyKey: KEY, ifMatch: '7x' })).rejects.toThrow(/Invalid version/);
    // @ts-expect-error mealId path parameter is required
    await expect(client.call('getMeal', { params: {} })).rejects.toThrow(/missing path parameter mealId/);
    expect(calls).toHaveLength(0);
  });

  it('returns undefined for 204 and parses typed errors', async () => {
    const noContent = capture(new Response(null, { status: 204 }));
    const client = createApiClient({ baseUrl: '', credentials: { kind: 'cookie', csrfToken: () => null }, fetch: noContent.fetch });
    await expect(client.call('logout', { body: { clientRequestId: KEY } })).resolves.toBeUndefined();

    const conflict = capture(ok(409, { error: { code: 'VERSION_CONFLICT', message: 'Changed', currentVersion: '9' }, meta: { requestId: 'r9', serverNow: '2026-10-21T10:00:00Z' } }));
    const c2 = createApiClient({ baseUrl: '', credentials: { kind: 'none' }, fetch: conflict.fetch });
    const error = await c2.call('withdrawApplication', { params: { applicationId: MEAL }, idempotencyKey: KEY, ifMatch: '8' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: 'VERSION_CONFLICT', kind: 'conflict', currentVersion: '9', requestId: 'r9', retryable: false });

    const ambiguous = capture(ok(422, { error: { code: 'TIME_AMBIGUOUS', message: 'Pick BST or GMT', choices: [{ utcOffsetMinutes: 60, label: 'BST', instant: '2026-10-25T00:30:00Z' }, { utcOffsetMinutes: 0, label: 'GMT', instant: '2026-10-25T01:30:00Z' }] }, meta: { requestId: 'r', serverNow: '2026-10-21T10:00:00Z' } }));
    const e3 = await createApiClient({ baseUrl: '', credentials: { kind: 'none' }, fetch: ambiguous.fetch })
      .call('getMeal', { params: { mealId: MEAL } }).catch((e: ApiError) => e);
    expect((e3 as ApiError).choices?.map((c) => c.label)).toEqual(['BST', 'GMT']);
  });

  it('classifies network failures and non-JSON gateway errors', async () => {
    const down = createApiClient({ baseUrl: '', credentials: { kind: 'none' }, fetch: (async () => { throw new TypeError('fetch failed'); }) as typeof fetch });
    await expect(down.call('getMeal', { params: { mealId: MEAL } })).rejects.toMatchObject({ code: 'NETWORK_ERROR', kind: 'network', retryable: true });
    const gateway = capture(new Response('<html>bad gateway</html>', { status: 503, headers: { 'retry-after': '3' } }));
    const c = createApiClient({ baseUrl: '', credentials: { kind: 'none' }, fetch: gateway.fetch });
    await expect(c.call('getMeal', { params: { mealId: MEAL } })).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE', retryAfterSeconds: 3, retryable: true });
  });
});

describe('withRetry', () => {
  it('retries transient failures with the same intent and stops on business conflicts', async () => {
    const sleeps: number[] = [];
    const sleep = async (ms: number) => { sleeps.push(ms); };
    let n = 0;
    const result = await withRetry(async () => {
      n++;
      if (n < 3) throw new ApiError({ status: 409, code: 'INTENT_IN_PROGRESS', message: 'busy', retryAfterSeconds: 1 });
      return 'done';
    }, { sleep });
    expect(result).toBe('done');
    expect(sleeps).toEqual([1000, 1000]);

    let m = 0;
    await expect(withRetry(async () => { m++; throw new ApiError({ status: 409, code: 'MEAL_FULL', message: 'full' }); }, { sleep })).rejects.toMatchObject({ code: 'MEAL_FULL' });
    expect(m).toBe(1);

    let k = 0;
    await expect(withRetry(async () => { k++; throw new ApiError({ status: 503, code: 'PROVIDER_UNAVAILABLE', message: 'down' }); }, { sleep, maxAttempts: 3, baseDelayMs: 100 })).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
    expect(k).toBe(3);
    expect(sleeps.slice(2)).toEqual([100, 200]);
  });

  it('honours a long server Retry-After but caps locally computed backoff at 30s', async () => {
    const sleeps: number[] = [];
    const sleep = async (ms: number) => { sleeps.push(ms); };
    let n = 0;
    await withRetry(async () => {
      if (++n === 1) throw new ApiError({ status: 429, code: 'RATE_LIMITED', message: 'slow down', retryAfterSeconds: 120 });
      return 'ok';
    }, { sleep });
    expect(sleeps).toEqual([120_000]);
    sleeps.length = 0;
    await expect(withRetry(async () => { throw new ApiError({ status: 503, code: 'PROVIDER_UNAVAILABLE', message: 'down' }); }, { sleep, maxAttempts: 5, baseDelayMs: 20_000 }))
      .rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
    expect(sleeps).toEqual([20_000, 30_000, 30_000, 30_000]);
  });
});
