import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { migrate, type Pool, type PoolClient } from '@fancy/db';
import { createMigratedDatabase, type MigratedDatabase } from '@fancy/testkit/db';
import { BudgetLedger } from './budget.ts';

let db: MigratedDatabase;
let ledger: BudgetLedger;
let day: string;
let month: string;
beforeAll(async () => { db = await createMigratedDatabase(inject('pgServerUrl'), migrate); ledger = new BudgetLedger(db.pool); });
afterAll(async () => { await db.drop(); });
beforeEach(async () => {
  await db.pool.query('TRUNCATE ai_budget_reconciliations,ai_calls,ai_requests,ai_quota,ai_subjects,ai_session_meta,ai_preferences,ai_budget');
  const { rows: [period] } = await db.pool.query(`SELECT 'D:'||to_char(clock_timestamp() AT TIME ZONE 'Europe/London','YYYY-MM-DD') day_period,'M:'||to_char(clock_timestamp() AT TIME ZONE 'Europe/London','YYYY-MM') month_period`);
  day = period.day_period; month = period.month_period;
});
async function reservation(amount = 70n) {
  const actor = randomUUID(), session = randomUUID(), requestId = randomUUID();
  const subject = `user:${actor}`;
  await db.pool.query('INSERT INTO users(id) VALUES($1)', [actor]);
  await db.pool.query(`INSERT INTO ai_session_meta(id,subject,device_hash,revoke_hash,preference_epoch,last_activity_at,expires_at,status) VALUES($1,$2,'hash','hash',0,clock_timestamp(),clock_timestamp()+interval '30 minutes','ACTIVE')`, [session, subject]);
  await db.pool.query(`INSERT INTO ai_requests(subject,request_id,session_id,generation,payload_hmac,state,deadline,quota_date) VALUES($1,$2,$3,1,'hmac','PENDING',clock_timestamp()+interval '30 seconds',current_date)`, [subject, requestId, session]);
  return { callId: randomUUID(), subject, requestId, priceVersion: 'synthetic-concurrency-only', maxMicroCny: amount, actor };
}
async function configure(cap = 200n, calls = 20) { await ledger.configure(day, cap, calls, true); await ledger.configure(month, cap, calls, true); }
const totals = async () => (await db.pool.query(`SELECT used_micro_cny::text used,reserved_micro_cny::text reserved,calls,enabled FROM ai_budget WHERE period=$1`, [month])).rows[0];

