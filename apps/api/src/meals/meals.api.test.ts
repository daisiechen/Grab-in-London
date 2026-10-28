import {createHash,randomUUID} from 'node:crypto';
import {afterAll,beforeAll,describe,expect,inject,it} from 'vitest';
import {Browser,createHarness,json,type Harness} from '../test/harness.ts';
import {londonTime} from './time.ts';
import {arrangementHash} from './read.ts';
import type {MealRow} from './lifecycle.ts';
import type {PoolClient} from 'pg';
let h:Harness;
beforeAll(async()=>{h=await createHarness(inject('pgServerUrl'));});afterAll(async()=>{await h.close();});
async function actor(complete=true){const b=new Browser(h);const {body}=await b.signInWithEmail(`${randomUUID()}@example.invalid`);if(complete){const response=await b.request('PATCH','/v1/me',{body:{displayName:'Alex Test',bio:'I enjoy shared meals and meeting new people.',languages:['en','zh'],lifeStatus:'NEW_TO_LONDON',interests:['FOOD'],ageConfirmedVersion:'2026-10-21',communityAcceptedVersion:'2026-10-21'},headers:{'if-match':'"1"','idempotency-key':randomUUID()}});expect(response.statusCode,response.body).toBe(200);}return {b,id:body.data.session.user.id as string};}
function times(days=5){const start=new Date(Math.floor((Date.now()+days*86_400_000)/60_000)*60_000);const close=new Date(start.getTime()-3_600_000);return {start:londonTime(start),close:londonTime(close)};}
const timeInput=(t:ReturnType<typeof londonTime>)=>({localDate:t.localDate,localTime:t.localTime,timeZone:t.timeZone,utcOffsetMinutes:t.utcOffsetMinutes});
async function create(host:Browser,extra:Record<string,unknown>={},key=randomUUID()){
 const confirmed=await host.request('POST','/v1/venues/confirm',{body:{placeId:'fixture_fancy_north'},headers:{'idempotency-key':randomUUID()}});expect(confirmed.statusCode,confirmed.body).toBe(200);
 const t=times();const body={venueRef:json(confirmed).data.venueRef,title:'Friendly lunch with new people',description:'Join a relaxed meal to share stories and good food.',start:timeInput(t.start),close:timeInput(t.close),minimum:2,capacity:3,budgetMinPence:1000,budgetMaxPence:3000,languages:['en','zh'],mood:'EASY_CONVERSATION',cuisineCode:'CHINESE',dietaryCodes:['VEGAN'],bookingMode:'EXTERNAL_PAY_AT_VENUE',attemptId:randomUUID(),bookingDeclarationConfirmed:true,reviewConfirmed:true,termsVersion:'2026-10-21',...extra};
 const result=await host.request('POST','/v1/meals',{body,headers:{'idempotency-key':key}});return {result,body,key};
}
async function publish(host:Browser,extra:Record<string,unknown>={}){const {result}=await create(host,extra);expect(result.statusCode,result.body).toBe(201);return json(result).data;}
const apply=(b:Browser,mealId:string,key=randomUUID())=>b.request('POST',`/v1/meals/${mealId}/applications`,{body:{message:'I would enjoy meeting everyone at this meal.'},headers:{'idempotency-key':key}});
const decide=(b:Browser,id:string,version='1',decision='APPROVE')=>b.request('POST',`/v1/applications/${id}/decision`,{body:{decision},headers:{'idempotency-key':randomUUID(),'if-match':`"${version}"`}});
const detail=async(b:Browser,id:string)=>json(await b.request('GET',`/v1/meals/${id}`)).data;

