import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { migrate } from '@fancy/db';
import { createGates, createMigratedDatabase, waitForLockWaiters, type MigratedDatabase } from '@fancy/testkit/db';
import { withTransaction } from '../common/transaction.ts';
import {
  allocateMessageSeq, createGroupConversation, dissolveConversation, intervalsFor, isVisible, joinConversation, leaveConversation,
} from './intervals.ts';

const serverUrl = inject('pgServerUrl');
let db: MigratedDatabase;
beforeAll(async () => { db = await createMigratedDatabase(serverUrl, migrate); });
afterAll(async () => { await db.drop(); });

const user = async () => (await db.pool.query<{ id: string }>(`INSERT INTO users DEFAULT VALUES RETURNING id`)).rows[0]!.id;
const now = new Date();
async function group() {
  const host = await user();
  const { conversationId } = await withTransaction(db.pool, (tx) => createGroupConversation(tx, { mealId: randomUUID(), hostId: host, effectiveAt: now }));
  return { host, conversationId };
}
const events = async (conversationId: string) =>
  (await db.pool.query<{ seq: string; kind: string }>(`SELECT seq, kind FROM conversation_events WHERE conversation_id = $1 ORDER BY seq`, [conversationId])).rows.map((r) => `${r.seq}:${r.kind}`);
const tx = <T>(fn: Parameters<typeof withTransaction<T>>[1]) => withTransaction(db.pool, fn);

