import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {afterAll,beforeAll,expect,inject,it} from 'vitest';
import {AssistantRuntime,emptyPreferences,mockProvider} from '../packages/assistant/src/index.ts';
import {BudgetLedger} from '../apps/api/src/assistant/budget.ts';
import {PreferenceService} from '../apps/api/src/assistant/preferences.ts';
import {TEST_ISSUER} from '../apps/api/src/identity/test-provider.ts';
import {Browser,createHarness,json,type Harness} from '../apps/api/src/test/harness.ts';
let h:Harness;
beforeAll(async()=>{
 h=await createHarness(inject('pgServerUrl'),{allowedAreas:[],provider:mockProvider('test',async()=>({parsed:{intent:'SEARCH',patches:[],mealIds:[]},usage:{inputTokens:10,outputTokens:10},providerRequestId:`qa-${randomUUID()}`})),price:{version:'synthetic-only',verified:true,inputMicroCnyPerMillion:1_000_000n,outputMicroCnyPerMillion:1_000_000n,validUntil:Date.now()+60000},countInputTokens:()=>1024});
 const {rows:[p]}=await h.db.pool.query("SELECT 'D:'||to_char(clock_timestamp() AT TIME ZONE 'Europe/London','YYYY-MM-DD') d,'M:'||to_char(clock_timestamp() AT TIME ZONE 'Europe/London','YYYY-MM') m");const ledger=new BudgetLedger(h.db.pool);await ledger.configure(p.d,10_000_000n,100,true);await ledger.configure(p.m,10_000_000n,100,true);
});afterAll(async()=>{await h.close();});
async function guest(b:Browser){const minted=await b.request('POST','/v1/guest-sessions',{body:{clientRequestId:randomUUID(),client:'WEB'}});expect(minted.statusCode,minted.body).toBe(201);b.csrf=json(minted).data.csrfToken;const token=b.cookies.get('__Host-fancy_guest')!;expect(token).toBeTruthy();return token;}
async function boot(b:Browser){const r=await b.request('POST','/v1/ai/sessions',{body:{deviceChallenge:randomBytes(32).toString('base64url')},headers:{'idempotency-key':randomUUID()}});expect(r.statusCode,r.body).toBe(201);return json(r).data;}
it('QA-AI-033 real Web guest login revokes old context and never migrates preferences; logout creates independent guest',async()=>{
 // Explicit pre-existing confirmed-account fixture; avoid mutating OTP cooldown or authentication clocks.
 const email=`${randomUUID()}@example.invalid`,userId=randomUUID();await h.db.pool.query('INSERT INTO users(id) VALUES($1)',[userId]);await h.db.pool.query('INSERT INTO identities(user_id,issuer,subject,provider,email_verified) VALUES($1,$2,$3,\'EMAIL\',true)',[userId,TEST_ISSUER,'email|'+createHash('sha256').update(email).digest('hex').slice(0,24)]);
 const accountFields={...emptyPreferences(),budgetMaxPence:4500};await new PreferenceService(h.db.pool,new AssistantRuntime(),[]).replace(userId,'0',accountFields,true);
 const b=new Browser(h),oldGuest=await guest(b),s=await boot(b),marker='QA_GUEST_CONTEXT_ONLY_'+randomUUID(),requestId=randomUUID();
 const headers={'ai-device-token':s.deviceToken,'idempotency-key':requestId},body={requestId,generation:s.generation,input:marker,sourcePage:'DISCOVER',queryVersion:'0',preferenceVersion:'0',contextVersion:'0',guestPreferences:{...emptyPreferences(),budgetMaxPence:1500}};
 expect((await b.request('POST',`/v1/ai/sessions/${s.sessionId}/requests`,{body,headers})).statusCode).toBe(202);
 const deadline=performance.now()+5000;for(;;){const r=await b.request('GET',`/v1/ai/requests/${requestId}?sessionId=${s.sessionId}&generation=${s.generation}`,{headers});expect(r.statusCode,r.body).toBe(200);if(json(r).data.state!=='PENDING'){expect(json(r).data.state).toBe('SUCCEEDED');break;}if(performance.now()>deadline)throw Error('controlled provider did not finish');await new Promise<void>(r=>setImmediate(r));}
 const transcript=await b.request('GET',`/v1/ai/sessions/${s.sessionId}`,{headers});expect(transcript.statusCode).toBe(200);expect(transcript.body).toContain(marker);
 const oldSubject=(await h.db.pool.query('SELECT subject FROM ai_session_meta WHERE id=$1',[s.sessionId])).rows[0].subject;
 const login=await b.signInWithEmail(email);expect(login.body.data.session.user.id).toBe(userId);expect(b.cookies.has('__Host-fancy_guest')).toBe(false);
 const saved=await b.request('GET','/v1/ai/preferences');expect(json(saved).data.fields).toEqual(accountFields);expect(json(saved).data.version).toBe('1');
 const account=await boot(b),accountText=await b.request('GET',`/v1/ai/sessions/${account.sessionId}`,{headers:{'ai-device-token':account.deviceToken}});expect(json(accountText).data.turns).toEqual([]);expect(accountText.body).not.toContain(marker);
 const old=await h.app.inject({method:'GET',url:`/v1/ai/sessions/${s.sessionId}`,headers:{authorization:`Bearer ${oldGuest}`,'ai-device-token':s.deviceToken}});expect(old.statusCode,old.body).toBe(410);
 const logout=await b.request('POST','/v1/auth/logout',{body:{clientRequestId:randomUUID()}});expect(logout.statusCode,logout.body).toBe(204);b.csrf=null;
 const nextGuest=await guest(b);expect(nextGuest).not.toBe(oldGuest);const next=await boot(b);const nextSubject=(await h.db.pool.query('SELECT subject FROM ai_session_meta WHERE id=$1',[next.sessionId])).rows[0].subject;expect(nextSubject).not.toBe(oldSubject);expect(nextSubject).toMatch(/^guest:/);
 const nextText=await b.request('GET',`/v1/ai/sessions/${next.sessionId}`,{headers:{'ai-device-token':next.deviceToken}});expect(json(nextText).data.turns).toEqual([]);expect(nextText.body).not.toContain(marker);
 expect((await h.db.pool.query('SELECT fields,version FROM ai_preferences WHERE user_id=$1',[userId])).rows).toEqual([{fields:accountFields,version:'1'}]);
 expect((await h.db.pool.query('SELECT count(*)::int n FROM ai_preferences WHERE user_id<>$1',[userId])).rows[0].n).toBe(0);
});
async function native(method:'GET'|'POST',url:string,token?:string,body?:unknown,headers:Record<string,string>={}){return h.app.inject({method,url,headers:{...(token?{authorization:`Bearer ${token}`} :{}),...(body===undefined?{}:{'content-type':'application/json'}),...headers},...(body===undefined?{}:{payload:JSON.stringify(body)})});}
it('QA-AI-033 actual native handoff API revokes guest at exchange and retains existing account preferences',async()=>{
 const email=`${randomUUID()}@example.invalid`,id=randomUUID(),fields={...emptyPreferences(),budgetMaxPence:5500};await h.db.pool.query('INSERT INTO users(id) VALUES($1)',[id]);await h.db.pool.query(`INSERT INTO identities(user_id,issuer,subject,provider,email_verified) VALUES($1,$2,$3,'EMAIL',true)`,[id,TEST_ISSUER,'email|'+createHash('sha256').update(email).digest('hex').slice(0,24)]);await new PreferenceService(h.db.pool,new AssistantRuntime(),[]).replace(id,'0',fields,true);
 const minted=await native('POST','/v1/guest-sessions',undefined,{clientRequestId:randomUUID(),client:'IOS'});expect(minted.statusCode,minted.body).toBe(201);const oldToken=json(minted).data.guestToken;
 const started=await native('POST','/v1/ai/sessions',oldToken,{deviceChallenge:randomBytes(32).toString('base64url')},{'idempotency-key':randomUUID()});expect(started.statusCode,started.body).toBe(201);const s=json(started).data,requestId=randomUUID(),marker='QA_NATIVE_GUEST_ONLY_'+randomUUID(),ai={'ai-device-token':s.deviceToken};
 const request=await native('POST',`/v1/ai/sessions/${s.sessionId}/requests`,oldToken,{requestId,generation:s.generation,input:marker,sourcePage:'DISCOVER',queryVersion:'0',preferenceVersion:'0',contextVersion:'0',guestPreferences:{...emptyPreferences(),budgetMaxPence:1200}},{...ai,'idempotency-key':requestId});expect(request.statusCode,request.body).toBe(202);
 const end=performance.now()+5000;for(;;){const r=await native('GET',`/v1/ai/requests/${requestId}?sessionId=${s.sessionId}&generation=${s.generation}`,oldToken,undefined,ai);expect(r.statusCode,r.body).toBe(200);if(json(r).data.state!=='PENDING'){expect(json(r).data.state).toBe('SUCCEEDED');break;}if(performance.now()>end)throw Error('controlled provider did not finish');await new Promise<void>(r=>setImmediate(r));}
 const verifier=randomBytes(48).toString('base64url'),appChallenge=createHash('sha256').update(verifier).digest('base64url');
 const otp=await native('POST','/v1/auth/email/start',undefined,{clientRequestId:randomUUID(),email,client:'IOS'});expect(otp.statusCode,otp.body).toBe(201);const verified=await native('POST','/v1/auth/email/verify',undefined,{clientRequestId:randomUUID(),challengeId:json(otp).data.challengeId,code:h.idp.inbox.get(email)!.at(-1),appChallenge});expect(verified.statusCode,verified.body).toBe(200);
 expect((await native('GET',`/v1/ai/sessions/${s.sessionId}`,oldToken,undefined,ai)).statusCode).toBe(200);
 const exchange=await native('POST','/v1/auth/handoff',oldToken,{clientRequestId:randomUUID(),code:json(verified).data.handoffCode,appVerifier:verifier});expect(exchange.statusCode,exchange.body).toBe(200);const access=json(exchange).data.accessToken;
 expect((await native('GET',`/v1/ai/sessions/${s.sessionId}`,oldToken,undefined,ai)).statusCode).toBe(410);
 const prefs=await native('GET','/v1/ai/preferences',access);expect(json(prefs).data.fields).toEqual(fields);expect(json(prefs).data.version).toBe('1');
 const account=await native('POST','/v1/ai/sessions',access,{deviceChallenge:randomBytes(32).toString('base64url')},{'idempotency-key':randomUUID()});expect(account.statusCode,account.body).toBe(201);const userSession=json(account).data;
 const text=await native('GET',`/v1/ai/sessions/${userSession.sessionId}`,access,undefined,{'ai-device-token':userSession.deviceToken});expect(json(text).data.turns).toEqual([]);expect(text.body).not.toContain(marker);
 expect((await native('POST','/v1/auth/logout',access,{clientRequestId:randomUUID()})).statusCode).toBe(204);
 const next=await native('POST','/v1/guest-sessions',undefined,{clientRequestId:randomUUID(),client:'IOS'});expect(next.statusCode,next.body).toBe(201);const newToken=json(next).data.guestToken;expect(newToken).not.toBe(oldToken);
 const booted=await native('POST','/v1/ai/sessions',newToken,{deviceChallenge:randomBytes(32).toString('base64url')},{'idempotency-key':randomUUID()});expect(booted.statusCode,booted.body).toBe(201);const fresh=json(booted).data;
 const oldSubject=(await h.db.pool.query('SELECT subject FROM ai_session_meta WHERE id=$1',[s.sessionId])).rows[0].subject,newSubject=(await h.db.pool.query('SELECT subject FROM ai_session_meta WHERE id=$1',[fresh.sessionId])).rows[0].subject;expect(newSubject).not.toBe(oldSubject);
 const freshText=await native('GET',`/v1/ai/sessions/${fresh.sessionId}`,newToken,undefined,{'ai-device-token':fresh.deviceToken});expect(json(freshText).data.turns).toEqual([]);expect(freshText.body).not.toContain(marker);expect((await h.db.pool.query('SELECT fields,version FROM ai_preferences WHERE user_id=$1',[id])).rows).toEqual([{fields,version:'1'}]);
});
