/** Third independent round: exact command time boundaries and real HTTP DST fields. */
import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,describe,expect,inject,it} from 'vitest';
import {Browser,createHarness,json,type Harness} from '../apps/api/src/test/harness.ts';
import {withTransaction,type Tx} from '../apps/api/src/common/transaction.ts';
import {approveApplication,cancelByHost,declareBooking,lockMeal} from '../apps/api/src/meals/commands.ts';
import {applyForMeal,leaveConfirmed} from '../apps/api/src/meals/applications.ts';
let h:Harness;
beforeAll(async()=>{h=await createHarness(inject('pgServerUrl'));});
afterAll(async()=>h.close());
const headers=(version?:string,key=randomUUID())=>({'idempotency-key':key,...(version?{'if-match':`"${version}"`}:{})});
async function actor(){const b=new Browser(h);const {body}=await b.signInWithEmail(`${randomUUID()}@example.invalid`);const id=body.data.session.user.id as string;const r=await b.request('PATCH','/v1/me',{body:{displayName:'QA Round Two',bio:'Synthetic isolated QA profile for concurrent safety checks.',languages:['en'],lifeStatus:'NEW_TO_LONDON',interests:['FOOD'],ageConfirmedVersion:'2026-10-21',communityAcceptedVersion:'2026-10-21'},headers:headers('1')});expect(r.statusCode,r.body).toBe(200);return{b,id};}
async function meal(b:Browser,capacity=4,extra:Record<string,unknown>={},expectedStatus=201){const venue=await b.request('POST','/v1/venues/confirm',{body:{placeId:'fixture_fancy_north'},headers:headers()});expect(venue.statusCode,venue.body).toBe(200);const r=await b.request('POST','/v1/meals',{body:{venueRef:json(venue).data.venueRef,title:'QA concurrency isolated table',description:'Synthetic table with no external restaurant or customer activity.',start:{localDate:'2030-10-23',localTime:'18:00',timeZone:'Europe/London',utcOffsetMinutes:60},close:{localDate:'2030-10-23',localTime:'17:00',timeZone:'Europe/London',utcOffsetMinutes:60},minimum:2,capacity,budgetMinPence:2000,budgetMaxPence:3500,languages:['en'],mood:'EASY_CONVERSATION',bookingMode:'EXTERNAL_PAY_AT_VENUE',attemptId:randomUUID(),bookingDeclarationConfirmed:true,reviewConfirmed:true,termsVersion:'2026-10-21',...extra},headers:headers()});expect(r.statusCode,r.body).toBe(expectedStatus);return expectedStatus===201?json(r).data:json(r).error;}
const apply=(b:Browser,id:string,key=randomUUID(),message='Independent synthetic application for QA.')=>b.request('POST',`/v1/meals/${id}/applications`,{body:{message},headers:headers(undefined,key)});
const approve=(b:Browser,id:string)=>b.request('POST',`/v1/applications/${id}/decision`,{body:{decision:'APPROVE'},headers:headers('1')});
async function count(sql:string,values:unknown[]){return Number((await h.db.pool.query(sql,values)).rows[0].n);}

