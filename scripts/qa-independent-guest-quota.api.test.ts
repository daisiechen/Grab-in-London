/** AI availability fails closed independently of ordinary business and preference controls. */
import {randomBytes,randomUUID} from 'node:crypto';
import {afterEach,expect,inject,it} from 'vitest';
import {Browser,createHarness,json,WEB_ORIGIN,type Harness} from '../apps/api/src/test/harness.ts';
import {mockProvider} from '../packages/assistant/src/index.ts';
import {BudgetLedger} from '../apps/api/src/assistant/budget.ts';
import {loadConfig} from '../packages/config/src/index.ts';
import {buildServer} from '../apps/api/src/http/server.ts';
let h:Harness,calls=0;afterEach(async()=>h?.close());
async function setup(disabled=false){
 calls=0;h=await createHarness(inject('pgServerUrl'),disabled?undefined:{allowedAreas:[],provider:mockProvider('test',async()=>{calls++;return{parsed:{intent:'SEARCH',patches:[],mealIds:[]},usage:{inputTokens:10,outputTokens:10},providerRequestId:randomUUID()};}),price:{version:'synthetic-QA-not-real-pricing',verified:true,inputMicroCnyPerMillion:1000000n,outputMicroCnyPerMillion:1000000n,validUntil:Date.now()+60000},countInputTokens:()=>1024});
 if(disabled){await h.app.close();const config=loadConfig({ENVIRONMENT:'test',DATABASE_URL:h.db.url,AUTH_ADAPTER:'test',PLACES_ADAPTER:'fixture',MAIL_ADAPTER:'outbox_test',AI_PROVIDER:'disabled',WEB_ORIGIN,SESSION_SECRET:'synthetic-availability-secret-0123456789',IOS_REDIRECT_URI:'fancy://auth/callback'});h.app=await buildServer({config,pool:h.db.pool,identity:h.idp,publicOrigin:WEB_ORIGIN});}
 const clock=(await h.db.pool.query("SELECT 'D:'||to_char(clock_timestamp() AT TIME ZONE 'Europe/London','YYYY-MM-DD') AS day_period,'M:'||to_char(clock_timestamp() AT TIME ZONE 'Europe/London','YYYY-MM') AS month_period")).rows[0];return{ledger:new BudgetLedger(h.db.pool),day:clock.day_period as string,month:clock.month_period as string};
}
const headers=(version?:string,key=randomUUID())=>({'idempotency-key':key,...(version?{'if-match':`"${version}"`}:{})});
async function bootstrap(b:Browser){const r=await b.request('POST','/v1/ai/sessions',{body:{deviceChallenge:randomBytes(32).toString('base64url')},headers:headers()});expect(r.statusCode,r.body).toBe(201);return json(r).data;}
async function request(b:Browser,s:Record<string,string|number>){const id=randomUUID();const r=await b.request('POST',`/v1/ai/sessions/${s.sessionId}/requests`,{headers:{...headers(undefined,id),'ai-device-token':String(s.deviceToken)},body:{requestId:id,generation:s.generation,input:'Find meals',sourcePage:'DISCOVER',queryVersion:'0',preferenceVersion:'0',contextVersion:'0'}});return{id,r};}
async function terminal(b:Browser,s:Record<string,string|number>,id:string){const end=Date.now()+5000;for(;;){const r=await b.request('GET',`/v1/ai/requests/${id}?sessionId=${s.sessionId}&generation=${s.generation}`,{headers:{'ai-device-token':String(s.deviceToken)}});expect(r.statusCode,r.body).toBe(200);if(json(r).data.state!=='PENDING')return json(r).data;if(Date.now()>end)throw Error('synthetic unavailable request did not settle');await new Promise<void>(r=>setImmediate(r));}}

