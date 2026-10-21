/** Production regression: a suspended provider call must not retain a meal row lock. */
import {DomainError} from '../common/errors.ts';
import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,expect,inject,it,vi} from 'vitest';
import {Browser,createHarness,json,WEB_ORIGIN,type Harness} from '../test/harness.ts';
import {loadConfig} from '../../../../packages/config/src/index.ts';
import {buildServer} from '../http/server.ts';
import {FixturePlacesProvider} from '../venues/fixture-provider.ts';
let h:Harness,armed=false,entered=false,release:()=>void=()=>{},providerCalls=0,failure:'NOT_FOUND'|'SERVICE_UNAVAILABLE'|'RATE_LIMITED'|null=null;
beforeAll(async()=>{
 h=await createHarness(inject('pgServerUrl'));await h.app.close();const originalClose=h.close,fixture=new FixturePlacesProvider('test');
 const config=loadConfig({ENVIRONMENT:'test',DATABASE_URL:h.db.url,AUTH_ADAPTER:'test',PLACES_ADAPTER:'fixture',MAIL_ADAPTER:'outbox_test',AI_PROVIDER:'disabled',WEB_ORIGIN,SESSION_SECRET:'api-test-session-secret-0123456789abcdef',IOS_REDIRECT_URI:'fancy://auth/callback'});
 h.app=await buildServer({config,pool:h.db.pool,identity:h.idp,publicOrigin:WEB_ORIGIN,placesProvider:{kind:'fixture',search:i=>fixture.search(i),details:async id=>{providerCalls++;if(failure)throw new DomainError(failure,'Controlled provider failure.',failure==='RATE_LIMITED'?{retryAfterSeconds:7}:{});if(armed){entered=true;await new Promise<void>(resolve=>{release=resolve;});}return fixture.details(id);}}});h.close=async()=>{await h.app.close();await originalClose();};
});afterAll(async()=>{armed=false;release();await h?.close();});
const headers=(version?:string,key=randomUUID())=>({'idempotency-key':key,...(version?{'if-match':`"${version}"`}:{})});
async function actor(){const b=new Browser(h);const {body}=await b.signInWithEmail(`${randomUUID()}@example.invalid`);const id=body.data.session.user.id as string;const r=await b.request('PATCH','/v1/me',{body:{displayName:'QA Round Two',bio:'Synthetic isolated QA profile for concurrent safety checks.',languages:['en'],lifeStatus:'NEW_TO_LONDON',interests:['FOOD'],ageConfirmedVersion:'2026-10-21',communityAcceptedVersion:'2026-10-21'},headers:headers('1')});expect(r.statusCode,r.body).toBe(200);return{b,id};}
async function meal(b:Browser,capacity=4,extra:Record<string,unknown>={},expectedStatus=201){const venue=await b.request('POST','/v1/venues/confirm',{body:{placeId:'fixture_fancy_north'},headers:headers()});expect(venue.statusCode,venue.body).toBe(200);const r=await b.request('POST','/v1/meals',{body:{venueRef:json(venue).data.venueRef,title:'QA concurrency isolated table',description:'Synthetic table with no external restaurant or customer activity.',start:{localDate:'2030-10-23',localTime:'18:00',timeZone:'Europe/London',utcOffsetMinutes:60},close:{localDate:'2030-10-23',localTime:'17:00',timeZone:'Europe/London',utcOffsetMinutes:60},minimum:2,capacity,budgetMinPence:2000,budgetMaxPence:3500,languages:['en'],mood:'EASY_CONVERSATION',bookingMode:'EXTERNAL_PAY_AT_VENUE',attemptId:randomUUID(),bookingDeclarationConfirmed:true,reviewConfirmed:true,termsVersion:'2026-10-21',...extra},headers:headers()});expect(r.statusCode,r.body).toBe(expectedStatus);return expectedStatus===201?json(r).data:json(r).error;}


