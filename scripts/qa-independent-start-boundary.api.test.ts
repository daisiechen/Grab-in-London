/** QA-DB-008: exact start boundary, two queued PostgreSQL commands, immutable eligibility, separate support intake. */
import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,expect,inject,it} from 'vitest';
import {Browser,createHarness,json,type Harness} from '../apps/api/src/test/harness.ts';
import {withTransaction,type Tx} from '../apps/api/src/common/transaction.ts';
import {cancelByHost,declareBooking,lockMeal} from '../apps/api/src/meals/commands.ts';
import {leaveConfirmed} from '../apps/api/src/meals/applications.ts';
let h:Harness;beforeAll(async()=>{h=await createHarness(inject('pgServerUrl'));});afterAll(async()=>h.close());
const headers=(version?:string,key=randomUUID())=>({'idempotency-key':key,...(version?{'if-match':`"${version}"`}:{})});
async function actor(){const b=new Browser(h);const {body}=await b.signInWithEmail(`${randomUUID()}@example.invalid`);const id=body.data.session.user.id as string;const r=await b.request('PATCH','/v1/me',{body:{displayName:'QA Round Two',bio:'Synthetic isolated QA profile for concurrent safety checks.',languages:['en'],lifeStatus:'NEW_TO_LONDON',interests:['FOOD'],ageConfirmedVersion:'2026-10-21',communityAcceptedVersion:'2026-10-21'},headers:headers('1')});expect(r.statusCode,r.body).toBe(200);return{b,id};}
async function meal(b:Browser,capacity=4,extra:Record<string,unknown>={},expectedStatus=201){const venue=await b.request('POST','/v1/venues/confirm',{body:{placeId:'fixture_fancy_north'},headers:headers()});expect(venue.statusCode,venue.body).toBe(200);const r=await b.request('POST','/v1/meals',{body:{venueRef:json(venue).data.venueRef,title:'QA concurrency isolated table',description:'Synthetic table with no external restaurant or customer activity.',start:{localDate:'2030-10-23',localTime:'18:00',timeZone:'Europe/London',utcOffsetMinutes:60},close:{localDate:'2030-10-23',localTime:'17:00',timeZone:'Europe/London',utcOffsetMinutes:60},minimum:2,capacity,budgetMinPence:2000,budgetMaxPence:3500,languages:['en'],mood:'EASY_CONVERSATION',bookingMode:'EXTERNAL_PAY_AT_VENUE',attemptId:randomUUID(),bookingDeclarationConfirmed:true,reviewConfirmed:true,termsVersion:'2026-10-21',...extra},headers:headers()});expect(r.statusCode,r.body).toBe(expectedStatus);return expectedStatus===201?json(r).data:json(r).error;}
const apply=(b:Browser,id:string,key=randomUUID(),message='Independent synthetic application for QA.')=>b.request('POST',`/v1/meals/${id}/applications`,{body:{message},headers:headers(undefined,key)});
const approve=(b:Browser,id:string)=>b.request('POST',`/v1/applications/${id}/decision`,{body:{decision:'APPROVE'},headers:headers('1')});

