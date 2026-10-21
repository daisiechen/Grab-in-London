import { ApiError, createApiClient, newIntentKey, withRetry, type ApiClient } from '@fancy/client';
import type { OperationId } from '@fancy/contracts';

export type RetryOptions = NonNullable<Parameters<typeof withRetry>[1]>;

/**
 * Browser-side API access. Same-origin `/v1` with the HttpOnly session cookie; the CSRF
 * token from getSession is attached to writes. Any 401 notifies listeners so the session
 * and every private cache/draft are cleared (API contract §1, §5).
 */
export interface WebApi {
  client: ApiClient;
  setCsrfToken(token: string | null): void;
  setAIDeviceToken(token:string|null):void;
  setGuestCsrfToken(token:string|null):void;
  setAnalyticsEnabled(enabled:boolean):void;
  onUnauthorized(listener: () => void): () => void;
  retry: RetryOptions;
}

export interface WebApiOptions {
  fetch?: typeof fetch;
  baseUrl?: string;
  retry?: RetryOptions;
}

export function createWebApi(options: WebApiOptions = {}): WebApi {
  let csrf: string | null = null;
  let aiDeviceToken:string|null=null,guestCsrf:string|null=null;
  let authGeneration = 0;
  let analyticsEnabled = false;
  const stale = () => new ApiError({status:409,code:'STATE_CONFLICT',message:'Your account changed while this request was running.'});
  const listeners = new Set<() => void>();
  const inner = createApiClient({
    baseUrl: options.baseUrl ?? '',
    credentials: { kind: 'cookie', csrfToken: () => csrf },
    headers: (id) => {
      const ai = ['bootstrapAI','readAI','activityAI','resetAI','requestAI','pollAI','validateAIDraft','replaceAIPreferences'].includes(id);
      return {'x-fancy-analytics':analyticsEnabled?'enabled':'disabled', ...(ai ? {...(aiDeviceToken?{'ai-device-token':aiDeviceToken}:{}),...(!csrf&&guestCsrf?{'x-csrf-token':guestCsrf}:{})} : {})};
    },
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });
  const client: ApiClient = {
    async call(operationId, request) {
      const generation = authGeneration;
      try {
        const result = await inner.call(operationId, request);
        if (generation !== authGeneration) throw stale();
        return result;
      } catch (error) {
        if (generation !== authGeneration) throw stale();
        if (error instanceof ApiError && error.status === 401) for (const l of [...listeners]) l();
        throw error;
      }
    },
  };
  return {
    client,
    setCsrfToken: (token) => { if(token===null){authGeneration++;aiDeviceToken=null;guestCsrf=null;analyticsEnabled=false;}csrf = token; },
    setAnalyticsEnabled:(enabled)=>{analyticsEnabled=enabled;},
    setAIDeviceToken:(token)=>{aiDeviceToken=token;},
    setGuestCsrfToken:(token)=>{guestCsrf=token;},
    onUnauthorized(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    retry: options.retry ?? {},
  };
}

/**
 * One user intent = one Idempotency-Key. Transient failures (network/503/429/in-progress)
 * keep the key so a retry replays the same intent; success or a business rejection ends the
 * intent, and any change to the body/version starts a new one (API contract §1).
 */
export class Intent {
  private fingerprint: string | null = null;
  private key = '';
  private readonly retry: RetryOptions;

  constructor(retry: RetryOptions = {}) {
    this.retry = retry;
  }

  async run<T>(fingerprint: unknown, attempt: (key: string) => Promise<T>): Promise<T> {
    const fp = JSON.stringify(fingerprint);
    if (fp !== this.fingerprint) {
      this.fingerprint = fp;
      this.key = newIntentKey();
    }
    const key = this.key;
    try {
      const result = await withRetry(() => attempt(key), this.retry);
      this.fingerprint = null;
      return result;
    } catch (error) {
      if (!(error instanceof ApiError) || !error.retryable) this.fingerprint = null;
      throw error;
    }
  }

  /** Current key, for tests and diagnostics. */
  get currentKey(): string | null {
    return this.fingerprint === null ? null : this.key;
  }
}

export type { OperationId };
