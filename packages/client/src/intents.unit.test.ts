import { describe, expect, it } from 'vitest';
import { ApiError } from './errors.ts';
import { createApiClient } from './http.ts';
import { IntentTracker, IntentUnresolvedError, outcomeFromError, outcomeFromReceipt, reconcileIntent, type CommandReceipt } from './intents.ts';

const KEY = '6f1c2a4e-9b3d-4c5e-8f7a-1b2c3d4e5f60';
const base: CommandReceipt = { operation: 'reviewPerson', key: KEY, state: 'NONE', retryable: false, expired: false, retryAfterSeconds: null, httpStatus: null,
  errorCode: null, conflict: null, resourceId: null, resourceVersion: null, currentVersion: null, completedAt: null, expiresAt: null };
const err = (status: number, code: ConstructorParameters<typeof ApiError>[0]['code']) => new ApiError({ status, code, message: code });

describe('intent outcome mapping (P03)', () => {
  it('keeps transport/5xx/429 failures unknown and never treats them as rejected', () => {
    expect(outcomeFromError(err(0, 'NETWORK_ERROR'))).toBe('unknown');
    expect(outcomeFromError(err(500, 'INTERNAL_ERROR'))).toBe('unknown');
    expect(outcomeFromError(err(503, 'SERVICE_UNAVAILABLE'))).toBe('unknown');
    expect(outcomeFromError(err(429, 'RATE_LIMITED'))).toBe('unknown');
    expect(outcomeFromError(new Error('boom'))).toBe('unknown');
  });
  it('separates in-progress, version conflict, definite rejection and reauth', () => {
    expect(outcomeFromError(err(409, 'INTENT_IN_PROGRESS'))).toBe('pending');
    expect(outcomeFromError(err(409, 'VERSION_CONFLICT'))).toBe('conflict');
    expect(outcomeFromError(err(409, 'STATE_CONFLICT'))).toBe('rejected');
    expect(outcomeFromError(err(403, 'FORBIDDEN'))).toBe('rejected');
    expect(outcomeFromError(err(401, 'AUTH_REQUIRED'))).toBe('reauth');
  });
  it('clears only on SUCCEEDED; NONE and lost lease allow same-key resend', () => {
    expect(outcomeFromReceipt({ ...base, state: 'SUCCEEDED', httpStatus: 200 })).toBe('saved');
    // NONE without age proof may be a purged completed intent: stays unknown.
    expect(outcomeFromReceipt(base)).toBe('unknown');
    expect(outcomeFromReceipt(base, { issuedAt: 0, now: 60_000 })).toBe('resend');
    expect(outcomeFromReceipt(base, { issuedAt: 0, now: 30 * 24 * 3600_000 })).toBe('unknown');
    expect(outcomeFromReceipt(base, { issuedAt: 10_000, now: 0 })).toBe('unknown');
    expect(outcomeFromReceipt({ ...base, state: 'PENDING', retryable: true })).toBe('resend');
    expect(outcomeFromReceipt({ ...base, state: 'PENDING', retryAfterSeconds: 5 })).toBe('pending');
    expect(outcomeFromReceipt({ ...base, state: 'REJECTED', httpStatus: 409, conflict: 'VERSION' })).toBe('conflict');
    expect(outcomeFromReceipt({ ...base, state: 'REJECTED', httpStatus: 409, conflict: 'STATE' })).toBe('rejected');
  });
  it('never offers same-key resend for an expired-but-unpurged intent', () => {
    expect(outcomeFromReceipt({ ...base, state: 'PENDING', expired: true, retryable: false })).toBe('expired');
    expect(outcomeFromReceipt({ ...base, state: 'SUCCEEDED', expired: true, httpStatus: 200 })).toBe('saved');
    expect(outcomeFromReceipt({ ...base, state: 'REJECTED', expired: true, httpStatus: 409, conflict: 'VERSION' })).toBe('conflict');
  });
  it('reconciles through GET /me/command-receipts and stays unknown when the read fails', async () => {
    const calls: string[] = [];
    const ok = createApiClient({ baseUrl: 'https://api.test', credentials: { kind: 'bearer', accessToken: () => 't'.repeat(30) },
      fetch: async (url) => { calls.push(String(url)); return new Response(JSON.stringify({ data: { ...base, state: 'SUCCEEDED', httpStatus: 200 }, meta: { requestId: 'r', serverNow: new Date().toISOString() } }), { status: 200, headers: { 'content-type': 'application/json' } }); } });
    expect((await reconcileIntent(ok, 'reviewPerson', KEY)).outcome).toBe('saved');
    expect(calls).toEqual([`https://api.test/v1/me/command-receipts/reviewPerson/${KEY}`]);
    const down = createApiClient({ baseUrl: 'https://api.test', credentials: { kind: 'none' }, fetch: async () => { throw new TypeError('offline'); } });
    expect(await reconcileIntent(down, 'reviewPerson', KEY)).toEqual({ outcome: 'unknown', receipt: null });
  });
});

