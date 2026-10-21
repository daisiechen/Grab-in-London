import { createApiClient } from '@fancy/client';
import { ensureRandomUUID } from './polyfills.ts';

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => '3f2b8c1e-9a4d-4e6f-8b2a-1c0d9e8f7a65') }));

describe('ensureRandomUUID', () => {
  it('installs expo-crypto randomUUID when the runtime has no crypto object', () => {
    const host: { crypto?: { randomUUID?: () => string } } = {};
    ensureRandomUUID(host);
    expect(host.crypto?.randomUUID?.()).toBe('3f2b8c1e-9a4d-4e6f-8b2a-1c0d9e8f7a65');
  });

  it('adds randomUUID to an existing crypto object that lacks it (Hermes getRandomValues only)', () => {
    const getRandomValues = jest.fn();
    const host: { crypto?: { randomUUID?: () => string; getRandomValues?: unknown } } = { crypto: { getRandomValues } };
    ensureRandomUUID(host);
    expect(host.crypto?.randomUUID?.()).toBe('3f2b8c1e-9a4d-4e6f-8b2a-1c0d9e8f7a65');
    expect(host.crypto?.getRandomValues).toBe(getRandomValues);
  });

  it('never replaces a native implementation', () => {
    const native = jest.fn(() => 'native-uuid');
    const host = { crypto: { randomUUID: native } };
    ensureRandomUUID(host);
    expect(host.crypto.randomUUID).toBe(native);
  });
});

describe('@fancy/client under the jest-expo iOS transform', () => {
  it('resolves the workspace SDK source and sends bearer credentials without cookies', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const body = { data: { ok: true }, meta: { requestId: 'r1', serverNow: '2026-10-21T10:00:00Z' } };
    const fakeFetch = jest.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return {
        status: 200,
        headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null) },
        json: async () => body,
      } as unknown as Response;
    }) as unknown as typeof fetch;

    const client = createApiClient({
      baseUrl: 'https://api.example.test/',
      credentials: { kind: 'bearer', accessToken: () => 'access-token-in-memory' },
      fetch: fakeFetch,
    });
    await expect(client.call('getMe', {})).resolves.toEqual(body);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://api.example.test/v1/me');
    expect(calls[0]?.init.credentials).toBe('omit');
    expect(calls[0]?.init.headers).toMatchObject({ authorization: 'Bearer access-token-in-memory' });
  });
});
