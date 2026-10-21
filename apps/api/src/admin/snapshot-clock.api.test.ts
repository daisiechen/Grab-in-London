import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { createHarness, type Harness } from '../test/harness.ts';
import { sealSourceSnapshot } from './snapshots.ts';
let h: Harness;
beforeAll(async () => { h = await createHarness(inject('pgServerUrl')); });
afterAll(async () => { await h.close(); });
describe('snapshot SQL clock preserves PostgreSQL microseconds', () => {
  it('includes facts and classification committed within the same millisecond before the snapshot boundary', async () => {
    // Freeze only this isolated connection's transaction_timestamp() via PostgreSQL function
    // resolution. Source rows, snapshot transaction, timestamp comparisons and JSON are real PG.
    const c = await h.db.pool.connect();
    await c.query(`CREATE SCHEMA precision_clock`);
    await c.query(`CREATE FUNCTION precision_clock.transaction_timestamp() RETURNS timestamptz LANGUAGE sql STABLE AS $$ SELECT '2026-10-01 12:00:00.000900+00'::timestamptz $$`);
    await c.query(`SET search_path=precision_clock,pg_catalog,public`);
    c.release(); // The next pool checkout reuses this idle connection.
    const included = randomUUID(), excluded = randomUUID();
    await h.db.pool.query(`INSERT INTO users(id,created_at) VALUES($1,'2026-10-01T12:00:00.000500Z'),($2,'2026-07-01')`, [included, excluded]);
    await h.db.pool.query(`INSERT INTO account_classifications(user_id,classification,actor_id,reason,created_at) VALUES($1,'test',$1,'Precision boundary fixture','2026-10-01T12:00:00.000500Z')`, [excluded]);
    // Ensure the rows are already committed before sealSourceSnapshot starts repeatable read.
    const committed = await h.db.pool.query(`SELECT count(*)::int n FROM users WHERE id=ANY($1::uuid[])`, [[included, excluded]]);
    expect(committed.rows[0].n).toBe(2);
    const id = await sealSourceSnapshot(h.db.pool, new Date('2026-07-01'));
    const { rows: [clock] } = await h.db.pool.query(`SELECT to_char(as_of AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US') value FROM analytics_snapshots WHERE id=$1`, [id]);
    expect(clock.value).toBe('2026-10-01T12:00:00.000900');
    const { rows: [users] } = await h.db.pool.query(`SELECT facts FROM analytics_snapshot_facts WHERE snapshot_id=$1 AND kind='users'`, [id]);
    expect(users.facts.map((u: {id: string}) => u.id)).toContain(included);
    expect(users.facts.map((u: {id: string}) => u.id)).not.toContain(excluded);
  });
});
