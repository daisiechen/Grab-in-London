/**
 * API test harness: real Fastify app on a fresh migrated PostgreSQL 17 database with the
 * test-only identity provider. Requests go through light-my-request (no network listener).
 */
import { randomUUID } from 'node:crypto';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { loadConfig } from '@fancy/config';
import { migrate } from '@fancy/db';
import { createMigratedDatabase, type MigratedDatabase } from '@fancy/testkit/db';
import { buildServer } from '../http/server.ts';
import { TestIdentityProvider } from '../identity/test-provider.ts';

export const WEB_ORIGIN = 'http://localhost:5174';

/**
 * Loosely typed response JSON for assertions only: tests probe envelope shapes the contract
 * schemas already pin, so chained property access stays readable.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test-only assertion helper
export type TestJson = Record<string, any>;

export interface Harness {
  app: FastifyInstance;
  db: MigratedDatabase;
  idp: TestIdentityProvider;
  close(): Promise<void>;
}

export async function createHarness(serverUrl: string): Promise<Harness> {
  const db = await createMigratedDatabase(serverUrl, migrate);
  const config = loadConfig({
    ENVIRONMENT: 'test', DATABASE_URL: db.url, AUTH_ADAPTER: 'test', PLACES_ADAPTER: 'fixture', MAIL_ADAPTER: 'outbox_test',
    AI_PROVIDER: 'mock', WEB_ORIGIN, SESSION_SECRET: 'api-test-session-secret-0123456789abcdef', IOS_REDIRECT_URI: 'fancy://auth/callback',
  });
  const idp = new TestIdentityProvider('test');
  const app = await buildServer({ config, pool: db.pool, identity: idp, publicOrigin: WEB_ORIGIN });
  return { app, db, idp, close: async () => { await app.close(); await db.drop(); } };
}

/** Minimal browser: cookie jar, Origin header and CSRF token for writes. */
export class Browser {
  readonly cookies = new Map<string, string>();
  csrf: string | null = null;
  private readonly h: Harness;
  readonly origin: string;
  /** Each simulated device has its own client address (per-IP rate limits are real). */
  readonly ip = randomIp();
  constructor(h: Harness, origin = WEB_ORIGIN) {
    this.h = h;
    this.origin = origin;
  }

  async request(method: string, url: string, o: { body?: unknown; headers?: Record<string, string> } = {}): Promise<LightMyRequestResponse> {
    const cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    const response = await this.h.app.inject({
      method: method as 'GET',
      url,
      remoteAddress: this.ip,
      headers: {
        origin: this.origin,
        ...(cookie ? { cookie } : {}),
        ...(this.csrf && method !== 'GET' ? { 'x-csrf-token': this.csrf } : {}),
        ...(o.body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...o.headers,
      },
      ...(o.body !== undefined ? { payload: JSON.stringify(o.body) } : {}),
    });
    for (const c of response.cookies as Array<{ name: string; value: string; maxAge?: number; expires?: Date }>) {
      if (c.value === '' || c.maxAge === 0 || (c.expires && c.expires.getTime() < Date.now())) this.cookies.delete(c.name);
      else this.cookies.set(c.name, c.value);
    }
    return response;
  }

  /** Full email OTP sign-in reading the code from the test inbox. */
  async signInWithEmail(email: string): Promise<{ body: TestJson; challengeId: string }> {
    const start = await this.request('POST', '/v1/auth/email/start', { body: { clientRequestId: randomUUID(), email, client: 'WEB' } });
    if (start.statusCode !== 201) throw new Error(`start failed ${start.statusCode} ${start.body}`);
    const challengeId = start.json().data.challengeId as string;
    const code = this.h.idp.inbox.get(email.toLowerCase())!.at(-1)!;
    const verify = await this.request('POST', '/v1/auth/email/verify', { body: { clientRequestId: randomUUID(), challengeId, code } });
    const body = verify.json();
    if (body.data?.session?.csrfToken) this.csrf = body.data.session.csrfToken;
    return { body, challengeId };
  }
}

export const randomIp = () => `10.${(Math.random() * 255) | 0}.${(Math.random() * 255) | 0}.${1 + ((Math.random() * 253) | 0)}`;

export const json = (r: LightMyRequestResponse) => r.json() as TestJson;
