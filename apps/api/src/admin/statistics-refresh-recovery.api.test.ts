import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { loadConfig } from '@fancy/config';
import { Browser, createHarness, json, WEB_ORIGIN, type Harness } from '../test/harness.ts';
import { registerAdminRoutes } from './routes.ts';
import { registerReceiptRoutes } from '../receipts/routes.ts';
import { sealSourceSnapshot } from './snapshots.ts';
import { statisticsRefreshTick } from './statistics-refresh.ts';
let h: Harness;
beforeAll(async () => {
  h = await createHarness(inject('pgServerUrl'));
  const deps = { pool: h.db.pool, identity: h.idp, publicOrigin: WEB_ORIGIN,
    config: loadConfig({ ENVIRONMENT: 'test', DATABASE_URL: h.db.url, AUTH_ADAPTER: 'test', PLACES_ADAPTER: 'fixture', MAIL_ADAPTER: 'outbox_test', AI_PROVIDER: 'mock', WEB_ORIGIN, SESSION_SECRET: 'api-test-session-secret-0123456789abcdef', IOS_REDIRECT_URI: 'fancy://auth/callback' }) };
  if (!h.app.hasRoute({ method: 'GET', url: '/v1/admin/snapshots' })) registerAdminRoutes(h.app, deps);
  if (!h.app.hasRoute({ method: 'GET', url: '/v1/me/command-receipts/:operation/:key' })) registerReceiptRoutes(h.app, deps);
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
const put = (b: Browser, id: string, key: string) => b.request('PUT', `/v1/admin/classifications/${id}`, { body: { classification: 'test', reason: 'Synthetic test account' }, headers: { 'if-match': '"0"', 'idempotency-key': key } });
const receipt = (b: Browser, key: string) => b.request('GET', `/v1/me/command-receipts/classifyUser/${key}`);
const byIntent = (b: Browser, key: string, targetUserId: string, acceptedRevision: string) =>
  b.request('GET', `/v1/admin/statistics-refresh-intents/${key}/${targetUserId}/${acceptedRevision}`);
const count = async (sql: string, args: unknown[]) => (await h.db.pool.query(sql, args)).rowCount;
const seal = () => sealSourceSnapshot(h.db.pool, new Date('2026-01-01'));

describe('P09-R01: lost classify response recovers the same refresh from the original intent', () => {
  it('receipt SUCCEEDED → locate by actor+key with frozen target and receipt revision → ready; one classification, audit and job', async () => {
    const admin = await actor('data_admin'); const target = await actor(); const key = randomUUID();
    // The response is committed server-side but treated as lost: the client keeps only key + frozen payload.
    expect((await put(admin.b, target.id, key)).statusCode).toBe(200);
    const r = json(await receipt(admin.b, key)).data;
    expect(r).toMatchObject({ state: 'SUCCEEDED', resourceId: target.id });
    expect(r).not.toHaveProperty('data');
    const recovered = await byIntent(admin.b, key, target.id, r.resourceVersion);
    expect(recovered.statusCode, recovered.body).toBe(200);
    expect(json(recovered).data).toMatchObject({ targetUserId: target.id, acceptedRevision: r.resourceVersion, state: 'pending' });
    const sealed = (await statisticsRefreshTick(h.db.pool, seal)).sealed;
    expect(json(await byIntent(admin.b, key, target.id, r.resourceVersion)).data).toMatchObject({ state: 'ready', snapshotId: sealed, refreshId: json(recovered).data.refreshId });
    expect(await count(`SELECT 1 FROM account_classifications WHERE user_id=$1`, [target.id])).toBe(1);
    expect(await count(`SELECT 1 FROM audit_events WHERE action='account.classified' AND aggregate_id=$1`, [target.id])).toBe(1);
    expect(await count(`SELECT 1 FROM admin_statistics_refreshes WHERE target_user_id=$1`, [target.id])).toBe(1);
  });

  it('other actor, target or revision mismatch and unknown intent are indistinguishable NOT_FOUND; revoked role is 403', async () => {
    const admin = await actor('data_admin'); const other = await actor('data_admin'); const target = await actor(); const stranger = await actor(); const key = randomUUID();
    await put(admin.b, target.id, key);
    const revision = json(await receipt(admin.b, key)).data.resourceVersion as string;
    expect(json(await receipt(other.b, key)).data.state).toBe('NONE');
    for (const res of [
      await byIntent(other.b, key, target.id, revision),
      await byIntent(admin.b, key, stranger.id, revision),
      await byIntent(admin.b, key, target.id, String(BigInt(revision) + 1n)),
      await byIntent(admin.b, randomUUID(), target.id, revision),
    ]) {
      expect(res.statusCode).toBe(404);
      expect(json(res).error.code).toBe('NOT_FOUND');
    }
    await h.db.pool.query(`DELETE FROM roles WHERE user_id=$1`, [admin.id]);
    expect((await byIntent(admin.b, key, target.id, revision)).statusCode).toBe(403);
    expect((await receipt(admin.b, key)).statusCode).toBe(403);
    expect(await count(`SELECT 1 FROM admin_statistics_refreshes WHERE target_user_id=$1`, [target.id])).toBe(1);
  });

  it('an unused key reports NONE and recovers nothing; nothing is created by looking', async () => {
    const admin = await actor('data_admin'); const target = await actor(); const key = randomUUID();
    expect(json(await receipt(admin.b, key)).data.state).toBe('NONE');
    expect((await byIntent(admin.b, key, target.id, '1')).statusCode).toBe(404);
    expect(await count(`SELECT 1 FROM account_classifications WHERE user_id=$1`, [target.id])).toBe(0);
    expect(await count(`SELECT 1 FROM admin_statistics_refreshes WHERE target_user_id=$1`, [target.id])).toBe(0);
  });
});
