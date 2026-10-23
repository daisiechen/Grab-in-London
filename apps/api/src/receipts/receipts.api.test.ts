import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { Browser, createHarness, json, type Harness } from '../test/harness.ts';
import { conflictClass } from './routes.ts';

let h: Harness;
beforeAll(async () => { h = await createHarness(inject('pgServerUrl')); });
afterAll(async () => { await h.close(); });

async function browser() { const b = new Browser(h); await b.signInWithEmail(`${randomUUID()}@example.invalid`); return b; }
const receipt = (b: Browser, operation: string, key: string) => b.request('GET', `/v1/me/command-receipts/${operation}/${key}`);
const patchMe = (b: Browser, body: unknown, version: string, key = randomUUID()) =>
  b.request('PATCH', '/v1/me', { body, headers: { 'if-match': `"${version}"`, 'idempotency-key': key } });
const BIO = 'A private synthetic biography that must never appear in a receipt.';

describe('P03 command receipts (actor + operation + key)', () => {
  it('reports SUCCEEDED with resource version only and never the stored body', async () => {
    const b = await browser();
    const version = json(await b.request('GET', '/v1/me')).data.version as string;
    const key = randomUUID();
    const saved = await patchMe(b, { bio: BIO }, version, key);
    expect(saved.statusCode, saved.body).toBe(200);
    const r = await receipt(b, 'updateMe', key.toUpperCase());
    expect(r.statusCode, r.body).toBe(200);
    expect(json(r).data).toMatchObject({ operation: 'updateMe', key, state: 'SUCCEEDED', httpStatus: 200, errorCode: null, conflict: null,
      resourceVersion: json(saved).data.version, retryable: false, expired: false });
    expect(r.body).not.toContain('synthetic biography');
    expect(r.headers['cache-control'] ?? '').not.toContain('public');
  });

  it('separates a definite version conflict from success and reports the current version', async () => {
    const b = await browser();
    const version = json(await b.request('GET', '/v1/me')).data.version as string;
    expect((await patchMe(b, { bio: BIO }, version)).statusCode).toBe(200);
    const key = randomUUID();
    const stale = await patchMe(b, { bio: `${BIO} Second.` }, version, key);
    expect(stale.statusCode).toBe(409);
    const data = json(await receipt(b, 'updateMe', key)).data;
    expect(data).toMatchObject({ state: 'REJECTED', httpStatus: 409, errorCode: 'VERSION_CONFLICT', conflict: 'VERSION', resourceVersion: null });
    expect(data.currentVersion).toBe(json(stale).error.currentVersion);
  });

  it('NONE for an unused key and for another actor key (no cross-actor disclosure)', async () => {
    const a = await browser(); const b = await browser();
    const version = json(await a.request('GET', '/v1/me')).data.version as string;
    const key = randomUUID();
    expect((await patchMe(a, { bio: BIO }, version, key)).statusCode).toBe(200);
    expect(json(await receipt(b, 'updateMe', key)).data).toMatchObject({ state: 'NONE', httpStatus: null, resourceId: null });
    expect(json(await receipt(a, 'updateMe', randomUUID())).data.state).toBe('NONE');
  });

  it('distinguishes an in-flight intent from a lost lease that may be resent with the same key', async () => {
    const b = await browser();
    const userId = json(await b.request('GET', '/v1/me')).data.id as string;
    const live = randomUUID(); const lost = randomUUID();
    await h.db.pool.query(
      `INSERT INTO idempotency (actor_id, operation, key, request_hash, state, claim_token, lease_until, expires_at, privacy_epoch)
       VALUES ($1,'reviewPerson',$2,repeat('a',64),'IN_PROGRESS',gen_random_uuid(), clock_timestamp() + interval '30 seconds', clock_timestamp() + interval '30 days', 0),
              ($1,'reviewPerson',$3,repeat('a',64),'IN_PROGRESS',gen_random_uuid(), clock_timestamp() - interval '1 second', clock_timestamp() + interval '30 days', 0)`,
      [userId, live, lost]);
    const inFlight = json(await receipt(b, 'reviewPerson', live)).data;
    expect(inFlight).toMatchObject({ state: 'PENDING', retryable: false });
    expect(inFlight.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(json(await receipt(b, 'reviewPerson', lost)).data).toMatchObject({ state: 'PENDING', retryable: true, retryAfterSeconds: null });
  });

  it('expired-but-unpurged rows are never retryable; the same key is refused by the write path', async () => {
    const b = await browser();
    const me = json(await b.request('GET', '/v1/me')).data;
    const done = randomUUID(); const stuck = randomUUID();
    expect((await patchMe(b, { bio: BIO }, me.version, done)).statusCode).toBe(200);
    await h.db.pool.query(
      `INSERT INTO idempotency (actor_id, operation, key, request_hash, state, claim_token, lease_until, created_at, expires_at, privacy_epoch)
       VALUES ($1,'updateMe',$2,repeat('a',64),'IN_PROGRESS',gen_random_uuid(), clock_timestamp() - interval '31 days', clock_timestamp() - interval '31 days', clock_timestamp() - interval '1 second', 0)`,
      [me.id, stuck]);
    await h.db.pool.query(`UPDATE idempotency SET created_at = clock_timestamp() - interval '31 days', expires_at = clock_timestamp() - interval '1 second' WHERE actor_id=$1 AND key=$2`, [me.id, done]);
    expect(json(await receipt(b, 'updateMe', stuck)).data).toMatchObject({ state: 'PENDING', expired: true, retryable: false, retryAfterSeconds: null });
    expect(json(await receipt(b, 'updateMe', done)).data).toMatchObject({ state: 'SUCCEEDED', expired: true, retryable: false });
    const resent = await patchMe(b, { bio: BIO }, me.version, stuck);
    expect(resent.statusCode).toBe(409);
    expect(json(resent).error.code).toBe('IDEMPOTENCY_CONFLICT');
    // The refused resend leaves the receipt unchanged (no new claim, still unresolved).
    expect(json(await receipt(b, 'updateMe', stuck)).data).toMatchObject({ state: 'PENDING', expired: true, retryable: false });
  });

  it('refuses non-whitelisted operations, malformed keys and guests', async () => {
    const b = await browser();
    expect((await receipt(b, 'putSurvey', randomUUID())).statusCode).toBe(404);
    expect((await receipt(b, 'getMe', randomUUID())).statusCode).toBe(404);
    expect((await receipt(b, 'updateMe', 'not-a-uuid')).statusCode).toBe(422);
    expect((await receipt(new Browser(h), 'updateMe', randomUUID())).statusCode).toBe(401);
  });

  it('classifies 409 families', () => {
    expect(conflictClass(409, 'VERSION_CONFLICT')).toBe('VERSION');
    expect(conflictClass(409, 'INTENT_IN_PROGRESS')).toBe('IN_PROGRESS');
    expect(conflictClass(409, 'IDEMPOTENCY_CONFLICT')).toBe('PAYLOAD');
    expect(conflictClass(409, 'MEAL_FULL')).toBe('STATE');
    expect(conflictClass(403, 'FORBIDDEN')).toBeNull();
  });
});
