import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,describe,it,expect,inject} from 'vitest';
import {Browser,createHarness,json,type Harness} from '../test/harness.ts';
import {REMOVED_SUPPORT_TEXT,purgeKnownSupportText} from './privacy.ts';
import {withTransaction} from '../common/transaction.ts';
let h:Harness;
beforeAll(async()=>{h=await createHarness(inject('pgServerUrl'));});afterAll(async()=>{await h.close();});
async function member(){const b=new Browser(h);const {body}=await b.signInWithEmail(`${randomUUID()}@example.invalid`);return {b,id:body.data.session.user.id as string};}
async function fixture(kind:'reporter'|'USER'|'MEAL'|'MESSAGE'){
 const reporter=await member(),target=await member(),staff=await member();let targetId=target.id;const targetType=kind==='reporter'?'USER':kind;
 if(kind==='MEAL'||kind==='MESSAGE'){
  const venue=(await h.db.pool.query(`INSERT INTO venues(place_id,provider) VALUES($1,'fixture') RETURNING id`,[`fixture_${randomUUID()}`])).rows[0].id;
  const meal=(await h.db.pool.query(`INSERT INTO meals(host_id,venue_ref,title,description,starts_at,closes_at,scheduled_end_at,start_local_date,start_local_time,start_offset,close_local_date,close_local_time,close_offset,minimum,capacity,budget_min_pence,budget_max_pence,languages,mood,booking_mode,terms_version,attempt_id,status) VALUES($1,$2,'Privacy fixture','Synthetic privacy fixture description',now()+interval '2 day',now()+interval '1 day',now()+interval '2 day 2 hour','2026-10-30','12:00',0,'2026-10-29','12:00',0,2,4,1000,2000,ARRAY['en'],'EASY_CONVERSATION','EXTERNAL_PAY_AT_VENUE','2026-10-21',$3,'OPEN') RETURNING id`,[target.id,venue,randomUUID()])).rows[0].id;
  targetId=meal;
  if(kind==='MESSAGE'){const conversation=(await h.db.pool.query(`INSERT INTO conversations(kind,meal_id) VALUES('GROUP',$1) RETURNING id`,[meal])).rows[0].id;targetId=(await h.db.pool.query(`INSERT INTO messages(conversation_id,seq,sender_id,client_message_id,body,created_at) VALUES($1,1,$2,$3,'Synthetic message body',now()) RETURNING id`,[conversation,target.id,randomUUID()])).rows[0].id;}
 }
 const report=(await h.db.pool.query(`INSERT INTO reports(reporter_id,target_type,target_id,reason,details,public_outcome,receipt) VALUES($1,$2,$3,'REASON_SENTINEL','DETAIL_SENTINEL','OUTCOME_SENTINEL',$4) RETURNING id`,[reporter.id,targetType,targetId,randomUUID()])).rows[0].id;
 const c=(await h.db.pool.query(`INSERT INTO support_cases(report_id,target_type,target_id,details) VALUES($1,$2,$3,'DETAIL_SENTINEL') RETURNING id`,[report,targetType,targetId])).rows[0].id;
 await h.db.pool.query(`INSERT INTO roles(user_id,role,granted_by) VALUES($1,'support','test')`,[staff.id]);await h.db.pool.query(`UPDATE session_families SET amr=ARRAY['mfa'] WHERE user_id=$1`,[staff.id]);await h.db.pool.query(`INSERT INTO support_case_grants(case_id,user_id) VALUES($1,$2)`,[c,staff.id]);
 return {reporter,target,staff,report,caseId:c,deleted:kind==='reporter'?reporter.id:target.id};
}
describe('support free text while a deleted association is held as a safety record',()=>{
 it.each(['reporter','USER','MEAL','MESSAGE'] as const)('keeps a granted case and its outcome readable when the %s association becomes DELETING, and hides them only after redaction',async kind=>{
  const f=await fixture(kind);const url=`/v1/support/cases/${f.caseId}`;const key=randomUUID();const body={status:'IN_REVIEW',publicOutcome:'OUTCOME_SENTINEL',reason:'AUDIT_SENTINEL'};
  const opened=await f.staff.b.request('GET',url);expect(opened.statusCode).toBe(200);expect(json(opened).data.details).toBe('DETAIL_SENTINEL');
  expect((await f.staff.b.request('POST',`${url}/status`,{body,headers:{'idempotency-key':key,'if-match':'"1"'}})).statusCode).toBe(200);
  await h.db.pool.query(`WITH deleted AS(UPDATE users SET status='DELETING' WHERE id=$1 RETURNING id) UPDATE privacy_control SET epoch=epoch+1 WHERE id=1 AND EXISTS(SELECT 1 FROM deleted)`,[f.deleted]);
  const kept=await f.staff.b.request('GET',url);expect(kept.statusCode,kept.body).toBe(200);expect(json(kept).data.details).toBe('DETAIL_SENTINEL');
  // Idempotent replays of responses cached before a privacy change still refuse to serve them.
  const replay=await f.staff.b.request('POST',`${url}/status`,{body,headers:{'idempotency-key':key,'if-match':'"1"'}});expect(replay.statusCode,replay.body).toBe(403);expect(replay.body).not.toContain('SENTINEL');
  // Staff without the case grant cannot read it.
  const stranger=await member();await h.db.pool.query(`INSERT INTO roles(user_id,role,granted_by) VALUES($1,'support','test')`,[stranger.id]);await h.db.pool.query(`UPDATE session_families SET amr=ARRAY['mfa'] WHERE user_id=$1`,[stranger.id]);
  expect((await stranger.b.request('GET',url)).statusCode).toBe(404);
  const resolved=await f.staff.b.request('POST',`${url}/status`,{body:{status:'RESOLVED',publicOutcome:'NEW_OUTCOME',reason:'NEW_REASON'},headers:{'idempotency-key':randomUUID(),'if-match':'"2"'}});expect(resolved.statusCode,resolved.body).toBe(200);expect(json(resolved).data.details).toBe('DETAIL_SENTINEL');
  expect((await h.db.pool.query(`SELECT public_outcome FROM reports WHERE id=$1`,[f.report])).rows[0].public_outcome).toBe('NEW_OUTCOME');
  expect((await h.db.pool.query(`SELECT reason FROM audit_events WHERE aggregate_id=$1 ORDER BY occurred_at DESC LIMIT 1`,[f.caseId])).rows[0].reason).toBe('NEW_REASON');
  if(kind!=='reporter')expect(json(await f.reporter.b.request('GET',`/v1/me/reports/${f.report}`)).data.publicOutcome).toBe('NEW_OUTCOME');
  // Once the retention period ends (or an erasure runs) the text is withheld everywhere.
  await withTransaction(h.db.pool,async tx=>{await tx.client.query(`SET LOCAL fancy.privacy_purge='on'`);await purgeKnownSupportText(tx.client,f.deleted);});
  const masked=await f.staff.b.request('GET',url);expect(masked.statusCode,masked.body).toBe(200);expect(json(masked).data.details).toBe(REMOVED_SUPPORT_TEXT);expect(masked.body).not.toMatch(/SENTINEL|NEW_/);
  const late=await f.staff.b.request('POST',`${url}/status`,{body:{status:'RESOLVED',publicOutcome:'LATE_OUTCOME',reason:'LATE_REASON'},headers:{'idempotency-key':randomUUID(),'if-match':`"${json(masked).data.version}"`}});expect(late.statusCode,late.body).toBe(200);expect(late.body).not.toContain('LATE_');
  expect((await h.db.pool.query(`SELECT public_outcome FROM reports WHERE id=$1`,[f.report])).rows[0].public_outcome).toBeNull();
  expect((await h.db.pool.query(`SELECT reason FROM audit_events WHERE aggregate_id=$1 AND action='support.case_resolved' ORDER BY occurred_at DESC LIMIT 1`,[f.caseId])).rows[0].reason).toBe('PRIVACY_REDACTED');
  if(kind!=='reporter'){const receipt=await f.reporter.b.request('GET',`/v1/me/reports/${f.report}`);expect(receipt.statusCode).toBe(200);expect(json(receipt).data.publicOutcome).toBeNull();expect(receipt.body).not.toMatch(/SENTINEL|NEW_|LATE_/);}
 });
 it('leaves an unrelated active case readable and rejects a new report against a deleting target',async()=>{
  const f=await fixture('USER');const other=await member();await h.db.pool.query(`UPDATE users SET status='DELETING' WHERE id=$1`,[other.id]);
  expect(json(await f.staff.b.request('GET',`/v1/support/cases/${f.caseId}`)).data.details).toBe('DETAIL_SENTINEL');
  const response=await f.reporter.b.request('POST','/v1/reports',{body:{targetType:'USER',targetId:other.id,reason:'private_concern',details:'Must never be accepted after target barrier.'},headers:{'idempotency-key':randomUUID()}});expect(response.statusCode,response.body).toBe(404);
 });
});
it('queues resolution behind a target deletion user barrier; the resolution is kept with the safety record',async()=>{
 const f=await fixture('USER');const barrier=await h.db.pool.connect();
 try{
  await barrier.query('BEGIN');await barrier.query(`UPDATE users SET status='DELETING' WHERE id=$1`,[f.deleted]);
  let settled=false;const response=f.staff.b.request('POST',`/v1/support/cases/${f.caseId}/status`,{body:{status:'RESOLVED',publicOutcome:'LATE_OUTCOME',reason:'LATE_REASON'},headers:{'idempotency-key':randomUUID(),'if-match':'"1"'}}).finally(()=>{settled=true;});
  let waiting=false;for(let n=0;n<100;n++){const result=await h.db.pool.query(`SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%FROM users%ORDER BY id FOR SHARE%'`);if(result.rows.length){waiting=true;break;}await new Promise(resolve=>setTimeout(resolve,5));}
  expect(waiting).toBe(true);expect(settled).toBe(false);await barrier.query(`UPDATE privacy_control SET epoch=epoch+1 WHERE id=1`);await barrier.query('COMMIT');
  const done=await response;expect(done.statusCode,done.body).toBe(200);expect(json(done).data.details).toBe('DETAIL_SENTINEL');
  expect((await h.db.pool.query(`SELECT public_outcome FROM reports WHERE id=$1`,[f.report])).rows[0].public_outcome).toBe('LATE_OUTCOME');
  expect((await h.db.pool.query(`SELECT reason FROM audit_events WHERE aggregate_id=$1 AND action='support.case_resolved'`,[f.caseId])).rows[0].reason).toBe('LATE_REASON');
 }finally{await barrier.query('ROLLBACK');barrier.release();}
});
