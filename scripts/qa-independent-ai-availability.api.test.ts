/** AI availability fails closed independently of ordinary business and preference controls. */
import {randomBytes,randomUUID} from 'node:crypto';
import {afterEach,expect,inject,it} from 'vitest';
import {Browser,createHarness,json,WEB_ORIGIN,type Harness} from '../apps/api/src/test/harness.ts';
import {mockProvider,emptyPreferences} from '../packages/assistant/src/index.ts';
import {BudgetLedger} from '../apps/api/src/assistant/budget.ts';
import {loadConfig} from '../packages/config/src/index.ts';
import {withTransaction} from '../apps/api/src/common/transaction.ts';
import {issueNativeCredentials} from '../apps/api/src/identity/sessions.ts';
import {buildServer} from '../apps/api/src/http/server.ts';
let h:Harness,calls=0;afterEach(async()=>h?.close());
async function setup(disabled=false){
 calls=0;h=await createHarness(inject('pgServerUrl'),disabled?undefined:{allowedAreas:[],provider:mockProvider('test',async()=>{calls++;return{parsed:{intent:'SEARCH',patches:[],mealIds:[]},usage:{inputTokens:10,outputTokens:10},providerRequestId:randomUUID()};}),price:{version:'synthetic-QA-not-real-pricing',verified:true,inputMicroCnyPerMillion:1000000n,outputMicroCnyPerMillion:1000000n,validUntil:Date.now()+60000},countInputTokens:()=>1024});
 if(disabled){const originalClose=h.close;await h.app.close();const config=loadConfig({ENVIRONMENT:'test',DATABASE_URL:h.db.url,AUTH_ADAPTER:'test',PLACES_ADAPTER:'fixture',MAIL_ADAPTER:'outbox_test',AI_PROVIDER:'disabled',WEB_ORIGIN,SESSION_SECRET:'synthetic-availability-secret-0123456789',IOS_REDIRECT_URI:'fancy://auth/callback'});h.app=await buildServer({config,pool:h.db.pool,identity:h.idp,publicOrigin:WEB_ORIGIN});h.close=async()=>{await h.app.close();await originalClose();};}
 const clock=(await h.db.pool.query("SELECT 'D:'||to_char(clock_timestamp() AT TIME ZONE 'Europe/London','YYYY-MM-DD') AS day_period,'M:'||to_char(clock_timestamp() AT TIME ZONE 'Europe/London','YYYY-MM') AS month_period")).rows[0];return{ledger:new BudgetLedger(h.db.pool),day:clock.day_period as string,month:clock.month_period as string};
}
const headers=(version?:string,key=randomUUID())=>({'idempotency-key':key,...(version?{'if-match':`"${version}"`}:{})});
async function actor(){const b=new Browser(h);const {body}=await b.signInWithEmail(`${randomUUID()}@example.invalid`);const id=body.data.session.user.id as string;const r=await b.request('PATCH','/v1/me',{body:{displayName:'QA Round Two',bio:'Synthetic isolated QA profile for concurrent safety checks.',languages:['en'],lifeStatus:'NEW_TO_LONDON',interests:['FOOD'],ageConfirmedVersion:'2026-10-21',communityAcceptedVersion:'2026-10-21'},headers:headers('1')});expect(r.statusCode,r.body).toBe(200);return{b,id};}
async function meal(b:Browser,capacity=4,extra:Record<string,unknown>={},expectedStatus=201){const venue=await b.request('POST','/v1/venues/confirm',{body:{placeId:'fixture_fancy_north'},headers:headers()});expect(venue.statusCode,venue.body).toBe(200);const r=await b.request('POST','/v1/meals',{body:{venueRef:json(venue).data.venueRef,title:'QA concurrency isolated table',description:'Synthetic table with no external restaurant or customer activity.',start:{localDate:'2030-10-23',localTime:'18:00',timeZone:'Europe/London',utcOffsetMinutes:60},close:{localDate:'2030-10-23',localTime:'17:00',timeZone:'Europe/London',utcOffsetMinutes:60},minimum:2,capacity,budgetMinPence:2000,budgetMaxPence:3500,languages:['en'],mood:'EASY_CONVERSATION',bookingMode:'EXTERNAL_PAY_AT_VENUE',attemptId:randomUUID(),bookingDeclarationConfirmed:true,reviewConfirmed:true,termsVersion:'2026-10-21',...extra},headers:headers()});expect(r.statusCode,r.body).toBe(expectedStatus);return expectedStatus===201?json(r).data:json(r).error;}


