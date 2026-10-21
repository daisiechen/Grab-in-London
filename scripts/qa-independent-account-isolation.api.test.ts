import {randomBytes,randomUUID} from 'node:crypto';
import {afterAll,beforeAll,expect,inject,it} from 'vitest';
import {AssistantRuntime,emptyPreferences,mockProvider} from '../packages/assistant/src/index.ts';
import {BudgetLedger} from '../apps/api/src/assistant/budget.ts';
import {PreferenceService} from '../apps/api/src/assistant/preferences.ts';
import {Browser,createHarness,json,type Harness} from '../apps/api/src/test/harness.ts';
let h:Harness;let release:()=>void=()=>{};let entered=false;let gate:Promise<void>|undefined;
beforeAll(async()=>{
 h=await createHarness(inject('pgServerUrl'),{allowedAreas:[],provider:mockProvider('test',async request=>{if(request.input.includes('HOLD_FOR_DELETION')){entered=true;await gate;}return{parsed:{intent:'SEARCH',patches:[],mealIds:[]},usage:{inputTokens:10,outputTokens:10},providerRequestId:`qa-${randomUUID()}`};}),price:{version:'synthetic-only',verified:true,inputMicroCnyPerMillion:1_000_000n,outputMicroCnyPerMillion:1_000_000n,validUntil:Date.now()+60000},countInputTokens:()=>1024});
 const {rows:[p]}=await h.db.pool.query("SELECT 'D:'||to_char(clock_timestamp() AT TIME ZONE 'Europe/London','YYYY-MM-DD') d,'M:'||to_char(clock_timestamp() AT TIME ZONE 'Europe/London','YYYY-MM') m");const ledger=new BudgetLedger(h.db.pool);await ledger.configure(p.d,10_000_000n,100,true);await ledger.configure(p.m,10_000_000n,100,true);
});afterAll(async()=>{await h.close();});

async function boot(b:Browser){const r=await b.request('POST','/v1/ai/sessions',{body:{deviceChallenge:randomBytes(32).toString('base64url')},headers:{'idempotency-key':randomUUID()}});expect(r.statusCode,r.body).toBe(201);return json(r).data;}
async function start(b:Browser,s:{sessionId:string;deviceToken:string;generation:number},input:string){const id=randomUUID();const r=await b.request('POST',`/v1/ai/sessions/${s.sessionId}/requests`,{headers:{'ai-device-token':s.deviceToken,'idempotency-key':id},body:{requestId:id,generation:s.generation,input,sourcePage:'DISCOVER',queryVersion:'0',preferenceVersion:'1',contextVersion:'0'}});expect(r.statusCode,r.body).toBe(202);return id;}
async function account(){const b=new Browser(h),login=await b.signInWithEmail(`${randomUUID()}@example.invalid`),id=login.body.data.session.user.id as string;const fields={...emptyPreferences(),budgetMaxPence:3500};await new PreferenceService(h.db.pool,new AssistantRuntime(),[]).replace(id,'0',fields,true);return{b,id,fields};}
it('QA-AI-032 A logout preserves account preferences while B cannot see A session context or inherit preferences',async()=>{
 const a=await account(),s=await boot(a.b),marker='ONLY_A_CONTEXT_'+randomUUID(),id=await start(a.b,s,marker);const headers={'ai-device-token':s.deviceToken};
 const stop=performance.now()+5000;for(;;){const r=await a.b.request('GET',`/v1/ai/requests/${id}?sessionId=${s.sessionId}&generation=${s.generation}`,{headers});expect(r.statusCode,r.body).toBe(200);if(json(r).data.state!=='PENDING')break;if(performance.now()>stop)throw Error('controlled turn timeout');await new Promise<void>(r=>setImmediate(r));}
 expect((await a.b.request('GET',`/v1/ai/sessions/${s.sessionId}`,{headers})).body).toContain(marker);expect((await a.b.request('POST','/v1/auth/logout',{body:{clientRequestId:randomUUID()}})).statusCode).toBe(204);a.b.csrf=null;
 const second=await a.b.signInWithEmail(`${randomUUID()}@example.invalid`);expect(second.body.data.session.user.id).not.toBe(a.id);const b=await boot(a.b),text=await a.b.request('GET',`/v1/ai/sessions/${b.sessionId}`,{headers:{'ai-device-token':b.deviceToken}});expect(json(text).data.turns).toEqual([]);expect(text.body).not.toContain(marker);expect(json(await a.b.request('GET','/v1/ai/preferences')).data.fields).toEqual(emptyPreferences());
 expect((await a.b.request('GET',`/v1/ai/sessions/${s.sessionId}`,{headers})).statusCode).toBe(410);expect((await h.db.pool.query('SELECT fields FROM ai_preferences WHERE user_id=$1',[a.id])).rows[0].fields).toEqual(a.fields);
});
it('QA-AI-032 accepted deletion clears preferences/context and late controlled provider result cannot publish',async()=>{
 const a=await account(),s=await boot(a.b);gate=new Promise<void>(r=>{release=r;});entered=false;const id=await start(a.b,s,'HOLD_FOR_DELETION');
 try{const stop=performance.now()+5000;while(!entered){if(performance.now()>stop)throw Error('provider was not entered');await new Promise<void>(r=>setImmediate(r));}
 const r=await a.b.request('POST','/v1/me/deletion',{headers:{'idempotency-key':randomUUID(),'if-match':'"1"'},body:{confirm:true,receiptToken:randomBytes(32).toString('base64url')}});expect(r.statusCode,r.body).toBe(202);
 expect((await h.db.pool.query('SELECT fields,confirmed_at FROM ai_preferences WHERE user_id=$1',[a.id])).rows[0]).toEqual({fields:emptyPreferences(),confirmed_at:null});expect((await h.db.pool.query('SELECT status FROM ai_session_meta WHERE id=$1',[s.sessionId])).rows[0].status).toBe('INVALIDATED');
 }finally{release();gate=undefined;}
 const stop=performance.now()+5000;for(;;){const row=(await h.db.pool.query('SELECT state FROM ai_requests WHERE request_id=$1',[id])).rows[0];if(row.state!=='PENDING'){expect(row.state).not.toBe('SUCCEEDED');break;}if(performance.now()>stop)throw Error('late provider did not settle');await new Promise<void>(r=>setImmediate(r));}
 expect((await a.b.request('GET',`/v1/ai/sessions/${s.sessionId}`,{headers:{'ai-device-token':s.deviceToken}})).statusCode).not.toBe(200);
});