describe('IntentTracker', () => {
  let n = 0;
  const tracker = () => new IntentTracker(() => `key-${++n}`, () => 1_000);
  it('reuses the key for the same request after an unknown result and refuses a different draft', async () => {
    const t = tracker(); const keys: string[] = [];
    await expect(t.run({ a: 1 }, async (k) => { keys.push(k); throw err(0, 'NETWORK_ERROR'); })).rejects.toBeInstanceOf(ApiError);
    await expect(t.run({ a: 2 }, async () => 'x')).rejects.toBeInstanceOf(IntentUnresolvedError);
    expect(t.blocks({ a: 2 })).toBe(true);
    await t.run({ a: 1 }, async (k) => { keys.push(k); return 'ok'; });
    expect(keys[0]).toBe(keys[1]);
    expect(t.pending).toBeNull();
  });
  it('a definite rejection ends the intent; the next attempt uses a new key', async () => {
    const t = tracker(); const keys: string[] = [];
    await expect(t.run({ a: 1 }, async (k) => { keys.push(k); throw err(409, 'VERSION_CONFLICT'); })).rejects.toBeInstanceOf(ApiError);
    await t.run({ a: 1 }, async (k) => { keys.push(k); return 'ok'; });
    expect(keys[0]).not.toBe(keys[1]);
  });
  it('reconcile clears only on a definite receipt and keeps NONE-with-age as resend', async () => {
    const t = tracker();
    await expect(t.run({ a: 1 }, async () => { throw err(0, 'NETWORK_ERROR'); })).rejects.toBeInstanceOf(ApiError);
    const reply = (state: string) => createApiClient({ baseUrl: 'https://api.test', credentials: { kind: 'none' },
      fetch: async () => new Response(JSON.stringify({ data: { ...base, state, httpStatus: state === 'SUCCEEDED' ? 200 : null }, meta: { requestId: 'r', serverNow: 'x' } }), { status: 200, headers: { 'content-type': 'application/json' } }) });
    expect(await t.reconcile(reply('NONE'), 'updateMe')).toBe('resend');
    expect(t.pending).not.toBeNull();
    expect(await t.reconcile(reply('SUCCEEDED'), 'updateMe')).toBe('saved');
    expect(t.pending).toBeNull();
  });
});

describe('IntentTracker fencing (P04-R01)', () => {
  it('a repeated tap joins the in-flight request instead of minting a second key', async () => {
    let n = 0; const keys: string[] = []; let finish!: () => void;
    const t = new IntentTracker(() => `k${++n}`);
    const held = new Promise<void>((r) => { finish = r; });
    const a = t.run({ a: 1 }, async (k) => { keys.push(k); await held; return 'ok'; });
    const b = t.run({ a: 1 }, async (k) => { keys.push(k); return 'dup'; });
    await expect(t.run({ a: 2 }, async () => 'x')).rejects.toBeInstanceOf(IntentUnresolvedError);
    finish();
    expect(await a).toBe('ok'); expect(await b).toBe('ok');
    expect(keys).toEqual(['k1']);
  });
  it('reset fences late failures, late successes and late receipts', async () => {
    let n = 0; let fail!: (e: Error) => void;
    const t = new IntentTracker(() => `k${++n}`);
    const old = t.run({ a: 'old' }, () => new Promise<never>((_, r) => { fail = r; })).catch(() => undefined);
    const gen = t.generation;
    t.reset();
    expect(t.generation).not.toBe(gen);
    fail(err(0, 'NETWORK_ERROR')); await old;
    expect(t.pending).toBeNull();
  });
});
