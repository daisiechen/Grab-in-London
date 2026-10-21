import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { Browser, createHarness, json, type Harness } from '../test/harness.ts';
import { sealSourceSnapshot } from './snapshots.ts';
let h: Harness;
beforeAll(async () => { h = await createHarness(inject('pgServerUrl')); });
afterAll(async () => { await h.close(); });
async function person(analyst = false) {
  const b = new Browser(h), login = await b.signInWithEmail(`${randomUUID()}@example.invalid`), id = login.body.data.session.user.id as string;
  if (analyst) {
    await h.db.pool.query(`INSERT INTO roles(user_id,role,granted_by) VALUES($1,'analyst','fixture')`, [id]);
    await h.db.pool.query(`UPDATE session_families SET amr=ARRAY['mfa'] WHERE user_id=$1`, [id]);
  }
  return { b, id };
}
const seal = () => sealSourceSnapshot(h.db.pool, new Date('2026-01-01'));
async function exportOf(b: Browser, snapshotId: string) {
  const result = await b.request('POST', '/v1/admin/exports', { body: { snapshotId, metric: 'formation', filters: {} }, headers: { 'idempotency-key': randomUUID() } });
  expect(result.statusCode, result.body).toBe(201); return json(result).data.exportId as string;
}
async function snapshotState(id: string) { return (await h.db.pool.query(`SELECT id,as_of::text,privacy_epoch::text,revoked_at FROM analytics_snapshots WHERE id=$1`, [id])).rows[0]; }
describe('strictly pre-account snapshots survive an unrelated deletion', () => {
  it('keeps the S0/E0 page and CSV byte-for-byte while S1/E1 are revoked; stale or ambiguous proofs never lift', async () => {
    const analyst = await person(true); await h.db.pool.query(`UPDATE privacy_control SET epoch=2 WHERE id=1`);
    const s0 = await seal(), e0 = await exportOf(analyst.b, s0);
    const page0 = await analyst.b.request('GET', `/v1/admin/supply?snapshotId=${s0}`), csv0 = await analyst.b.request('GET', `/v1/admin/exports/${e0}`);
    expect(page0.statusCode, page0.body).toBe(200); expect(csv0.statusCode, csv0.body).toBe(200);
    const before = await snapshotState(s0), facts0 = (await h.db.pool.query(`SELECT kind,facts FROM analytics_snapshot_facts WHERE snapshot_id=$1 ORDER BY kind`, [s0])).rows;
    const user = await person();
    expect((await h.db.pool.query(`SELECT s.as_of<u.created_at AS proven FROM analytics_snapshots s CROSS JOIN users u WHERE s.id=$1 AND u.id=$2`, [s0, user.id])).rows[0].proven).toBe(true);
    const s1 = await seal(), e1 = await exportOf(analyst.b, s1), csv1 = await analyst.b.request('GET', `/v1/admin/exports/${e1}`);
    expect(csv1.statusCode).toBe(200);
    // Controlled metadata edge cases are not safe to promote despite no subject-index row.
    const ambiguous = randomUUID(), stale = randomUUID(), revoked = randomUUID();
    for (const id of [ambiguous, stale, revoked]) await h.db.pool.query(`INSERT INTO analytics_snapshots(id,as_of,definition_version,history_coverage_start,privacy_epoch,classification_revision,source_status,quality,dimensions,revoked_at) SELECT $2,CASE WHEN $2::uuid=$3 THEN (SELECT created_at FROM users WHERE id=$4) ELSE as_of END,definition_version,history_coverage_start,CASE WHEN $2::uuid=$5 THEN 1 ELSE 2 END,classification_revision,source_status,quality,dimensions,CASE WHEN $2::uuid=$6 THEN clock_timestamp() ELSE NULL END FROM analytics_snapshots WHERE id=$1`, [s0, id, ambiguous, user.id, stale, revoked]);
    const staleExport = await exportOf(analyst.b, s0); await h.db.pool.query(`UPDATE analytics_exports SET privacy_epoch=1 WHERE id=$1`, [staleExport]);
    const deleted = await user.b.request('POST', '/v1/me/deletion', { body: { confirm: true, receiptToken: randomBytes(32).toString('base64url') }, headers: { 'idempotency-key': randomUUID(), 'if-match': '"1"' } });
    expect(deleted.statusCode, deleted.body).toBe(202);
    const after = await snapshotState(s0); expect(after).toEqual({ ...before, privacy_epoch: '3' });
    expect((await h.db.pool.query(`SELECT kind,facts FROM analytics_snapshot_facts WHERE snapshot_id=$1 ORDER BY kind`, [s0])).rows).toEqual(facts0);
    const pageAfter = await analyst.b.request('GET', `/v1/admin/supply?snapshotId=${s0}`), csvAfter = await analyst.b.request('GET', `/v1/admin/exports/${e0}`);
    expect(pageAfter.statusCode, pageAfter.body).toBe(200); expect(json(pageAfter).data).toEqual(json(page0).data);
    expect(csvAfter.statusCode, csvAfter.body).toBe(200); expect(csvAfter.body).toBe(csv0.body);
    expect((await h.db.pool.query(`SELECT privacy_epoch::text,revoked_at FROM analytics_exports WHERE id=$1`, [e0])).rows[0]).toEqual({ privacy_epoch: '3', revoked_at: null });
    for (const id of [s1, ambiguous, stale, revoked]) {
      const result = await analyst.b.request('GET', `/v1/admin/supply?snapshotId=${id}`); expect(result.statusCode, result.body).toBe(410); expect(json(result).error.code).toBe('SNAPSHOT_REVOKED'); expect(json(result).data).toBeUndefined();
    }
    const oldExport = await analyst.b.request('GET', `/v1/admin/exports/${e1}`); expect(oldExport.statusCode, oldExport.body).toBe(410); expect(json(oldExport).error.code).toBe('SNAPSHOT_REVOKED'); expect(oldExport.body).not.toContain(csv1.body);
    expect((await snapshotState(ambiguous)).privacy_epoch).toBe('2'); expect((await snapshotState(stale)).privacy_epoch).toBe('1'); expect((await snapshotState(revoked)).privacy_epoch).toBe('2');
    expect((await h.db.pool.query(`SELECT privacy_epoch::text FROM analytics_exports WHERE id=$1`, [staleExport])).rows[0].privacy_epoch).toBe('1');
  });
});
