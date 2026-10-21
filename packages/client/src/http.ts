import type { OperationId } from '@fancy/contracts';
import { OPERATIONS } from './generated/operations.ts';
import { ApiError, errorFromResponse } from './errors.ts';
import type { RequestOf, ResponseOf } from './types.ts';

export type Credentials =
  /** Web: same-origin HttpOnly cookie; writes send the CSRF token from getSession. */
  | { kind: 'cookie'; csrfToken: () => string | null }
  /** iOS/CLI: in-memory opaque access token. */
  | { kind: 'bearer'; accessToken: () => string | null }
  | { kind: 'none' };

export interface ClientOptions {
  baseUrl: string;
  credentials: Credentials;
  fetch?: typeof fetch;
  headers?: (operationId: OperationId) => Readonly<Record<string,string>>;
}

export interface ApiClient {
  call<I extends OperationId>(operationId: I, request: RequestOf<I>): Promise<ResponseOf<I>>;
}

const formatIfMatch = (version: string) => {
  if (!/^(0|[1-9][0-9]{0,18})$/.test(version)) throw new TypeError(`Invalid version for If-Match: ${version}`);
  return `"${version}"`;
};

export function createApiClient(options: ClientOptions): ApiClient {
  const doFetch = options.fetch ?? fetch;
  const base = options.baseUrl.replace(/\/$/, '');
  return {
    async call(operationId, request) {
      const meta = OPERATIONS[operationId];
      const req = request as { params?: Record<string, string>; query?: Record<string, unknown>; body?: unknown; idempotencyKey?: string; ifMatch?: string };
      let path: string = meta.path;
      for (const name of meta.pathParams as readonly string[]) {
        const value = req.params?.[name];
        if (!value) throw new TypeError(`${operationId}: missing path parameter ${name}`);
        path = path.replace(`{${name}}`, encodeURIComponent(value));
      }
      const search = new URLSearchParams();
      for (const [key, value] of Object.entries(req.query ?? {})) if (value !== undefined && value !== null) search.set(key, String(value));
      // toString() rather than .size: React Native's URLSearchParams polyfill lacks .size.
      const qs = search.toString();
      const url = base + path + (qs ? `?${qs}` : '');

      const headers: Record<string, string> = { ...options.headers?.(operationId), accept: 'application/json' };
      if (meta.hasBody) headers['content-type'] = 'application/json';
      if (meta.write === 'idempotencyKey') {
        if (!req.idempotencyKey) throw new TypeError(`${operationId}: idempotencyKey is required`);
        headers['idempotency-key'] = req.idempotencyKey;
      }
      if (meta.write === 'resourceKey' && req.idempotencyKey) headers['idempotency-key'] = req.idempotencyKey;
      if (meta.ifMatch) {
        if (req.ifMatch === undefined) throw new TypeError(`${operationId}: ifMatch version is required`);
        headers['if-match'] = formatIfMatch(req.ifMatch);
      }
      const creds = options.credentials;
      if (creds.kind === 'bearer') {
        const token = creds.accessToken();
        if (token) headers.authorization = `Bearer ${token}`;
      } else if (creds.kind === 'cookie' && meta.method !== 'GET') {
        const csrf = creds.csrfToken();
        if (csrf) headers['x-csrf-token'] = csrf;
      }

      let response: Response;
      try {
        response = await doFetch(url, {
          method: meta.method,
          headers,
          credentials: creds.kind === 'cookie' ? 'include' : 'omit',
          cache: 'no-store',
          ...(meta.hasBody ? { body: JSON.stringify(req.body) } : {}),
        });
      } catch (cause) {
        throw new ApiError({ status: 0, code: 'NETWORK_ERROR', message: (cause as Error).message || 'Network error' });
      }
      if (response.status !== meta.successStatus) throw await errorFromResponse(response);
      if (response.status === 204) return undefined as ResponseOf<typeof operationId>;
      if (!(response.headers.get('content-type') ?? '').includes('application/json')) return (await response.text()) as ResponseOf<typeof operationId>;
      return (await response.json()) as ResponseOf<typeof operationId>;
    },
  };
}

/**
 * Re-sends one user intent with the same key/body after transient failures only; business
 * rejections (409/403/422…) surface immediately so the UI can refresh instead of replaying.
 */
export async function withRetry<T>(
  attempt: () => Promise<T>,
  { maxAttempts = 4, baseDelayMs = 500, sleep = (ms: number) => new Promise((r) => setTimeout(r, ms)) } = {},
): Promise<T> {
  for (let n = 1; ; n++) {
    try {
      return await attempt();
    } catch (error) {
      if (!(error instanceof ApiError) || !error.retryable || n >= maxAttempts) throw error;
      // A server-requested Retry-After is honoured in full; only our own backoff is capped at 30s.
      const delay = error.retryAfterSeconds !== undefined ? error.retryAfterSeconds * 1000 : Math.min(baseDelayMs * 2 ** (n - 1), 30_000);
      await sleep(delay);
    }
  }
}

/** New UUID per user intent; keep it for every retry of that intent. */
export const newIntentKey = (): string => crypto.randomUUID();
