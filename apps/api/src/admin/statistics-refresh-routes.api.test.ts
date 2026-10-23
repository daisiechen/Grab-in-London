import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { loadConfig } from '@fancy/config';
import { Browser, createHarness, json, WEB_ORIGIN, type Harness } from '../test/harness.ts';
import { registerAdminRoutes } from './routes.ts';
import { sealSourceSnapshot } from './snapshots.ts';
import { statisticsRefreshTick } from './statistics-refresh.ts';
let h: Harness;
beforeAll(async () => {
  h = await createHarness(inject('pgServerUrl'));
  if (!h.app.hasRoute({ method: 'GET', url: '/v1/admin/snapshots' })) registerAdminRoutes(h.app, { pool: h.db.pool, identity: h.idp, publicOrigin: WEB_ORIGIN,
    config: loadConfig({ ENVIRONMENT: 'test', DATABASE_URL: h.db.url, AUTH_ADAPTER: 'test', PLACES_ADAPTER: 'fixture', MAIL_ADAPTER: 'outbox_test', AI_PROVIDER: 'mock', WEB_ORIGIN, SESSION_SECRET: 'api-test-session-secret-0123456789abcdef', IOS_REDIRECT_URI: 'fancy://auth/callback' }) });
});
afterAll(async () => { await h.close(); });
async function actor(role?: string) {
  const b = new Browser(h);
  const { body } = await b.signInWithEmail(`${randomUUID()}@example.invalid`);
  const id = body.data.session.user.id as string;
  if (role) await h.db.pool.query(`INSERT INTO roles(user_id,role,granted_by) VALUES($1,$2,'test-bootstrap')`, [id, role]);
  await h.db.pool.query(`UPDATE session_families SET amr=ARRAY['otp','mfa'] WHERE user_id=$1`, [id]);
  return { b, id };
}
const put = (b: Browser, id: string, version: string, classification = 'test', key = randomUUID()) => b.request('PUT', `/v1/admin/classifications/${id}`, { body: { classification, reason: 'Synthetic test account' }, headers: { 'if-match': `"${version}"`, 'idempotency-key': key } });
const get = (b: Browser, refreshId: string) => b.request('GET', `/v1/admin/statistics-refresh/${refreshId}`);
const retry = (b: Browser, refreshId: string, key = randomUUID()) => b.request('POST', `/v1/admin/statistics-refresh/${refreshId}/retry`, { headers: { 'idempotency-key': key } });
const count = async (sql: string, args: unknown[]) => (await h.db.pool.query(sql, args)).rowCount;
const seal = () => sealSourceSnapshot(h.db.pool, new Date('2026-01-01'));

describe('classification receipt carries the statistics refresh of the same intent', () => {
  it('binds refresh to target user, original key/request and accepted revision; replay returns the identical receipt', async () => {
    const admin = await actor('data_admin'); const target = await actor(); const key = randomUUID();
    const first = await put(admin.b, target.id, '0', 'test', key);
    expect(first.statusCode, first.body).toBe(200);
    const receipt = json(first).data;
    expect(receipt.statisticsRefresh).toMatchObject({ targetUserId: target.id, acceptedRevision: receipt.revision, state: 'pending', snapshotId: null, failureCode: null });
    const { rows: [row] } = await h.db.pool.query(`SELECT actor_id,intent_key,request_id,target_user_id,accepted_revision::text FROM admin_statistics_refreshes WHERE id=$1`, [receipt.statisticsRefresh.refreshId]);
    expect(row).toEqual({ actor_id: admin.id, intent_key: key, request_id: json(first).meta.requestId, target_user_id: target.id, accepted_revision: receipt.revision });
    const replay = await put(admin.b, target.id, '0', 'test', key);
    expect(json(replay).data).toEqual(receipt);
    expect(await count(`SELECT 1 FROM admin_statistics_refreshes WHERE target_user_id=$1`, [target.id])).toBe(1);
    expect(await count(`SELECT 1 FROM account_classifications WHERE user_id=$1`, [target.id])).toBe(1);
  });

  it('a version-conflict loser writes neither classification nor refresh', async () => {
    const admin = await actor('data_admin'); const target = await actor();
    const responses = await Promise.all([put(admin.b, target.id, '0', 'test'), put(admin.b, target.id, '0', 'staff')]);
    expect(responses.map(r => r.statusCode).sort()).toEqual([200, 409]);
    expect(await count(`SELECT 1 FROM admin_statistics_refreshes WHERE target_user_id=$1`, [target.id])).toBe(1);
  });

  it('only the original data_admin actor reads it; analysts are forbidden', async () => {
    const admin = await actor('data_admin'); const other = await actor('data_admin'); const analyst = await actor('analyst'); const target = await actor();
    const refreshId = json(await put(admin.b, target.id, '0')).data.statisticsRefresh.refreshId;
    expect((await get(admin.b, refreshId)).statusCode).toBe(200);
    expect((await get(other.b, refreshId)).statusCode).toBe(404);
    expect((await get(analyst.b, refreshId)).statusCode).toBe(403);
    expect((await get(admin.b, randomUUID())).statusCode).toBe(404);
  });

  it('A03 over HTTP: failed statistics retry reopens only statistics, then becomes ready on a sealed snapshot', async () => {
    const admin = await actor('data_admin'); const other = await actor('data_admin'); const target = await actor();
    const receipt = json(await put(admin.b, target.id, '0')).data;
    const refreshId = receipt.statisticsRefresh.refreshId;
    await statisticsRefreshTick(h.db.pool, () => Promise.reject(new Error('synthetic seal failure')));
    expect(json(await get(admin.b, refreshId)).data).toMatchObject({ state: 'failed', failureCode: 'SNAPSHOT_FAILED' });
    expect((await retry(other.b, refreshId)).statusCode).toBe(404);
    const key = randomUUID();
    const reopened = await retry(admin.b, refreshId, key);
    expect(reopened.statusCode, reopened.body).toBe(200);
    expect(json(reopened).data).toMatchObject({ state: 'pending', failureCode: null });
    expect(json(await retry(admin.b, refreshId, key)).data).toEqual(json(reopened).data);
    expect(await count(`SELECT 1 FROM account_classifications WHERE user_id=$1`, [target.id])).toBe(1);
    expect(await count(`SELECT 1 FROM audit_events WHERE action='account.classified' AND aggregate_id=$1`, [target.id])).toBe(1);
    const sealed = (await statisticsRefreshTick(h.db.pool, seal)).sealed;
    expect(json(await get(admin.b, refreshId)).data).toMatchObject({ state: 'ready', snapshotId: sealed, acceptedRevision: receipt.revision });
    // Retrying a ready refresh is a no-op, not a new seal request.
    expect(json(await retry(admin.b, refreshId)).data).toMatchObject({ state: 'ready', snapshotId: sealed });
  });

  it('retry rechecks data_admin inside the write', async () => {
    const admin = await actor('data_admin'); const target = await actor();
    const refreshId = json(await put(admin.b, target.id, '0')).data.statisticsRefresh.refreshId;
    await h.db.pool.query(`DELETE FROM roles WHERE user_id=$1`, [admin.id]);
    expect((await retry(admin.b, refreshId)).statusCode).toBe(403);
    expect((await get(admin.b, refreshId)).statusCode).toBe(403);
  });
});
