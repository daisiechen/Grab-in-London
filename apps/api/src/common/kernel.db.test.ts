import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import type pg from 'pg';
import { migrate } from '@fancy/db';
import { createGates, createMigratedDatabase, waitForLockWaiters, type MigratedDatabase } from '@fancy/testkit/db';
import { DomainError, InvariantError } from './errors.ts';
import { registerLockTable } from './locks.ts';
import { withTransaction } from './transaction.ts';
import { lockActiveActor } from './actor.ts';

const serverUrl = inject('pgServerUrl');
let db: MigratedDatabase;
// Fixture-only table at the meal level so ordering across levels can be exercised before T07 exists.
const FIXTURE = 't02_fixture_meals';

beforeAll(async () => {
  db = await createMigratedDatabase(serverUrl, migrate);
  await db.pool.query(`CREATE TABLE ${FIXTURE} (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), n int NOT NULL DEFAULT 0)`);
  registerLockTable(FIXTURE, 'meal');
});
afterAll(async () => { await db.drop(); });

const newUser = async (status = 'ACTIVE') => (await db.pool.query<{ id: string }>(`INSERT INTO users (status) VALUES ($1) RETURNING id`, [status])).rows[0]!.id;
const newMeal = async () => (await db.pool.query<{ id: string }>(`INSERT INTO ${FIXTURE} DEFAULT VALUES RETURNING id`)).rows[0]!.id;

describe('lock order discipline', () => {
  it('locks ascending ids within a level and refuses lower levels after higher ones', async () => {
    const [a, b] = [await newUser(), await newUser()].sort();
    const meal = await newMeal();
    await withTransaction(db.pool, async (tx) => {
      const rows = await tx.locks.lock('users', [b!, a!], 'share');
      expect(rows.map((r) => r.id)).toEqual([a, b]);
      await tx.locks.lock(FIXTURE, [meal], 'update');
      await expect(tx.locks.lock('users', [a!], 'share')).rejects.toBeInstanceOf(InvariantError);
    });
    await withTransaction(db.pool, async (tx) => {
      await tx.locks.lock('users', [b!], 'share');
      await expect(tx.locks.lock('users', [a!], 'share')).rejects.toThrow(/not after/);
    });
  });

  it('refuses any lock after effectiveNow and unregistered tables', async () => {
    const user = await newUser();
    await withTransaction(db.pool, async (tx) => {
      await tx.effectiveNow();
      await expect(tx.locks.lock('users', [user], 'share')).rejects.toThrow(/before effectiveNow/);
      await expect(tx.locks.privacyControl()).rejects.toThrow(/before effectiveNow/);
    });
    await withTransaction(db.pool, async (tx) => {
      await expect(tx.locks.lock('jobs', [user], 'share')).rejects.toThrow(/not registered/);
    });
  });

  it('makes privacy_control the last lock of a transaction', async () => {
    const user = await newUser();
    await withTransaction(db.pool, async (tx) => {
      await tx.locks.lock('users', [user], 'update');
      expect(await tx.locks.privacyControl()).toBe(0n);
      await expect(tx.locks.lock(FIXTURE, [await newMeal()], 'update')).rejects.toThrow(/lock order violation/);
    });
  });

  it('serialises opposite-order requests without deadlock because ids are sorted', async () => {
    const [a, b] = [await newUser(), await newUser()];
    const gates = createGates();
    const first = withTransaction(db.pool, async (tx) => {
      await tx.locks.lock('users', [a!, b!], 'update');
      gates.open('first-holds');
      await gates.wait('release-first');
      return 'first';
    });
    await gates.wait('first-holds');
    const second = withTransaction(db.pool, async (tx) => {
      await tx.locks.lock('users', [b!, a!], 'update');
      return 'second';
    });
    await waitForLockWaiters(db.pool, 1);
    gates.open('release-first');
    expect(await Promise.all([first, second])).toEqual(['first', 'second']);
  });

  it('retries a real deadlock (40P01) as a whole new attempt', async () => {
    const [a, b] = [await newUser(), await newUser()];
    const raw: pg.Client = await db.connect();
    await raw.query('BEGIN');
    await raw.query(`SELECT 1 FROM users WHERE id = $1 FOR UPDATE`, [b]);
    const retries: string[] = [];
    let attempts = 0;
    const kernel = withTransaction(db.pool, async (tx) => {
      attempts++;
      await tx.locks.lock('users', [a!], 'update');
      await tx.client.query(`SELECT 1 FROM users WHERE id = $1 FOR UPDATE`, [b]); // waits for raw
      return 'ok';
    }, { onRetry: (code) => retries.push(code) });
    await waitForLockWaiters(db.pool, 1);
    // raw now requests a in the opposite order: one side is chosen as the deadlock victim.
    const rawSide = raw.query(`SELECT 1 FROM users WHERE id = $1 FOR UPDATE`, [a]).then(() => 'raw-got-a', (e: { code: string }) => e.code);
    const rawResult = await Promise.race([rawSide, kernel.then(() => 'kernel-first')]);
    if (rawResult === '40P01') {
      await raw.query('ROLLBACK');
      expect(await kernel).toBe('ok');
      expect(retries).toEqual([]);
    } else {
      await raw.query('COMMIT');
      expect(await kernel).toBe('ok');
      expect(retries).toEqual(['40P01']);
      expect(attempts).toBe(2);
    }
  });
});

