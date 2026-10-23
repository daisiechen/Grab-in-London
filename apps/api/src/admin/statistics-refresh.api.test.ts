import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { createHarness, type Harness } from '../test/harness.ts';
import { sealSourceSnapshot } from './snapshots.ts';
import { createStatisticsRefresh, readStatisticsRefresh, retryStatisticsRefresh, statisticsRefreshTick } from './statistics-refresh.ts';
let h: Harness;
beforeAll(async () => { h = await createHarness(inject('pgServerUrl')); });
afterAll(async () => { await h.close(); });

const user = async () => (await h.db.pool.query<{ id: string }>(`INSERT INTO users DEFAULT VALUES RETURNING id`)).rows[0]!.id;
const classify = async (target: string, actor: string, classification = 'test', createdAt = 'clock_timestamp()') =>
  (await h.db.pool.query<{ revision: string }>(`INSERT INTO account_classifications(user_id,classification,actor_id,reason,created_at) VALUES($1,$2,$3,'Synthetic fixture',${createdAt}) RETURNING revision::text`, [target, classification, actor])).rows[0]!.revision;
const refresh = async (actor: string, target: string, acceptedRevision: string) => {
  const c = await h.db.pool.connect();
  try { return await createStatisticsRefresh(c, { actorId: actor, intentKey: randomUUID(), requestId: 'req-synthetic', targetUserId: target, acceptedRevision }); } finally { c.release(); }
};
const seal = () => sealSourceSnapshot(h.db.pool, new Date('2026-01-01'));
const classificationRows = async (target: string) => (await h.db.pool.query(`SELECT 1 FROM account_classifications WHERE user_id=$1`, [target])).rowCount;