const CLOSE=new Date('2030-10-23T16:00:00.000Z'),START=new Date('2030-10-23T17:00:00.000Z');
async function at<T>(instant:Date,command:(tx:Tx)=>Promise<T>){return withTransaction(h.db.pool,tx=>command({...tx,effectiveNow:async()=>{tx.locks.closeLockPhase();return instant;}}),{commitOnDomainError:true});}
async function version(id:string){return (await h.db.pool.query('SELECT version FROM meals WHERE id=$1',[id])).rows[0].version as string;}
describe('independent fixed command clock with real PostgreSQL',()=>{
 for(const [cid,delta,allowed]of [['QA-TIME-001',-1,true],['QA-TIME-002',0,false],['QA-TIME-003',1,false]]as const){
  it(`${cid} apply and approve at close ${delta}ms`,async()=>{
   const host=await actor(),guest=await actor(),fresh=await actor(),m=await meal(host.b);const pending=await apply(guest.b,m.id);expect(pending.statusCode,pending.body).toBe(201);const instant=new Date(+CLOSE+delta);
   if(allowed){expect((await at(instant,tx=>approveApplication(tx,json(pending).data.id,host.id,'1','APPROVE'))).application.state).toBe('CONFIRMED');expect((await at(instant,tx=>applyForMeal(tx,m.id,fresh.id,'An independent boundary application.'))).state).toBe('PENDING');expect(await count("SELECT count(*) n FROM seat_events WHERE meal_id=$1 AND type='GUEST_CONFIRMED'",[m.id])).toBe(1);}
   else{await expect(at(instant,tx=>approveApplication(tx,json(pending).data.id,host.id,'1','APPROVE'))).rejects.toMatchObject({code:expect.stringMatching(/MEAL_CANCELLED|DEADLINE_PASSED/)});await expect(at(instant,tx=>applyForMeal(tx,m.id,fresh.id,'An independent boundary application.'))).rejects.toMatchObject({code:expect.stringMatching(/MEAL_CANCELLED|DEADLINE_PASSED/)});expect((await h.db.pool.query('SELECT state FROM applications WHERE id=$1',[json(pending).data.id])).rows[0].state).toBe('EXPIRED');expect(await count("SELECT count(*) n FROM seat_events WHERE meal_id=$1 AND type='GUEST_CONFIRMED'",[m.id])).toBe(0);expect(await count('SELECT count(*) n FROM applications WHERE meal_id=$1 AND user_id=$2',[m.id,fresh.id])).toBe(0);}
  });
 }
 it('QA-DB-007 post-close exit below minimum cancels once and preserves group membership',async()=>{
  const host=await actor(),a=await actor(),b=await actor(),m=await meal(host.b,4,{minimum:3});for(const guest of[a,b]){const r=await apply(guest.b,m.id);expect((await approve(host.b,json(r).data.id)).statusCode).toBe(200);}
  const v=await version(m.id);const exited=await at(new Date(+CLOSE+1),tx=>leaveConfirmed(tx,m.id,a.id,v));expect(exited.meal).toMatchObject({status:'CANCELLED',cancel_reason:'insufficient'});
  const group=(await h.db.pool.query('SELECT id,dissolved_at FROM conversations WHERE meal_id=$1',[m.id])).rows[0];expect(group.dissolved_at).toBeNull();expect(await count('SELECT count(*) n FROM membership_intervals WHERE conversation_id=$1 AND leave_seq IS NULL',[group.id])).toBe(3);
  const first=await count("SELECT count(*) n FROM notifications WHERE refs->>'mealId'=$1 AND template='meal_cancelled'",[m.id]);expect(first).toBe(2);await expect(at(new Date(+CLOSE+2),tx=>leaveConfirmed(tx,m.id,a.id,v))).rejects.toMatchObject({code:'MEAL_CANCELLED'});expect(await count("SELECT count(*) n FROM notifications WHERE refs->>'mealId'=$1 AND template='meal_cancelled'",[m.id])).toBe(first);
 });
 it('QA-DB-008 after start ordinary cancel and leave reject without changing sealed eligibility',async()=>{
  const host=await actor(),guest=await actor(),m=await meal(host.b);const a=await apply(guest.b,m.id);expect((await approve(host.b,json(a).data.id)).statusCode).toBe(200);let v=await version(m.id);
  await expect(at(new Date(+START+1),tx=>cancelByHost(tx,m.id,host.id,v,'host'))).rejects.toMatchObject({code:'DEADLINE_PASSED'});v=await version(m.id);const before=(await h.db.pool.query('SELECT user_id FROM start_roster WHERE meal_id=$1 ORDER BY user_id',[m.id])).rows;expect(before).toHaveLength(2);await expect(at(new Date(+START+2),tx=>leaveConfirmed(tx,m.id,guest.id,v))).rejects.toMatchObject({code:'DEADLINE_PASSED'});expect((await h.db.pool.query('SELECT user_id FROM start_roster WHERE meal_id=$1 ORDER BY user_id',[m.id])).rows).toEqual(before);expect(await count("SELECT count(*) n FROM seat_events WHERE meal_id=$1 AND type='LEFT'",[m.id])).toBe(0);
 });
 it('QA-DB-011 booking failure does not cancel meal or group and changed headcount makes declaration stale',async()=>{
  const host=await actor(),guest=await actor(),m=await meal(host.b);const result=await at(new Date(+CLOSE-60_000),tx=>declareBooking(tx,m.id,host.id,'1',{status:'FAILED',count:1}));expect(result.meal.status).toBe('OPEN');const group=(await h.db.pool.query('SELECT dissolved_at FROM conversations WHERE meal_id=$1',[m.id])).rows[0];expect(group.dissolved_at).toBeNull();const a=await apply(guest.b,m.id);expect((await approve(host.b,json(a).data.id)).statusCode).toBe(200);expect(json(await host.b.request('GET',`/v1/meals/${m.id}`)).data.meal.bookingDeclaration.stale).toBe(true);
 });
});
describe('independent real HTTP begin and deadline DST fields',()=>{
 for(const [id,offset,utc]of [['QA-TIME-005',60,'2026-10-25T00:30:00.000Z'],['QA-TIME-006',0,'2026-10-25T01:30:00.000Z']]as const){
  it(`${id} start and close use the independently expected instant`,async()=>{
   for(const field of['start','close']as const){const host=await actor();const target={localDate:'2026-10-25',localTime:'01:30',timeZone:'Europe/London',utcOffsetMinutes:offset};const other=field==='start'?{close:{localDate:'2026-10-24',localTime:'23:30',timeZone:'Europe/London',utcOffsetMinutes:60}}:{start:{localDate:'2026-10-25',localTime:'03:00',timeZone:'Europe/London',utcOffsetMinutes:0}};const m=await meal(host.b,4,{...other,[field]:target});const column=field==='start'?'starts_at':'closes_at';expect((await h.db.pool.query(`SELECT ${column} AS instant FROM meals WHERE id=$1`,[m.id])).rows[0].instant.toISOString()).toBe(utc);}
  });
 }
});

