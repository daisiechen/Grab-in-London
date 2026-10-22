import {request as httpRequest} from 'node:http';
import {randomBytes,randomUUID} from 'node:crypto';
import {afterAll,beforeAll,expect,it,vi} from 'vitest';
import {createPool,migrate} from '../../packages/db/src/index.ts';
import {startPostgres17,type PostgresServer} from '../../packages/testkit/src/postgres/server.ts';
import {createMigratedDatabase} from '../../packages/testkit/src/db/index.ts';
import {loadConfig} from '../../packages/config/src/index.ts';
import {buildServer} from '../../apps/api/src/http/server.ts';
import {advanceRigClock,createLocalClock,localClockGate,parseClockCommand,type LocalClock} from '../local-clock.ts';
import {londonTime} from '../../apps/api/src/meals/time.ts';
import {createWorkerRuntime} from '../../apps/worker/src/main.ts';
import {localFixtureIdentity} from '../local-acceptance.ts';
const RealDate=Date,START=new Date(Date.now()+3_600_000).toISOString();
const at=(days:number,delta=0)=>new RealDate(RealDate.parse(START)+days*86_400_000+delta).toISOString();
const env={FANCY_LOCAL_ACCEPTANCE:'1',FANCY_LOCAL_CLOCK:'1',FANCY_LOCAL_CLOCK_START:START};
let pg:PostgresServer;
beforeAll(async()=>{pg=await startPostgres17();},60_000);afterAll(async()=>{await pg?.stop();});
it('rejects disabled, production, external database and malformed/backwards/out-of-range commands',async()=>{
 const db=await createMigratedDatabase(pg.url,migrate);let clock:LocalClock|undefined;
 try{
  for(const invalid of [{},{...env,FANCY_LOCAL_CLOCK:'0'},{...env,ENVIRONMENT:'production'},{...env,FANCY_TEST_DATABASE_URL:pg.url},{...env,FANCY_LOCAL_CLOCK_START:'2020-01-01T00:00:00.000Z'}])await expect(createLocalClock(db,invalid)).rejects.toThrow();
  for(const text of ['{}','{"advanceTo":"2026-02-30T00:00:00.000Z"}','{"advanceTo":"2026-10-22T00:00:00Z"}','{"advanceTo":"2026-10-22T00:00:00.000Z","extra":true}'])expect(()=>parseClockCommand(text)).toThrow();
  clock=await createLocalClock(db,env);
  await expect(clock.advanceTo(START)).rejects.toThrow();await expect(clock.advanceTo(at(-1))).rejects.toThrow();await expect(clock.advanceTo(at(31))).rejects.toThrow();
 }finally{await clock?.close();await db.drop();}
 expect(Date).toBe(RealDate);
});
it('all pool connections, migrated defaults and Node share a fixed instant while timers stay real',async()=>{
 const db=await createMigratedDatabase(pg.url,migrate);let clock:LocalClock|undefined;
 try{
  clock=await createLocalClock(db,env);const c=clock;
  expect(new Date().toISOString()).toBe(START);expect(Date.now()).toBe(RealDate.parse(START));
  expect(Date.parse('2030-01-01T00:00:00Z')).toBe(RealDate.parse('2030-01-01T00:00:00Z'));expect(Date.UTC(2030,0,1)).toBe(RealDate.UTC(2030,0,1));expect(new Date(0).getTime()).toBe(0);
  const before=performance.now();await new Promise<void>(resolve=>setTimeout(resolve,20));expect(performance.now()-before).toBeGreaterThanOrEqual(10);expect(Date.now()).toBe(RealDate.parse(START));
  const connections=await Promise.all(Array.from({length:4},()=>c.pool.connect()));
  try{for(const connection of connections){const r=await connection.query(`SELECT clock_timestamp() AS clock,transaction_timestamp() AS tx,now() AS now`);expect(Object.values(r.rows[0]).map(value=>(value as Date).toISOString())).toEqual([START,START,START]);}}finally{connections.forEach(connection=>connection.release());}
  const first=await c.pool.query(`INSERT INTO users DEFAULT VALUES RETURNING created_at`);expect(first.rows[0].created_at.toISOString()).toBe(START);
  await c.advanceTo(at(3,-1));expect(new Date().toISOString()).toBe(at(3,-1));
  await c.advanceTo(at(3));const second=await c.pool.query(`INSERT INTO users DEFAULT VALUES RETURNING created_at`);expect(second.rows[0].created_at.toISOString()).toBe(at(3));
  // Ordinary connections still use their real clock: the override is scoped to the rig pool.
  const ordinary=createPool(db.url);try{expect((await ordinary.query('SELECT clock_timestamp() AS now')).rows[0].now.toISOString()).not.toBe(at(3));}finally{await ordinary.end();}
 }finally{await clock?.close();await db.drop();}
 expect(Date).toBe(RealDate);
});
it('drains in-flight HTTP, blocks new requests, advances real API time and preserves session expiry',async()=>{
 const db=await createMigratedDatabase(pg.url,migrate);let clock:LocalClock|undefined,app:Awaited<ReturnType<typeof buildServer>>|undefined;
 let release!:()=>void;const hold=new Promise<void>(resolve=>{release=resolve;});let entered=false;
 try{
  clock=await createLocalClock(db,env);
  const config=loadConfig({ENVIRONMENT:'test',DATABASE_URL:db.url,AUTH_ADAPTER:'test',PLACES_ADAPTER:'fixture',MAIL_ADAPTER:'outbox_test',AI_PROVIDER:'disabled',WEB_ORIGIN:'http://127.0.0.1:5174',SESSION_SECRET:randomBytes(32).toString('hex'),IOS_REDIRECT_URI:'fancy://auth/callback'});
  app=await buildServer({config,pool:clock.pool,identity:localFixtureIdentity(env),publicOrigin:config.webOrigin});
  app.get('/fixture/hold',async()=>{entered=true;await hold;return {ok:true};});const gate=localClockGate(app);
  const headers={origin:config.webOrigin},email='clock-person@example.invalid';
  const start=await app.inject({method:'POST',url:'/v1/auth/email/start',headers,payload:{clientRequestId:randomUUID(),email,client:'WEB'}});
  const verify=await app.inject({method:'POST',url:'/v1/auth/email/verify',headers,payload:{clientRequestId:randomUUID(),challengeId:start.json().data.challengeId,code:'000000'}});expect(verify.statusCode).toBe(200);
  const cookie=verify.cookies.map(c=>`${c.name}=${c.value}`).join('; ');
  for(let n=0;n<40;n++)expect((await app.inject({url:'/v1/inbox',headers:{cookie}})).statusCode).toBe(200);
  expect((await app.inject({url:'/v1/inbox',headers:{cookie}})).statusCode).toBe(429);
  await gate.pause();await clock.advanceTo(at(0,60_000));gate.resume();
  expect((await app.inject({url:'/v1/inbox',headers:{cookie}})).statusCode).toBe(200);
  const windows=await clock.pool.query(`SELECT count FROM api_rate_limits WHERE bucket='poll:/v1/inbox' ORDER BY window_start`);expect(windows.rows.map(row=>row.count)).toEqual([41,1]);
  const pending=app.inject('/fixture/hold').then(value=>value);const stop=performance.now()+3000;while(!entered){if(performance.now()>stop)throw Error('fixture request did not enter');await new Promise<void>(resolve=>setImmediate(resolve));}
  let drained=false;const pause=gate.pause().then(()=>{drained=true;});await Promise.resolve();expect(drained).toBe(false);
  expect((await app.inject('/health/live')).statusCode).toBe(503);release();await pending;await pause;
  await clock.advanceTo(at(3));gate.resume();
  const alive=await app.inject({url:'/v1/auth/session',headers:{cookie}});expect(alive.statusCode).toBe(200);expect(alive.json().meta.serverNow).toBe(at(3));
  await gate.pause();await clock.advanceTo(at(11));gate.resume();
  expect((await app.inject({url:'/v1/auth/session',headers:{cookie}})).statusCode).toBe(401);
 }finally{release();await app?.close();await clock?.close();await db.drop();}
});

