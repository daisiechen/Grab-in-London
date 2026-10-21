import {withTransaction} from '../common/transaction.ts';
import {createGroupConversation} from '../membership/intervals.ts';
/** Independent regression probes against takeover integration; this file owns no implementation. */
import {randomBytes,randomUUID} from 'node:crypto';
import {afterAll,beforeAll,describe,expect,inject,it} from 'vitest';
import {Browser,createHarness,json,type Harness} from './harness.ts';
let h:Harness;
beforeAll(async()=>{h=await createHarness(inject('pgServerUrl'));});afterAll(async()=>{await h.close();});
async function member(){const b=new Browser(h);const {body}=await b.signInWithEmail(`${randomUUID()}@example.invalid`);return {b,id:body.data.session.user.id as string};}
async function runningMeal(hostId:string,guestId:string,startAfterMinutes=30){
 const {rows:[venue]}=await h.db.pool.query(`INSERT INTO venues(place_id,provider) VALUES($1,'fixture') RETURNING id`,[`fixture_${randomUUID().replaceAll('-','')}`]);
 const starts=new Date(Date.now()+startAfterMinutes*60_000),closes=new Date(Date.now()+(startAfterMinutes-60)*60_000);
 const {rows:[meal]}=await h.db.pool.query(`INSERT INTO meals(host_id,venue_ref,title,description,starts_at,closes_at,scheduled_end_at,start_local_date,start_local_time,start_offset,close_local_date,close_local_time,close_offset,minimum,capacity,budget_min_pence,budget_max_pence,languages,mood,booking_mode,terms_version,attempt_id,head) VALUES($1,$2,'Live review fixture','This is an independent review fixture meal description',$3,$4,$3::timestamptz+interval '2 hours','2026-10-21','12:00',60,'2026-10-21','11:00',60,2,3,1000,2000,ARRAY['en'],'EASY_CONVERSATION','EXTERNAL_PAY_AT_VENUE','2026-10-21',$5,2) RETURNING id`,[hostId,venue.id,starts,closes,randomUUID()]);
 const {rows:[application]}=await h.db.pool.query(`INSERT INTO applications(meal_id,user_id,round,state,message,decided_at) VALUES($1,$2,1,'CONFIRMED','A valid confirmed fixture application',$3) RETURNING id`,[meal.id,guestId,new Date(closes.getTime()-60_000)]);
 for(const [index,id] of [hostId,guestId].entries())await h.db.pool.query(`INSERT INTO seat_events(meal_id,seq,user_id,application_id,type,effective_at,command_id) VALUES($1,$2,$3,$4,$5,$6,$7)`,[meal.id,index+1,id,index?application.id:null,index?'GUEST_CONFIRMED':'HOST_CONFIRMED',new Date(closes.getTime()-60_000),randomUUID()]);
 return meal.id as string;
}

describe('independent integration review regression probes',()=>{
 it('cancels synchronously when deleting a confirmed guest drops a passed-cutoff meal below minimum',async()=>{
  const host=await member(),guest=await member();const mealId=await runningMeal(host.id,guest.id);
  const removed=await guest.b.request('POST','/v1/me/deletion',{body:{confirm:true,receiptToken:randomBytes(32).toString('base64url')},headers:{'idempotency-key':randomUUID(),'if-match':'"1"'}});
  expect(removed.statusCode,removed.body).toBe(202);
  const {rows:[meal]}=await h.db.pool.query(`SELECT status,cancel_reason,version FROM meals WHERE id=$1`,[mealId]);
  expect(meal).toMatchObject({status:'CANCELLED',cancel_reason:'insufficient'});
  expect(BigInt(meal.version)).toBeGreaterThan(1n);
 });
 it('refuses a private case result replay after its per-case grant is revoked',async()=>{
  const reporter=await member(),target=await member(),staff=await member();
  const report=await reporter.b.request('POST','/v1/reports',{body:{targetType:'USER',targetId:target.id,reason:'private_concern',details:'Sensitive case details review sentinel'},headers:{'idempotency-key':randomUUID()}});expect(report.statusCode).toBe(201);
  const {rows:[c]}=await h.db.pool.query(`SELECT id FROM support_cases WHERE report_id=$1`,[json(report).data.id]);
  await h.db.pool.query(`INSERT INTO roles(user_id,role,granted_by) VALUES($1,'support','test')`,[staff.id]);await h.db.pool.query(`UPDATE session_families SET amr=ARRAY['mfa'] WHERE user_id=$1`,[staff.id]);await h.db.pool.query(`INSERT INTO support_case_grants(case_id,user_id) VALUES($1,$2)`,[c.id,staff.id]);
  const key=randomUUID();const resolve=()=>staff.b.request('POST',`/v1/support/cases/${c.id}/status`,{body:{status:'RESOLVED',publicOutcome:'Reviewed.',reason:'A reason for the audit log.'},headers:{'idempotency-key':key,'if-match':'"1"'}});
  const first=await resolve();expect(first.statusCode,first.body).toBe(200);expect(first.body).toContain('Sensitive case details');
  await h.db.pool.query(`DELETE FROM support_case_grants WHERE case_id=$1 AND user_id=$2`,[c.id,staff.id]);
  const replay=await resolve();expect(replay.statusCode,replay.body).toBe(403);expect(replay.body).not.toContain('Sensitive case details');
 });
 it('does not skip notification rows whose timestamps differ only below millisecond precision',async()=>{
  const actor=await member();const first=randomUUID(),second=randomUUID();
  await h.db.pool.query(`INSERT INTO notifications(id,event_id,recipient_id,template,created_at) VALUES($1,$2,$3,'review_fixture','2026-10-20T12:00:00.123456Z'),($4,$5,$3,'review_fixture','2026-10-20T12:00:00.123789Z')`,[first,randomUUID(),actor.id,second,randomUUID()]);
  const page1=await actor.b.request('GET','/v1/me/notifications?limit=1');expect(json(page1).data[0].id).toBe(second);
  const page2=await actor.b.request('GET',`/v1/me/notifications?limit=1&cursor=${encodeURIComponent(json(page1).page.nextCursor)}`);expect(page2.statusCode,page2.body).toBe(200);expect(json(page2).data.map((r:{id:string})=>r.id)).toContain(first);
 });
});