describe('independent HTTP invalid wall times never persist meals',()=>{
 it('QA-TIME-004 both start and close require explicit autumn BST/GMT choice',async()=>{
  for(const field of['start','close']as const){const host=await actor();const target={localDate:'2026-10-25',localTime:'01:30',timeZone:'Europe/London'};const other=field==='start'?{close:{localDate:'2026-10-24',localTime:'23:30',timeZone:'Europe/London',utcOffsetMinutes:60}}:{start:{localDate:'2026-10-25',localTime:'03:00',timeZone:'Europe/London',utcOffsetMinutes:0}};const error=await meal(host.b,4,{...other,[field]:target},422);expect(error.code).toBe('TIME_AMBIGUOUS');expect(await count('SELECT count(*) n FROM meals WHERE host_id=$1',[host.id])).toBe(0);}
 });
 it('QA-TIME-007 neither start nor close spring gap silently shifts, for any supplied offset',async()=>{
  for(const field of['start','close']as const){for(const offset of[undefined,0,60]){const host=await actor();const target={localDate:'2027-03-28',localTime:'01:30',timeZone:'Europe/London',...(offset===undefined?{}:{utcOffsetMinutes:offset})};const other=field==='start'?{close:{localDate:'2027-03-27',localTime:'23:30',timeZone:'Europe/London',utcOffsetMinutes:0}}:{start:{localDate:'2027-03-28',localTime:'03:00',timeZone:'Europe/London',utcOffsetMinutes:60}};const error=await meal(host.b,4,{...other,[field]:target},422);expect(error.code).toBe('TIME_NONEXISTENT');expect(await count('SELECT count(*) n FROM meals WHERE host_id=$1',[host.id])).toBe(0);}}
 });
});