async function guest(b:Browser){const r=await b.request('POST','/v1/guest-sessions',{body:{clientRequestId:randomUUID(),client:'WEB'}});expect(r.statusCode,r.body).toBe(201);b.csrf=json(r).data.csrfToken;return json(r).data;}
async function subject(s:Record<string,string|number>){return (await h.db.pool.query('SELECT subject FROM ai_session_meta WHERE id=$1',[s.sessionId])).rows[0].subject as string;}
it('QA-AI-038 reload NEW and two tabs share ten-turn subject; cookie clearing and expiry create new bounded subjects; wrong source fails',async()=>{
 const{ledger,day,month}=await setup();await ledger.configure(day,10000000n,100,true);await ledger.configure(month,10000000n,100,true);
 const b=new Browser(h),initial=await guest(b),s=await bootstrap(b),principal=await subject(s);
 const lifetime=(await h.db.pool.query('SELECT created_at,expires_at FROM guest_sessions WHERE id=$1',[principal.slice(6)])).rows[0];expect(+lifetime.expires_at-+lifetime.created_at).toBe(86400000);
 await h.db.pool.query("INSERT INTO ai_quota(subject,london_date,successes,minute_start) VALUES($1,(clock_timestamp() AT TIME ZONE 'Europe/London')::date,9,clock_timestamp())",[principal]);
 const last=await request(b,s);expect(last.r.statusCode,last.r.body).toBe(202);expect((await terminal(b,s,last.id)).state).toBe('SUCCEEDED');expect(calls).toBe(1);
 const tab=new Browser(h);for(const[k,v]of b.cookies)tab.cookies.set(k,v);tab.csrf=b.csrf;
 expect((await guest(tab)).expiresAt).toBe(initial.expiresAt);const second=await bootstrap(tab);expect(await subject(second)).toBe(principal);
 const over=await request(tab,second);expect(over.r.statusCode,over.r.body).toBe(429);expect(json(over.r).error.code).toBe('AI_QUOTA_EXCEEDED');
 const cleared=await b.request('DELETE',`/v1/ai/sessions/${s.sessionId}`,{headers:{...headers(),'ai-device-token':String(s.deviceToken)},body:{generation:s.generation,reason:'NEW'}});expect(cleared.statusCode,cleared.body).toBe(204);
 expect((await guest(b)).expiresAt).toBe(initial.expiresAt);const reset=await bootstrap(b);expect(await subject(reset)).toBe(principal);expect((await request(b,reset)).r.statusCode).toBe(429);expect(calls).toBe(1);
 const foreign=new Browser(h,'https://untrusted.example.invalid');for(const[k,v]of b.cookies)foreign.cookies.set(k,v);foreign.csrf=b.csrf;
 expect((await foreign.request('POST','/v1/guest-sessions',{body:{clientRequestId:randomUUID(),client:'WEB'}})).statusCode).toBe(403);
 expect((await foreign.request('POST','/v1/ai/sessions',{headers:headers(),body:{deviceChallenge:randomBytes(32).toString('base64url')}})).statusCode).toBe(403);
 const noCsrf=new Browser(h);for(const[k,v]of b.cookies)noCsrf.cookies.set(k,v);
 expect((await noCsrf.request('POST','/v1/ai/sessions',{headers:headers(),body:{deviceChallenge:randomBytes(32).toString('base64url')}})).statusCode).toBe(403);
 b.cookies.clear();b.csrf=null;await guest(b);const fresh=await bootstrap(b),newPrincipal=await subject(fresh);expect(newPrincipal).not.toBe(principal);
 const independent=await request(b,fresh);expect(independent.r.statusCode,independent.r.body).toBe(202);expect((await terminal(b,fresh,independent.id)).state).toBe('SUCCEEDED');expect(calls).toBe(2);
 await h.db.pool.query("UPDATE guest_sessions SET expires_at=clock_timestamp()-interval '1 millisecond' WHERE id=$1",[newPrincipal.slice(6)]);
 const expired=await b.request('GET',`/v1/ai/sessions/${fresh.sessionId}`,{headers:{'ai-device-token':String(fresh.deviceToken)}});expect(expired.statusCode,expired.body).toBe(410);
 await guest(b);const renewed=await bootstrap(b);expect(await subject(renewed)).not.toBe(newPrincipal);
 expect((await h.db.pool.query('SELECT successes FROM ai_quota WHERE subject=$1',[principal])).rows).toEqual([{successes:10}]);
 expect((await h.db.pool.query('SELECT successes FROM ai_quota WHERE subject=$1',[newPrincipal])).rows).toEqual([{successes:1}]);
});