// The isolated pool uses the fixed SQL clock for existing and subsequently created connections.
async function withFixedBookingClock(run:()=>Promise<void>){
 const pool=h.db.pool;let installed=false,clockError:unknown;
 const onConnect=(client:PoolClient)=>{void client.query('SET search_path=booking_fixed_clock,pg_catalog,public').catch(error=>{clockError=error;});};
 const applyToConnections=async(sql:string)=>{
  const held:PoolClient[]=[];
  try{
   const results=await Promise.allSettled(Array.from({length:pool.totalCount},async()=>{const c=await pool.connect();held.push(c);}));
   const failed=results.find(r=>r.status==='rejected');if(failed?.status==='rejected')throw failed.reason;
   const resets=await Promise.allSettled([...held].map(async c=>{try{await c.query(sql);}catch(error){held.splice(held.indexOf(c),1);c.release(error instanceof Error?error:true);throw error;}}));
   const resetFailure=resets.find(r=>r.status==='rejected');if(resetFailure?.status==='rejected')throw resetFailure.reason;
  }finally{for(const c of held)c.release();}
 };
 try{
  const {rows:[clock]}=await pool.query(`SELECT date_trunc('milliseconds',clock_timestamp())::text instant`);
  await pool.query('CREATE SCHEMA booking_fixed_clock');installed=true;
  await pool.query(`CREATE FUNCTION booking_fixed_clock.clock_timestamp() RETURNS timestamptz LANGUAGE sql VOLATILE AS $$ SELECT '${clock.instant}'::timestamptz $$`);
  pool.on('connect',onConnect);await applyToConnections('SET search_path=booking_fixed_clock,pg_catalog,public');
  await run();if(clockError)throw clockError;
 }finally{
  pool.removeListener('connect',onConnect);
  try{await applyToConnections('RESET search_path');}finally{if(installed)await pool.query('DROP SCHEMA booking_fixed_clock CASCADE');}
 }
}