describe('independent real lock wait and transactional refusal',()=>{
 it('QA-DB-002 approval waits across actual DB deadline and commits expiry instead of stale-clock approval',async()=>{
  const host=await actor(),guest=await actor(),m=await meal(host.b);const a=await apply(guest.b,m.id);expect(a.statusCode,a.body).toBe(201);const holder=await h.db.pool.connect();
  try{
   await holder.query('BEGIN');await holder.query('SELECT id FROM meals WHERE id=$1 FOR UPDATE',[m.id]);
   await holder.query("WITH t AS (SELECT clock_timestamp() n) UPDATE meals SET closes_at=t.n+interval '1 second',starts_at=t.n+interval '1 hour',scheduled_end_at=t.n+interval '3 hours' FROM t WHERE id=$1",[m.id]);
   // Keep the equality constraint exact despite multiple volatile clock calls in one statement.
   await holder.query("UPDATE meals SET scheduled_end_at=starts_at+interval '2 hours' WHERE id=$1",[m.id]);
   const flight=approve(host.b,json(a).data.id);let observed=false;
   for(let i=0;i<100;i++){const r=await h.db.pool.query("SELECT count(*)::int n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query ILIKE '%meals%'");if(r.rows[0].n>0){observed=true;break;}await new Promise(resolve=>setTimeout(resolve,5));}
   expect(observed).toBe(true);expect((await holder.query('SELECT clock_timestamp()<closes_at AS before FROM meals WHERE id=$1',[m.id])).rows[0].before).toBe(true);
   for(let i=0;i<300;i++){if((await holder.query('SELECT clock_timestamp()>=closes_at AS passed FROM meals WHERE id=$1',[m.id])).rows[0].passed)break;await new Promise(resolve=>setTimeout(resolve,5));}
   expect((await holder.query('SELECT clock_timestamp()>=closes_at AS passed FROM meals WHERE id=$1',[m.id])).rows[0].passed).toBe(true);await holder.query('COMMIT');const r=await flight;expect(r.statusCode,r.body).toBe(409);
   expect((await h.db.pool.query('SELECT status,cancel_reason FROM meals WHERE id=$1',[m.id])).rows[0]).toEqual({status:'CANCELLED',cancel_reason:'insufficient'});expect((await h.db.pool.query('SELECT state FROM applications WHERE id=$1',[json(a).data.id])).rows[0].state).toBe('EXPIRED');expect(await count("SELECT count(*) n FROM seat_events WHERE meal_id=$1 AND type='GUEST_CONFIRMED'",[m.id])).toBe(0);
  }finally{await holder.query('ROLLBACK');holder.release();}
 });
 it('QA-DB-003 unexpected error rolls back lifecycle catchup while an expected 409 preserves it',async()=>{
  const host=await actor(),guest=await actor(),m=await meal(host.b);const a=await apply(guest.b,m.id);expect(a.statusCode,a.body).toBe(201);
  await expect(at(CLOSE,async tx=>{await lockMeal(tx,m.id,host.id);throw new Error('Independent unexpected failure');})).rejects.toThrow('Independent unexpected failure');expect((await h.db.pool.query('SELECT status FROM meals WHERE id=$1',[m.id])).rows[0].status).toBe('OPEN');expect((await h.db.pool.query('SELECT state FROM applications WHERE id=$1',[json(a).data.id])).rows[0].state).toBe('PENDING');expect(await count('SELECT count(*) n FROM lifecycle_marks WHERE meal_id=$1',[m.id])).toBe(0);
  await expect(at(CLOSE,tx=>approveApplication(tx,json(a).data.id,host.id,'1','APPROVE'))).rejects.toMatchObject({status:409});expect((await h.db.pool.query('SELECT status FROM meals WHERE id=$1',[m.id])).rows[0].status).toBe('CANCELLED');expect((await h.db.pool.query('SELECT state FROM applications WHERE id=$1',[json(a).data.id])).rows[0].state).toBe('EXPIRED');
 });
});
