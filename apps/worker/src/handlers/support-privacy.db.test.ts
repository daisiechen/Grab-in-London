import {randomUUID,randomBytes} from 'node:crypto';
import {afterAll,beforeAll,it,expect,inject} from 'vitest';
import {migrate,type Job} from '@fancy/db';
import {createMigratedDatabase,type MigratedDatabase} from '@fancy/testkit/db';
import {deletionHandler,UnavailableDeletionProvider} from './deletion.ts';
import {DEFAULT_SAFETY_RECORD_DAYS,REMOVED_SUPPORT_TEXT,purgeExpiredSafetyRecords,purgeKnownSupportText,safetyRecordRetentionDays} from '../../../api/src/support/privacy.ts';
import {withTransaction} from '../../../api/src/common/transaction.ts';
let db:MigratedDatabase;
beforeAll(async()=>{db=await createMigratedDatabase(inject('pgServerUrl'),migrate);});afterAll(async()=>{await db.drop();});
const day=86_400_000;
it('holds support records of a deleted account (reports about and by them, notes, reasons) with a copy of the reported content, then redacts them after the retention period',async()=>{
 const users:string[]=[];for(let i=0;i<3;i++)users.push((await db.pool.query(`INSERT INTO users DEFAULT VALUES RETURNING id`)).rows[0].id);
 const [deleted,other,staff]=users as [string,string,string];
 await db.pool.query(`UPDATE users SET signup_source='instagram:social:launch' WHERE id=$1`,[deleted]);
 await db.pool.query(`INSERT INTO profiles(user_id,display_name,bio,languages,interests) VALUES($1,'Deleted name','PROFILE_SENTINEL bio',ARRAY['en'],ARRAY['FOOD'])`,[deleted]);
 const venue=(await db.pool.query(`INSERT INTO venues(place_id,provider) VALUES($1,'fixture') RETURNING id`,[`fixture_${randomUUID()}`])).rows[0].id;
 const meal=(await db.pool.query(`INSERT INTO meals(host_id,venue_ref,title,description,starts_at,closes_at,scheduled_end_at,start_local_date,start_local_time,start_offset,close_local_date,close_local_time,close_offset,minimum,capacity,budget_min_pence,budget_max_pence,languages,mood,booking_mode,terms_version,attempt_id,status) VALUES($1,$2,'Deleted host title','Deleted host synthetic description',now()-interval '10 day',now()-interval '11 day',now()-interval '10 day'+interval '2 hour','2026-10-01','12:00',60,'2026-09-30','12:00',60,2,4,1000,2000,ARRAY['en'],'EASY_CONVERSATION','EXTERNAL_PAY_AT_VENUE','2026-10-21',$3,'COMPLETED') RETURNING id`,[deleted,venue,randomUUID()])).rows[0].id;
 const conversation=(await db.pool.query(`INSERT INTO conversations(kind,meal_id) VALUES('GROUP',$1) RETURNING id`,[meal])).rows[0].id;
 const message=(await db.pool.query(`INSERT INTO messages(conversation_id,seq,sender_id,client_message_id,body,created_at) VALUES($1,1,$2,$3,'Original deleted author body',now()) RETURNING id`,[conversation,deleted,randomUUID()])).rows[0].id;
 await db.pool.query(`INSERT INTO messages(conversation_id,seq,sender_id,client_message_id,body,created_at) VALUES($1,2,$2,$3,'Other member line',now())`,[conversation,other,randomUUID()]);
 const records:Array<{report:string;caseId:string}>=[];
 for(const [reporter,targetType,targetId]of [[deleted,'USER',other],[other,'USER',deleted],[other,'MEAL',meal],[other,'MESSAGE',message],[other,'USER',other]]){
  const report=(await db.pool.query(`INSERT INTO reports(reporter_id,target_type,target_id,reason,details,public_outcome,receipt) VALUES($1,$2,$3,'REASON_SENTINEL','DETAIL_SENTINEL','OUTCOME_SENTINEL',$4) RETURNING id`,[reporter,targetType,targetId,randomUUID()])).rows[0].id;
  const caseId=(await db.pool.query(`INSERT INTO support_cases(report_id,target_type,target_id,details) VALUES($1,$2,$3,'DETAIL_SENTINEL') RETURNING id`,[report,targetType,targetId])).rows[0].id;
  await db.pool.query(`INSERT INTO audit_events(actor_kind,actor_id,action,aggregate_type,aggregate_id,reason) VALUES('SUPPORT',$1,'support.case_resolved','case',$2,'AUDIT_SENTINEL')`,[staff,caseId]);records.push({report,caseId});
  await db.pool.query(`INSERT INTO moderation_actions(report_id,case_id,actor_kind,actor_id,action,target_type,target_id,note,before_state,after_state,public_outcome) VALUES($1,$2,'SUPPORT',$3,'HIDE_CONTENT',$4,$5,'NOTE_SENTINEL','{"displayName":"NOTE_SENTINEL"}','{"limited":true}','OUTCOME_SENTINEL')`,[report,caseId,staff,targetType,targetId]);
  await db.pool.query(`INSERT INTO idempotency(actor_id,operation,key,request_hash,state,claim_token,lease_until,response_status,response_json,resource_id,completed_at,expires_at) VALUES($1,'resolveCase',$2,$3,'COMPLETED',$4,now()+interval '1 min',200,$5,$6,now(),now()+interval '1 day')`,[staff,randomUUID(),'a'.repeat(64),randomUUID(),JSON.stringify({data:{id:caseId,details:'DETAIL_SENTINEL',publicOutcome:'OUTCOME_SENTINEL'}}),caseId]);
 }
 const related=records.slice(0,4),unrelated=records[4]!;
 const revision=(await db.pool.query(`INSERT INTO attendance_revisions(meal_id,subject_id,source,value,version,reason,actor_id) VALUES($1,$2,'SUPPORT','present',1,'COPIED_CASE_REASON',$3) RETURNING id`,[meal,other,staff])).rows[0].id;
 await db.pool.query(`INSERT INTO attendance_revisions(meal_id,subject_id,source,value,version,reason,actor_id) VALUES($1,$2,'SUPPORT','present',2,'UNLINKED_REASON',$3)`,[meal,other,staff]);
 await db.pool.query(`INSERT INTO audit_events(actor_kind,actor_id,action,aggregate_type,aggregate_id,reason,payload) VALUES('SUPPORT',$1,'attendance.corrected','case',$2,'COPIED_CASE_REASON',$3)`,[staff,related[2]!.caseId,JSON.stringify({mealId:meal,subjectId:other,revision:'1'})]);
 await db.pool.query(`UPDATE users SET status='DELETING' WHERE id=$1`,[deleted]);
 const {rows:[receipt]}=await db.pool.query(`INSERT INTO deletion_requests(user_id,receipt_token_hash,status,requested_at,policy_version,provider_steps) VALUES($1,$2,'PENDING',now()-interval '2 day','unconfigured','{"local":"COMPLETED"}'::jsonb) RETURNING id,requested_at`,[deleted,randomBytes(32).toString('hex')]);
 const job:Job={id:randomUUID(),kind:'account.purge',resourceId:receipt.id,dueAt:new Date(),attempts:1,maxAttempts:8,leaseOwner:'test',leaseUntil:new Date(Date.now()+10000),claimToken:randomUUID()};
 const handler=deletionHandler(db.pool,new UnavailableDeletionProvider());await handler(job);await handler(job);

 // Live personal content is replaced as before; the safety records are not.
 expect((await db.pool.query(`SELECT title FROM meals WHERE id=$1`,[meal])).rows[0].title).toBe('Meal unavailable');
 expect((await db.pool.query(`SELECT body FROM messages WHERE id=$1`,[message])).rows[0].body).toBe('Message removed');
 expect((await db.pool.query(`SELECT count(*)::int AS n FROM profiles WHERE user_id=$1`,[deleted])).rows[0].n).toBe(0);
 expect((await db.pool.query(`SELECT signup_source FROM users WHERE id=$1`,[deleted])).rows[0].signup_source).toBeNull();
 for(const item of related){
  expect((await db.pool.query(`SELECT details,reason,public_outcome FROM reports WHERE id=$1`,[item.report])).rows[0]).toEqual({details:'DETAIL_SENTINEL',reason:'REASON_SENTINEL',public_outcome:'OUTCOME_SENTINEL'});
  expect((await db.pool.query(`SELECT details,version FROM support_cases WHERE id=$1`,[item.caseId])).rows[0]).toMatchObject({details:'DETAIL_SENTINEL',version:'1'});
  expect((await db.pool.query(`SELECT note,before_state FROM moderation_actions WHERE case_id=$1`,[item.caseId])).rows[0]).toEqual({note:'NOTE_SENTINEL',before_state:{displayName:'NOTE_SENTINEL'}});
 }
 const holds=(await db.pool.query(`SELECT case_id,user_id,role,evidence,held_at FROM safety_record_holds ORDER BY case_id`)).rows;
 const byCase=Object.fromEntries(holds.map(r=>[r.case_id,r]));
 expect(holds).toHaveLength(4);expect(holds.every(r=>r.user_id===deleted&&r.held_at.getTime()===receipt.requested_at.getTime())).toBe(true);
 expect(byCase[related[0]!.caseId]).toMatchObject({role:'REPORTER',evidence:{}});
 expect(byCase[related[1]!.caseId]).toMatchObject({role:'SUBJECT',evidence:{profile:{displayName:'Deleted name',bio:'PROFILE_SENTINEL bio',languages:['en'],interests:['FOOD']}}});
 expect(byCase[related[2]!.caseId]).toMatchObject({role:'SUBJECT',evidence:{meal:{title:'Deleted host title',description:'Deleted host synthetic description'}}});
 expect(byCase[related[3]!.caseId]).toMatchObject({role:'SUBJECT',evidence:{messages:{[message]:'Original deleted author body'}}});
 expect(JSON.stringify(byCase[related[3]!.caseId])).not.toContain('Other member line');
 expect(byCase[unrelated.caseId]).toBeUndefined();
 expect((await db.pool.query(`SELECT status,provider_steps FROM deletion_requests WHERE id=$1`,[receipt.id])).rows[0]).toMatchObject({status:'NEEDS_SUPPORT',provider_steps:{local:'COMPLETED',supportText:'SAFETY_RECORDS_HELD',supportTextScope:'UNSTRUCTURED_ASSOCIATIONS_UNVERIFIED',retention:'NEEDS_APPROVAL'}});

 // Open cases are never due. Closed cases are due a full period after the later of deletion and closure.
 expect(await purgeExpiredSafetyRecords(db.pool,DEFAULT_SAFETY_RECORD_DAYS,new Date(Date.now()+5000*day))).toBe(0);
 await db.pool.query(`UPDATE support_cases SET status='RESOLVED' WHERE id=ANY($1::uuid[])`,[records.map(r=>r.caseId)]);
 // One case was closed 100 days after the deletion, so it is kept 100 days longer.
 await db.pool.query(`INSERT INTO audit_events(actor_kind,actor_id,action,aggregate_type,aggregate_id,occurred_at) VALUES('SUPPORT',$1,'support.case_resolved','case',$2,now()+interval '100 day')`,[staff,related[1]!.caseId]);
 const after=(n:number)=>new Date(Date.now()+n*day);
 expect(await purgeExpiredSafetyRecords(db.pool,365,after(364))).toBe(0);
 expect(await purgeExpiredSafetyRecords(db.pool,365,after(366))).toBe(3);
 expect((await db.pool.query(`SELECT details FROM reports WHERE id=$1`,[related[1]!.report])).rows[0].details).toBe('DETAIL_SENTINEL');
 expect(await purgeExpiredSafetyRecords(db.pool,365,after(464))).toBe(0);
 expect(await purgeExpiredSafetyRecords(db.pool,365,after(466))).toBe(1);
 expect(await purgeExpiredSafetyRecords(db.pool,365,after(466))).toBe(0);

 for(const item of related){const r=(await db.pool.query(`SELECT details,reason,public_outcome FROM reports WHERE id=$1`,[item.report])).rows[0];expect(r).toEqual({details:REMOVED_SUPPORT_TEXT,reason:'PRIVACY_REDACTED',public_outcome:null});expect((await db.pool.query(`SELECT details,version FROM support_cases WHERE id=$1`,[item.caseId])).rows[0]).toMatchObject({details:REMOVED_SUPPORT_TEXT,version:'2'});
  expect((await db.pool.query(`SELECT note,before_state,after_state,public_outcome FROM moderation_actions WHERE case_id=$1`,[item.caseId])).rows[0]).toEqual({note:'PRIVACY_REDACTED',before_state:{},after_state:{},public_outcome:null});}
 expect((await db.pool.query(`SELECT count(*)::int AS n FROM safety_record_holds`)).rows[0].n).toBe(0);
 expect((await db.pool.query(`SELECT reason,value,version,subject_id FROM attendance_revisions WHERE id=$1`,[revision])).rows[0]).toMatchObject({reason:'PRIVACY_REDACTED',value:'present',version:'1',subject_id:other});
 expect((await db.pool.query(`SELECT reason FROM attendance_revisions WHERE meal_id=$1 AND version=2`,[meal])).rows[0].reason).toBe('UNLINKED_REASON');
 expect((await db.pool.query(`SELECT reason FROM audit_events WHERE aggregate_id=ANY($1::uuid[])`,[related.map(r=>r.caseId)])).rows.every(r=>r.reason===null)).toBe(true);
 expect((await db.pool.query(`SELECT details,reason,public_outcome FROM reports WHERE id=$1`,[unrelated.report])).rows[0]).toEqual({details:'DETAIL_SENTINEL',reason:'REASON_SENTINEL',public_outcome:'OUTCOME_SENTINEL'});
 expect((await db.pool.query(`SELECT reason FROM audit_events WHERE aggregate_id=$1`,[unrelated.caseId])).rows[0].reason).toBe('AUDIT_SENTINEL');
 expect((await db.pool.query(`SELECT note FROM moderation_actions WHERE case_id=$1`,[unrelated.caseId])).rows[0].note).toBe('NOTE_SENTINEL');
 const intents=(await db.pool.query(`SELECT state,request_hash,response_json FROM idempotency WHERE resource_id=ANY($1::uuid[])`,[related.map(r=>r.caseId)])).rows;
 expect(intents).toHaveLength(4);for(const intent of intents){expect(intent).toMatchObject({state:'COMPLETED',request_hash:'a'.repeat(64),response_json:{data:{details:REMOVED_SUPPORT_TEXT,publicOutcome:null}}});expect(JSON.stringify(intent)).not.toContain('SENTINEL');}
 expect((await db.pool.query(`SELECT response_json FROM idempotency WHERE resource_id=$1`,[unrelated.caseId])).rows[0].response_json.data.details).toBe('DETAIL_SENTINEL');
 // A repeated immediate erasure is stable.
 await withTransaction(db.pool,async tx=>{await tx.client.query(`SET LOCAL fancy.privacy_purge='on'`);await purgeKnownSupportText(tx.client,deleted);});
 expect((await db.pool.query(`SELECT version FROM support_cases WHERE id=$1`,[related[0]!.caseId])).rows[0].version).toBe('2');
});
it('reads the retention period from RETENTION_POLICY_JSON.safetyRecordDays, defaulting to the approved 12 months',()=>{
 expect(DEFAULT_SAFETY_RECORD_DAYS).toBe(365);
 expect(safetyRecordRetentionDays(null)).toBe(365);
 expect(safetyRecordRetentionDays({})).toBe(365);
 expect(safetyRecordRetentionDays({safetyRecordDays:730})).toBe(730);
 for(const bad of [0,-1,1.5,'365',3651,null])expect(safetyRecordRetentionDays({safetyRecordDays:bad})).toBe(365);
});
