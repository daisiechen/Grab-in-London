import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { loadConfig } from '@fancy/config';
import { Browser, createHarness, json, WEB_ORIGIN, type Harness } from '../test/harness.ts';
import { registerAdminRoutes } from './routes.ts';
let h: Harness;
beforeAll(async () => {
  h = await createHarness(inject('pgServerUrl'));
  if (!h.app.hasRoute({ method: 'GET', url: '/v1/admin/snapshots' })) registerAdminRoutes(h.app, { pool: h.db.pool, identity: h.idp, publicOrigin: WEB_ORIGIN,
    config: loadConfig({ ENVIRONMENT: 'test', DATABASE_URL: h.db.url, AUTH_ADAPTER: 'test', PLACES_ADAPTER: 'fixture', MAIL_ADAPTER: 'outbox_test', AI_PROVIDER: 'mock', WEB_ORIGIN, SESSION_SECRET: 'api-test-session-secret-0123456789abcdef', IOS_REDIRECT_URI: 'fancy://auth/callback' }) });
});
afterAll(async () => { await h.close(); });
async function actor(role?: string, mfa = false) {
  const b = new Browser(h);
  const { body } = await b.signInWithEmail(`${randomUUID()}@example.invalid`);
  const id = body.data.session.user.id as string;
  if (role) await h.db.pool.query(`INSERT INTO roles(user_id,role,granted_by) VALUES($1,$2,'test-bootstrap')`, [id, role]);
  if (mfa) await h.db.pool.query(`UPDATE session_families SET amr=ARRAY['otp','mfa'] WHERE user_id=$1`, [id]);
  return { b, id };
}
const put = (b: Browser, id: string, version: string, classification = 'test', key = randomUUID()) => b.request('PUT', `/v1/admin/classifications/${id}`, { body: { classification, reason: 'Synthetic test account' }, headers: { 'if-match': `"${version}"`, 'idempotency-key': key } });

describe('classification statistical metadata', () => {
  it('requires data_admin and MFA for reads and writes; analyst cannot classify', async () => {
    const target = await actor();
    for (const role of [undefined, 'analyst']) {
      const user = await actor(role, true);
      expect((await put(user.b, target.id, '0')).statusCode).toBe(403);
      expect((await user.b.request('GET', `/v1/admin/classifications/${target.id}`)).statusCode).toBe(403);
    }
    const noMfa = await actor('data_admin');
    const res = await put(noMfa.b, target.id, '0');
    expect(res.statusCode).toBe(403);
    expect(json(res).error.code).toBe('REAUTH_REQUIRED');
  });
  it('serializes concurrent edits, preserves revisions and audit, and grants no business role', async () => {
    const admin = await actor('data_admin', true); const target = await actor();
    expect(json(await admin.b.request('GET', `/v1/admin/classifications/${target.id}`)).data).toMatchObject({ classification: 'regular', revision: '0' });
    const responses = await Promise.all([put(admin.b, target.id, '0', 'test'), put(admin.b, target.id, '0', 'staff')]);
    expect(responses.map(r => r.statusCode).sort()).toEqual([200,409]);
    const data = json(responses.find(r => r.statusCode === 200)!).data;
    const updated = await put(admin.b, target.id, data.revision, 'regular');
    expect(updated.statusCode, updated.body).toBe(200);
    expect(BigInt(json(updated).data.revision)).toBeGreaterThan(BigInt(data.revision));
    expect((await h.db.pool.query(`SELECT 1 FROM account_classifications WHERE user_id=$1`, [target.id])).rows).toHaveLength(2);
    expect((await h.db.pool.query(`SELECT 1 FROM audit_events WHERE action='account.classified' AND aggregate_id=$1`, [target.id])).rows).toHaveLength(2);
    expect((await h.db.pool.query(`SELECT 1 FROM roles WHERE user_id=$1`, [target.id])).rows).toHaveLength(0);
    await expect(h.db.pool.query(`DELETE FROM account_classifications WHERE user_id=$1`, [target.id])).rejects.toThrow('immutable');
  });
  it('replays identical intent once but role revocation prevents replay', async () => {
    const admin = await actor('data_admin', true); const target = await actor(); const key = randomUUID();
    const first = await put(admin.b, target.id, '0', 'test', key);
    const replay = await put(admin.b, target.id, '0', 'test', key);
    expect(replay.statusCode, replay.body).toBe(200);
    expect(json(replay).data).toEqual(json(first).data);
    expect((await h.db.pool.query(`SELECT 1 FROM account_classifications WHERE user_id=$1`, [target.id])).rows).toHaveLength(1);
    await h.db.pool.query(`DELETE FROM roles WHERE user_id=$1`, [admin.id]);
    expect((await put(admin.b, target.id, '0', 'test', key)).statusCode).toBe(403);
  });
  it('lists zero actual snapshots before the pipeline exists, without fabricated metrics', async () => {
    const analyst = await actor('analyst', true);
    const res = await analyst.b.request('GET', '/v1/admin/snapshots');
    expect(res.statusCode, res.body).toBe(200);
    expect(json(res).data).toEqual([]);
    expect(json(res).page).toEqual({ nextCursor: null, hasMore: false });
  });
  it('preserves microseconds in snapshot keysets and binds HMAC cursor to actor, filters and privacy epoch',async()=>{
    const a=await actor('analyst',true),b=await actor('analyst',true);
    const first=randomUUID(),second=randomUUID();
    for(const [id,asOf]of [[first,'2026-10-21T00:00:00.000002Z'],[second,'2026-10-21T00:00:00.000001Z']])await h.db.pool.query(`INSERT INTO analytics_snapshots(id,as_of,definition_version,history_coverage_start,privacy_epoch,classification_revision,source_status,quality,dimensions) VALUES($1,$2,'v4','2026-01-01',0,0,'{}','{}','{"areas":[],"sources":[]}')`,[id,asOf]);
    const page1=json(await a.b.request('GET','/v1/admin/snapshots?limit=1'));expect(page1.data[0].id).toBe(first);
    const cursor=page1.page.nextCursor as string;
    const page2=json(await a.b.request('GET','/v1/admin/snapshots?limit=1&cursor='+encodeURIComponent(cursor)));expect(page2.data[0].id).toBe(second);
    expect((await b.b.request('GET','/v1/admin/snapshots?limit=1&cursor='+encodeURIComponent(cursor))).statusCode).toBe(422);
    expect((await a.b.request('GET','/v1/admin/snapshots?limit=2&cursor='+encodeURIComponent(cursor))).statusCode).toBe(422);
    expect((await a.b.request('GET','/v1/admin/snapshots?limit=1&cursor='+encodeURIComponent(cursor+'x'))).statusCode).toBe(422);
    await h.db.pool.query(`UPDATE privacy_control SET epoch=epoch+1 WHERE id=1`);
    expect((await a.b.request('GET','/v1/admin/snapshots?limit=1&cursor='+encodeURIComponent(cursor))).statusCode).toBe(422);
  });
});