/** Actual two PG backends: pause only AFTER each successful INSERT has acquired its real FK locks. */
async function concurrentReserves(a: Awaited<ReturnType<typeof reservation>>, b: Awaited<ReturnType<typeof reservation>>) {
  const clients = await Promise.all([db.pool.connect(), db.pool.connect()]);
  const pids = await Promise.all(clients.map(async c => (await c.query('SELECT pg_backend_pid() pid')).rows[0].pid));
  expect(new Set(pids).size).toBe(2);
  let inserted = 0, releaseBarrier!: () => void, rejectBarrier!: (error: Error) => void;
  const barrier = new Promise<void>((resolve, reject) => { releaseBarrier = resolve; rejectBarrier = reject; });
  const timeout = setTimeout(() => rejectBarrier(new Error('actual post-INSERT barrier was not reached')), 5000);
  let next = 0;
  const observing = clients.map(c => new Proxy(c, {
    get(target, key) {
      if (key === 'release') return () => {}; // release the owned clients in finally, after the real transaction ends.
      if (key === 'query') return async (sql: string, values?: unknown[]) => {
        const result = await target.query(sql, values);
        if (/INSERT INTO ai_calls\(/.test(sql)) { inserted++; if (inserted === 2) releaseBarrier(); await barrier; }
        return result;
      };
      return Reflect.get(target, key);
    },
  })) as PoolClient[];
  const pool = Object.create(db.pool) as Pool;
  Object.defineProperty(pool, 'connect', { value: async () => {
    const c = observing[next++]; if (!c) throw new Error('unexpected third transaction'); return c;
  } });
  try {
    const actual = new BudgetLedger(pool);
    const outcomes = await Promise.allSettled([actual.reserve(a), actual.reserve(b)]);
    expect(inserted).toBe(2);
    const codes = outcomes.map(x => x.status === 'fulfilled' ? 'ADMITTED' : String(x.reason.code ?? x.reason.message));
    // Codes and distinct backend count only; no PID, SQL parameters, subject or payload logging.
    console.warn('REAL_PG_POST_INSERT_BARRIER', { distinctBackendConnections: new Set(pids).size, inserted, codes });
    return outcomes;
  } finally { clearTimeout(timeout); clients.forEach(c => c.release()); }
}

describe('budget FK lock compatibility on separate actual PG connections', () => {
  it('admits both independently valid reservations after both FK INSERTs without lock-upgrade deadlock', async () => {
    await configure();
    const outcomes = await concurrentReserves(await reservation(), await reservation());
    expect(outcomes.map(x => x.status)).toEqual(['fulfilled', 'fulfilled']);
    expect(await totals()).toMatchObject({ used: '0', reserved: '140', calls: 2 });
  });
  it('still admits only one at the exact money cap without deadlock or over-admission', async () => {
    await configure(100n);
    const outcomes = await concurrentReserves(await reservation(), await reservation());
    expect(outcomes.filter(x => x.status === 'fulfilled')).toHaveLength(1);
    const rejected = outcomes.find(x => x.status === 'rejected');
    expect(rejected?.status === 'rejected' && rejected.reason.code).toBe('AI_BUDGET_EXCEEDED');
    expect(await totals()).toMatchObject({ used: '0', reserved: '70', calls: 1 });
  });
  it('still enforces the exact global call cap', async () => {
    await configure(200n, 1);
    const outcomes = await concurrentReserves(await reservation(), await reservation());
    expect(outcomes.filter(x => x.status === 'fulfilled')).toHaveLength(1);
    const rejected = outcomes.find(x => x.status === 'rejected');
    expect(rejected?.status === 'rejected' && rejected.reason.code).toBe('AI_BUDGET_EXCEEDED');
    expect(await totals()).toMatchObject({ reserved: '70', calls: 1 });
  });
  it('preserves cancellation, dispatch CAS, UNKNOWN reservation and explicit reconciliation accounting', async () => {
    await configure(500n);
    const cancelled = await reservation(), unknown = await reservation(), known = await reservation();
    await ledger.reserve(cancelled); expect(await ledger.cancelBeforeDispatch(cancelled.callId)).toBe(true);
    await ledger.reserve(unknown); expect(await ledger.dispatch(unknown.callId)).toBe(true);
    expect(await ledger.dispatch(unknown.callId)).toBe(false); await ledger.unknown(unknown.callId); await ledger.recoverAfterRestart();
    expect(await totals()).toMatchObject({ used: '0', reserved: '70', calls: 2 });
    await ledger.reserve(known); expect(await ledger.dispatch(known.callId)).toBe(true);
    await ledger.settle(known.callId, 30n, { inputTokens: 10, outputTokens: 20, providerRequestId: 'synthetic-known' });
    expect(await totals()).toMatchObject({ used: '30', reserved: '70', calls: 3 });
    const row = (await db.pool.query('SELECT version::text FROM ai_calls WHERE call_id=$1', [unknown.callId])).rows[0];
    const reconciliation = { callId: unknown.callId, expectedVersion: row.version, key: randomUUID(), actualMicroCny: 20n, providerReference: 'synthetic-explicit-reconciliation', actorId: unknown.actor, reason: 'Controlled local accounting regression only.', roles: ['ai_budget_ops'], mfa: true };
    expect(await ledger.reconcile(reconciliation)).toBe(true); expect(await ledger.reconcile(reconciliation)).toBe(false);
    expect(await totals()).toMatchObject({ used: '50', reserved: '0', calls: 3 });
  });
  it('still cancels undispatched money when an approved period is disabled', async () => {
    await configure(); const r = await reservation(); await ledger.reserve(r);
    await db.pool.query('UPDATE ai_budget SET enabled=false WHERE period=$1', [day]);
    expect(await ledger.dispatch(r.callId)).toBe(false);
    expect(await totals()).toMatchObject({ used: '0', reserved: '0', calls: 1 });
  });
});
