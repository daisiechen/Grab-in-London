/** QA round four: post-meal exact windows and independent message/consent permissions. */
import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,expect,inject,it} from 'vitest';
import {Browser,createHarness,json,type Harness} from '../apps/api/src/test/harness.ts';
import {withTransaction,type Tx} from '../apps/api/src/common/transaction.ts';
import {lockPostMeal} from '../apps/api/src/post-meal/lock.ts';
import {recordAttendanceRevision} from '../apps/api/src/post-meal/attendance.ts';
import {rateExperience} from '../apps/api/src/post-meal/experience.ts';
import {publishedReviewsForProfile,reviewPerson} from '../apps/api/src/post-meal/reviews.ts';
import {lockConnection,selectPair} from '../apps/api/src/connections/service.ts';
import {createGroupConversation,joinConversation} from '../apps/api/src/membership/intervals.ts';
let h:Harness;
beforeAll(async()=>{h=await createHarness(inject('pgServerUrl'));});afterAll(async()=>h.close());
async function actor(){const b=new Browser(h);const {body}=await b.signInWithEmail(`${randomUUID()}@example.invalid`);return{b,id:body.data.session.user.id as string};}
async function fixture(present=true){
 const host=await actor(),guest=await actor(),outsider=await actor();const end=new Date(Date.now()-8*86400_000),start=new Date(+end-7200_000),close=new Date(+start-3600_000);
 const venue=(await h.db.pool.query("INSERT INTO venues(place_id,provider) VALUES($1,'fixture') RETURNING id",['fixture_'+randomUUID()])).rows[0].id;
 const m=(await h.db.pool.query("INSERT INTO meals(host_id,venue_ref,title,description,starts_at,closes_at,scheduled_end_at,start_local_date,start_local_time,start_offset,close_local_date,close_local_time,close_offset,minimum,capacity,budget_min_pence,budget_max_pence,languages,mood,booking_mode,terms_version,attempt_id,status,head) VALUES($1,$2,'QA finished table','Synthetic independent post-meal fixture description',$3,$4,$5,'2026-10-20','19:00',60,'2026-10-20','18:00',60,2,4,1000,2000,ARRAY['en'],'EASY_CONVERSATION','EXTERNAL_PAY_AT_VENUE','2026-10-21',$6,'COMPLETED',2) RETURNING id",[host.id,venue,start,close,end,randomUUID()])).rows[0].id as string;
 for(const[index,user]of[host,guest].entries()){await h.db.pool.query('INSERT INTO seat_events(meal_id,seq,user_id,type,effective_at,command_id) VALUES($1,$2,$3,$4,$5,$6)',[m,index+1,user.id,index?'GUEST_CONFIRMED':'HOST_CONFIRMED',new Date(+close-60_000),randomUUID()]);await h.db.pool.query("INSERT INTO start_roster(meal_id,user_id,source_revision_hash,starts_at) VALUES($1,$2,'qa-independent',$3)",[m,user.id,start]);if(present)await h.db.pool.query("INSERT INTO attendance_revisions(meal_id,subject_id,source,value,version,actor_id,created_at) VALUES($1,$2,'SELF','present',1,$2,$3)",[m,user.id,end]);}
 const group=await withTransaction(h.db.pool,async tx=>{const g=await createGroupConversation(tx,{mealId:m,hostId:host.id,effectiveAt:close});await joinConversation(tx,g.conversationId,guest.id,close);return g.conversationId;});
 return{host,guest,outsider,m,end,group};
}
async function at<T>(now:Date,fn:(tx:Tx)=>Promise<T>){return withTransaction(h.db.pool,tx=>fn({...tx,effectiveNow:async()=>{tx.locks.closeLockPhase();return now;}}),{commitOnDomainError:true});}
async function snapshot(m:string){const result:Record<string,number>={};for(const table of['attendance_revisions','experience_revisions','public_review_revisions'])result[table]=Number((await h.db.pool.query(`SELECT count(*) n FROM ${table} WHERE meal_id=$1`,[m])).rows[0].n);result.consents=Number((await h.db.pool.query('SELECT count(*) n FROM pair_consents WHERE basis_meal_id=$1',[m])).rows[0].n);result.facts=Number((await h.db.pool.query('SELECT count(*) n FROM business_events WHERE aggregate_id=$1',[m])).rows[0].n);return result;}