describe('PATCH-006 statistics refresh bound to target user + original intent + accepted revision', () => {
  it('seals the exact per-user revision for included and excluded users; inputs are append-only', async () => {
    const admin = await user(), regular = await user(), excluded = await user();
    const regularRevision = await classify(regular, admin, 'regular');
    const excludedRevision = await classify(excluded, admin, 'staff');
    const id = await seal();
    const { rows } = await h.db.pool.query(`SELECT user_id,revision::text,classification FROM analytics_snapshot_classification_inputs WHERE snapshot_id=$1 AND user_id=ANY($2::uuid[])`, [id, [regular, excluded]]);
    expect(rows).toEqual(expect.arrayContaining([
      { user_id: regular, revision: regularRevision, classification: 'regular' },
      { user_id: excluded, revision: excludedRevision, classification: 'staff' },
    ]));
    await expect(h.db.pool.query(`UPDATE analytics_snapshot_classification_inputs SET classification='test' WHERE snapshot_id=$1`, [id])).rejects.toThrow('append-only');
    await expect(h.db.pool.query(`DELETE FROM analytics_snapshot_classification_inputs WHERE snapshot_id=$1`, [id])).rejects.toThrow('append-only');
  });

  it('A04: a larger revision of another user never proves the target was sealed', async () => {
    const admin = await user(), target = await user(), other = await user();
    // Target revision is allocated first but becomes visible only after the snapshot boundary.
    const accepted = await classify(target, admin, 'test', `clock_timestamp()+interval '1 hour'`);
    const otherRevision = await classify(other, admin, 'test');
    expect(BigInt(otherRevision)).toBeGreaterThan(BigInt(accepted));
    const pending = await refresh(admin, target, accepted);
    const id = await seal();
    const { rows: [snapshot] } = await h.db.pool.query(`SELECT classification_revision::text r FROM analytics_snapshots WHERE id=$1`, [id]);
    expect(BigInt(snapshot.r)).toBeGreaterThanOrEqual(BigInt(accepted)); // the global maximum would wrongly pass
    expect(await readStatisticsRefresh(h.db.pool, pending.refreshId, admin)).toMatchObject({ state: 'pending', snapshotId: null, acceptedRevision: accepted, targetUserId: target });
  });

  it('becomes ready on the snapshot sealing the same user, accepts a later revision of that user, and hides it from other actors', async () => {
    const admin = await user(), otherAdmin = await user(), target = await user();
    const accepted = await classify(target, admin);
    const r = await refresh(admin, target, accepted);
    await expect(readStatisticsRefresh(h.db.pool, r.refreshId, otherAdmin)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const tick = await statisticsRefreshTick(h.db.pool, seal);
    expect(tick.sealed).not.toBeNull();
    expect(await readStatisticsRefresh(h.db.pool, r.refreshId, admin)).toMatchObject({ state: 'ready', snapshotId: tick.sealed, failureCode: null });
    // Same-user later revision also satisfies an older intent; it remains bound to the newest valid snapshot.
    await classify(target, admin, 'regular');
    const later = await seal();
    const { rows: [input] } = await h.db.pool.query(`SELECT revision::text FROM analytics_snapshot_classification_inputs WHERE snapshot_id=$1 AND user_id=$2`, [later, target]);
    expect(BigInt(input.revision)).toBeGreaterThan(BigInt(accepted));
    // A ready refresh follows the newest valid snapshot that sealed this user's revision.
    expect(await readStatisticsRefresh(h.db.pool, r.refreshId, admin)).toMatchObject({ state: 'ready', snapshotId: later });
  });

  it('P10-R02: intents resolved at different times converge on the newest snapshot sealing both users', async () => {
    const admin = await user(), first = await user(), second = await user();
    const a = await refresh(admin, first, await classify(first, admin));
    const s1 = (await statisticsRefreshTick(h.db.pool, seal)).sealed;
    expect(await readStatisticsRefresh(h.db.pool, a.refreshId, admin)).toMatchObject({ state: 'ready', snapshotId: s1 });
    const b = await refresh(admin, second, await classify(second, admin));
    const s2 = (await statisticsRefreshTick(h.db.pool, seal)).sealed;
    expect(await readStatisticsRefresh(h.db.pool, b.refreshId, admin)).toMatchObject({ state: 'ready', snapshotId: s2 });
    expect(await readStatisticsRefresh(h.db.pool, a.refreshId, admin)).toMatchObject({ state: 'ready', snapshotId: s2 });
  });

  it('A03: a failed seal fails only statistics; retry reopens statistics with zero classification writes', async () => {
    const admin = await user(), target = await user();
    const accepted = await classify(target, admin);
    const r = await refresh(admin, target, accepted);
    const before = await classificationRows(target);
    const failed = await statisticsRefreshTick(h.db.pool, () => Promise.reject(new Error('synthetic seal failure')));
    expect(failed.failed).toBeGreaterThanOrEqual(1);
    expect(await readStatisticsRefresh(h.db.pool, r.refreshId, admin)).toMatchObject({ state: 'failed', failureCode: 'SNAPSHOT_FAILED' });
    const c = await h.db.pool.connect();
    try {
      await expect(retryStatisticsRefresh(c, r.refreshId, await user())).rejects.toMatchObject({ code: 'NOT_FOUND' });
      expect(await retryStatisticsRefresh(c, r.refreshId, admin)).toMatchObject({ state: 'pending', failureCode: null });
    } finally { c.release(); }
    expect(await classificationRows(target)).toBe(before);
    await statisticsRefreshTick(h.db.pool, seal);
    expect(await readStatisticsRefresh(h.db.pool, r.refreshId, admin)).toMatchObject({ state: 'ready' });
    expect(await classificationRows(target)).toBe(before);
    expect((await h.db.pool.query(`SELECT 1 FROM audit_events WHERE action='account.classified' AND aggregate_id=$1`, [target])).rowCount).toBe(0);
  });

  it('fails as NOT_INCORPORATED after bounded seals that still cannot see the accepted revision', async () => {
    const admin = await user(), target = await user();
    const accepted = await classify(target, admin, 'test', `clock_timestamp()+interval '1 hour'`);
    const r = await refresh(admin, target, accepted);
    for (let i = 0; i < 2; i++) await statisticsRefreshTick(h.db.pool, seal, 2);
    expect(await readStatisticsRefresh(h.db.pool, r.refreshId, admin)).toMatchObject({ state: 'failed', failureCode: 'NOT_INCORPORATED', snapshotId: null });
  });

  it('reopens a ready refresh when its snapshot is revoked or leaves the privacy epoch, never reporting a stale snapshot', async () => {
    const admin = await user(), target = await user();
    const accepted = await classify(target, admin);
    const r = await refresh(admin, target, accepted);
    const first = (await statisticsRefreshTick(h.db.pool, seal)).sealed;
    await h.db.pool.query(`UPDATE privacy_control SET epoch=epoch+1 WHERE id=1`);
    expect(await readStatisticsRefresh(h.db.pool, r.refreshId, admin)).toMatchObject({ state: 'pending', snapshotId: null });
    const second = (await statisticsRefreshTick(h.db.pool, seal)).sealed;
    expect(second).not.toBe(first);
    expect(await readStatisticsRefresh(h.db.pool, r.refreshId, admin)).toMatchObject({ state: 'ready', snapshotId: second });
  });

  it('rejects a refresh for a revision that belongs to a different user', async () => {
    const admin = await user(), target = await user(), other = await user();
    const otherRevision = await classify(other, admin);
    await expect(refresh(admin, target, otherRevision)).rejects.toThrow(/foreign key/);
  });
});
