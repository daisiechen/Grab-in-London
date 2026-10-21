import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { migrate } from '@fancy/db';
import { createMigratedDatabase, type MigratedDatabase } from '@fancy/testkit/db';
import { claimIntent, completeIntent, purgeExpiredIntents, releaseIntent, replayIfAuthorized, type IntentKey } from './idempotency.ts';
import { requestHash } from './canonical.ts';
import { withTransaction } from './transaction.ts';
import { FencingError } from './errors.ts';

const serverUrl = inject('pgServerUrl');
let db: MigratedDatabase;
beforeAll(async () => { db = await createMigratedDatabase(serverUrl, migrate); });
afterAll(async () => { await db.drop(); });

async function intent(body: unknown = { message: 'hello there, nice to meet you' }): Promise<IntentKey> {
  const { rows } = await db.pool.query<{ id: string }>(`INSERT INTO users DEFAULT VALUES RETURNING id`);
  return { actorId: rows[0]!.id, operation: 'applyMeal', key: randomUUID(), requestHash: requestHash({ method: 'POST', path: '/v1/meals/x/applications', body }) };
}

describe('ordinary write intents (30-day protocol)', () => {
  it('lets exactly one of two concurrent claims proceed; the other sees INTENT_IN_PROGRESS', async () => {
    const key = await intent();
    const results = await Promise.allSettled([claimIntent(db.pool, key), claimIntent(db.pool, key)]);
    const claimed = results.filter((r) => r.status === 'fulfilled' && r.value.kind === 'claimed');
    const busy = results.filter((r) => r.status === 'rejected');
    expect(claimed).toHaveLength(1);
    expect(busy).toHaveLength(1);
    expect((busy[0] as PromiseRejectedResult).reason).toMatchObject({ code: 'INTENT_IN_PROGRESS' });
  });

  it('replays the sealed response for the same request and refuses a changed payload', async () => {
    const key = await intent();
    const claim = await claimIntent(db.pool, key);
    if (claim.kind !== 'claimed') throw new Error('expected claim');
    await withTransaction(db.pool, (tx) => completeIntent(tx.client, claim, { status: 201, body: { data: { id: 'a1' } }, resourceId: randomUUID() }));
    const replay = await claimIntent(db.pool, key);
    expect(replay).toMatchObject({ kind: 'replay', status: 201, body: { data: { id: 'a1' } } });
    await expect(claimIntent(db.pool, { ...key, requestHash: requestHash({ method: 'POST', path: '/v1/meals/x/applications', body: { message: 'different' } }) }))
      .rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('stores stable business rejections but never 5xx outcomes', async () => {
    const key = await intent();
    const claim = await claimIntent(db.pool, key);
    if (claim.kind !== 'claimed') throw new Error('expected claim');
    await expect(withTransaction(db.pool, (tx) => completeIntent(tx.client, claim, { status: 500, body: {} }))).rejects.toThrow(/never sealed/);
    await withTransaction(db.pool, (tx) => completeIntent(tx.client, claim, { status: 409, body: { error: { code: 'MEAL_FULL' } } }));
    expect(await claimIntent(db.pool, key)).toMatchObject({ kind: 'replay', status: 409 });
  });

  it('releases a claim after an unexpected failure so the intent can retry at once', async () => {
    const key = await intent();
    const claim = await claimIntent(db.pool, key);
    if (claim.kind !== 'claimed') throw new Error('expected claim');
    await releaseIntent(db.pool, claim);
    expect((await claimIntent(db.pool, key)).kind).toBe('claimed');
  });

  it('takes over an abandoned claim after its lease, and the stale holder cannot complete', async () => {
    const key = await intent();
    const stale = await claimIntent(db.pool, key, 1);
    if (stale.kind !== 'claimed') throw new Error('expected claim');
    await new Promise((r) => setTimeout(r, 20));
    const fresh = await claimIntent(db.pool, key);
    expect(fresh.kind).toBe('claimed');
    await expect(withTransaction(db.pool, (tx) => completeIntent(tx.client, stale, { status: 201, body: {} }))).rejects.toBeInstanceOf(FencingError);
  });

  it('rolls back every write of a fenced stale attempt even with commitOnDomainError', async () => {
    await db.pool.query(`CREATE TABLE IF NOT EXISTS t02_probe (id uuid PRIMARY KEY, note text NOT NULL)`);
    const key = await intent();
    const stale = await claimIntent(db.pool, key, 1);
    if (stale.kind !== 'claimed') throw new Error('expected claim');
    await new Promise((r) => setTimeout(r, 20));
    const fresh = await claimIntent(db.pool, key);
    expect(fresh.kind).toBe('claimed');
    const probe = randomUUID();
    const outcome = await withTransaction(db.pool, async (tx) => {
      await tx.client.query(`INSERT INTO t02_probe (id, note) VALUES ($1, 'stale business write')`, [probe]);
      await completeIntent(tx.client, stale, { status: 201, body: { id: probe } });
    }, { commitOnDomainError: true }).catch((e: unknown) => e);
    expect(outcome).toBeInstanceOf(FencingError);
    expect(outcome).toMatchObject({ code: 'INTENT_IN_PROGRESS' });
    expect((await db.pool.query(`SELECT count(*) n FROM t02_probe WHERE id = $1`, [probe])).rows[0].n).toBe('0');
    expect((await db.pool.query(`SELECT state FROM idempotency WHERE key = $1`, [key.key])).rows[0].state).toBe('IN_PROGRESS');
  });

  it('refuses to replay after access is lost, without returning the stored body', async () => {
    const key = await intent();
    const claim = await claimIntent(db.pool, key);
    if (claim.kind !== 'claimed') throw new Error('expected claim');
    await withTransaction(db.pool, (tx) => completeIntent(tx.client, claim, { status: 201, body: { secret: 'private' } }));
    const replay = await claimIntent(db.pool, key);
    if (replay.kind !== 'replay') throw new Error('expected replay');
    await expect(replayIfAuthorized(replay, async () => false)).rejects.toMatchObject({ code: 'FORBIDDEN', message: expect.not.stringContaining('private') });
    expect(await replayIfAuthorized(replay, async () => true)).toEqual({ status: 201, body: { secret: 'private' } });
  });

  it('does not replay intents past the 30-day window and purges them', async () => {
    const key = await intent();
    const claim = await claimIntent(db.pool, key);
    if (claim.kind !== 'claimed') throw new Error('expected claim');
    await withTransaction(db.pool, (tx) => completeIntent(tx.client, claim, { status: 201, body: {} }));
    const { rows } = await db.pool.query(`SELECT expires_at - created_at AS window FROM idempotency WHERE key = $1`, [key.key]);
    expect(rows[0].window).toMatchObject({ days: 30 });
    await db.pool.query(`UPDATE idempotency SET created_at = now() - interval '31 days', expires_at = now() - interval '1 day' WHERE key = $1`, [key.key]);
    await expect(claimIntent(db.pool, key)).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT', message: expect.stringMatching(/too old/) });
    expect(await purgeExpiredIntents(db.pool)).toBeGreaterThanOrEqual(1);
    expect((await db.pool.query(`SELECT count(*) n FROM idempotency WHERE key = $1`, [key.key])).rows[0].n).toBe('0');
  });
});
