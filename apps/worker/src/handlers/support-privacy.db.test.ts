import {randomUUID,randomBytes} from 'node:crypto';
import {afterAll,beforeAll,it,expect,inject} from 'vitest';
import {migrate,type Job} from '@fancy/db';
import {createMigratedDatabase,type MigratedDatabase} from '@fancy/testkit/db';
import {deletionHandler,UnavailableDeletionProvider} from './deletion.ts';
import {REMOVED_SUPPORT_TEXT,purgeKnownSupportText} from '../../../api/src/support/privacy.ts';
import {withTransaction} from '../../../api/src/common/transaction.ts';
let db:MigratedDatabase;
beforeAll(async()=>{db=await createMigratedDatabase(inject('pgServerUrl'),migrate);});afterAll(async()=>{await db.drop();});
it('purges both known support copies, copied reasons and public outcomes without altering facts or unrelated text; repeated purge is stable',async()=>{
 const users:string[]=[];for(let i=0;i<3;i++)users.push((await db.pool.query(`INSERT INTO users DEFAULT VALUES RETURNING id`)).rows[0].id);
 const [deleted,other,staff]=users as [string,string,string];
 const venue=(await db.pool.query(`INSERT INTO venues(place_id,provider) VALUES($1,'fixture') RETURNING id`,[`fixture_${randomUUID()}`])).rows[0].id;
 const meal=(await db.pool.query(`INSERT INTO meals(host_id,venue_ref,title,description,starts_at,closes_at,scheduled_end_at,start_local_date,start_local_time,start_offset,close_local_date,close_local_time,close_offset,minimum,capacity,budget_min_pence,budget_max_pence,languages,mood,booking_mode,terms_version,attempt_id,status) VALUES($1,$2,'Deleted host title','Deleted host synthetic description',now()-interval '10 day',now()-interval '11 day',now()-interval '10 day'+interval '2 hour','2026-10-01','12:00',60,'2026-09-30','12:00',60,2,4,1000,2000,ARRAY['en'],'EASY_CONVERSATION','EXTERNAL_PAY_AT_VENUE','2026-10-21',$3,'COMPLETED') RETURNING id`,[deleted,venue,randomUUID()])).rows[0].id;
 const conversation=(await db.pool.query(`INSERT INTO conversations(kind,meal_id) VALUES('GROUP',$1) RETURNING id`,[meal])).rows[0].id;
 const message=(await db.pool.query(`INSERT INTO messages(conversation_id,seq,sender_id,client_message_id,body,created_at) VALUES($1,1,$2,$3,'Original deleted author body',now()) RETURNING id`,[conversation,deleted,randomUUID()])).rows[0].id;
 const records:Array<{report:string;caseId:string}>=[];
 for(const [reporter,targetType,targetId]of [[deleted,'USER',other],[other,'USER',deleted],[other,'MEAL',meal],[other,'MESSAGE',message],[other,'USER',other]]){
  const report=(await db.pool.query(`INSERT INTO reports(reporter_id,target_type,target_id,reason,details,public_outcome,receipt) VALUES($1,$2,$3,'REASON_SENTINEL','DETAIL_SENTINEL','OUTCOME_SENTINEL',$4) RETURNING id`,[reporter,targetType,targetId,randomUUID()])).rows[0].id;
  const caseId=(await db.pool.query(`INSERT INTO support_cases(report_id,target_type,target_id,details) VALUES($1,$2,$3,'DETAIL_SENTINEL') RETURNING id`,[report,targetType,targetId])).rows[0].id;
  await db.pool.query(`INSERT INTO audit_events(actor_kind,actor_id,action,aggregate_type,aggregate_id,reason) VALUES('SUPPORT',$1,'support.case_resolved','case',$2,'AUDIT_SENTINEL')`,[staff,caseId]);records.push({report,caseId});
  await db.pool.query(`INSERT INTO idempotency(actor_id,operation,key,request_hash,state,claim_token,lease_until,response_status,response_json,resource_id,completed_at,expires_at) VALUES($1,'resolveCase',$2,$3,'COMPLETED',$4,now()+interval '1 min',200,$5,$6,now(),now()+interval '1 day')`,[staff,randomUUID(),'a'.repeat(64),randomUUID(),JSON.stringify({data:{id:caseId,details:'DETAIL_SENTINEL',publicOutcome:'OUTCOME_SENTINEL'}}),caseId]);
 }
 const related=records.slice(0,4),unrelated=records[4]!;
 const revision=(await db.pool.query(`INSERT INTO attendance_revisions(meal_id,subject_id,source,value,version,reason,actor_id) VALUES($1,$2,'SUPPORT','present',1,'COPIED_CASE_REASON',$3) RETURNING id`,[meal,other,staff])).rows[0].id;
 await db.pool.query(`INSERT INTO attendance_revisions(meal_id,subject_id,source,value,version,reason,actor_id) VALUES($1,$2,'SUPPORT','present',2,'UNLINKED_REASON',$3)`,[meal,other,staff]);
 await db.pool.query(`INSERT INTO audit_events(actor_kind,actor_id,action,aggregate_type,aggregate_id,reason,payload) VALUES('SUPPORT',$1,'attendance.corrected','case',$2,'COPIED_CASE_REASON',$3)`,[staff,related[2]!.caseId,JSON.stringify({mealId:meal,subjectId:other,revision:'1'})]);
 await db.pool.query(`UPDATE users SET status='DELETING' WHERE id=$1`,[deleted]);
 const receipt=(await db.pool.query(`INSERT INTO deletion_requests(user_id,receipt_token_hash,status,requested_at,policy_version,provider_steps) VALUES($1,$2,'PENDING',now(),'unconfigured','{"local":"COMPLETED"}'::jsonb) RETURNING id`,[deleted,randomBytes(32).toString('hex')])).rows[0].id;
 const job:Job={id:randomUUID(),kind:'account.purge',resourceId:receipt,dueAt:new Date(),attempts:1,maxAttempts:8,leaseOwner:'test',leaseUntil:new Date(Date.now()+10000),claimToken:randomUUID()};
 const handler=deletionHandler(db.pool,new UnavailableDeletionProvider());await handler(job);await handler(job);
 for(const item of related){const r=(await db.pool.query(`SELECT details,reason,public_outcome FROM reports WHERE id=$1`,[item.report])).rows[0];expect(r).toEqual({details:REMOVED_SUPPORT_TEXT,reason:'PRIVACY_REDACTED',public_outcome:null});expect((await db.pool.query(`SELECT details,version FROM support_cases WHERE id=$1`,[item.caseId])).rows[0]).toMatchObject({details:REMOVED_SUPPORT_TEXT,version:'2'});}
 expect((await db.pool.query(`SELECT reason,value,version,subject_id FROM attendance_revisions WHERE id=$1`,[revision])).rows[0]).toMatchObject({reason:'PRIVACY_REDACTED',value:'present',version:'1',subject_id:other});
 expect((await db.pool.query(`SELECT reason FROM attendance_revisions WHERE meal_id=$1 AND version=2`,[meal])).rows[0].reason).toBe('UNLINKED_REASON');
 expect((await db.pool.query(`SELECT reason FROM audit_events WHERE aggregate_id=ANY($1::uuid[])`,[related.map(r=>r.caseId)])).rows.every(r=>r.reason===null)).toBe(true);
 expect((await db.pool.query(`SELECT details,reason,public_outcome FROM reports WHERE id=$1`,[unrelated.report])).rows[0]).toEqual({details:'DETAIL_SENTINEL',reason:'REASON_SENTINEL',public_outcome:'OUTCOME_SENTINEL'});
 expect((await db.pool.query(`SELECT reason FROM audit_events WHERE aggregate_id=$1`,[unrelated.caseId])).rows[0].reason).toBe('AUDIT_SENTINEL');
 const intents=(await db.pool.query(`SELECT state,request_hash,response_json FROM idempotency WHERE resource_id=ANY($1::uuid[])`,[related.map(r=>r.caseId)])).rows;
 expect(intents).toHaveLength(4);for(const intent of intents){expect(intent).toMatchObject({state:'COMPLETED',request_hash:'a'.repeat(64),response_json:{data:{details:REMOVED_SUPPORT_TEXT,publicOutcome:null}}});expect(JSON.stringify(intent)).not.toContain('SENTINEL');}
 expect((await db.pool.query(`SELECT response_json FROM idempotency WHERE resource_id=$1`,[unrelated.caseId])).rows[0].response_json.data.details).toBe('DETAIL_SENTINEL');
 await withTransaction(db.pool,async tx=>{await tx.client.query(`SET LOCAL fancy.privacy_purge='on'`);await purgeKnownSupportText(tx.client,deleted);});
 expect((await db.pool.query(`SELECT version FROM support_cases WHERE id=$1`,[related[0]!.caseId])).rows[0].version).toBe('2');
 expect((await db.pool.query(`SELECT status,provider_steps FROM deletion_requests WHERE id=$1`,[receipt])).rows[0]).toMatchObject({status:'NEEDS_SUPPORT',provider_steps:{supportText:'KNOWN_LINKS_REDACTED',supportTextScope:'UNSTRUCTURED_ASSOCIATIONS_UNVERIFIED',retention:'NEEDS_APPROVAL'}});
});
