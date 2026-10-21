import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { Browser, createHarness, json, type Harness } from '../test/harness.ts';
import { withTransaction } from '../common/transaction.ts';
import { approveApplication } from './commands.ts';
let h: Harness;
beforeAll(async () => { h = await createHarness(inject('pgServerUrl')); });
afterAll(async () => { await h.close(); });
async function person() { const b = new Browser(h), login = await b.signInWithEmail(`${randomUUID()}@example.invalid`); return { b, id: login.body.data.session.user.id as string }; }
async function fixture() {
  const host = await person(), guest = await person(), outsider = await person();
  const starts = new Date(Date.now() + 86_400_000), closes = new Date(starts.getTime() - 3_600_000);
  const venue = (await h.db.pool.query(`INSERT INTO venues(place_id,provider) VALUES($1,'fixture') RETURNING id`, [`fixture_${randomUUID()}`])).rows[0].id;
  const meal = (await h.db.pool.query(`INSERT INTO meals(host_id,venue_ref,title,description,starts_at,closes_at,scheduled_end_at,start_local_date,start_local_time,start_offset,close_local_date,close_local_time,close_offset,minimum,capacity,budget_min_pence,budget_max_pence,languages,mood,booking_mode,terms_version,attempt_id,head) VALUES($1,$2,'Decision fixture meal','Fixture to separate actor authentication from applicant state',$3,$4,$5,'2026-10-23','19:00',60,'2026-10-23','18:00',60,2,4,1000,2000,ARRAY['en'],'EASY_CONVERSATION','EXTERNAL_PAY_AT_VENUE','2026-10-21',$6,1) RETURNING id`, [host.id, venue, starts, closes, new Date(starts.getTime() + 7_200_000), randomUUID()])).rows[0].id;
  await h.db.pool.query(`INSERT INTO seat_events(meal_id,seq,user_id,type,effective_at,command_id) VALUES($1,1,$2,'HOST_CONFIRMED',clock_timestamp(),$3)`, [meal, host.id, randomUUID()]);
  const application = (await h.db.pool.query(`INSERT INTO applications(meal_id,user_id,round,state,message) VALUES($1,$2,1,'PENDING','A valid pending guest introduction') RETURNING id`, [meal, guest.id])).rows[0].id as string;
  return { host, guest, outsider, meal, application };
}
const decide = (b: Browser, id: string, decision: string) => b.request('POST', `/v1/applications/${id}/decision`, { body: { decision }, headers: { 'idempotency-key': randomUUID(), 'if-match': '"1"' } });
describe('unavailable applicant never invalidates the active host session', () => {
  it.each(['APPROVE', 'DECLINE'])('%s on an old deleted-applicant row returns a business 404 while host remains signed in', async decision => {
    const f = await fixture();
    const deletion = await f.guest.b.request('POST', '/v1/me/deletion', { body: { confirm: true, receiptToken: randomBytes(32).toString('base64url') }, headers: { 'idempotency-key': randomUUID(), 'if-match': '"1"' } });
    expect(deletion.statusCode, deletion.body).toBe(202);
    if (decision === 'DECLINE') await h.db.pool.query(`UPDATE users SET status='DELETED' WHERE id=$1`, [f.guest.id]);
    const result = await decide(f.host.b, f.application, decision);
    expect(result.statusCode, result.body).toBe(404); expect(json(result).error.code).toBe('NOT_FOUND');
    const session = await f.host.b.request('GET', '/v1/auth/session'); expect(session.statusCode, session.body).toBe(200); expect(json(session).data.user.id).toBe(f.host.id);
    expect((await h.db.pool.query(`SELECT state FROM applications WHERE id=$1`, [f.application])).rows[0].state).toBe('WITHDRAWN');
    expect((await h.db.pool.query(`SELECT * FROM seat_events WHERE meal_id=$1 AND type='GUEST_CONFIRMED'`, [f.meal])).rowCount).toBe(0);
    expect((await decide(f.outsider.b, f.application, decision)).statusCode).toBe(403);
  });
  it('still returns AUTH_REQUIRED for an inactive actor at the command barrier and HTTP authentication boundary', async () => {
    const f = await fixture(); await h.db.pool.query(`UPDATE users SET status='DELETING' WHERE id=ANY($1::uuid[])`, [[f.host.id, f.guest.id]]);
    await expect(withTransaction(h.db.pool, tx => approveApplication(tx, f.application, f.host.id, '1', 'APPROVE'))).rejects.toMatchObject({ code: 'AUTH_REQUIRED', status: 401 });
    const result = await decide(f.host.b, f.application, 'DECLINE'); expect(result.statusCode, result.body).toBe(401);
  });
});