it('delayed restaurant provider during an edit does not hold the meal lock on another connection',async()=>{
 const a=await actor(),m=await meal(a.b);armed=true;entered=false;let lock='ACQUIRED';const probe=await h.db.pool.connect();
 const patch=a.b.request('PATCH',`/v1/meals/${m.id}`,{headers:headers(String(m.version)),body:{description:'Synthetic updated arrangement while a provider is suspended.'}});
 try{
  const end=Date.now()+5000;while(!entered){if(Date.now()>end)throw Error('controlled provider did not enter');await new Promise<void>(r=>setImmediate(r));}
  await probe.query('BEGIN');try{await probe.query('SELECT id FROM meals WHERE id=$1 FOR UPDATE NOWAIT',[m.id]);}catch(error){lock=String((error as {code?:string}).code);}
 }finally{await probe.query('ROLLBACK');probe.release();armed=false;release();}
 const result=await patch;expect(result.statusCode,result.body).toBe(200);expect(lock).toBe('ACQUIRED');
});

async function waitProvider(){const end=Date.now()+5000;while(!entered){if(Date.now()>end)throw Error('provider did not enter');await new Promise<void>(r=>setImmediate(r));}}
async function canLock(table:'users'|'meals',id:string){const c=await h.db.pool.connect();try{await c.query('BEGIN');await c.query(`SELECT id FROM ${table} WHERE id=$1 FOR UPDATE NOWAIT`,[id]);}finally{await c.query('ROLLBACK');c.release();}}
it('confirmation waits outside actor transaction; success and provider404 replay without any provider dependency',async()=>{
 const a=await actor();const key=randomUUID(),body={placeId:'fixture_fancy_north'};armed=true;entered=false;
 const confirm=a.b.request('POST','/v1/venues/confirm',{body,headers:headers(undefined,key)});
 try{await waitProvider();await canLock('users',a.id);}finally{armed=false;release();}
 const success=await confirm;expect(success.statusCode,success.body).toBe(200);failure='NOT_FOUND';const before=providerCalls;
 try{
  const replay=await a.b.request('POST','/v1/venues/confirm',{body,headers:headers(undefined,key)});expect(replay.statusCode).toBe(200);expect(providerCalls).toBe(before);
  const rejectedKey=randomUUID();const rejected=await a.b.request('POST','/v1/venues/confirm',{body,headers:headers(undefined,rejectedKey)});expect(rejected.statusCode).toBe(404);const after=providerCalls;failure=null;
  const repeated=await a.b.request('POST','/v1/venues/confirm',{body,headers:headers(undefined,rejectedKey)});expect(repeated.statusCode).toBe(404);expect(json(repeated)).toEqual(json(rejected));expect(repeated.headers['idempotent-replay']).toBe('true');expect(providerCalls).toBe(after);
 }finally{failure=null;}
});
it('provider503 releases intent so same key can recover',async()=>{
 const a=await actor(),key=randomUUID(),body={placeId:'fixture_fancy_north'};failure='SERVICE_UNAVAILABLE';
 try{expect((await a.b.request('POST','/v1/venues/confirm',{body,headers:headers(undefined,key)})).statusCode).toBe(503);}finally{failure=null;}
 expect((await a.b.request('POST','/v1/venues/confirm',{body,headers:headers(undefined,key)})).statusCode).toBe(200);
});
it.each(['version','venue','profile','actor','deadline'] as const)('rechecks %s after a paused edit and commits no edited description',async(change)=>{
 const a=await actor(),m=await meal(a.b),key=randomUUID();armed=true;entered=false;
 const body={description:'The update must not commit against newly changed server facts.'};
 const patch=a.b.request('PATCH',`/v1/meals/${m.id}`,{body,headers:headers(String(m.version),key)});
 try{
  await waitProvider();await canLock('meals',m.id);await canLock('users',a.id);
  if(change==='version')await h.db.pool.query(`UPDATE meals SET version=version+1 WHERE id=$1`,[m.id]);
  if(change==='venue')await h.db.pool.query(`UPDATE venues SET place_id=$2 WHERE id=$1`,[m.venue.venueRef,`fixture_${randomUUID()}`]);
  if(change==='profile')await h.db.pool.query(`UPDATE profiles SET bio=NULL WHERE user_id=$1`,[a.id]);
  if(change==='actor')await h.db.pool.query(`UPDATE users SET status='DELETING' WHERE id=$1`,[a.id]);
  if(change==='deadline')await h.db.pool.query(`UPDATE meals SET closes_at=clock_timestamp()-interval '1 second' WHERE id=$1`,[m.id]);
 }finally{armed=false;release();}
 const result=await patch;expect(result.statusCode,result.body).toBe(change==='actor'?401:change==='profile'?403:409);
 expect((await h.db.pool.query(`SELECT description FROM meals WHERE id=$1`,[m.id])).rows[0].description).not.toBe(body.description);
});