it('worker failure after committed advancement leaves HTTP closed and reports the actual advanced instant',async()=>{
 const db=await createMigratedDatabase(pg.url,migrate);let clock:LocalClock|undefined,app:Awaited<ReturnType<typeof buildServer>>|undefined;
 try{
  clock=await createLocalClock(db,env);
  const config=loadConfig({ENVIRONMENT:'test',DATABASE_URL:db.url,AUTH_ADAPTER:'test',PLACES_ADAPTER:'fixture',MAIL_ADAPTER:'outbox_test',AI_PROVIDER:'disabled',WEB_ORIGIN:'http://127.0.0.1:5174',SESSION_SECRET:randomBytes(32).toString('hex'),IOS_REDIRECT_URI:'fancy://auth/callback'});
  app=await buildServer({config,pool:clock.pool,identity:localFixtureIdentity(env),publicOrigin:config.webOrigin});const gate=localClockGate(app,20);
  const worker={stop:vi.fn(async()=>{}),tick:vi.fn(async()=>{throw Error('controlled tick failure');}),start:vi.fn()};
  await expect(advanceRigClock(clock,gate,worker,START)).rejects.toThrow();expect(clock.now()).toBe(START);expect(worker.stop).not.toHaveBeenCalled();expect((await app.inject('/health/live')).statusCode).toBe(200);
  await expect(advanceRigClock(clock,gate,worker,at(3))).rejects.toThrow();expect(clock.now()).toBe(at(3));expect(worker.start).not.toHaveBeenCalled();expect((await app.inject('/health/live')).statusCode).toBe(503);
  const {rows:[sql]}=await clock.pool.query('SELECT clock_timestamp() AS now');expect(sql.now.toISOString()).toBe(at(3));
  gate.resume();const real=performance.now();
  await expect(advanceRigClock(clock,gate,{stop:()=>new Promise(()=>{}),tick:async()=>{},start:vi.fn()},at(4),20)).rejects.toMatchObject({diagnostic:{phase:'WORKER_STOP',databaseOutcome:'OLD'}});
  expect(performance.now()-real).toBeGreaterThanOrEqual(10);expect(clock.now()).toBe(at(3));expect((await app.inject('/health/live')).statusCode).toBe(503);
 }finally{await app?.close();await clock?.close();await db.drop();}
});
it('real worker processes the same published meal at exact close/start/end boundaries, then real attendance and mutual reconnect APIs',async()=>{
 const db=await createMigratedDatabase(pg.url,migrate);let clock:LocalClock|undefined,app:Awaited<ReturnType<typeof buildServer>>|undefined;
 try{
  clock=await createLocalClock(db,env);
  const config=loadConfig({ENVIRONMENT:'test',DATABASE_URL:db.url,AUTH_ADAPTER:'test',PLACES_ADAPTER:'fixture',MAIL_ADAPTER:'outbox_test',AI_PROVIDER:'disabled',WEB_ORIGIN:'http://127.0.0.1:5174',SESSION_SECRET:randomBytes(32).toString('hex'),IOS_REDIRECT_URI:'fancy://auth/callback'});
  app=await buildServer({config,pool:clock.pool,identity:localFixtureIdentity(env),publicOrigin:config.webOrigin});
  const gate=localClockGate(app),runtime=createWorkerRuntime(clock.pool,config);
  const browser=()=>{
   let cookie='',csrf='';
   const request=async(method:'GET'|'POST'|'PATCH'|'PUT',url:string,body?:unknown,version?:string)=>{
    const result=await app!.inject({method,url,headers:{origin:config.webOrigin,cookie,...(body===undefined?{}:{'content-type':'application/json'}),...(csrf?{'x-csrf-token':csrf}:{}),...(method==='GET'?{}:{'idempotency-key':randomUUID()}),...(version?{'if-match':`"${version}"`}:{})},...(body===undefined?{}:{payload:JSON.stringify(body)})});
    if(result.cookies.length)cookie=result.cookies.map(c=>`${c.name}=${c.value}`).join('; ');return result;
   };
   return {request,async login(){const start=await request('POST','/v1/auth/email/start',{clientRequestId:randomUUID(),email:`clock-${randomUUID()}@example.invalid`,client:'WEB'});expect(start.statusCode).toBe(201);const result=await request('POST','/v1/auth/email/verify',{clientRequestId:randomUUID(),challengeId:start.json().data.challengeId,code:'000000'});expect(result.statusCode).toBe(200);csrf=result.json().data.session.csrfToken;const id=result.json().data.session.user.id as string;
    expect((await request('PATCH','/v1/me',{displayName:'Clock Fixture',bio:'A synthetic participant for local lifecycle validation.',languages:['en'],lifeStatus:'NEW_TO_LONDON',interests:['FOOD'],ageConfirmedVersion:'2026-10-21',communityAcceptedVersion:'2026-10-21'},'1')).statusCode).toBe(200);return id;}};
  };
  const host=browser(),guest=browser(),hostId=await host.login(),guestId=await guest.login();
  const venue=await host.request('POST','/v1/venues/confirm',{placeId:'fixture_fancy_north'});expect(venue.statusCode).toBe(200);
  const start=Math.floor(RealDate.parse(START)/60_000)*60_000+3*3_600_000,close=start-3_600_000,end=start+2*3_600_000;
  const time=(instant:number)=>{const t=londonTime(new RealDate(instant));return {localDate:t.localDate,localTime:t.localTime,timeZone:t.timeZone,utcOffsetMinutes:t.utcOffsetMinutes};};
  const published=await host.request('POST','/v1/meals',{venueRef:venue.json().data.venueRef,title:'Fixed clock lifecycle meal',description:'Same synthetic meal across close, start, end and post-meal.',start:time(start),close:time(close),minimum:2,capacity:4,budgetMinPence:1000,budgetMaxPence:3000,languages:['en'],mood:'EASY_CONVERSATION',bookingMode:'EXTERNAL_PAY_AT_VENUE',attemptId:randomUUID(),bookingDeclarationConfirmed:true,reviewConfirmed:true,termsVersion:'2026-10-21'});expect(published.statusCode,published.body).toBe(201);const mealId=published.json().data.id as string;
  const application=await guest.request('POST',`/v1/meals/${mealId}/applications`,{message:'Looking forward to sharing a friendly meal.'});expect(application.statusCode).toBe(201);
  const approve=await host.request('POST',`/v1/applications/${application.json().data.id}/decision`,{decision:'APPROVE'},application.json().data.version);expect(approve.statusCode,approve.body).toBe(200);
  const advance=async(instant:number)=>advanceRigClock(clock!,gate,{stop:async()=>{},tick:()=>runtime.tick(),start:()=>{}},new RealDate(instant).toISOString());
  const marks=async()=>(await clock!.pool.query(`SELECT kind FROM lifecycle_marks WHERE meal_id=$1 ORDER BY due_at`,[mealId])).rows.map(row=>row.kind);
  await advance(close-1);expect(await marks()).toEqual([]);await advance(close);expect(await marks()).toEqual(['CLOSE']);
  await advance(start-1);expect((await clock.pool.query(`SELECT count(*)::int n FROM start_roster WHERE meal_id=$1`,[mealId])).rows[0].n).toBe(0);
  await advance(start);expect(await marks()).toEqual(['CLOSE','START']);expect((await clock.pool.query(`SELECT count(*)::int n FROM start_roster WHERE meal_id=$1`,[mealId])).rows[0].n).toBe(2);
  await advance(end-1);expect((await host.request('GET',`/v1/meals/${mealId}/post-meal`)).json().data.windowOpen).toBe(false);
  await advance(end);expect(await marks()).toEqual(['CLOSE','START','END']);expect((await host.request('GET',`/v1/meals/${mealId}/post-meal`)).json().data.windowOpen).toBe(true);
  for(const [person,id] of [[host,hostId],[guest,guestId]] as const)expect((await person.request('PUT',`/v1/meals/${mealId}/attendance/${id}`,{value:'present'},'0')).statusCode).toBe(200);
  expect((await host.request('PUT',`/v1/meals/${mealId}/reconnect/${guestId}`,{selected:true},'0')).statusCode).toBe(200);
  const mutual=await guest.request('PUT',`/v1/meals/${mealId}/reconnect/${hostId}`,{selected:true},'0');expect(mutual.statusCode,mutual.body).toBe(200);expect(mutual.json().data.connection).toBe('OPEN');
  expect((await clock.pool.query(`SELECT starts_at,closes_at,scheduled_end_at FROM meals WHERE id=$1`,[mealId])).rows[0]).toEqual({starts_at:new Date(start),closes_at:new Date(close),scheduled_end_at:new Date(end)});
 }finally{try{await app?.close();}finally{try{await clock?.close();}finally{await db.drop();}}}
},30_000);
it('diagnoses drain, worker, and ambiguous commit failures from the database rather than Node time',async()=>{
 const db=await createMigratedDatabase(pg.url,migrate);let clock:LocalClock|undefined;
 try{
  clock=await createLocalClock(db,env);const c=clock,gate={pause:async()=>{},block:vi.fn(),resume:vi.fn()},worker={stop:async()=>{},tick:async()=>{},start:vi.fn()};
  await expect(advanceRigClock(c,{...gate,pause:async()=>{throw new Error('private controlled failure');}},worker,at(0,1))).rejects.toMatchObject({diagnostic:{phase:'HTTP_DRAIN',databaseOutcome:'OLD'}});
  await expect(advanceRigClock(c,gate,{...worker,stop:async()=>{throw new Error('private worker failure');}},at(0,1))).rejects.toMatchObject({diagnostic:{phase:'WORKER_STOP',databaseOutcome:'OLD'}});
  // Simulate a committed transaction whose acknowledgement failed: Node is intentionally stale.
  const advance=vi.spyOn(c,'advanceTo').mockImplementationOnce(async value=>{await c.pool.query('UPDATE fancy_fixture_clock.state SET instant=$1',[value]);throw new Error('private acknowledgement failure');});
  await expect(advanceRigClock(c,gate,worker,at(0,1))).rejects.toMatchObject({diagnostic:{phase:'CLOCK_COMMIT',nodeCurrent:START,databaseOutcome:'TARGET',databaseCurrent:at(0,1)}});advance.mockRestore();
  expect(worker.start).not.toHaveBeenCalled();expect(gate.resume).not.toHaveBeenCalled();
 }finally{await clock?.close();await db.drop();}
});
it('drains a complete GET whose client disconnects while waiting for its response',async()=>{
 const db=await createMigratedDatabase(pg.url,migrate);let app:Awaited<ReturnType<typeof buildServer>>|undefined;
 let release!:()=>void,entered!:()=>void;const held=new Promise<void>(r=>{release=r;}),ready=new Promise<void>(r=>{entered=r;});
 try{
  const config=loadConfig({ENVIRONMENT:'test',DATABASE_URL:db.url,AUTH_ADAPTER:'test',PLACES_ADAPTER:'fixture',MAIL_ADAPTER:'outbox_test',AI_PROVIDER:'disabled',WEB_ORIGIN:'http://127.0.0.1:5174',SESSION_SECRET:randomBytes(32).toString('hex'),IOS_REDIRECT_URI:'fancy://auth/callback'});
  app=await buildServer({config,pool:db.pool,identity:localFixtureIdentity(env),publicOrigin:config.webOrigin});
  const gate=localClockGate(app,100);app.get('/fixture/abort-response',async()=>{entered();await held;return {ok:true};});
  await app.listen({host:'127.0.0.1',port:0});const address=app.server.address();if(!address||typeof address==='string')throw new Error('fixture listener missing');
  const client=httpRequest({host:'127.0.0.1',port:address.port,path:'/fixture/abort-response',method:'GET'});client.on('error',()=>{});client.end();await ready;
  client.destroy();await new Promise<void>(r=>setTimeout(r,20));await expect(gate.pause()).resolves.toBeUndefined();release();
 }finally{release?.();await app?.close();await db.drop();}
},30_000);
