import { randomBytes, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, expect, inject, it } from 'vitest';
import { loadConfig } from '@fancy/config';
import { ERROR_STATUS } from '@fancy/contracts';
import { createHarness, WEB_ORIGIN, type Harness } from '../test/harness.ts';
import { buildServer } from './server.ts';

let h: Harness;
let trusted: FastifyInstance;
beforeAll(async () => {
  h = await createHarness(inject('pgServerUrl'));
  const config = loadConfig({
    ENVIRONMENT: 'test', DATABASE_URL: h.db.url, AUTH_ADAPTER: 'test', PLACES_ADAPTER: 'fixture',
    MAIL_ADAPTER: 'outbox_test', AI_PROVIDER: 'mock', WEB_ORIGIN,
    SESSION_SECRET: 'api-test-session-secret-0123456789abcdef', TRUSTED_PROXY_CIDRS: '127.0.0.1,10.20.0.0/24',
  });
  trusted = await buildServer({ config, pool: h.db.pool, identity: h.idp, publicOrigin: WEB_ORIGIN });
});
afterAll(async () => { await trusted?.close(); await h?.close(); });

type Quota = 'otp' | 'guest' | 'receipt';
const limits = { otp: 5, guest: 10, receipt: 20 };
function request(app: FastifyInstance, quota: Quota, remoteAddress: string, forwarded: string) {
  const url = quota === 'otp' ? '/v1/auth/email/start' : quota === 'guest' ? '/v1/guest-sessions' : '/v1/deletion-status';
  const payload = quota === 'otp' ? { clientRequestId: randomUUID(), email: `${randomUUID()}@example.invalid`, client: 'WEB' }
    : quota === 'guest' ? { clientRequestId: randomUUID(), client: 'IOS' }
      : { receiptToken: randomBytes(32).toString('base64url') };
  return app.inject({ method: 'POST', url, remoteAddress, headers: { origin: WEB_ORIGIN, 'x-forwarded-for': forwarded }, payload });
}
const accepted = (quota: Quota) => quota === 'receipt' ? 404 : 201;

it.each<Quota>(['otp', 'guest', 'receipt'])('keeps %s quotas independent through an explicitly trusted proxy', async (quota) => {
  const group = Object.keys(limits).indexOf(quota) + 1;
  const first = `198.51.${group}.1`, second = `198.51.${group}.2`;
  for (let i = 0; i < limits[quota]; i++) expect((await request(trusted, quota, '127.0.0.1', first)).statusCode).toBe(accepted(quota));
  expect((await request(trusted, quota, '127.0.0.1', first)).statusCode).toBe(429);
  expect((await request(trusted, quota, '127.0.0.1', second)).statusCode).toBe(accepted(quota));
});

it.each<Quota>(['otp', 'guest', 'receipt'])('ignores spoofed forwarding headers from an untrusted %s peer', async (quota) => {
  const group = Object.keys(limits).indexOf(quota) + 10;
  for (let i = 0; i < limits[quota]; i++) expect((await request(trusted, quota, `203.0.113.${group}`, `192.0.2.${i + 1}`)).statusCode).toBe(accepted(quota));
  expect((await request(trusted, quota, `203.0.113.${group}`, '192.0.2.250')).statusCode).toBe(429);
});

it('distrusts forwarded addresses by default, reproducing the shared proxy quota until explicitly configured', async () => {
  for (let i = 0; i < 5; i++) expect((await request(h.app, 'otp', '127.0.0.2', `192.0.2.${i + 1}`)).statusCode).toBe(201);
  expect((await request(h.app, 'otp', '127.0.0.2', '192.0.2.250')).statusCode).toBe(429);
});

it('stops at the nearest untrusted hop rather than trusting a forged leftmost address', async () => {
  for (let i = 0; i < 5; i++) expect((await request(trusted, 'otp', '10.20.0.7', `192.0.2.${i + 1}, 203.0.113.90`)).statusCode).toBe(201);
  expect((await request(trusted, 'otp', '10.20.0.7', '192.0.2.250, 203.0.113.90')).statusCode).toBe(429);
});

it('uses a declared 503 contract code while recovery verification blocks API traffic', async () => {
  await h.db.pool.query("UPDATE recovery_control SET state='REPLAY_REQUIRED' WHERE id=1");
  try {
    const response = await h.app.inject({ method: 'GET', url: '/v1/me' });
    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe('SERVICE_UNAVAILABLE');
    expect(ERROR_STATUS.SERVICE_UNAVAILABLE).toBe(503);
  } finally { await h.db.pool.query("UPDATE recovery_control SET state='READY' WHERE id=1"); }
});
