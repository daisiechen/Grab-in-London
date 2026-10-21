/** QA-AUTH-014: real PostgreSQL family revocation, replayed private reads/writes and independent device. */
import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,expect,inject,it} from 'vitest';
import {createApiClient,withRetry} from '../packages/client/src/index.ts';
import {Browser,createHarness,json,type Harness} from '../apps/api/src/test/harness.ts';
let h:Harness;beforeAll(async()=>{h=await createHarness(inject('pgServerUrl'));});afterAll(async()=>h.close());
const headers=(version?:string,key=randomUUID())=>({'idempotency-key':key,...(version?{'if-match':`"${version}"`}:{})});
async function actor(){const b=new Browser(h);const {body}=await b.signInWithEmail(`${randomUUID()}@example.invalid`);const id=body.data.session.user.id as string;const r=await b.request('PATCH','/v1/me',{body:{displayName:'QA Round Two',bio:'Synthetic isolated QA profile for concurrent safety checks.',languages:['en'],lifeStatus:'NEW_TO_LONDON',interests:['FOOD'],ageConfirmedVersion:'2026-10-21',communityAcceptedVersion:'2026-10-21'},headers:headers('1')});expect(r.statusCode,r.body).toBe(200);return{b,id};}
async function meal(b:Browser,capacity=4,extra:Record<string,unknown>={},expectedStatus=201){const venue=await b.request('POST','/v1/venues/confirm',{body:{placeId:'fixture_fancy_north'},headers:headers()});expect(venue.statusCode,venue.body).toBe(200);const r=await b.request('POST','/v1/meals',{body:{venueRef:json(venue).data.venueRef,title:'QA concurrency isolated table',description:'Synthetic table with no external restaurant or customer activity.',start:{localDate:'2030-10-23',localTime:'18:00',timeZone:'Europe/London',utcOffsetMinutes:60},close:{localDate:'2030-10-23',localTime:'17:00',timeZone:'Europe/London',utcOffsetMinutes:60},minimum:2,capacity,budgetMinPence:2000,budgetMaxPence:3500,languages:['en'],mood:'EASY_CONVERSATION',bookingMode:'EXTERNAL_PAY_AT_VENUE',attemptId:randomUUID(),bookingDeclarationConfirmed:true,reviewConfirmed:true,termsVersion:'2026-10-21',...extra},headers:headers()});expect(r.statusCode,r.body).toBe(expectedStatus);return expectedStatus===201?json(r).data:json(r).error;}

it('QA-AUTH-014 revokes only the departing family and rejects captured private deep-link reads and message replay',async()=>{
 const host=await actor(),m=await meal(host.b);
 const group=(await h.db.pool.query('SELECT id FROM conversations WHERE meal_id=$1',[m.id])).rows[0].id as string;
 const email=(await h.db.pool.query('SELECT email FROM private_contact WHERE user_id=$1',[host.id])).rows[0].email as string;
 await h.db.pool.query("UPDATE auth_transactions SET created_at=created_at-interval '1 minute' WHERE kind='EMAIL_OTP'");
 const other=new Browser(h);await other.signInWithEmail(email);expect((await other.request('GET','/v1/auth/session')).statusCode).toBe(200);
 const body={body:'Synthetic private logout replay sentinel',clientMessageId:randomUUID()};
 expect((await host.b.request('POST',`/v1/conversations/${group}/messages`,{body})).statusCode).toBe(201);
 const captured=new Browser(h);for(const[k,v]of host.b.cookies)captured.cookies.set(k,v);captured.csrf=host.b.csrf;
 const before=(await h.db.pool.query('SELECT count(*)::int n FROM messages WHERE conversation_id=$1',[group])).rows[0].n;
 const logout=await host.b.request('POST','/v1/auth/logout',{body:{clientRequestId:randomUUID()}});expect(logout.statusCode,logout.body).toBe(204);
 expect(host.b.cookies.has('__Host-fancy_session')).toBe(false);
 expect((await captured.request('GET','/v1/auth/session')).statusCode).toBe(401);
 expect((await captured.request('GET',`/v1/conversations/${group}/messages?mode=LIVE&afterSeq=0`)).statusCode).toBe(401);
 const replay=await captured.request('POST',`/v1/conversations/${group}/messages`,{body});expect(replay.statusCode,replay.body).toBe(401);
 const newWrite=await captured.request('POST',`/v1/conversations/${group}/messages`,{body:{...body,clientMessageId:randomUUID()}});expect(newWrite.statusCode,newWrite.body).toBe(401);
 expect((await h.db.pool.query('SELECT count(*)::int n FROM messages WHERE conversation_id=$1',[group])).rows[0].n).toBe(before);
 expect((await other.request('GET','/v1/auth/session')).statusCode).toBe(200);
 expect((await other.request('POST',`/v1/conversations/${group}/messages`,{body:{body:'Other device remains authorized after ordinary logout',clientMessageId:randomUUID()}})).statusCode).toBe(201);
 const families=(await h.db.pool.query('SELECT revoked_at,revoke_reason FROM session_families WHERE user_id=$1',[host.id])).rows;
 expect(families.filter(r=>r.revoked_at!==null)).toHaveLength(1);expect(families.filter(r=>r.revoked_at===null)).toHaveLength(1);
});

