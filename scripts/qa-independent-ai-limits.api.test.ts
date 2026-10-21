/** Server limits with real PG, controlled provider and actual DeepSeek response adapter (fetch stub, no network). */
import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,expect,inject,it} from 'vitest';
import {migrate} from '../packages/db/src/index.ts';
import {createMigratedDatabase,type MigratedDatabase} from '../packages/testkit/src/db/index.ts';
import {AssistantRuntime,deepSeekProvider,emptyPreferences,type ModelInput,type ModelProvider,type SessionBinding} from '../packages/assistant/src/index.ts';
import {AssistantController,type AssistantTurn} from '../apps/api/src/assistant/controller.ts';
import {SessionService} from '../apps/api/src/assistant/sessions.ts';
let db:MigratedDatabase;beforeAll(async()=>{db=await createMigratedDatabase(inject('pgServerUrl'),migrate);});afterAll(async()=>db.drop());
async function setup(tokenCount=1024,adapter?:ModelProvider){
 const user=randomUUID();await db.pool.query('INSERT INTO users(id) VALUES($1)',[user]);const runtime=new AssistantRuntime(),sessions=new SessionService(db.pool,runtime),calls:ModelInput[]=[];
 const provider:ModelProvider={generate:async input=>{calls.push(input);return adapter?adapter.generate(input):{parsed:{intent:'SEARCH',patches:[],mealIds:[]},usage:{inputTokens:10,outputTokens:10},providerRequestId:randomUUID()};}};
 const c=new AssistantController({pool:db.pool,sessions,secret:'synthetic-input-limits-test-key-012345',allowedAreas:[],provider,price:{version:'synthetic-not-real-price',verified:true,inputMicroCnyPerMillion:1000000n,outputMicroCnyPerMillion:1000000n,validUntil:Date.now()+60000},countInputTokens:()=>tokenCount});
 const pref=await c.preferences.replace(user,'0',emptyPreferences(),true),subject=`user:${user}`,s=await sessions.create(subject),b:SessionBinding={subject,deviceToken:s.deviceToken,generation:1,preferenceEpoch:pref.epoch};
 const periods=(await db.pool.query("SELECT 'D:'||to_char(clock_timestamp() AT TIME ZONE 'Europe/London','YYYY-MM-DD') day_period,'M:'||to_char(clock_timestamp() AT TIME ZONE 'Europe/London','YYYY-MM') month_period")).rows[0];await c.budget.configure(periods.day_period,10000000n,100,true);await c.budget.configure(periods.month_period,10000000n,100,true);
 const turn=(input:string):AssistantTurn=>({requestId:randomUUID(),generation:1,input,sourcePage:'DISCOVER',queryVersion:'0',preferenceVersion:'1',contextVersion:'0'});
 return{c,s,b,calls,turn};
}
async function terminal(h:Awaited<ReturnType<typeof setup>>,id:string){const end=Date.now()+5000;for(;;){const r=await h.c.status(h.s.id,h.b,id);if(r.state!=='PENDING')return r;if(Date.now()>end)throw Error('controlled limit request did not settle');await new Promise<void>(r=>setImmediate(r));}}
it('QA-AI-045 blank and 2001 characters do not dispatch; exactly2000 is admitted with at most30s durable deadline',async()=>{
 const h=await setup();for(const text of['   ','x'.repeat(2001)])await expect(h.c.request(h.s.id,h.b,h.turn(text))).rejects.toMatchObject({code:'AI_CONFLICT'});expect(h.calls).toHaveLength(0);
 const turn=h.turn('x'.repeat(2000));await h.c.request(h.s.id,h.b,turn);expect((await terminal(h,turn.requestId)).state).toBe('SUCCEEDED');expect(h.calls).toHaveLength(1);
 const row=(await db.pool.query('SELECT extract(epoch FROM deadline-created_at)*1000 duration FROM ai_requests WHERE request_id=$1',[turn.requestId])).rows[0];expect(Number(row.duration)).toBeGreaterThan(29900);expect(Number(row.duration)).toBeLessThanOrEqual(30000);
});
it('QA-AI-045 input token16001 fails before provider dispatch and releases successful slot',async()=>{
 const h=await setup(16001),turn=h.turn('Find meals');await h.c.request(h.s.id,h.b,turn);const result=await terminal(h,turn.requestId);expect(result.state).toBe('FAILED');expect(result.result).toBeNull();expect(h.calls).toHaveLength(0);
 expect((await db.pool.query('SELECT successes,reserved_success_slots FROM ai_quota WHERE subject=$1',[h.b.subject])).rows[0]).toEqual({successes:0,reserved_success_slots:0});
});
it('QA-AI-045 actual adapter rejects output2001tokens, charges known usage and exposes no actionable fragment',async()=>{
 let fetches=0;const adapter=deepSeekProvider({enabled:true,apiKey:'synthetic-placeholder-not-a-key',model:'synthetic-test-model',modelVerified:true,priceVersion:'synthetic-only',fetch:async()=>{fetches++;return new Response(JSON.stringify({id:'qa-overflow',usage:{prompt_tokens:10,completion_tokens:2001},choices:[{finish_reason:'stop',message:{content:JSON.stringify({intent:'SEARCH',patches:[],mealIds:[]})}}]}),{status:200,headers:{'content-type':'application/json'}});}});
 const h=await setup(1024,adapter),turn=h.turn('Find meals');await h.c.request(h.s.id,h.b,turn);const result=await terminal(h,turn.requestId);expect(result.state).toBe('FAILED');expect(result.result).toBeNull();expect(fetches).toBe(1);expect(h.calls[0]?.maxOutputTokens).toBe(2000);
 expect((await db.pool.query('SELECT state,actual_micro_cny FROM ai_calls WHERE request_id=$1',[turn.requestId])).rows).toEqual([{state:'KNOWN',actual_micro_cny:'2011'}]);
 expect((await db.pool.query('SELECT successes,reserved_success_slots FROM ai_quota WHERE subject=$1',[h.b.subject])).rows[0]).toEqual({successes:0,reserved_success_slots:0});
});