const START=new Date('2030-10-23T17:00:00Z');
async function at<T>(instant:Date,fn:(tx:Tx)=>Promise<T>){return withTransaction(h.db.pool,tx=>fn({...tx,effectiveNow:async()=>{tx.locks.closeLockPhase();return instant;}}),{commitOnDomainError:true});}
async function version(id:string){return (await h.db.pool.query('SELECT version FROM meals WHERE id=$1',[id])).rows[0].version as string;}
it.each([0,1])('QA-DB-008 queued cancel and leave at startsAt+%ims preserve start roster and use separate support intake',async delta=>{
 const host=await actor(),guests=await Promise.all([actor(),actor(),actor()]),m=await meal(host.b,4,{minimum:3});
 for(const guest of guests){const a=await apply(guest.b,m.id);expect(a.statusCode,a.body).toBe(201);expect((await approve(host.b,json(a).data.id)).statusCode).toBe(200);}

 const bookingVersion=await version(m.id);await at(new Date(+START-3600001),tx=>declareBooking(tx,m.id,host.id,bookingVersion,{status:'REPORTED_CONFIRMED',count:4}));
 await at(START,tx=>lockMeal(tx,m.id,host.id));
 const beforeRoster=(await h.db.pool.query('SELECT * FROM start_roster WHERE meal_id=$1 ORDER BY user_id',[m.id])).rows;
 expect(beforeRoster.map(r=>r.user_id).sort()).toEqual([host.id,...guests.map(g=>g.id)].sort());
 const beforeSeats=(await h.db.pool.query('SELECT * FROM seat_events WHERE meal_id=$1 ORDER BY seq',[m.id])).rows;
 const current=await version(m.id),holder=await h.db.pool.connect();let cancelPid=0,leavePid=0;
 try{
  await holder.query('BEGIN');await holder.query('SELECT id FROM meals WHERE id=$1 FOR UPDATE',[m.id]);
  const command=(which:'cancel'|'leave')=>withTransaction(h.db.pool,async tx=>{
   const pid=(await tx.client.query('SELECT pg_backend_pid() pid')).rows[0].pid as number;
   if(which==='cancel')cancelPid=pid;else leavePid=pid;
   const timed={...tx,effectiveNow:async()=>{tx.locks.closeLockPhase();return new Date(+START+delta);}};
   return which==='cancel'?cancelByHost(timed,m.id,host.id,current,'host'):leaveConfirmed(timed,m.id,guests[0]!.id,current);
  },{commitOnDomainError:true});
  const pending=Promise.allSettled([command('cancel'),command('leave')]);
  let blocked=false;
  for(let n=0;n<300;n++){
   if(cancelPid&&leavePid){const r=await h.db.pool.query("SELECT count(*)::int n FROM pg_stat_activity WHERE pid=ANY($1::int[]) AND wait_event_type='Lock'",[ [cancelPid,leavePid] ]);if(r.rows[0].n===2){blocked=true;break;}}
   await new Promise(resolve=>setTimeout(resolve,5));
  }
  expect(blocked).toBe(true);await holder.query('COMMIT');
  for(const result of await pending){expect(result.status).toBe('rejected');if(result.status==='rejected')expect(result.reason).toMatchObject({code:'DEADLINE_PASSED'});}
 }finally{await holder.query('ROLLBACK');holder.release();}
 expect((await h.db.pool.query('SELECT * FROM start_roster WHERE meal_id=$1 ORDER BY user_id',[m.id])).rows).toEqual(beforeRoster);
 expect((await h.db.pool.query('SELECT * FROM seat_events WHERE meal_id=$1 ORDER BY seq',[m.id])).rows).toEqual(beforeSeats);
 expect((await h.db.pool.query('SELECT status,cancel_reason FROM meals WHERE id=$1',[m.id])).rows[0]).toEqual({status:'OPEN',cancel_reason:null});
 expect((await h.db.pool.query("SELECT count(*)::int n FROM business_events WHERE aggregate_id=$1 AND kind='meal.cancelled'",[m.id])).rows[0].n).toBe(0);
 const report=await guests[0]!.b.request('POST','/v1/reports',{headers:headers(),body:{targetType:'MEAL',targetId:m.id,reason:'private_concern',details:'Synthetic support request after start; ordinary cancellation refused.'}});
 expect(report.statusCode,report.body).toBe(201);
 const intake=(await h.db.pool.query('SELECT id FROM support_cases WHERE report_id=$1',[json(report).data.id])).rows;expect(intake).toHaveLength(1);
 expect((await h.db.pool.query('SELECT * FROM start_roster WHERE meal_id=$1 ORDER BY user_id',[m.id])).rows).toEqual(beforeRoster);
});
