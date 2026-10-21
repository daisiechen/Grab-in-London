import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { cancelPendingJobs, claimJobs, enqueueJob, migrate, oldestPendingDueAt } from '@fancy/db';
import { createMigratedDatabase, type MigratedDatabase } from '@fancy/testkit/db';
import { getEventListeners } from 'node:events';
import { createRunner, idle } from './runner.ts';

const serverUrl = inject('pgServerUrl');
let db: MigratedDatabase;
beforeAll(async () => { db = await createMigratedDatabase(serverUrl, migrate); });
afterAll(async () => { await db.drop(); });

const past = (ms = 1000) => new Date(Date.now() - ms);
const state = async (resourceId: string) => (await db.pool.query(`SELECT state, attempts, last_error FROM jobs WHERE resource_id = $1`, [resourceId])).rows[0];

describe('durable job runner', () => {
  it('schedules each (kind, resource, dueAt) once', async () => {
    const id = randomUUID();
    const due = past();
    expect(await enqueueJob(db.pool, { kind: 't02.dedupe', resourceId: id, dueAt: due })).toBe(true);
    expect(await enqueueJob(db.pool, { kind: 't02.dedupe', resourceId: id, dueAt: due })).toBe(false);
    expect(await enqueueJob(db.pool, { kind: 't02.dedupe', resourceId: id, dueAt: new Date(due.getTime() + 1) })).toBe(true);
  });

  it('gives concurrent workers disjoint jobs via SKIP LOCKED', async () => {
    for (let i = 0; i < 6; i++) await enqueueJob(db.pool, { kind: 't02.disjoint', resourceId: randomUUID(), dueAt: past() });
    const [a, b] = await Promise.all([
      claimJobs(db.pool, { owner: 'w1', kinds: ['t02.disjoint'], limit: 4, leaseMs: 60_000 }),
      claimJobs(db.pool, { owner: 'w2', kinds: ['t02.disjoint'], limit: 4, leaseMs: 60_000 }),
    ]);
    const ids = [...a, ...b].map((j) => j.id);
    expect(ids).toHaveLength(6);
    expect(new Set(ids).size).toBe(6);
  });

  it('does not run jobs before they are due', async () => {
    const id = randomUUID();
    await enqueueJob(db.pool, { kind: 't02.future', resourceId: id, dueAt: new Date(Date.now() + 60_000) });
    expect(await claimJobs(db.pool, { owner: 'w', kinds: ['t02.future'], limit: 5, leaseMs: 1000 })).toEqual([]);
    expect((await state(id)).state).toBe('PENDING');
  });

  it('completes handled jobs; a claim alone is not completion', async () => {
    const id = randomUUID();
    await enqueueJob(db.pool, { kind: 't02.ok', resourceId: id, dueAt: past() });
    const seen: string[] = [];
    const runner = createRunner({ pool: db.pool, owner: 'w', handlers: { 't02.ok': async (job) => { seen.push(job.resourceId); expect((await state(id)).state).toBe('RUNNING'); } } });
    expect(await runner.tick()).toMatchObject({ claimed: 1, done: 1 });
    expect(seen).toEqual([id]);
    expect(await state(id)).toMatchObject({ state: 'DONE', attempts: 1 });
    expect(await runner.tick()).toMatchObject({ claimed: 0 });
  });

  it('retries failures with backoff and marks them DEAD after max attempts', async () => {
    const id = randomUUID();
    await enqueueJob(db.pool, { kind: 't02.fail', resourceId: id, dueAt: past(), maxAttempts: 2 });
    const dead: string[] = [];
    const fail = Object.assign(new Error('timeout talking to provider'), { code: 'PROVIDER_TIMEOUT' });
    const runner = createRunner({ pool: db.pool, owner: 'w', retryBaseMs: 1, handlers: { 't02.fail': async () => { throw fail; } }, onDead: (job) => dead.push(job.resourceId) });
    expect(await runner.tick()).toMatchObject({ claimed: 1, retried: 1 });
    expect(await state(id)).toMatchObject({ state: 'PENDING', attempts: 1, last_error: 'PROVIDER_TIMEOUT' });
    await new Promise((r) => setTimeout(r, 10));
    expect(await runner.tick()).toMatchObject({ claimed: 1, dead: 1 });
    expect(await state(id)).toMatchObject({ state: 'DEAD', attempts: 2 });
    expect(dead).toEqual([id]);
  });

  it('reclaims a job whose worker died mid-lease; the dead worker cannot complete it', async () => {
    const id = randomUUID();
    await enqueueJob(db.pool, { kind: 't02.crash', resourceId: id, dueAt: past() });
    const [crashed] = await claimJobs(db.pool, { owner: 'dead-worker', kinds: ['t02.crash'], limit: 1, leaseMs: 1 });
    await new Promise((r) => setTimeout(r, 20));
    const runner = createRunner({ pool: db.pool, owner: 'w2', handlers: { 't02.crash': async () => undefined } });
    expect(await runner.tick()).toMatchObject({ claimed: 1, done: 1 });
    const { completeJob } = await import('@fancy/db');
    expect(await completeJob(db.pool, crashed!)).toBe(false);
    expect(await state(id)).toMatchObject({ state: 'DONE', attempts: 2 });
  });

  it('never persists or forwards raw error messages (they may carry secrets)', async () => {
    const id = randomUUID();
    const sentinel = 'Bearer sk-SENTINEL-do-not-store user@example.test';
    await enqueueJob(db.pool, { kind: 't02.secret', resourceId: id, dueAt: past(), maxAttempts: 1 });
    const alerts: unknown[] = [];
    const runner = createRunner({ pool: db.pool, owner: 'w', handlers: { 't02.secret': async () => { throw Object.assign(new Error(sentinel), { code: sentinel }); } }, onDead: (...args) => alerts.push(args) });
    expect(await runner.tick()).toMatchObject({ dead: 1 });
    const { rows } = await db.pool.query(`SELECT row_to_json(j)::text AS row FROM jobs j WHERE resource_id = $1`, [id]);
    expect(rows[0].row).not.toContain('SENTINEL');
    expect(await state(id)).toMatchObject({ state: 'DEAD', last_error: 'HANDLER_ERROR' });
    expect(JSON.stringify(alerts)).not.toContain('SENTINEL');
    expect(alerts).toEqual([[{ id: expect.any(String), kind: 't02.secret', resourceId: id }, 'HANDLER_ERROR']]);
    const { failJob } = await import('@fancy/db');
    // @ts-expect-error only JobErrorCode values are accepted
    await expect(failJob(db.pool, { id, claimToken: randomUUID() }, 'TOKEN_SECRET_SENTINEL')).rejects.toThrow(/allowlisted error code/);
  });

  it('collapses unknown upper-case codes to HANDLER_ERROR and the DB refuses them too', async () => {
    const id = randomUUID();
    await enqueueJob(db.pool, { kind: 't02.unknown_code', resourceId: id, dueAt: past(), maxAttempts: 1 });
    const alerts: string[] = [];
    const runner = createRunner({ pool: db.pool, owner: 'w', handlers: { 't02.unknown_code': async () => { throw Object.assign(new Error('x'), { code: 'TOKEN_SECRET_SENTINEL' }); } }, onDead: (_job, code) => alerts.push(code) });
    expect(await runner.tick()).toMatchObject({ dead: 1 });
    expect(alerts).toEqual(['HANDLER_ERROR']);
    expect(await state(id)).toMatchObject({ last_error: 'HANDLER_ERROR' });
    await expect(db.pool.query(`UPDATE jobs SET last_error = 'TOKEN_SECRET_SENTINEL' WHERE resource_id = $1`, [id])).rejects.toMatchObject({ code: '23514' });
    const { jobErrorCode } = await import('@fancy/db');
    expect(jobErrorCode(Object.assign(new Error(), { code: 'PROVIDER_TIMEOUT' }))).toBe('PROVIDER_TIMEOUT');
    expect(jobErrorCode({ code: 'provider_timeout' })).toBe('HANDLER_ERROR');
    expect(jobErrorCode('PROVIDER_TIMEOUT')).toBe('HANDLER_ERROR');
  });

  it('fences a stale attempt by claim token even when the same owner reclaimed the job', async () => {
    const id = randomUUID();
    await enqueueJob(db.pool, { kind: 't02.same_owner', resourceId: id, dueAt: past() });
    const [stale] = await claimJobs(db.pool, { owner: 'w-same', kinds: ['t02.same_owner'], limit: 1, leaseMs: 1 });
    await new Promise((r) => setTimeout(r, 20));
    const [fresh] = await claimJobs(db.pool, { owner: 'w-same', kinds: ['t02.same_owner'], limit: 1, leaseMs: 60_000 });
    expect(fresh!.id).toBe(stale!.id);
    expect(fresh!.claimToken).not.toBe(stale!.claimToken);
    const { completeJob, failJob } = await import('@fancy/db');
    expect(await completeJob(db.pool, stale!)).toBe(false);
    expect(await failJob(db.pool, stale!, 'PROVIDER_TIMEOUT')).toBe('LOST');
    expect(await state(id)).toMatchObject({ state: 'RUNNING', attempts: 2 });
    expect(await completeJob(db.pool, fresh!)).toBe(true);
    expect(await state(id)).toMatchObject({ state: 'DONE' });
  });

  it('stops reclaiming after max attempts of expired leases and marks the job DEAD', async () => {
    const id = randomUUID();
    await enqueueJob(db.pool, { kind: 't02.crashloop', resourceId: id, dueAt: past(), maxAttempts: 2 });
    for (let i = 0; i < 2; i++) {
      expect(await claimJobs(db.pool, { owner: `crash-${i}`, kinds: ['t02.crashloop'], limit: 1, leaseMs: 1 })).toHaveLength(1);
      await new Promise((r) => setTimeout(r, 20));
    }
    expect(await claimJobs(db.pool, { owner: 'crash-3', kinds: ['t02.crashloop'], limit: 1, leaseMs: 1 })).toEqual([]);
    const alerts: string[] = [];
    const runner = createRunner({ pool: db.pool, owner: 'w', handlers: { 't02.crashloop': async () => undefined }, onDead: (_job, code) => alerts.push(code) });
    expect(await runner.tick()).toMatchObject({ claimed: 0, dead: 1 });
    expect(alerts).toEqual(['LEASE_EXPIRED']);
    expect(await state(id)).toMatchObject({ state: 'DEAD', attempts: 2, last_error: 'LEASE_EXPIRED' });
  });

  it('does not accumulate abort listeners across idle polls and stops promptly on abort', async () => {
    const controller = new AbortController();
    let ticks = 0;
    const runner = createRunner({ pool: db.pool, owner: 'w-idle', handlers: { 't02.never_enqueued': async () => undefined } });
    const tick = runner.tick;
    const counted = { ...runner, tick: async () => { ticks++; return tick(); } };
    const loop = (async () => {
      while (!controller.signal.aborted) {
        const { claimed } = await counted.tick();
        if (!claimed) await idle(controller.signal, 1);
        expect(getEventListeners(controller.signal, 'abort').length).toBe(0);
        if (ticks >= 20) controller.abort();
      }
    })();
    await loop;
    expect(ticks).toBe(20);
    // run() itself: abort during an idle wait resolves and leaves no listener behind.
    const c2 = new AbortController();
    const running = runner.run(c2.signal, 60_000);
    for (let i = 0; i < 500 && getEventListeners(c2.signal, 'abort').length === 0; i++) await new Promise((r) => setTimeout(r, 5));
    expect(getEventListeners(c2.signal, 'abort').length).toBe(1); // exactly one, while idling
    c2.abort();
    await running;
    expect(getEventListeners(c2.signal, 'abort').length).toBe(0);
  });

  it('idle resolves immediately for an already-aborted signal', async () => {
    const c = new AbortController();
    c.abort();
    await idle(c.signal, 60_000);
    expect(getEventListeners(c.signal, 'abort').length).toBe(0);
  });

  it('cancels only pending work and reports the oldest unfinished due time', async () => {
    const id = randomUUID();
    const due = past(5_000);
    await enqueueJob(db.pool, { kind: 't02.cancel', resourceId: id, dueAt: due });
    expect((await oldestPendingDueAt(db.pool))!.getTime()).toBeLessThanOrEqual(due.getTime());
    const client = await db.pool.connect();
    try {
      expect(await cancelPendingJobs(client, 't02.cancel', id)).toBe(1);
    } finally {
      client.release();
    }
    expect(await state(id)).toBeUndefined();
  });
});
