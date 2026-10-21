/** Independent budget admission and late-publication probes; no real provider calls. */
import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,beforeEach,describe,expect,inject,it} from 'vitest';
import {migrate} from '../packages/db/src/index.ts';
import {createMigratedDatabase,type MigratedDatabase} from '../packages/testkit/src/db/index.ts';
import {AssistantRuntime,ProviderError,emptyPreferences,mockProvider,type SessionBinding} from '../packages/assistant/src/index.ts';
import {AssistantController,type AssistantTurn} from '../apps/api/src/assistant/controller.ts';
import {SessionService} from '../apps/api/src/assistant/sessions.ts';
import {type VenueDisplay} from '../apps/api/src/assistant/context.ts';
let db:MigratedDatabase;let userId:string;let hostId:string;
beforeAll(async()=>{db=await createMigratedDatabase(inject('pgServerUrl'),migrate);});afterAll(async()=>{await db.drop();});
beforeEach(async()=>{userId=randomUUID();hostId=randomUUID();await db.pool.query(`INSERT INTO users(id) VALUES($1),($2)`,[userId,hostId]);});
const plan=(intent:string,patches:unknown[]=[],mealIds:string[]=[])=>({intent,patches,mealIds});
async function setup(outputs:unknown[],preferences=emptyPreferences(),venueDisplay?:VenueDisplay,gate?:Promise<void>){
 const captured:string[]=[];const runtime=new AssistantRuntime();const sessions=new SessionService(db.pool,runtime);
 const provider=mockProvider('test',async request=>{captured.push(request.input);await gate;const output=outputs.shift();if(output instanceof Error)throw output;return {parsed:output,usage:{inputTokens:10,outputTokens:10},providerRequestId:`synthetic-${randomUUID()}`};});
 const c=new AssistantController({pool:db.pool,sessions,secret:'synthetic-hmac-key-for-local-tests-only-123',allowedAreas:['soho'],provider,price:{version:'synthetic-only-CNY',inputMicroCnyPerMillion:1_000_000n,outputMicroCnyPerMillion:1_000_000n,verified:true,validUntil:Date.now()+60_000},countInputTokens:()=>1024,...(venueDisplay?{venueDisplay}:{})});
 const pref=await c.preferences.replace(userId,'0',preferences,true);
 const subject=`user:${userId}`;const s=await sessions.create(subject);const b:SessionBinding={subject,deviceToken:s.deviceToken,generation:1,preferenceEpoch:pref.epoch};
 const {rows:[clock]}=await db.pool.query(`SELECT 'D:'||to_char(clock_timestamp() AT TIME ZONE 'Europe/London','YYYY-MM-DD') day_period,'M:'||to_char(clock_timestamp() AT TIME ZONE 'Europe/London','YYYY-MM') month_period`);
 await c.budget.configure(clock.day_period,10_000_000n,100,true);await c.budget.configure(clock.month_period,10_000_000n,100,true);
 const turn=(input:string,extra:Partial<AssistantTurn>={}):AssistantTurn=>({requestId:randomUUID(),generation:1,input,sourcePage:'DISCOVER',queryVersion:'0',preferenceVersion:'1',contextVersion:'0',...extra});
 const run=async(input:AssistantTurn)=>{
  await c.request(s.id,b,input);const stop=Date.now()+3000;
  for(;;){const status=await c.status(s.id,b,input.requestId);if(status.state!=='PENDING')return status;if(Date.now()>stop)throw Error('controlled mock turn did not terminate');await new Promise<void>(r=>setImmediate(r));}
 };
 return {c,runtime,s,b,captured,turn,run};
}