import {invalidateIneligiblePairs} from '../apps/api/src/connections/service.ts';
import {sealSourceSnapshot} from '../apps/api/src/admin/snapshots.ts';
import {loadAdminSnapshot} from '../apps/api/src/admin/pages.ts';
import {appendAudit} from '../packages/db/src/index.ts';
async function support(f:Awaited<ReturnType<typeof fixture>>,role='support'){
 const staff=await actor();await h.db.pool.query("INSERT INTO roles(user_id,role,granted_by) VALUES($1,$2,'qa-fixture')",[staff.id,role]);await h.db.pool.query("UPDATE session_families SET amr=ARRAY['mfa'] WHERE user_id=$1",[staff.id]);
 const c=(await h.db.pool.query("INSERT INTO support_cases(target_type,target_id,details) VALUES('MEAL',$1,'Independent synthetic attendance evidence') RETURNING id",[f.m])).rows[0].id;
 await h.db.pool.query('INSERT INTO support_case_grants(case_id,user_id) VALUES($1,$2)',[c,staff.id]);return{...staff,caseId:c};
}
const correct=(staff:Awaited<ReturnType<typeof support>>,f:Awaited<ReturnType<typeof fixture>>,value:string,version:string)=>staff.b.request('POST',`/v1/support/cases/${staff.caseId}/attendance-corrections`,{headers:{'idempotency-key':randomUUID()},body:{mealId:f.m,subjectId:f.guest.id,value,expectedVersion:version,reason:'Reviewed independent synthetic evidence.'}});
async function feedback(){const id=await sealSourceSnapshot(h.db.pool,new Date('2026-01-01'));const page=await loadAdminSnapshot(h.db.pool,{snapshotId:id});return page.calculated.metrics.feedback;}
it('QA-POST-009 actual support present absent present recomputes fresh statistics/public references and closes sole-basis direct without duplicate ratings',async()=>{
 const f=await fixture(),staff=await support(f),when=new Date(+f.end+3600_000);
 await at(when,async tx=>{const {meal,now}=await lockPostMeal(tx,f.m,f.guest.id,f.host.id);await rateExperience(tx,meal,f.guest.id,5,'0',now);await reviewPerson(tx,meal,f.guest.id,f.host.id,'Independent reference for the host.','0',now);await reviewPerson(tx,meal,f.host.id,f.guest.id,'Independent reference for the guest.','0',now);});
 for(const [a,b] of [[f.host,f.guest],[f.guest,f.host]])await at(when,async tx=>{const {pair,now}=await lockConnection(tx,a.id,b.id,[f.m]);return selectPair(tx,pair,a.id,b.id,f.m,true,'0',now);});
 const path=`/v1/connections/${f.guest.id}/conversation`,direct=json(await f.host.b.request('GET',path)).data.id;
 expect(json(await f.host.b.request('GET',path)).data.canSend).toBe(true);expect(await publishedReviewsForProfile(h.db.pool,f.guest.id)).toHaveLength(1);expect(await feedback()).toEqual({numerator:1,denominator:2});
 const off=await correct(staff,f,'absent','1');expect(off.statusCode,off.body).toBe(201);expect(await publishedReviewsForProfile(h.db.pool,f.guest.id)).toEqual([]);expect(await feedback()).toEqual({numerator:0,denominator:1});expect(json(await f.host.b.request('GET',path)).data.canSend).toBe(false);
 expect((await f.host.b.request('POST',`/v1/conversations/${direct}/messages`,{body:{body:'Must not send after correction.',clientMessageId:randomUUID()}})).statusCode).toBe(403);
 const on=await correct(staff,f,'present','2');expect(on.statusCode,on.body).toBe(201);expect(await publishedReviewsForProfile(h.db.pool,f.guest.id)).toHaveLength(1);expect(await feedback()).toEqual({numerator:1,denominator:2});expect(json(await f.host.b.request('GET',path)).data.canSend).toBe(false);
 expect((await h.db.pool.query('SELECT count(*)::int n FROM experience_revisions WHERE meal_id=$1',[f.m])).rows[0].n).toBe(1);
 expect((await h.db.pool.query("SELECT count(*)::int n FROM audit_events WHERE aggregate_id=$1 AND action='attendance.corrected'",[staff.caseId])).rows[0].n).toBe(2);
});
it('QA-POST-010 support correction deadline minus1 rejects and equality records revision/audit atomically; analyst denied even with MFA and case grant',async()=>{
 const f=await fixture(),staff=await support(f),deadline=new Date(+f.end+7*86400_000);
 await expect(at(new Date(+deadline-1),async tx=>{const {meal,now}=await lockPostMeal(tx,f.m,staff.id,f.guest.id);return recordAttendanceRevision(tx,meal,f.guest.id,'SUPPORT','absent',staff.id,'1',now,'Independent evidence.');})).rejects.toMatchObject({code:'CORRECTION_WINDOW_OPEN'});
 expect((await snapshot(f.m)).attendance_revisions).toBe(2);
 await at(deadline,async tx=>{const {meal,now,pairs}=await lockPostMeal(tx,f.m,staff.id,f.guest.id);const a=await recordAttendanceRevision(tx,meal,f.guest.id,'SUPPORT','absent',staff.id,'1',now,'Independent evidence.');await invalidateIneligiblePairs(tx,pairs,now);await appendAudit(tx.client,{actorKind:'SUPPORT',actorId:staff.id,action:'attendance.corrected',aggregateType:'case',aggregateId:staff.caseId,requestId:randomUUID(),reason:'Independent evidence.',payload:{revision:a.version}});});
 expect((await h.db.pool.query("SELECT created_at FROM attendance_revisions WHERE meal_id=$1 AND source='SUPPORT'",[f.m])).rows[0].created_at).toEqual(deadline);
 expect((await h.db.pool.query("SELECT count(*)::int n FROM audit_events WHERE aggregate_id=$1 AND action='attendance.corrected'",[staff.caseId])).rows[0].n).toBe(1);
 const analyst=await support(f,'analyst');expect((await correct(analyst,f,'present','2')).statusCode).toBe(403);expect((await analyst.b.request('GET',`/v1/conversations/${f.group}/messages?mode=HISTORY`)).statusCode).toBe(404);
});