it('publish verification holds no actor lock, then create and edit success replay with provider unavailable',async()=>{
 const a=await actor(),m=await meal(a.b);
 const {rows:[base]}=await h.db.pool.query(`SELECT venue_ref FROM meals WHERE id=$1`,[m.id]);
 const body={venueRef:base.venue_ref,title:'Another relaxed table for friends',description:'A separate publishing attempt with fresh restaurant verification.',start:{localDate:'2030-10-23',localTime:'18:00',timeZone:'Europe/London',utcOffsetMinutes:60},close:{localDate:'2030-10-23',localTime:'17:00',timeZone:'Europe/London',utcOffsetMinutes:60},minimum:2,capacity:4,budgetMinPence:2000,budgetMaxPence:3500,languages:['en'],mood:'EASY_CONVERSATION',bookingMode:'EXTERNAL_PAY_AT_VENUE',attemptId:randomUUID(),bookingDeclarationConfirmed:true,reviewConfirmed:true,termsVersion:'2026-10-21'};
 const key=randomUUID();armed=true;entered=false;
 const pending=a.b.request('POST','/v1/meals',{body,headers:headers(undefined,key)});
 try{await waitProvider();await canLock('users',a.id);}finally{armed=false;release();}
 const created=await pending;expect(created.statusCode,created.body).toBe(201);
 const patch={description:'A verified update for a relaxed table and friendly conversation.'},editKey=randomUUID();
 const changed=await a.b.request('PATCH',`/v1/meals/${m.id}`,{body:patch,headers:headers(String(m.version),editKey)});expect(changed.statusCode,changed.body).toBe(200);
 failure='SERVICE_UNAVAILABLE';const before=providerCalls;
 try{
  const replay=await a.b.request('POST','/v1/meals',{body,headers:headers(undefined,key)});expect(replay.body).toBe(created.body);expect(replay.headers['idempotent-replay']).toBe('true');
  const editReplay=await a.b.request('PATCH',`/v1/meals/${m.id}`,{body:patch,headers:headers(String(m.version),editKey)});expect(editReplay.body).toBe(changed.body);expect(editReplay.headers['idempotent-replay']).toBe('true');expect(providerCalls).toBe(before);
 }finally{failure=null;}
});
it('seals one rejection body even when each error serialization crosses a controlled millisecond',async()=>{
 const a=await actor(),key=randomUUID(),body={placeId:'fixture_fancy_north'};
 const serialize=Date.prototype.toISOString;let instant=Date.now();
 vi.useFakeTimers({toFake:['Date']});
 const clock=vi.spyOn(Date.prototype,'toISOString').mockImplementation(function(this:Date){const value=serialize.call(this);vi.setSystemTime(++instant);return value;});
 failure='NOT_FOUND';
 try{
  const first=await a.b.request('POST','/v1/venues/confirm',{body,headers:headers(undefined,key)});
  const replay=await a.b.request('POST','/v1/venues/confirm',{body,headers:headers(undefined,key)});
  expect(first.statusCode).toBe(404);expect(replay.statusCode).toBe(404);expect(json(replay)).toEqual(json(first));
 }finally{failure=null;clock.mockRestore();vi.useRealTimers();}
});

it('sealed rate limit first response and replay preserve Retry-After',async()=>{
 const a=await actor(),key=randomUUID(),body={placeId:'fixture_fancy_north'};failure='RATE_LIMITED';
 try{
  const first=await a.b.request('POST','/v1/venues/confirm',{body,headers:headers(undefined,key)});
  const replay=await a.b.request('POST','/v1/venues/confirm',{body,headers:headers(undefined,key)});
  expect(first.statusCode).toBe(429);expect(replay.statusCode).toBe(429);expect(first.headers['retry-after']).toBe('7');expect(replay.headers['retry-after']).toBe('7');expect(json(replay)).toEqual(json(first));
 }finally{failure=null;}
});