async function terminal(h:Awaited<ReturnType<typeof setup>>,id:string){const end=Date.now()+5000;for(;;){const r=await h.c.status(h.s.id,h.b,id);if(r.state!=='PENDING')return r;if(Date.now()>end)throw Error('controlled turn did not settle');await new Promise<void>(r=>setImmediate(r));}}
describe('independent budget shutdown and deadline races',()=>{
 it('QA-AI-043 manual budget disable while provider is in flight blocks late publication',async()=>{
  let release!:()=>void;const gate=new Promise<void>(r=>{release=r;}),h=await setup([plan('SEARCH')],emptyPreferences(),undefined,gate);const turn=h.turn('Find meals');
  try{await h.c.request(h.s.id,h.b,turn);const stop=Date.now()+5000;while(h.captured.length===0){if(Date.now()>stop)throw Error('provider did not enter');await new Promise<void>(r=>setImmediate(r));}await db.pool.query('UPDATE ai_budget SET enabled=false,version=version+1');}finally{release();}
  const r=await terminal(h,turn.requestId);expect(r.state).not.toBe('SUCCEEDED');expect(r.state).not.toBe('NEEDS_INPUT');expect(r.result).toBeNull();expect((await db.pool.query('SELECT successes,reserved_success_slots FROM ai_quota WHERE subject=$1',[h.b.subject])).rows[0]).toEqual({successes:0,reserved_success_slots:0});expect(h.captured).toHaveLength(1);
 });
 it('QA-AI-042 deadline reaper wins before late provider success without republishing or charging successful turn',async()=>{
  let release!:()=>void;const gate=new Promise<void>(r=>{release=r;}),h=await setup([plan('SEARCH')],emptyPreferences(),undefined,gate);const turn=h.turn('Find meals');
  try{await h.c.request(h.s.id,h.b,turn);const stop=Date.now()+5000;while(h.captured.length===0){if(Date.now()>stop)throw Error('provider did not enter');await new Promise<void>(r=>setImmediate(r));}await db.pool.query("UPDATE ai_requests SET deadline=clock_timestamp()-interval '1 millisecond' WHERE subject=$1 AND request_id=$2",[h.b.subject,turn.requestId]);await h.c.requests.expireDeadlines();expect((await terminal(h,turn.requestId)).state).toBe('FAILED');}finally{release();}
  const stop=Date.now()+5000;for(;;){const row=(await db.pool.query('SELECT state FROM ai_calls WHERE request_id=$1',[turn.requestId])).rows[0];if(row?.state==='KNOWN')break;if(Date.now()>stop)throw Error('late usage not accounted');await new Promise<void>(r=>setImmediate(r));}
  const r=await terminal(h,turn.requestId);expect(r.state).toBe('FAILED');expect(r.result).toBeNull();expect((await db.pool.query('SELECT successes,reserved_success_slots FROM ai_quota WHERE subject=$1',[h.b.subject])).rows[0]).toEqual({successes:0,reserved_success_slots:0});expect(await h.c.requests.finish(h.b.subject,turn.requestId,'SUCCEEDED',null,async()=>{throw Error('must not publish');})).toBe(false);
 });
 it('QA-AI-040 second internal call cannot dispatch when call cap only admits parsing, and parsing cost remains charged',async()=>{
  const h=await setup([plan('DRAFT_CREATE'),{title:'Must not be generated',description:'This second mock response must never be requested.'}]);await db.pool.query('UPDATE ai_budget SET call_cap=calls+1');const r=await h.run(h.turn('Prepare a meal draft'));expect(r.state).toBe('FAILED');expect(r.result).toBeNull();expect(h.captured).toHaveLength(1);const calls=(await db.pool.query('SELECT state,actual_micro_cny FROM ai_calls WHERE request_id=$1',[r.requestId])).rows;expect(calls).toEqual([{state:'KNOWN',actual_micro_cny:'20'}]);expect((await db.pool.query('SELECT used_micro_cny,reserved_micro_cny FROM ai_budget')).rows.every(r=>BigInt(r.used_micro_cny)>=20n&&r.reserved_micro_cny==='0')).toBe(true);
 });
});
describe('independent publication stop fence',()=>{
 it('QA-F04 budget disabled after usage settlement but before finish cannot publish',async()=>{
  const h=await setup([plan('SEARCH')]);const finish=h.c.requests.finish.bind(h.c.requests);let disabled=false;
  h.c.requests.finish=async(...args)=>{if(args[2]==='SUCCEEDED'||args[2]==='NEEDS_INPUT'){await db.pool.query('UPDATE ai_budget SET enabled=false,version=version+1');disabled=true;}return finish(...args);};
  const r=await h.run(h.turn('Find meals'));expect(disabled).toBe(true);expect(r.state).not.toBe('SUCCEEDED');expect(r.state).not.toBe('NEEDS_INPUT');expect(r.result).toBeNull();expect((await db.pool.query('SELECT state,actual_micro_cny FROM ai_calls WHERE request_id=$1',[r.requestId])).rows).toEqual([{state:'KNOWN',actual_micro_cny:'20'}]);expect((await db.pool.query('SELECT successes,reserved_success_slots FROM ai_quota WHERE subject=$1',[h.b.subject])).rows[0]).toEqual({successes:0,reserved_success_slots:0});
 });
});
describe('independent global monetary admission and failure usage',()=>{
 it('QA-AI-040 two subjects compete for one maximum-cost monetary reservation with only one provider dispatch',async()=>{
  let release!:()=>void;const gate=new Promise<void>(r=>{release=r;}),first=await setup([plan('SEARCH')],emptyPreferences(),undefined,gate);userId=randomUUID();await db.pool.query('INSERT INTO users(id) VALUES($1)',[userId]);const second=await setup([plan('SEARCH')],emptyPreferences(),undefined,gate);
  await db.pool.query('UPDATE ai_budget SET cap_micro_cny=used_micro_cny+reserved_micro_cny+3024');const a=first.turn('Find meals'),b=second.turn('Find meals');
  try{await Promise.all([first.c.request(first.s.id,first.b,a),second.c.request(second.s.id,second.b,b)]);const stop=Date.now()+5000;for(;;){const rows=(await db.pool.query('SELECT state FROM ai_requests WHERE request_id=ANY($1::uuid[])',[[a.requestId,b.requestId]])).rows;if(rows.some(r=>r.state==='FAILED')&&first.captured.length+second.captured.length===1)break;if(Date.now()>stop)throw Error('budget race did not settle');await new Promise<void>(r=>setImmediate(r));}expect((await db.pool.query('SELECT used_micro_cny+reserved_micro_cny<=cap_micro_cny safe FROM ai_budget')).rows.every(r=>r.safe)).toBe(true);}finally{release();}
  const results=await Promise.all([terminal(first,a.requestId),terminal(second,b.requestId)]);expect(results.map(r=>r.state).sort()).toEqual(['FAILED','SUCCEEDED']);expect(first.captured.length+second.captured.length).toBe(1);expect((await db.pool.query('SELECT state,actual_micro_cny FROM ai_calls WHERE request_id=ANY($1::uuid[])',[[a.requestId,b.requestId]])).rows).toEqual([{state:'KNOWN',actual_micro_cny:'20'}]);
 });
 for(const known of [false,true])it(`QA-AI-041 failed provider knownUsage=${known} retains liability without successful turn or resend`,async()=>{
  const error=known?new ProviderError('PROVIDER_INVALID_RESULT','KNOWN',{inputTokens:10,outputTokens:10},'qa-known-failure'):new ProviderError('PROVIDER_TIMEOUT');const h=await setup([error]),turn=h.turn('Find meals'),r=await h.run(turn);expect(r.state).toBe('FAILED');expect(r.result).toBeNull();expect((await db.pool.query('SELECT successes,reserved_success_slots FROM ai_quota WHERE subject=$1',[h.b.subject])).rows[0]).toEqual({successes:0,reserved_success_slots:0});const calls=(await db.pool.query('SELECT call_id,state,max_micro_cny,actual_micro_cny FROM ai_calls WHERE request_id=$1',[turn.requestId])).rows;expect(calls).toHaveLength(1);expect(calls[0]).toMatchObject({state:known?'KNOWN':'UNKNOWN',actual_micro_cny:known?'20':null,max_micro_cny:'3024'});await h.c.budget.recoverAfterRestart();await h.c.requests.recoverAfterRestart();await h.c.request(h.s.id,h.b,turn);expect(h.captured).toHaveLength(1);expect(await h.c.budget.dispatch(calls[0].call_id)).toBe(false);expect((await db.pool.query('SELECT state FROM ai_calls WHERE call_id=$1',[calls[0].call_id])).rows[0].state).toBe(known?'KNOWN':'UNKNOWN');
 });
});