describe('S14 conversation kernel', () => {
  it('creates the group with the host joined at seq 1', async () => {
    const { host, conversationId } = await group();
    expect(await events(conversationId)).toEqual(['1:JOIN']);
    expect(await intervalsFor(db.pool as never, conversationId, host)).toEqual([{ joinSeq: 1n, leaveSeq: null }]);
  });

  it('gives JOIN/MESSAGE/LEAVE one gap-free sequence and records each rejoin as a new interval', async () => {
    const { host, conversationId } = await group();
    const guest = await user();
    expect(await tx((t) => joinConversation(t, conversationId, guest, now))).toEqual({ joinSeq: 2n, created: true });
    expect(await tx((t) => joinConversation(t, conversationId, guest, now))).toEqual({ joinSeq: 2n, created: false });
    expect(await tx((t) => allocateMessageSeq(t, conversationId, host, now))).toBe(3n);
    expect(await tx((t) => leaveConversation(t, conversationId, guest, now))).toEqual({ leaveSeq: 4n });
    expect(await tx((t) => leaveConversation(t, conversationId, guest, now))).toEqual({ leaveSeq: null });
    expect(await tx((t) => allocateMessageSeq(t, conversationId, host, now))).toBe(5n);
    await expect(tx((t) => allocateMessageSeq(t, conversationId, guest, now))).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(await tx((t) => joinConversation(t, conversationId, guest, now))).toEqual({ joinSeq: 6n, created: true });
    expect(await tx((t) => allocateMessageSeq(t, conversationId, host, now))).toBe(7n);
    expect(await events(conversationId)).toEqual(['1:JOIN', '2:JOIN', '3:MESSAGE', '4:LEAVE', '5:MESSAGE', '6:JOIN', '7:MESSAGE']);
    const intervals = await intervalsFor(db.pool as never, conversationId, guest);
    expect(intervals).toEqual([{ joinSeq: 2n, leaveSeq: 4n }, { joinSeq: 6n, leaveSeq: null }]);
    expect([3n, 5n, 7n].map((s) => isVisible(s, intervals))).toEqual([true, false, true]);
  });

  it('commits in seq order: a writer queued on the conversation lock gets the next seq after the holder commits', async () => {
    const { host, conversationId } = await group();
    const gates = createGates();
    const first = tx(async (t) => {
      const seq = await allocateMessageSeq(t, conversationId, host, now);
      gates.open('allocated');
      await gates.wait('commit');
      return seq;
    });
    await gates.wait('allocated');
    const second = tx((t) => allocateMessageSeq(t, conversationId, host, now));
    await waitForLockWaiters(db.pool, 1);
    // While the holder is uncommitted, readers see only the committed head.
    expect((await db.pool.query(`SELECT head FROM conversations WHERE id = $1`, [conversationId])).rows[0].head).toBe('1');
    gates.open('commit');
    expect([await first, await second]).toEqual([2n, 3n]);
  });

  it('leaves no published hole when an allocation rolls back', async () => {
    const { host, conversationId } = await group();
    await expect(tx(async (t) => {
      await allocateMessageSeq(t, conversationId, host, now);
      throw new Error('message insert failed');
    })).rejects.toThrow('message insert failed');
    expect(await tx((t) => allocateMessageSeq(t, conversationId, host, now))).toBe(2n);
    expect(await events(conversationId)).toEqual(['1:JOIN', '2:MESSAGE']);
  });

  it('dissolves once, closing every open interval at the same seq, and never reopens', async () => {
    const { host, conversationId } = await group();
    const [a, b] = [await user(), await user()];
    await tx((t) => joinConversation(t, conversationId, a, now));
    await tx((t) => joinConversation(t, conversationId, b, now));
    await tx((t) => leaveConversation(t, conversationId, b, now));
    expect(await tx((t) => dissolveConversation(t, conversationId, host, now))).toEqual({ dissolveSeq: 5n, alreadyDissolved: false });
    expect(await tx((t) => dissolveConversation(t, conversationId, host, now))).toEqual({ dissolveSeq: 5n, alreadyDissolved: true });
    expect(await intervalsFor(db.pool as never, conversationId, host)).toEqual([{ joinSeq: 1n, leaveSeq: 5n }]);
    expect(await intervalsFor(db.pool as never, conversationId, a)).toEqual([{ joinSeq: 2n, leaveSeq: 5n }]);
    expect(await intervalsFor(db.pool as never, conversationId, b)).toEqual([{ joinSeq: 3n, leaveSeq: 4n }]);
    await expect(tx((t) => joinConversation(t, conversationId, b, now))).rejects.toMatchObject({ code: 'STATE_CONFLICT' });
    await expect(tx((t) => allocateMessageSeq(t, conversationId, host, now))).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(await tx((t) => leaveConversation(t, conversationId, a, now))).toEqual({ leaveSeq: null });
  });

  it('enforces interval and event invariants in the database', async () => {
    const { host, conversationId } = await group();
    await expect(db.pool.query(`INSERT INTO membership_intervals (conversation_id, user_id, join_seq) VALUES ($1, $2, 1)`, [conversationId, host])).rejects.toMatchObject({ code: '23505' });
    await expect(db.pool.query(`UPDATE membership_intervals SET leave_seq = 1 WHERE conversation_id = $1`, [conversationId])).rejects.toMatchObject({ code: '23514' });
    await expect(db.pool.query(`UPDATE membership_intervals SET leave_seq = 99 WHERE conversation_id = $1`, [conversationId])).rejects.toMatchObject({ code: '23503' });
    await expect(db.pool.query(`DELETE FROM conversation_events WHERE conversation_id = $1`, [conversationId])).rejects.toThrow(/append-only/);
    await expect(db.pool.query(`INSERT INTO conversations (kind) VALUES ('GROUP')`)).rejects.toMatchObject({ code: '23514' });
    await expect(db.pool.query(`INSERT INTO conversations (kind, pair_id) VALUES ('DIRECT', gen_random_uuid())`).then(async () =>
      db.pool.query(`UPDATE conversations SET dissolved_at = now(), dissolved_seq = 0 WHERE kind = 'DIRECT'`))).rejects.toMatchObject({ code: '23514' });
  });

  it('refuses to dissolve a direct conversation', async () => {
    const a = await user();
    const { rows } = await db.pool.query<{ id: string }>(`INSERT INTO conversations (kind, pair_id) VALUES ('DIRECT', gen_random_uuid()) RETURNING id`);
    await expect(tx((t) => dissolveConversation(t, rows[0]!.id, a, now))).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
