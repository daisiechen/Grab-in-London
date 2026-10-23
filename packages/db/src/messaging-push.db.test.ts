import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, inject, it } from 'vitest';
import { createMigratedDatabase, type MigratedDatabase } from '@fancy/testkit/db';
import { migrate } from './migrate.ts';
let db: MigratedDatabase;
beforeAll(async () => { db = await createMigratedDatabase(inject('pgServerUrl'), migrate); });
afterAll(async () => { await db.drop(); });
async function subscription() {
 const { rows: [user] } = await db.pool.query(`INSERT INTO users DEFAULT VALUES RETURNING id`);
 const { rows: [family] } = await db.pool.query(`INSERT INTO session_families(user_id,kind,auth_time,amr,absolute_expires_at) VALUES($1,'IOS',clock_timestamp(),ARRAY['otp'],clock_timestamp()+interval '1 day') RETURNING id`, [user.id]);
 const installation = randomUUID(), hash = randomUUID().replaceAll('-', '').padEnd(64, 'a');
 const { rows: [sub] } = await db.pool.query(`INSERT INTO push_subscriptions(user_id,family_id,installation_id,platform,environment,destination_hash,encrypted_destination,key_version,app_build) VALUES($1,$2,$3,'apns','development',$4,'encrypted-synthetic','test','1') RETURNING id`, [user.id,family.id,installation,hash]);
 return { user: user.id, family: family.id, id: sub.id, installation, hash };
}
it('applies additive schema without historical recipients or subscriptions', async () => {
 expect((await db.pool.query(`SELECT count(*)::int AS n FROM message_notification_recipients`)).rows[0].n).toBe(0);
 expect((await db.pool.query(`SELECT count(*)::int AS n FROM push_subscriptions`)).rows[0].n).toBe(0);
});
it('revoking the session family permanently revokes its subscriptions', async () => {
 const f = await subscription();
 await db.pool.query(`UPDATE session_families SET revoked_at=clock_timestamp(),revoke_reason='LOGOUT' WHERE id=$1`, [f.family]);
 expect((await db.pool.query(`SELECT revoked_at IS NOT NULL AS revoked,version FROM push_subscriptions WHERE id=$1`,[f.id])).rows[0]).toEqual({ revoked: true, version: '2' });
});
it('leaving ACTIVE revokes destinations and cannot silently reactivate on status reversal', async () => {
 const f = await subscription();
 await db.pool.query(`UPDATE users SET status='DELETING' WHERE id=$1`,[f.user]);
 await db.pool.query(`UPDATE users SET status='ACTIVE' WHERE id=$1`,[f.user]);
 expect((await db.pool.query(`SELECT revoked_at IS NOT NULL AS revoked FROM push_subscriptions WHERE id=$1`,[f.id])).rows[0].revoked).toBe(true);
});
it('enforces one active destination and installation, allowing replacement after revocation', async () => {
 const f = await subscription();
 const insert = () => db.pool.query(`INSERT INTO push_subscriptions(user_id,family_id,installation_id,platform,environment,destination_hash,encrypted_destination,key_version,app_build) VALUES($1,$2,$3,'apns','development',$4,'encrypted-synthetic','test','2')`, [f.user,f.family,f.installation,f.hash]);
 await expect(insert()).rejects.toMatchObject({ code: '23505' });
 await db.pool.query(`UPDATE push_subscriptions SET revoked_at=clock_timestamp() WHERE id=$1`,[f.id]);
 await expect(insert()).resolves.toBeDefined();
});
