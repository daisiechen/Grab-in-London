/** QA-CODE-003: a suspended provider call must not retain a meal row lock. */
import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,expect,inject,it} from 'vitest';
import {Browser,createHarness,json,WEB_ORIGIN,type Harness} from '../apps/api/src/test/harness.ts';
import {loadConfig} from '../packages/config/src/index.ts';
import {buildServer} from '../apps/api/src/http/server.ts';
import {FixturePlacesProvider} from '../apps/api/src/venues/fixture-provider.ts';
let h:Harness,armed=false,entered=false,release:()=>void=()=>{};
beforeAll(async()=>{
 h=await createHarness(inject('pgServerUrl'));await h.app.close();const originalClose=h.close,fixture=new FixturePlacesProvider('test');
 const config=loadConfig({ENVIRONMENT:'test',DATABASE_URL:h.db.url,AUTH_ADAPTER:'test',PLACES_ADAPTER:'fixture',MAIL_ADAPTER:'outbox_test',AI_PROVIDER:'disabled',WEB_ORIGIN,SESSION_SECRET:'api-test-session-secret-0123456789abcdef',IOS_REDIRECT_URI:'fancy://auth/callback'});
 h.app=await buildServer({config,pool:h.db.pool,identity:h.idp,publicOrigin:WEB_ORIGIN,placesProvider:{kind:'fixture',search:i=>fixture.search(i),details:async id=>{if(armed){entered=true;await new Promise<void>(resolve=>{release=resolve;});}return fixture.details(id);}}});h.close=async()=>{await h.app.close();await originalClose();};
});afterAll(async()=>{armed=false;release();await h?.close();});
const headers=(version?:string,key=randomUUID())=>({'idempotency-key':key,...(version?{'if-match':`"${version}"`}:{})});
async function actor(){const b=new Browser(h);const {body}=await b.signInWithEmail(`${randomUUID()}@example.invalid`);const id=body.data.session.user.id as string;const r=await b.request('PATCH','/v1/me',{body:{displayName:'QA Round Two',bio:'Synthetic isolated QA profile for concurrent safety checks.',languages:['en'],lifeStatus:'NEW_TO_LONDON',interests:['FOOD'],ageConfirmedVersion:'2026-10-21',communityAcceptedVersion:'2026-10-21'},headers:headers('1')});expect(r.statusCode,r.body).toBe(200);return{b,id};}
async function meal(b:Browser,capacity=4,extra:Record<string,unknown>={},expectedStatus=201){const venue=await b.request('POST','/v1/venues/confirm',{body:{placeId:'fixture_fancy_north'},headers:headers()});expect(venue.statusCode,venue.body).toBe(200);const r=await b.request('POST','/v1/meals',{body:{venueRef:json(venue).data.venueRef,title:'QA concurrency isolated table',description:'Synthetic table with no external restaurant or customer activity.',start:{localDate:'2030-10-23',localTime:'18:00',timeZone:'Europe/London',utcOffsetMinutes:60},close:{localDate:'2030-10-23',localTime:'17:00',timeZone:'Europe/London',utcOffsetMinutes:60},minimum:2,capacity,budgetMinPence:2000,budgetMaxPence:3500,languages:['en'],mood:'EASY_CONVERSATION',bookingMode:'EXTERNAL_PAY_AT_VENUE',attemptId:randomUUID(),bookingDeclarationConfirmed:true,reviewConfirmed:true,termsVersion:'2026-10-21',...extra},headers:headers()});expect(r.statusCode,r.body).toBe(expectedStatus);return expectedStatus===201?json(r).data:json(r).error;}


it('QA-F12 delayed restaurant provider during an edit does not hold the meal lock on another connection',async()=>{
 const a=await actor(),m=await meal(a.b);armed=true;entered=false;let lock='ACQUIRED';const probe=await h.db.pool.connect();
 const patch=a.b.request('PATCH',`/v1/meals/${m.id}`,{headers:headers(String(m.version)),body:{description:'Synthetic updated arrangement while a provider is suspended.'}});
 try{
  const end=Date.now()+5000;while(!entered){if(Date.now()>end)throw Error('controlled provider did not enter');await new Promise<void>(r=>setImmediate(r));}
  await probe.query('BEGIN');try{await probe.query('SELECT id FROM meals WHERE id=$1 FOR UPDATE NOWAIT',[m.id]);}catch(error){lock=String((error as {code?:string}).code);}
 }finally{await probe.query('ROLLBACK');probe.release();armed=false;release();}
 const result=await patch;expect(result.statusCode,result.body).toBe(200);expect(lock).toBe('ACQUIRED');
});
