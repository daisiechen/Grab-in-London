import { randomUUID } from 'node:crypto';
import { setTimeout as pause } from 'node:timers/promises';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { Browser, createHarness, json, type Harness } from '../test/harness.ts';
let h: Harness;
beforeAll(async () => { h = await createHarness(inject('pgServerUrl')); });
afterAll(async () => { await h.close(); });
async function member() { const b = new Browser(h); const { body } = await b.signInWithEmail(`${randomUUID()}@example.invalid`); return { b, id: body.data.session.user.id as string }; }
async function fixture(days: number) {
  const host = await member(), guest = await member(), staff = await member();
  const end = new Date(Date.now() - days * 86_400_000), start = new Date(end.getTime() - 7_200_000), close = new Date(start.getTime() - 3_600_000);
  const { rows: [v] } = await h.db.pool.query(`INSERT INTO venues(place_id,provider) VALUES($1,'fixture') RETURNING id`, [`fixture_${randomUUID()}`]);
  const { rows: [m] } = await h.db.pool.query(`INSERT INTO meals(host_id,venue_ref,title,description,starts_at,closes_at,scheduled_end_at,start_local_date,start_local_time,start_offset,close_local_date,close_local_time,close_offset,minimum,capacity,budget_min_pence,budget_max_pence,languages,mood,booking_mode,terms_version,attempt_id,status) VALUES($1,$2,'Support fixture','Completed support correction fixture description',$3,$4,$5,'2026-10-01','12:00',60,'2026-10-01','11:00',60,2,4,1000,2000,ARRAY['en'],'EASY_CONVERSATION','EXTERNAL_PAY_AT_VENUE','2026-10-21',$6,'COMPLETED') RETURNING id`, [host.id, v.id, start, close, end, randomUUID()]);
  for (const [index, user] of [host, guest].entries()) {
    await h.db.pool.query(`INSERT INTO seat_events(meal_id,seq,user_id,type,effective_at,command_id) VALUES($1,$2,$3,$4,$5,$6)`, [m.id, index + 1, user.id, index === 0 ? 'HOST_CONFIRMED' : 'GUEST_CONFIRMED', new Date(close.getTime() - 60_000), randomUUID()]);
    await h.db.pool.query(`INSERT INTO start_roster(meal_id,user_id,source_revision_hash,starts_at) VALUES($1,$2,'fixture',$3)`, [m.id, user.id, start]);
  }
  await h.db.pool.query(`UPDATE meals SET head=2 WHERE id=$1`, [m.id]);
  const { rows: [c] } = await h.db.pool.query(`INSERT INTO support_cases(target_type,target_id,details) VALUES('MEAL',$1,'Synthetic attendance dispute') RETURNING id`, [m.id]);
  return { host, guest, staff, mealId: m.id as string, caseId: c.id as string };
}
async function authorize(f: Awaited<ReturnType<typeof fixture>>) {
  await h.db.pool.query(`INSERT INTO roles(user_id,role,granted_by) VALUES($1,'support','test')`, [f.staff.id]);
  await h.db.pool.query(`UPDATE session_families SET amr=ARRAY['mfa'] WHERE user_id=$1`, [f.staff.id]);
  await h.db.pool.query(`INSERT INTO support_case_grants(case_id,user_id) VALUES($1,$2)`, [f.caseId, f.staff.id]);
}
function correct(f: Awaited<ReturnType<typeof fixture>>, key = randomUUID(), version = '0', mealId = f.mealId) {
  return f.staff.b.request('POST', `/v1/support/cases/${f.caseId}/attendance-corrections`, { headers: { 'idempotency-key': key }, body: { mealId, subjectId: f.guest.id, value: 'present', expectedVersion: version, reason: 'Reviewed synthetic attendance evidence.' } });
}
describe('support attendance correction through HTTP authorization and transaction layers', () => {
  it('rejects before seven days without creating an attendance revision or audit correction', async () => {
    const f = await fixture(6); await authorize(f);
    const r = await correct(f); expect(r.statusCode, r.body).toBe(409); expect(json(r).error.code).toBe('CORRECTION_WINDOW_OPEN');
    expect((await h.db.pool.query(`SELECT * FROM attendance_revisions WHERE meal_id=$1`, [f.mealId])).rowCount).toBe(0);
    expect((await h.db.pool.query(`SELECT * FROM audit_events WHERE aggregate_id=$1 AND action='attendance.corrected'`, [f.caseId])).rowCount).toBe(0);
  });
  it('requires support role, MFA, case grant and the exact case meal scope before accepting', async () => {
    const f = await fixture(8);
    expect((await correct(f)).statusCode).toBe(403);
    await h.db.pool.query(`INSERT INTO roles(user_id,role,granted_by) VALUES($1,'support','test')`, [f.staff.id]);
    expect((await correct(f)).statusCode).toBe(403);
    await h.db.pool.query(`UPDATE session_families SET amr=ARRAY['mfa'] WHERE user_id=$1`, [f.staff.id]);
    expect((await correct(f)).statusCode).toBe(404);
    await h.db.pool.query(`INSERT INTO support_case_grants(case_id,user_id) VALUES($1,$2)`, [f.caseId, f.staff.id]);
    expect((await correct(f, randomUUID(), '0', randomUUID())).statusCode).toBe(403);
    const accepted = await correct(f); expect(accepted.statusCode, accepted.body).toBe(201); expect(json(accepted).data).toMatchObject({ mealId: f.mealId, subjectId: f.guest.id, value: 'present', version: '1' });
    expect((await h.db.pool.query(`SELECT source,actor_id,reason FROM attendance_revisions WHERE meal_id=$1`, [f.mealId])).rows).toEqual([{ source: 'SUPPORT', actor_id: f.staff.id, reason: 'Reviewed synthetic attendance evidence.' }]);
  });
  it('enforces CAS, stable-intent replay and current grant/MFA on replay', async () => {
    const f = await fixture(8); await authorize(f); const key = randomUUID();
    const first = await correct(f, key); expect(first.statusCode, first.body).toBe(201);
    const replay = await correct(f, key); expect(replay.statusCode, replay.body).toBe(201); expect(replay.headers['idempotent-replay']).toBe('true');
    const stale = await correct(f); expect(stale.statusCode, stale.body).toBe(409); expect(json(stale).error.code).toBe('VERSION_CONFLICT');
    await h.db.pool.query(`DELETE FROM support_case_grants WHERE case_id=$1 AND user_id=$2`, [f.caseId, f.staff.id]);
    expect((await correct(f, key)).statusCode).toBe(403);
    await h.db.pool.query(`INSERT INTO support_case_grants(case_id,user_id) VALUES($1,$2)`, [f.caseId, f.staff.id]);
    await h.db.pool.query(`UPDATE session_families SET amr=ARRAY['email'] WHERE user_id=$1`, [f.staff.id]);
    expect((await correct(f, key)).statusCode).toBe(403);
    expect((await h.db.pool.query(`SELECT * FROM attendance_revisions WHERE meal_id=$1`, [f.mealId])).rowCount).toBe(1);
  });
  it('does not use a revoked case grant after waiting for the meal write lock', async () => {
    const f = await fixture(8); await authorize(f);
    const blocker = await h.db.pool.connect();
    let pending: ReturnType<typeof correct> | undefined;
    try {
      await blocker.query('BEGIN');
      await blocker.query(`SELECT id FROM meals WHERE id=$1 FOR UPDATE`, [f.mealId]);
      pending = correct(f);
      let waiting = false;
      for (let n = 0; n < 100; n++) {
        const { rows } = await h.db.pool.query(`SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'SELECT % FROM meals WHERE id = ANY%'`);
        if (rows.length) { waiting = true; break; }
        await pause(5);
      }
      expect(waiting).toBe(true);
      // Grant removal commits while the correction is blocked, before its effectiveNow/write.
      await h.db.pool.query(`DELETE FROM support_case_grants WHERE case_id=$1 AND user_id=$2`, [f.caseId, f.staff.id]);
      await blocker.query('COMMIT');
      const result = await pending;
      expect(result.statusCode, result.body).toBe(404);
      expect((await h.db.pool.query(`SELECT * FROM attendance_revisions WHERE meal_id=$1`, [f.mealId])).rowCount).toBe(0);
    } finally {
      await blocker.query('ROLLBACK'); blocker.release();
      if (pending) await pending;
    }
  });
});