describe('MVP production meal commands and privacy',()=>{
 it('publishes host seat, GROUP JOIN, three jobs and self-reported booking atomically; retries do not duplicate',async()=>{
  const {b}=await actor();const {result,body,key}=await create(b);expect(result.statusCode,result.body).toBe(201);const meal=json(result).data;
  expect(meal.confirmedCount).toBe(1);expect(meal.bookingDeclaration).toMatchObject({declaredCount:3,stale:false,status:'REPORTED_CONFIRMED'});
  // Who's coming: seat holders' public profiles, host first, matching confirmedCount.
  expect(meal.members.map((m:{id:string})=>m.id)).toEqual([meal.host.id]);
  const replay=await b.request('POST','/v1/meals',{body,headers:{'idempotency-key':key}});expect(replay.headers['idempotent-replay']).toBe('true');expect(json(replay).data.id).toBe(meal.id);
  expect((await h.db.pool.query(`SELECT * FROM conversations WHERE meal_id=$1`,[meal.id])).rowCount).toBe(1);
  expect((await h.db.pool.query(`SELECT * FROM seat_events WHERE meal_id=$1`,[meal.id])).rowCount).toBe(1);
  expect((await h.db.pool.query(`SELECT * FROM jobs WHERE resource_id=$1`,[meal.id])).rowCount).toBe(3);
  expect((await h.db.pool.query(`SELECT * FROM booking_declarations WHERE meal_id=$1`,[meal.id])).rowCount).toBe(1);
  const otherKey=await b.request('POST','/v1/meals',{body,headers:{'idempotency-key':randomUUID()}});expect(otherKey.statusCode).toBe(409);
 });
 it.each([2,4,6])('records the personally declared capacity %i with a fresh initial roster baseline',async capacity=>{
  const host=await actor();const meal=await publish(host.b,{capacity});
  expect(meal.confirmedCount).toBe(1);expect(meal.bookingDeclaration).toMatchObject({declaredCount:capacity,revision:'1',stale:false});
 });
 it('keeps pending fresh, marks an approved full table stale, and refreshes only after host declaration',async()=>{
  const host=await actor(),guest=await actor();const meal=await publish(host.b,{capacity:2});
  const application=json(await apply(guest.b,meal.id)).data;
  let latest=(await detail(host.b,meal.id)).meal;
  expect(latest.confirmedCount).toBe(1);expect(latest.bookingDeclaration).toMatchObject({declaredCount:2,revision:'1',stale:false});
  expect((await decide(host.b,application.id)).statusCode).toBe(200);
  latest=(await detail(host.b,meal.id)).meal;
  expect(latest.confirmedCount).toBe(2);expect(latest.bookingDeclaration).toMatchObject({declaredCount:2,revision:'1',stale:true});
  const declaration=await host.b.request('POST',`/v1/meals/${meal.id}/booking-declarations`,{body:{status:'REPORTED_CONFIRMED',count:2},headers:{'idempotency-key':randomUUID(),'if-match':`"${latest.version}"`}});
  expect(declaration.statusCode,declaration.body).toBe(201);
  latest=(await detail(host.b,meal.id)).meal;
  expect(latest.bookingDeclaration).toMatchObject({declaredCount:2,revision:'2',stale:false});
  const left=await guest.b.request('POST',`/v1/meals/${meal.id}/leave`,{headers:{'idempotency-key':randomUUID(),'if-match':`"${latest.version}"`}});
  expect(left.statusCode,left.body).toBe(200);
  latest=(await detail(host.b,meal.id)).meal;
  expect(latest.confirmedCount).toBe(1);expect(latest.bookingDeclaration).toMatchObject({declaredCount:2,revision:'2',stale:true});
 });
 it.each([false,true])('keeps a declaration stale when the roster returns to two (replacement=%s), even at one database instant',async replacement=>{
  const host=await actor(),a=await actor(),b=await actor();const meal=await publish(host.b,{capacity:2});
  await withFixedBookingClock(async()=>{
   const first=json(await apply(a.b,meal.id)).data;expect((await decide(host.b,first.id)).statusCode).toBe(200);
   let latest=(await detail(host.b,meal.id)).meal;
   const declared=await host.b.request('POST',`/v1/meals/${meal.id}/booking-declarations`,{body:{status:'REPORTED_CONFIRMED',count:2},headers:{'idempotency-key':randomUUID(),'if-match':`"${latest.version}"`}});expect(declared.statusCode,declared.body).toBe(201);
   latest=(await detail(host.b,meal.id)).meal;expect(latest.bookingDeclaration.stale).toBe(false);
   expect((await a.b.request('POST',`/v1/meals/${meal.id}/leave`,{headers:{'idempotency-key':randomUUID(),'if-match':`"${latest.version}"`}})).statusCode).toBe(200);
   expect((await detail(host.b,meal.id)).meal.bookingDeclaration.stale).toBe(true);
   const next=json(await apply(replacement?b.b:a.b,meal.id)).data;expect((await decide(host.b,next.id)).statusCode).toBe(200);
   latest=(await detail(host.b,meal.id)).meal;expect(latest.confirmedCount).toBe(2);expect(latest.bookingDeclaration).toMatchObject({revision:'2',declaredCount:2,stale:true});
   const refreshed=await host.b.request('POST',`/v1/meals/${meal.id}/booking-declarations`,{body:{status:'REPORTED_CONFIRMED',count:2},headers:{'idempotency-key':randomUUID(),'if-match':`"${latest.version}"`}});expect(refreshed.statusCode,refreshed.body).toBe(201);
   expect((await detail(host.b,meal.id)).meal.bookingDeclaration).toMatchObject({revision:'3',stale:false});
   const {rows:[events]}=await h.db.pool.query(`SELECT count(DISTINCT effective_at)::int instants FROM seat_events WHERE meal_id=$1 AND type<>'HOST_CONFIRMED'`,[meal.id]);expect(events.instants).toBe(1);
  });
 });
 it('keeps pending, messages, group exit and booking events fresh without advancing the seat watermark',async()=>{
  const host=await actor(),guest=await actor();const meal=await publish(host.b);const application=json(await apply(guest.b,meal.id)).data;
  expect((await detail(host.b,meal.id)).meal.bookingDeclaration.stale).toBe(false);
  expect((await decide(host.b,application.id)).statusCode).toBe(200);
  let latest=(await detail(host.b,meal.id)).meal;
  for(let i=0;i<2;i++){
   const declared=await host.b.request('POST',`/v1/meals/${meal.id}/booking-declarations`,{body:{status:'REPORTED_CONFIRMED',count:2},headers:{'idempotency-key':randomUUID(),'if-match':`"${latest.version}"`}});expect(declared.statusCode,declared.body).toBe(201);latest=json(declared).data;expect(latest.bookingDeclaration.stale).toBe(false);
  }
  const {rows:[conversation]}=await h.db.pool.query('SELECT id,version FROM conversations WHERE meal_id=$1',[meal.id]);
  const sent=await guest.b.request('POST',`/v1/conversations/${conversation.id}/messages`,{body:{body:'A normal message does not change the restaurant reservation.',clientMessageId:randomUUID()}});expect(sent.statusCode,sent.body).toBe(201);
  const {rows:[current]}=await h.db.pool.query('SELECT version FROM conversations WHERE id=$1',[conversation.id]);
  const left=await guest.b.request('POST',`/v1/conversations/${conversation.id}/leave`,{body:{confirm:true},headers:{'if-match':`"${current.version}"`,'idempotency-key':randomUUID()}});expect(left.statusCode,left.body).toBe(200);
  expect((await detail(host.b,meal.id)).meal.bookingDeclaration.stale).toBe(false);
 });
 it('reads legacy hashes conservatively without rewriting them and requires normal host redeclaration',async()=>{
  const host=await actor();const meal=await publish(host.b);
  const {rows:[m]}=await h.db.pool.query('SELECT * FROM meals WHERE id=$1',[meal.id]);
  const legacy=createHash('sha256').update(JSON.stringify([m.venue_ref,m.title,m.description,m.starts_at.toISOString(),m.closes_at.toISOString(),m.minimum,m.capacity,m.budget_min_pence,m.budget_max_pence,m.languages,m.mood,m.cuisine_code,m.dietary_codes,1])).digest('hex');
  // Explicit legacy row setup in this fresh test database; production reads never rewrite it.
  await h.db.pool.query(`INSERT INTO booking_declarations(meal_id,revision,reported_by,declared_count,reported_at,status,arrangement_hash) VALUES($1,2,$2,1,clock_timestamp(),'REPORTED_CONFIRMED',$3)`,[meal.id,m.host_id,legacy]);
  const before=(await h.db.pool.query('SELECT * FROM booking_declarations WHERE meal_id=$1',[meal.id])).rows;
  for(let i=0;i<2;i++)expect((await detail(host.b,meal.id)).meal.bookingDeclaration).toMatchObject({revision:'2',stale:true});
  expect((await h.db.pool.query('SELECT * FROM booking_declarations WHERE meal_id=$1',[meal.id])).rows).toEqual(before);
  const declared=await host.b.request('POST',`/v1/meals/${meal.id}/booking-declarations`,{body:{status:'REPORTED_CONFIRMED',count:1},headers:{'idempotency-key':randomUUID(),'if-match':`"${meal.version}"`}});expect(declared.statusCode,declared.body).toBe(201);
  expect(json(declared).data.bookingDeclaration).toMatchObject({revision:'3',stale:false});
  expect((await h.db.pool.query('SELECT arrangement_hash FROM booking_declarations WHERE meal_id=$1 AND revision=2',[meal.id])).rows[0].arrangement_hash).toBe(legacy);
 });
 it('retains distinct decimal seat revisions above the JavaScript integer precision limit',async()=>{
  const host=await actor();const meal=await publish(host.b);
  const {rows:[row]}=await h.db.pool.query<MealRow>('SELECT * FROM meals WHERE id=$1',[meal.id]);
  const first=9007199254740992n,next=first+1n;
  expect(arrangementHash(row!,1,first)).toBe(arrangementHash(row!,1,String(first)));
  expect(arrangementHash(row!,1,first)).not.toBe(arrangementHash(row!,1,next));
 });
 it('rejects incomplete profile, unknown restaurant and invalid deadlines without publishing',async()=>{
  const {b}=await actor(false);expect((await create(b)).result.statusCode).toBe(403);
  const ready=await actor();const invalid=await create(ready.b,{venueRef:randomUUID()});expect(invalid.result.statusCode).toBe(404);
  const t=times();expect((await create(ready.b,{close:timeInput(t.start)})).result.statusCode).toBe(422);
 });
 it('allows edit before first approval, marks booking stale, and permanently locks arrangement after approval and seat exit',async()=>{
  const host=await actor(),guest=await actor();const meal=await publish(host.b);
  const changed=await host.b.request('PATCH',`/v1/meals/${meal.id}`,{body:{title:'A different friendly meal title'},headers:{'idempotency-key':randomUUID(),'if-match':'"1"'}});expect(changed.statusCode,changed.body).toBe(200);expect(json(changed).data.bookingDeclaration.stale).toBe(true);
  const application=json(await apply(guest.b,meal.id)).data;expect((await decide(host.b,application.id)).statusCode).toBe(200);
  let latest=(await detail(guest.b,meal.id)).meal;expect(latest.arrangementLocked).toBe(true);
  const left=await guest.b.request('POST',`/v1/meals/${meal.id}/leave`,{headers:{'idempotency-key':randomUUID(),'if-match':`"${latest.version}"`}});expect(left.statusCode,left.body).toBe(200);
  latest=json(left).data.meal;
  const edit=await host.b.request('PATCH',`/v1/meals/${meal.id}`,{body:{title:'Trying to edit a locked table'},headers:{'idempotency-key':randomUUID(),'if-match':`"${latest.version}"`}});expect(json(edit).error.code).toBe('ARRANGEMENT_LOCKED');
  const c=await h.db.pool.query(`SELECT i.* FROM membership_intervals i JOIN conversations c ON c.id=i.conversation_id WHERE c.meal_id=$1 AND i.user_id=$2 AND i.leave_seq IS NULL`,[meal.id,guest.id]);expect(c.rowCount).toBe(1);
 });
 it('serializes simultaneous approvals for the last seat and joins exactly one guest',async()=>{
  const host=await actor(),a=await actor(),b=await actor();const meal=await publish(host.b,{capacity:2});
  const aa=json(await apply(a.b,meal.id)).data,ba=json(await apply(b.b,meal.id)).data;
  const responses=await Promise.all([decide(host.b,aa.id),decide(host.b,ba.id)]);expect(responses.map(r=>r.statusCode).sort()).toEqual([200,409]);
  expect((await detail(host.b,meal.id)).meal.confirmedCount).toBe(2);
  expect((await h.db.pool.query(`SELECT i.* FROM membership_intervals i JOIN conversations c ON c.id=i.conversation_id WHERE c.meal_id=$1 AND leave_seq IS NULL`,[meal.id])).rowCount).toBe(2);
 });
 it('pending applications do not take seats; withdrawal permits a new round while a declined round blocks forever',async()=>{
  const host=await actor(),guest=await actor();const meal=await publish(host.b,{capacity:2});
  const first=json(await apply(guest.b,meal.id)).data;expect((await detail(host.b,meal.id)).meal.confirmedCount).toBe(1);
  const withdrawn=await guest.b.request('POST',`/v1/applications/${first.id}/withdraw`,{headers:{'idempotency-key':randomUUID(),'if-match':'"1"'}});expect(withdrawn.statusCode,withdrawn.body).toBe(200);
  const second=json(await apply(guest.b,meal.id)).data;expect(second.round).toBe(2);expect(second.id).not.toBe(first.id);
  expect((await decide(host.b,second.id,'1','DECLINE')).statusCode).toBe(200);
  const retry=await apply(guest.b,meal.id);expect(json(retry).error.code).toBe('APPLICATION_DECLINED_FINAL');
  const listing=await guest.b.request('GET',`/v1/meals/${meal.id}/applications`);expect(json(listing).data).toHaveLength(2);
 });
 it('hides application text/identity and group access from public detail and unrelated users',async()=>{
  const host=await actor(),guest=await actor(),outsider=await actor();const meal=await publish(host.b);const application=json(await apply(guest.b,meal.id)).data;
  const publicResponse=await new Browser(h).request('GET',`/v1/meals/${meal.id}`);expect(publicResponse.body).not.toContain(application.message);expect(publicResponse.body).not.toContain(guest.id);expect(json(publicResponse).data.myApplication).toBeNull();expect(json(publicResponse).data.conversationId).toBeNull();
  expect(json(await outsider.b.request('GET',`/v1/meals/${meal.id}/applications`)).data).toEqual([]);
  expect((await decide(outsider.b,application.id)).statusCode).toBe(403);
 });
 it('cancels terminally, expires pending applications, writes recipient notifications and preserves the group',async()=>{
  const host=await actor(),guest=await actor();const meal=await publish(host.b);const application=json(await apply(guest.b,meal.id)).data;
  const cancel=await host.b.request('POST',`/v1/meals/${meal.id}/cancel`,{body:{reason:'booking'},headers:{'idempotency-key':randomUUID(),'if-match':'"1"'}});expect(cancel.statusCode,cancel.body).toBe(200);expect(json(cancel).data).toMatchObject({status:'CANCELLED',cancelReason:'booking'});
  expect((await h.db.pool.query(`SELECT state FROM applications WHERE id=$1`,[application.id])).rows[0].state).toBe('EXPIRED');
  expect((await h.db.pool.query(`SELECT * FROM notifications WHERE refs->>'mealId'=$1 AND template='meal_cancelled'`,[meal.id])).rowCount).toBe(2);
  expect((await h.db.pool.query(`SELECT dissolved_at FROM conversations WHERE meal_id=$1`,[meal.id])).rows[0].dissolved_at).toBeNull();
  expect((await apply(guest.b,meal.id)).statusCode).toBe(409);
 });
 it('filters discovery dimensions with OR within and AND across; public GET never advances lifecycle',async()=>{
  const host=await actor();const meal=await publish(host.b);
  const publicBrowser=new Browser(h);
  const response=await publicBrowser.request('GET','/v1/meals?languages=fr,zh&budgetMaxPence=3000&cuisineCodes=CHINESE&dietaryCodes=VEGAN&tableSizes=3');expect(response.statusCode,response.body).toBe(200);expect(json(response).data.some((m:{id:string})=>m.id===meal.id)).toBe(true);
  expect(json(await publicBrowser.request('GET','/v1/meals?budgetMaxPence=2999')).data.some((m:{id:string})=>m.id===meal.id)).toBe(false);
  const before=await h.db.pool.query(`SELECT * FROM lifecycle_marks WHERE meal_id=$1`,[meal.id]);await detail(publicBrowser,meal.id);expect((await h.db.pool.query(`SELECT * FROM lifecycle_marks WHERE meal_id=$1`,[meal.id])).rowCount).toBe(before.rowCount);
 });
 it('uses signed actor/filter-bound cursors and paginates every application round without skipping',async()=>{
  const host=await actor(),guest=await actor();const meal=await publish(host.b);
  const first=json(await apply(guest.b,meal.id)).data;await guest.b.request('POST',`/v1/applications/${first.id}/withdraw`,{headers:{'idempotency-key':randomUUID(),'if-match':'"1"'}});await apply(guest.b,meal.id);
  const page1=await guest.b.request('GET','/v1/me/meals?section=APPLICATIONS&limit=1');expect(json(page1).data).toHaveLength(1);
  // A pending applicant has no readable group yet, so the item carries no chat (same rule as getMeal).
  expect(json(page1).data[0].conversationId).toBeNull();const cursor=json(page1).page.nextCursor;expect(cursor).toContain('.');
  const page2=await guest.b.request('GET',`/v1/me/meals?section=APPLICATIONS&limit=1&cursor=${encodeURIComponent(cursor)}`);expect(page2.statusCode,page2.body).toBe(200);expect(json(page2).data[0].application.id).not.toBe(json(page1).data[0].application.id);
  expect((await host.b.request('GET',`/v1/me/meals?section=APPLICATIONS&limit=1&cursor=${encodeURIComponent(cursor)}`)).statusCode).toBe(422);
  expect((await guest.b.request('GET',`/v1/me/meals?section=HOSTING&limit=1&cursor=${encodeURIComponent(cursor)}`)).statusCode).toBe(422);
 });
});