describe('independent inbox authorization and pagination',()=>{
 it('advertises current DIRECT send authorization in Inbox after mutual consent',async()=>{
  const host=await member(),guest=await member();const mealId=await runningMeal(host.id,guest.id,-180);
  const {rows:[meal]}=await h.db.pool.query(`SELECT starts_at FROM meals WHERE id=$1`,[mealId]);
  for(const user of [host,guest]){
   await h.db.pool.query(`INSERT INTO start_roster(meal_id,user_id,source_revision_hash,starts_at) VALUES($1,$2,'review',$3) ON CONFLICT DO NOTHING`,[mealId,user.id,meal.starts_at]);
   const response=await user.b.request('PUT',`/v1/meals/${mealId}/attendance/${user.id}`,{body:{value:'present'},headers:{'idempotency-key':randomUUID(),'if-match':'"0"'}});expect(response.statusCode,response.body).toBe(200);
  }
  for(const [actor,subject] of [[host,guest],[guest,host]]){
   const response=await actor!.b.request('PUT',`/v1/meals/${mealId}/reconnect/${subject!.id}`,{body:{selected:true},headers:{'idempotency-key':randomUUID(),'if-match':'"0"'}});expect(response.statusCode,response.body).toBe(200);
  }
  const inbox=await host.b.request('GET','/v1/inbox');expect(inbox.statusCode,inbox.body).toBe(200);expect(json(inbox).data.find((r:{conversation:{kind:string}})=>r.conversation.kind==='DIRECT').conversation.canSend).toBe(true);
 });
 it('does not skip Inbox conversations whose creation timestamps differ only below millisecond precision',async()=>{
  const host=await member(),guest=await member();const conversations=[];
  for(let i=0;i<2;i++){
   const mealId=await runningMeal(host.id,guest.id);
   const created=await withTransaction(h.db.pool,tx=>createGroupConversation(tx,{mealId,hostId:host.id,effectiveAt:new Date()}));conversations.push(created.conversationId);
  }
  await h.db.pool.query(`UPDATE conversations SET created_at=CASE WHEN id=$1 THEN '2026-10-20T12:00:00.123456Z'::timestamptz ELSE '2026-10-20T12:00:00.123789Z'::timestamptz END WHERE id=ANY($2::uuid[])`,[conversations[0],conversations]);
  const first=await host.b.request('GET','/v1/inbox?limit=1');expect(json(first).data[0].conversation.id).toBe(conversations[1]);
  const second=await host.b.request('GET',`/v1/inbox?limit=1&cursor=${encodeURIComponent(json(first).page.nextCursor)}`);expect(second.statusCode,second.body).toBe(200);expect(json(second).data.map((r:{conversation:{id:string}})=>r.conversation.id)).toContain(conversations[0]);
 });
});

describe('independent inbox application progress contract',()=>{
 it('returns an applicant pending progress before any group membership exists',async()=>{
  const host=await member(),guest=await member(),applicant=await member();const mealId=await runningMeal(host.id,guest.id,120);
  const {rows:[application]}=await h.db.pool.query(`INSERT INTO applications(meal_id,user_id,round,state,message) VALUES($1,$2,1,'PENDING','A valid pending review application message') RETURNING id`,[mealId,applicant.id]);
  const inbox=await applicant.b.request('GET','/v1/inbox');expect(inbox.statusCode,inbox.body).toBe(200);expect(json(inbox).data.some((r:{application?:{id:string;state:string};conversation?:unknown})=>r.application?.id===application.id&&r.application?.state==='PENDING'&&!r.conversation)).toBe(true);
  const strangers=await guest.b.request('GET','/v1/inbox');expect(strangers.body).not.toContain(application.id);
 });
});

describe('independent authorization rejection before deletion mutations',()=>{
 it('does not alter account, seats or pending applications when sensitive reauthentication has expired',async()=>{
  const host=await member(),guest=await member();const mealId=await runningMeal(host.id,guest.id);
  await h.db.pool.query(`UPDATE session_families SET auth_time=clock_timestamp()-interval '6 minutes' WHERE user_id=$1`,[guest.id]);
  const response=await guest.b.request('POST','/v1/me/deletion',{body:{confirm:true,receiptToken:randomBytes(32).toString('base64url')},headers:{'idempotency-key':randomUUID(),'if-match':'"1"'}});expect(response.statusCode,response.body).toBe(403);expect(json(response).error.code).toBe('REAUTH_REQUIRED');
  expect((await h.db.pool.query(`SELECT status,version FROM users WHERE id=$1`,[guest.id])).rows[0]).toMatchObject({status:'ACTIVE',version:'1'});
  expect((await h.db.pool.query(`SELECT state FROM applications WHERE meal_id=$1 AND user_id=$2`,[mealId,guest.id])).rows[0].state).toBe('CONFIRMED');
  expect((await h.db.pool.query(`SELECT * FROM seat_events WHERE meal_id=$1 AND type='LEFT'`,[mealId])).rowCount).toBe(0);
  expect((await h.db.pool.query(`SELECT * FROM deletion_requests WHERE user_id=$1`,[guest.id])).rowCount).toBe(0);
 });
});
