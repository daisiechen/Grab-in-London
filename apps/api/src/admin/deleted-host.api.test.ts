import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { Browser, createHarness, json, type Harness } from '../test/harness.ts';
import { sealSourceSnapshot } from './snapshots.ts';
let h: Harness;
beforeAll(async () => { h = await createHarness(inject('pgServerUrl')); });
afterAll(async () => { await h.close(); });
async function person(analyst = false) {
  const b = new Browser(h), login = await b.signInWithEmail(`${randomUUID()}@example.invalid`), id = login.body.data.session.user.id as string;
  await h.db.pool.query(`UPDATE users SET created_at='2026-07-01' WHERE id=$1`, [id]);
  if (analyst) {
    await h.db.pool.query(`INSERT INTO roles(user_id,role,granted_by) VALUES($1,'analyst','fixture')`, [id]);
    await h.db.pool.query(`UPDATE session_families SET amr=ARRAY['mfa'] WHERE user_id=$1`, [id]);
  }
  return { id, b };
}
async function completedMeal(host: string, guest: string) {
  const venue = (await h.db.pool.query(`INSERT INTO venues(place_id,provider) VALUES($1,'fixture') RETURNING id`, [`fixture_${randomUUID()}`])).rows[0].id;
  const meal = (await h.db.pool.query(`INSERT INTO meals(host_id,venue_ref,title,description,starts_at,closes_at,scheduled_end_at,start_local_date,start_local_time,start_offset,close_local_date,close_local_time,close_offset,minimum,capacity,budget_min_pence,budget_max_pence,languages,mood,area_code,booking_mode,terms_version,attempt_id,status,created_at) VALUES($1,$2,'PRIVATE_HOST_TITLE_SENTINEL','PRIVATE_HOST_DESCRIPTION_SENTINEL for this historic meal','2026-09-01T12:00:00Z','2026-09-01T11:00:00Z','2026-09-01T14:00:00Z','2026-09-01','13:00',60,'2026-09-01','12:00',60,2,4,1000,2000,ARRAY['en'],'EASY_CONVERSATION','deleted-host-review','EXTERNAL_PAY_AT_VENUE','2026-10-21',$3,'COMPLETED','2026-08-20') RETURNING id`, [host, venue, randomUUID()])).rows[0].id as string;
  for (const [index, user] of [host, guest].entries()) {
    await h.db.pool.query(`INSERT INTO seat_events(meal_id,seq,user_id,type,effective_at,command_id) VALUES($1,$2,$3,$4,'2026-08-30',$5)`, [meal, index + 1, user, index === 0 ? 'HOST_CONFIRMED' : 'GUEST_CONFIRMED', randomUUID()]);
    await h.db.pool.query(`INSERT INTO start_roster(meal_id,user_id,source_revision_hash,starts_at) VALUES($1,$2,'fixture','2026-09-01T12:00:00Z')`, [meal, user]);
    await h.db.pool.query(`INSERT INTO attendance_revisions(meal_id,subject_id,source,value,version,actor_id,created_at) VALUES($1,$2,'SELF','present',1,$2,'2026-09-01T15:00:00Z')`, [meal, user]);
  }
  return meal;
}
const snapshot = () => sealSourceSnapshot(h.db.pool, new Date('2026-07-01'));
async function facts(id: string) {
  const { rows } = await h.db.pool.query(`SELECT kind,facts FROM analytics_snapshot_facts WHERE snapshot_id=$1`, [id]);
  return Object.fromEntries(rows.map(row => [row.kind, row.facts]));
}
describe('deleted regular hosts preserve shared historical statistics', () => {
  it('retains the completed meal and surviving guest attendance/week after host DELETING and DELETED, without deleted-user participation or public text', async () => {
    const host = await person(), guest = await person(), analyst = await person(true), meal = await completedMeal(host.id, guest.id);
    const baseline = await facts(await snapshot()); expect(baseline.meals.some((m: {id: string}) => m.id === meal)).toBe(true);
    for (const status of ['DELETING', 'DELETED']) {
      await h.db.pool.query(`UPDATE users SET status=$2 WHERE id=$1`, [host.id, status]);
      const id = await snapshot(), frozen = await facts(id);
      expect(frozen.meals.find((m: {id: string}) => m.id === meal)).toMatchObject({ status: 'COMPLETED' });
      expect(frozen.users.some((u: {id: string}) => u.id === host.id)).toBe(false);
      expect(frozen.seats.filter((s: {meal_id: string}) => s.meal_id === meal).map((s: {user_id: string}) => s.user_id)).toEqual([guest.id]);
      expect(frozen.attendance.filter((a: {meal_id: string}) => a.meal_id === meal).map((a: {subject_id: string}) => a.subject_id)).toEqual([guest.id]);
      expect(frozen.rosters.filter((r: {meal_id: string}) => r.meal_id === meal).map((r: {user_id: string}) => r.user_id)).toEqual([guest.id]);
      expect(JSON.stringify(frozen)).not.toContain('PRIVATE_HOST_TITLE_SENTINEL'); expect(JSON.stringify(frozen)).not.toContain('PRIVATE_HOST_DESCRIPTION_SENTINEL');
      const response = await analyst.b.request('GET', `/v1/admin/overview?snapshotId=${id}`);
      expect(response.statusCode, response.body).toBe(200); const page = json(response).data;
      expect(page.metrics.weekly).toBe(1);
      const supply = await analyst.b.request('GET', `/v1/admin/supply?snapshotId=${id}`);
      expect(supply.statusCode, supply.body).toBe(200); expect(json(supply).data.metrics.mealsWithAttendance).toBe(1);
      const detail = await analyst.b.request('GET', `/v1/admin/drilldowns/attendance?snapshotId=${id}&filterHash=${page.filterHash}`);
      expect(detail.statusCode, detail.body).toBe(200);
      expect(json(detail).data.map((r: {attributes: {userId: string; attendanceStatus: string}}) => r.attributes)).toEqual([expect.objectContaining({ userId: guest.id, attendanceStatus: 'present' })]);
    }
    // Only classification changes meal inclusion; neither deleted status bypasses test/staff exclusions.
    for (const classification of ['test', 'staff']) {
      await h.db.pool.query(`INSERT INTO account_classifications(user_id,classification,actor_id,reason,created_at) VALUES($1,$2,$3,'Synthetic classification review','2026-09-01')`, [host.id, classification, analyst.id]);
      expect((await facts(await snapshot())).meals.some((m: {id: string}) => m.id === meal)).toBe(false);
    }
  });
});