it('QA-API-007 missing version returns 428 and real 429 retries one original intent with its Retry-After',async()=>{
 const host=await actor(),m=await meal(host.b),key=randomUUID(),body={description:'Updated synthetic QA arrangement after a controlled rate limit.'};
 const missing=await host.b.request('PATCH',`/v1/meals/${m.id}`,{body,headers:headers()});expect(missing.statusCode,missing.body).toBe(428);
 await h.db.pool.query("INSERT INTO api_rate_limits(actor_id,bucket,window_start,count) VALUES($1,'writes',date_trunc('minute',clock_timestamp()),60) ON CONFLICT(actor_id,bucket,window_start) DO UPDATE SET count=60",[host.id]);
 const calls:{key:string|undefined;status:number;retry:string|number|string[]|undefined}[]=[],sleeps:number[]=[];
 const client=createApiClient({baseUrl:'http://qa.test',credentials:{kind:'cookie',csrfToken:()=>host.b.csrf},fetch:async(input,init)=>{
  const response=await host.b.request(init!.method!,new URL(String(input)).pathname,{body:JSON.parse(String(init!.body)),headers:init!.headers as Record<string,string>});
  calls.push({key:(init!.headers as Record<string,string>)['idempotency-key'],status:response.statusCode,retry:response.headers['retry-after']});
  return new Response(response.body,{status:response.statusCode,headers:{'content-type':'application/json',...(response.headers['retry-after']?{'retry-after':String(response.headers['retry-after'])}:{})}});
 }});
 const request={params:{mealId:m.id},body,idempotencyKey:key,ifMatch:String(m.version)};
 const result=await withRetry(()=>client.call('editMeal',request),{maxAttempts:2,sleep:async ms=>{sleeps.push(ms);await h.db.pool.query('DELETE FROM api_rate_limits WHERE actor_id=$1',[host.id]);}});
 expect(calls.map(c=>c.status)).toEqual([429,200]);expect(Number(calls[0]?.retry)).toBeGreaterThan(0);expect(sleeps).toEqual([Number(calls[0]?.retry)*1000]);expect(calls.map(c=>c.key)).toEqual([key,key]);
 expect(result.data.description).toBe(body.description);
 expect((await h.db.pool.query("SELECT count(*)::int n FROM business_events WHERE aggregate_id=$1 AND kind='meal.edited'",[m.id])).rows[0].n).toBe(1);
 const replay=await client.call('editMeal',request);expect(replay.data.version).toBe(result.data.version);
 expect((await h.db.pool.query("SELECT count(*)::int n FROM business_events WHERE aggregate_id=$1 AND kind='meal.edited'",[m.id])).rows[0].n).toBe(1);
});