describe('effectiveNow', () => {
  it('is read after the lock wait, not at transaction start', async () => {
    const meal = await newMeal();
    const gates = createGates();
    let holderCommittedAt!: Date;
    const holder = withTransaction(db.pool, async (tx) => {
      await tx.locks.lock(FIXTURE, [meal], 'update');
      gates.open('held');
      await gates.wait('release');
      holderCommittedAt = await tx.effectiveNow();
    });
    await gates.wait('held');
    let waiterStart!: Date;
    const waiter = withTransaction(db.pool, async (tx) => {
      waiterStart = (await tx.client.query<{ now: Date }>('SELECT now() AS now')).rows[0]!.now;
      await tx.locks.lock(FIXTURE, [meal], 'update');
      const first = await tx.effectiveNow();
      expect(await tx.effectiveNow()).toBe(first); // one instant per command
      return first;
    });
    await waitForLockWaiters(db.pool, 1);
    await new Promise((r) => setTimeout(r, 50));
    gates.open('release');
    await holder;
    const effective = await waiter;
    expect(effective.getTime()).toBeGreaterThan(waiterStart.getTime());
    expect(effective.getTime()).toBeGreaterThanOrEqual(holderCommittedAt.getTime());
  });
});

describe('transaction outcome', () => {
  it('rolls back unexpected errors and optionally commits facts before a DomainError', async () => {
    const meal = await newMeal();
    await expect(withTransaction(db.pool, async (tx) => {
      await tx.client.query(`UPDATE ${FIXTURE} SET n = 1 WHERE id = $1`, [meal]);
      throw new Error('boom');
    })).rejects.toThrow('boom');
    expect((await db.pool.query(`SELECT n FROM ${FIXTURE} WHERE id = $1`, [meal])).rows[0].n).toBe(0);
    await expect(withTransaction(db.pool, async (tx) => {
      await tx.client.query(`UPDATE ${FIXTURE} SET n = 2 WHERE id = $1`, [meal]);
      throw new DomainError('DEADLINE_PASSED', 'Applications are closed.');
    }, { commitOnDomainError: true })).rejects.toMatchObject({ code: 'DEADLINE_PASSED', status: 409 });
    expect((await db.pool.query(`SELECT n FROM ${FIXTURE} WHERE id = $1`, [meal])).rows[0].n).toBe(2);
  });
});

describe('deletion barrier on the actor row', () => {
  it('blocks deletion (FOR UPDATE) until an in-flight write holding FOR SHARE commits', async () => {
    const user = await newUser();
    const gates = createGates();
    const order: string[] = [];
    const write = withTransaction(db.pool, async (tx) => {
      await lockActiveActor(tx, user);
      gates.open('write-holds');
      await gates.wait('finish-write');
      order.push('write');
    });
    await gates.wait('write-holds');
    const deletion = withTransaction(db.pool, async (tx) => {
      await lockActiveActor(tx, user, 'update');
      await tx.client.query(`UPDATE users SET status = 'DELETING' WHERE id = $1`, [user]);
      order.push('delete');
    });
    await waitForLockWaiters(db.pool, 1);
    gates.open('finish-write');
    await Promise.all([write, deletion]);
    expect(order).toEqual(['write', 'delete']);
    await expect(withTransaction(db.pool, (tx) => lockActiveActor(tx, user))).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
  });

  it('rejects unknown and deleted actors', async () => {
    const deleted = await newUser('DELETED');
    await expect(withTransaction(db.pool, (tx) => lockActiveActor(tx, deleted))).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
    await expect(withTransaction(db.pool, (tx) => lockActiveActor(tx, '6a1f6c32-6c4e-4c4d-9a51-6c1d0e5f9b11'))).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
  });
});