async function bootstrap(b:Browser){const r=await b.request('POST','/v1/ai/sessions',{body:{deviceChallenge:randomBytes(32).toString('base64url')},headers:headers()});expect(r.statusCode,r.body).toBe(201);return json(r).data;}
async function request(b:Browser,s:Record<string,string|number>){const id=randomUUID();const r=await b.request('POST',`/v1/ai/sessions/${s.sessionId}/requests`,{headers:{...headers(undefined,id),'ai-device-token':String(s.deviceToken)},body:{requestId:id,generation:s.generation,input:'Find meals',sourcePage:'DISCOVER',queryVersion:'0',preferenceVersion:'1',contextVersion:'0'}});return{id,r};}
async function terminal(b:Browser,s:Record<string,string|number>,id:string){const end=Date.now()+5000;for(;;){const r=await b.request('GET',`/v1/ai/requests/${id}?sessionId=${s.sessionId}&generation=${s.generation}`,{headers:{'ai-device-token':String(s.deviceToken)}});expect(r.statusCode,r.body).toBe(200);if(json(r).data.state!=='PENDING')return json(r).data;if(Date.now()>end)throw Error('synthetic unavailable request did not settle');await new Promise<void>(r=>setImmediate(r));}}
const fields={...emptyPreferences(),languages:['fr']};
it.each(['none','missing-day','missing-month','missing-call-cap','disabled-budget'])('QA-AI-043 %s does not dispatch and leaves business and preference deletion usable',async mode=>{
 const{ledger,day,month}=await setup();
 if(mode==='missing-call-cap')await expect(Reflect.apply(ledger.configure,ledger,[day,10000000n,undefined,true])).rejects.toMatchObject({code:'AI_CONFLICT'});
 if(!['none','missing-day','missing-call-cap'].includes(mode))await ledger.configure(day,10000000n,100,mode!=='disabled-budget');
 if(!['none','missing-month'].includes(mode))await ledger.configure(month,10000000n,100,mode!=='disabled-budget');
 const a=await actor(),m=await meal(a.b);const saved=await a.b.request('PUT','/v1/ai/preferences',{headers:headers('0'),body:{fields,confirmation:true}});expect(saved.statusCode,saved.body).toBe(200);
 const s=await bootstrap(a.b),pending=await request(a.b,s);expect(pending.r.statusCode,pending.r.body).toBe(202);const result=await terminal(a.b,s,pending.id);expect(result.state).toBe('FAILED');expect(result.result).toBeNull();expect(calls).toBe(0);
 const read=await a.b.request('GET','/v1/ai/preferences');expect(read.statusCode,read.body).toBe(200);expect(json(read).data.fields).toEqual(fields);
 const removed=await a.b.request('DELETE','/v1/ai/preferences',{headers:headers('1')});expect(removed.statusCode,removed.body).toBe(200);expect(json(removed).data.fields).toEqual(emptyPreferences());
 expect((await a.b.request('GET',`/v1/meals/${m.id}`)).statusCode).toBe(200);const patch=await a.b.request('PATCH',`/v1/meals/${m.id}`,{headers:headers(String(m.version)),body:{description:'Ordinary business edit remains available while AI is unavailable.'}});expect(patch.statusCode,patch.body).toBe(200);
 expect((await h.db.pool.query('SELECT successes,reserved_success_slots FROM ai_quota')).rows).toEqual([{successes:0,reserved_success_slots:0}]);expect((await h.db.pool.query('SELECT count(*)::int n FROM ai_calls')).rows[0].n).toBe(0);
});
it('QA-AI-027 disabled provider still lets only the owner read/delete preferences and retains submitted meal',async()=>{
 await setup(true);const a=await actor(),b=await actor(),m=await meal(a.b);
 const saved=await a.b.request('PUT','/v1/ai/preferences',{headers:headers('0'),body:{fields,confirmation:true}});expect(saved.statusCode,saved.body).toBe(200);
 const own=await a.b.request('GET','/v1/ai/preferences');expect(json(own).data.fields).toEqual(fields);
 const other=await b.b.request('GET',`/v1/ai/preferences?userId=${a.id}`);expect(other.statusCode,other.body).toBe(200);expect(json(other).data.fields).toEqual(emptyPreferences());
 const forged=await b.b.request('DELETE',`/v1/ai/preferences?userId=${a.id}`,{headers:headers('1')});expect(forged.statusCode,forged.body).toBe(409);expect(json(forged).error.code).toBe('AI_CONFLICT');
 expect((await b.b.request('GET',`/v1/ai/preferences/${a.id}`)).statusCode).toBe(404);
 expect((await new Browser(h).request('GET','/v1/ai/preferences')).statusCode).toBe(401);
 const s=await bootstrap(a.b),r=await request(a.b,s);expect(r.r.statusCode,r.r.body).toBe(503);expect(calls).toBe(0);
 expect(json(await a.b.request('GET','/v1/ai/preferences')).data.fields).toEqual(fields);
 const tab=new Browser(h);for(const[k,v]of a.b.cookies)tab.cookies.set(k,v);tab.csrf=a.b.csrf;
 const nativeA=await withTransaction(h.db.pool,tx=>issueNativeCredentials(tx.client,a.id,'IOS',['otp'],new Date()));
 const nativeB=await withTransaction(h.db.pool,tx=>issueNativeCredentials(tx.client,b.id,'IOS',['otp'],new Date()));
 const bearerA={authorization:`Bearer ${nativeA.credentials.accessToken}`},bearerB={authorization:`Bearer ${nativeB.credentials.accessToken}`};
 const nativeRead=await h.app.inject({method:'GET',url:'/v1/ai/preferences',headers:bearerA});expect(nativeRead.statusCode,nativeRead.body).toBe(200);expect(json(nativeRead).data.fields).toEqual(fields);
 const nativeOther=await h.app.inject({method:'GET',url:`/v1/ai/preferences?userId=${a.id}`,headers:bearerB});expect(json(nativeOther).data.fields).toEqual(emptyPreferences());
 const nativeWrong=await h.app.inject({method:'DELETE',url:`/v1/ai/preferences?userId=${a.id}`,headers:{...bearerB,...headers('1')}});expect(nativeWrong.statusCode,nativeWrong.body).toBe(409);
 const nativeDelete=await h.app.inject({method:'DELETE',url:'/v1/ai/preferences',headers:{...bearerA,...headers('1')}});expect(nativeDelete.statusCode,nativeDelete.body).toBe(200);expect(json(nativeDelete).data.fields).toEqual(emptyPreferences());
 const synced=await tab.request('GET','/v1/ai/preferences');expect(json(synced).data.fields).toEqual(emptyPreferences());expect(json(synced).data.epoch).toBe(json(nativeDelete).data.epoch);
 const restored=await a.b.request('PUT','/v1/ai/preferences',{headers:headers('2'),body:{fields,confirmation:true}});expect(restored.statusCode,restored.body).toBe(200);
 const removed=await a.b.request('DELETE','/v1/ai/preferences',{headers:headers('3')});expect(removed.statusCode,removed.body).toBe(200);expect(json(removed).data.fields).toEqual(emptyPreferences());

 expect((await a.b.request('GET',`/v1/meals/${m.id}`)).statusCode).toBe(200);expect((await h.db.pool.query('SELECT count(*)::int n FROM meals WHERE id=$1',[m.id])).rows[0].n).toBe(1);
});
