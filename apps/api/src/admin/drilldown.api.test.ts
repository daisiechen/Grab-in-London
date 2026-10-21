import{randomUUID}from'node:crypto';
import{afterAll,beforeAll,describe,expect,inject,it}from'vitest';
import{Browser,createHarness,json,type Harness}from'../test/harness.ts';
import{sealSourceSnapshot}from'./snapshots.ts';
let h:Harness;
beforeAll(async()=>{h=await createHarness(inject('pgServerUrl'));});afterAll(async()=>{await h.close();});
async function user(analyst=false){const b=new Browser(h);const login=await b.signInWithEmail(`${randomUUID()}@example.invalid`);const id=login.body.data.session.user.id as string;await h.db.pool.query(`UPDATE users SET created_at='2026-07-01' WHERE id=$1`,[id]);if(analyst){await h.db.pool.query(`INSERT INTO roles(user_id,role,granted_by) VALUES($1,'analyst','test-bootstrap')`,[id]);await h.db.pool.query(`UPDATE session_families SET amr=ARRAY['otp','mfa'] WHERE user_id=$1`,[id]);}return{b,id};}
async function source(){
 const host=await user(true),guest=await user();const meal=randomUUID(),application=randomUUID(),venue=randomUUID();
 await h.db.pool.query(`INSERT INTO venues(id,place_id,provider) VALUES($1,$2,'fixture')`,[venue,randomUUID()]);
 await h.db.pool.query(`INSERT INTO meals(id,host_id,venue_ref,title,description,starts_at,closes_at,scheduled_end_at,start_local_date,start_local_time,start_offset,close_local_date,close_local_time,close_offset,minimum,capacity,budget_min_pence,budget_max_pence,languages,mood,area_code,booking_mode,terms_version,attempt_id,status,created_at) VALUES($1,$2,$3,'Historic shared meal','A historic meal fixture for source calculations.','2026-09-01T12:00:00Z','2026-09-01T11:00:00Z','2026-09-01T14:00:00Z','2026-09-01','13:00',60,'2026-09-01','12:00',60,2,3,1000,2000,ARRAY['en','zh'],'EASY_CONVERSATION','soho','EXTERNAL_PAY_AT_VENUE','2026-10-21',$4,'COMPLETED','2026-08-20T00:00:00Z')`,[meal,host.id,venue,randomUUID()]);
 await h.db.pool.query(`INSERT INTO applications(id,meal_id,user_id,round,state,message,created_at,decided_at) VALUES($1,$2,$3,1,'CONFIRMED','A private application introduction not used in analytics.','2026-08-30T10:00:00Z','2026-08-30T13:00:00Z')`,[application,meal,guest.id]);
 await h.db.pool.query(`INSERT INTO seat_events(meal_id,seq,user_id,application_id,type,effective_at,command_id) VALUES($1,1,$2,NULL,'HOST_CONFIRMED','2026-08-20T00:00:00Z',$4),($1,2,$3,$5,'GUEST_CONFIRMED','2026-08-30T13:00:00Z',$6)`,[meal,host.id,guest.id,randomUUID(),application,randomUUID()]);
 await h.db.pool.query(`INSERT INTO attendance_revisions(meal_id,subject_id,source,value,version,actor_id,created_at) VALUES($1,$2,'SELF','present',1,$2,'2026-09-01T15:00:00Z'),($1,$3,'HOST','absent',1,$2,'2026-09-01T15:00:00Z'),($1,$3,'SELF','present',2,$3,'2026-09-02T15:00:00Z')`,[meal,host.id,guest.id]);
 await h.db.pool.query(`INSERT INTO experience_revisions(meal_id,user_id,score,revision,created_at) VALUES($1,$2,4,1,'2026-09-02T15:30:00Z')`,[meal,guest.id]);
 await h.db.pool.query(`INSERT INTO public_review_revisions(meal_id,author_id,subject_id,body,revision,created_at) VALUES($1,$2,$3,'NEVER_EXPORT_PRIVATE_REFERENCE_TEXT',1,'2026-09-02T15:30:00Z')`,[meal,host.id,guest.id]);
 return{host,guest,meal};
}
describe('frozen actual attendance, drilldowns and row CSV',()=>{
 it('matches hand calculation and keeps private bodies out of snapshots and CSV',async()=>{
  const s=await source();const id=await sealSourceSnapshot(h.db.pool,new Date('2026-07-01'));
  const overview=await s.host.b.request('GET',`/v1/admin/overview?snapshotId=${id}`);expect(overview.statusCode,overview.body).toBe(200);
  const page=json(overview).data;expect(page.metrics.coverage).toEqual({numerator:2,denominator:2});expect(page.metrics.activation).toEqual({numerator:1,denominator:1});expect(page.metrics.retention).toEqual({numerator:0,denominator:2});
  const detail=await s.host.b.request('GET',`/v1/admin/drilldowns/attendance?snapshotId=${id}&filterHash=${page.filterHash}&limit=1`);expect(detail.statusCode,detail.body).toBe(200);const first=json(detail);
  const next=await s.host.b.request('GET',`/v1/admin/drilldowns/attendance?snapshotId=${id}&filterHash=${page.filterHash}&limit=1&cursor=${encodeURIComponent(first.page.nextCursor)}`);expect(json(next).data[0].rowId).not.toBe(first.data[0].rowId);
  const all=await s.host.b.request('GET',`/v1/admin/drilldowns/attendance?snapshotId=${id}&filterHash=${page.filterHash}`);expect(json(all).data).toHaveLength(2);
  const guest=json(all).data.find((r:{attributes:{userId:string}})=>r.attributes.userId===s.guest.id);expect(guest.attributes).toMatchObject({attendanceStatus:'present',source:'SELF',sourceDifference:true});
  const other=await user(true);expect((await other.b.request('GET',`/v1/admin/drilldowns/attendance?snapshotId=${id}&filterHash=${page.filterHash}&cursor=${encodeURIComponent(first.page.nextCursor)}`)).statusCode).toBe(422);
  expect((await s.host.b.request('GET',`/v1/admin/drilldowns/attendance?snapshotId=${id}&filterHash=${'a'.repeat(64)}`)).statusCode).toBe(409);
  const ticket=await s.host.b.request('POST','/v1/admin/exports',{body:{snapshotId:id,metric:'attendance',filters:{userId:s.guest.id}},headers:{'idempotency-key':randomUUID()}});expect(ticket.statusCode,ticket.body).toBe(201);
  const csv=await s.host.b.request('GET',`/v1/admin/exports/${json(ticket).data.exportId}`);expect(csv.statusCode,csv.body).toBe(200);expect(csv.body).toContain(s.guest.id);expect(csv.body).not.toContain(s.host.id);expect(csv.body).not.toContain('NEVER_EXPORT');expect(csv.body).not.toContain('private application');
  const{rows}=await h.db.pool.query(`SELECT facts::text AS text FROM analytics_snapshot_facts WHERE snapshot_id=$1`,[id]);expect(rows.map(r=>r.text).join('')).not.toContain('NEVER_EXPORT');
 });
});
