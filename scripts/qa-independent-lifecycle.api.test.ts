/** Third independent round: exact command time boundaries and real HTTP DST fields. */
import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,describe,expect,inject,it} from 'vitest';
import {Browser,createHarness,json,type Harness} from '../apps/api/src/test/harness.ts';
import {withTransaction,type Tx} from '../apps/api/src/common/transaction.ts';
import {declareBooking,lockMeal} from '../apps/api/src/meals/commands.ts';
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
describe('independent persistent arrangement and historical lifecycle',()=>{
 it('QA-DB-006 leaving every guest never unlocks any critical arrangement field',async()=>{
  const host=await actor(),guest=await actor(),m=await meal(host.b,4,{minimum:3});const a=await apply(guest.b,m.id);expect((await approve(host.b,json(a).data.id)).statusCode).toBe(200);
  const locked=(await h.db.pool.query('SELECT arrangement_locked_at FROM meals WHERE id=$1',[m.id])).rows[0].arrangement_locked_at;
  const left=await guest.b.request('POST',`/v1/meals/${m.id}/leave`,{headers:headers(await version(m.id))});expect(left.statusCode,left.body).toBe(200);
  expect((await h.db.pool.query('SELECT arrangement_locked_at FROM meals WHERE id=$1',[m.id])).rows[0].arrangement_locked_at).toEqual(locked);
  const patches=[{capacity:5},{venueRef:randomUUID()},{start:{localDate:'2030-10-24',localTime:'18:00',timeZone:'Europe/London',utcOffsetMinutes:60}},{budgetMaxPence:4000},{close:{localDate:'2030-10-23',localTime:'16:30',timeZone:'Europe/London',utcOffsetMinutes:60}},{dietaryCodes:['VEGAN']}];
  const before=(await h.db.pool.query('SELECT * FROM meals WHERE id=$1',[m.id])).rows[0];for(const patch of patches){const r=await host.b.request('PATCH',`/v1/meals/${m.id}`,{body:patch,headers:headers(await version(m.id))});expect(r.statusCode,r.body).toBe(409);expect(json(r).error.code).toBe('ARRANGEMENT_LOCKED');}
  expect((await h.db.pool.query('SELECT * FROM meals WHERE id=$1',[m.id])).rows[0]).toEqual(before);expect(json(await host.b.request('GET',`/v1/meals/${m.id}`)).data.meal.confirmedCount).toBe(1);
 });
 it('QA-DB-009 delayed catchup after end cancels at historical close despite a later third confirmation and retries once',async()=>{
  const host=await actor(),a=await actor(),late=await actor(),m=await meal(host.b,4,{minimum:3});const application=await apply(a.b,m.id);expect((await approve(host.b,json(application).data.id)).statusCode).toBe(200);
  // Recovery fixture: valid event shape, effective after close; current seats must not rewrite the close roster.
  const seq=BigInt((await h.db.pool.query('SELECT head FROM meals WHERE id=$1',[m.id])).rows[0].head)+1n;
  await h.db.pool.query("INSERT INTO seat_events(meal_id,seq,user_id,type,effective_at,command_id) VALUES($1,$2,$3,'GUEST_CONFIRMED',$4,$5)",[m.id,String(seq),late.id,new Date(+CLOSE+1),randomUUID()]);await h.db.pool.query('UPDATE meals SET head=$2 WHERE id=$1',[m.id,String(seq)]);
  const catchup=()=>at(new Date(+START+7_200_001),tx=>lockMeal(tx,m.id,host.id));expect((await catchup()).meal).toMatchObject({status:'CANCELLED',cancel_reason:'insufficient'});
  const facts=(await h.db.pool.query("SELECT kind,effective_at FROM business_events WHERE aggregate_id=$1 AND kind IN ('meal.cancelled','meal.end','meal.start') ORDER BY kind",[m.id])).rows;expect(facts).toEqual([{kind:'meal.cancelled',effective_at:CLOSE}]);
  const notifications=await count("SELECT count(*) n FROM notifications WHERE refs->>'mealId'=$1",[m.id]);const outbox=await count("SELECT count(*) n FROM outbox WHERE payload->>'mealId'=$1",[m.id]);await catchup();expect(await count("SELECT count(*) n FROM business_events WHERE aggregate_id=$1 AND kind='meal.cancelled'",[m.id])).toBe(1);expect(await count("SELECT count(*) n FROM notifications WHERE refs->>'mealId'=$1",[m.id])).toBe(notifications);expect(await count("SELECT count(*) n FROM outbox WHERE payload->>'mealId'=$1",[m.id])).toBe(outbox);expect(await count('SELECT count(*) n FROM start_roster WHERE meal_id=$1',[m.id])).toBe(0);
 });
 for(const [delta,included]of [[-1,false],[0,false],[1,true]]as const){it(`QA-DB-010 sealed roster LEFT at start ${delta}ms retains guest=${included}`,async()=>{
  const host=await actor(),a=await actor(),b=await actor(),m=await meal(host.b);for(const guest of[a,b]){const r=await apply(guest.b,m.id);expect((await approve(host.b,json(r).data.id)).statusCode).toBe(200);}
  const seq=BigInt((await h.db.pool.query('SELECT head FROM meals WHERE id=$1',[m.id])).rows[0].head)+1n;await h.db.pool.query("INSERT INTO seat_events(meal_id,seq,user_id,type,effective_at,command_id) VALUES($1,$2,$3,'LEFT',$4,$5)",[m.id,String(seq),a.id,new Date(+START+delta),randomUUID()]);await h.db.pool.query('UPDATE meals SET head=$2 WHERE id=$1',[m.id,String(seq)]);
  await at(new Date(+START+2),tx=>lockMeal(tx,m.id,host.id));const roster=async()=>(await h.db.pool.query('SELECT user_id FROM start_roster WHERE meal_id=$1 ORDER BY user_id',[m.id])).rows.map(r=>r.user_id);expect(await roster()).toEqual([host.id,b.id,...(included?[a.id]:[])].sort());
  await h.db.pool.query("UPDATE users SET status='DELETING' WHERE id=$1",[a.id]);await at(new Date(+START+3),tx=>lockMeal(tx,m.id,host.id));expect(await roster()).toEqual([host.id,b.id,...(included?[a.id]:[])].sort());
 });}
 it('QA-DB-011 wrong headcount declaration is stale and never claims provider confirmed booking',async()=>{
  const host=await actor(),guest=await actor(),m=await meal(host.b);const failed=await at(new Date(+CLOSE-60_000),tx=>declareBooking(tx,m.id,host.id,'1',{status:'FAILED',count:1}));expect(failed.meal.status).toBe('OPEN');const r=await apply(guest.b,m.id);expect((await approve(host.b,json(r).data.id)).statusCode).toBe(200);
  const wrong=await host.b.request('POST',`/v1/meals/${m.id}/booking-declarations`,{headers:headers(await version(m.id)),body:{status:'REPORTED_CONFIRMED',count:1}});expect(wrong.statusCode,wrong.body).toBe(201);const detail=json(await host.b.request('GET',`/v1/meals/${m.id}`)).data.meal;expect(detail.status).toBe('OPEN');expect(detail.bookingDeclaration).toMatchObject({stale:true,status:'REPORTED_CONFIRMED',declaredCount:1});expect((await h.db.pool.query('SELECT dissolved_at FROM conversations WHERE meal_id=$1',[m.id])).rows[0].dissolved_at).toBeNull();expect(wrong.body).not.toContain('PROVIDER_CONFIRMED');
 });
});
