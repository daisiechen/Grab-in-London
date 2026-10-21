/** QA-AI-039: execute production SQL against an isolated database clock function; never change host/system time. */
import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,expect,inject,it} from 'vitest';
import {migrate} from '../packages/db/src/index.ts';
import {createMigratedDatabase,type MigratedDatabase} from '../packages/testkit/src/db/index.ts';
import {AssistantRuntime,emptyPreferences,mockProvider,type SessionBinding} from '../packages/assistant/src/index.ts';
import {AssistantController,type AssistantTurn} from '../apps/api/src/assistant/controller.ts';
import {SessionService} from '../apps/api/src/assistant/sessions.ts';
let db:MigratedDatabase,pool:MigratedDatabase['pool'],now=0;
beforeAll(async()=>{
 db=await createMigratedDatabase(inject('pgServerUrl'),migrate);
 await db.pool.query("CREATE TABLE public.qa_virtual_clock(id int PRIMARY KEY, instant timestamptz NOT NULL); INSERT INTO public.qa_virtual_clock VALUES(1,'2026-10-24T22:59:59Z'); CREATE SCHEMA qa_clock; CREATE FUNCTION qa_clock.clock_timestamp() RETURNS timestamptz LANGUAGE sql VOLATILE AS 'SELECT instant FROM public.qa_virtual_clock WHERE id=1'");
 const Pool=db.pool.constructor as new(options:{connectionString:string;options:string;max:number})=>MigratedDatabase['pool'];
 pool=new Pool({connectionString:db.url,options:'-c search_path=qa_clock,pg_catalog,public',max:5});
});
afterAll(async()=>{await pool?.end();await db?.drop();});
async function clock(instant:string){now=Date.parse(instant);await db.pool.query('UPDATE public.qa_virtual_clock SET instant=$1 WHERE id=1',[instant]);expect(+(await pool.query('SELECT clock_timestamp() instant')).rows[0].instant).toBe(now);}
async function setup(gate=Promise.resolve()){
 const user=randomUUID();await pool.query('INSERT INTO users(id) VALUES($1)',[user]);
 const runtime=new AssistantRuntime({now:()=>now}),sessions=new SessionService(pool,runtime),calls:string[]=[];
 const c=new AssistantController({pool,sessions,secret:'synthetic-London-quota-only-secret-0123',allowedAreas:[],provider:mockProvider('test',async input=>{calls.push(input.callId);await gate;return{parsed:{intent:'SEARCH',patches:[],mealIds:[]},usage:{inputTokens:10,outputTokens:10},providerRequestId:randomUUID()};}),price:{version:'synthetic-not-real-pricing',verified:true,inputMicroCnyPerMillion:1000000n,outputMicroCnyPerMillion:1000000n,validUntil:Date.now()+300000},countInputTokens:()=>1024});
 const pref=await c.preferences.replace(user,'0',emptyPreferences(),true),subject=`user:${user}`,s=await sessions.create(subject),binding:SessionBinding={subject,deviceToken:s.deviceToken,generation:1,preferenceEpoch:pref.epoch};
 const turn=():AssistantTurn=>({requestId:randomUUID(),generation:1,input:'Find meals',sourcePage:'DISCOVER',queryVersion:'0',preferenceVersion:'1',contextVersion:'0'});
 await c.budget.configure('D:2026-10-24',10000000n,100,true);await c.budget.configure('D:2026-10-25',10000000n,100,true);await c.budget.configure('M:2026-10',10000000n,100,true);
 return{c,s,binding,turn,calls};
}
async function waitFor(condition:()=>Promise<boolean>|boolean){const end=Date.now()+5000;while(!await condition()){if(Date.now()>end)throw Error('controlled quota barrier did not reach target');await new Promise<void>(r=>setImmediate(r));}}
it('QA-AI-039 London midnight completion charges the admission day once despite unchanged UTC date',async()=>{
 await clock('2026-10-24T22:59:59Z');let release!:()=>void;const gate=new Promise<void>(r=>{release=r;}),h=await setup(gate),turn=h.turn();
 try{await h.c.request(h.s.id,h.binding,turn);await waitFor(()=>h.calls.length===1);
  const row=(await pool.query('SELECT quota_date::text,deadline-created_at duration FROM ai_requests WHERE request_id=$1',[turn.requestId])).rows[0];expect(row.quota_date).toBe('2026-10-24');
  await clock('2026-10-24T23:00:01Z');
 }finally{release();}
 await waitFor(async()=>{const r=await h.c.status(h.s.id,h.binding,turn.requestId);return r.state!=='PENDING';});
 expect((await h.c.status(h.s.id,h.binding,turn.requestId)).state).toBe('SUCCEEDED');
 expect((await pool.query('SELECT london_date::text,successes,reserved_success_slots FROM ai_quota WHERE subject=$1',[h.binding.subject])).rows).toEqual([{london_date:'2026-10-24',successes:1,reserved_success_slots:0}]);
 expect((await pool.query('SELECT state,actual_micro_cny FROM ai_calls WHERE request_id=$1',[turn.requestId])).rows).toEqual([{state:'KNOWN',actual_micro_cny:'20'}]);expect(h.calls).toHaveLength(1);
 expect(await h.c.requests.finish(h.binding.subject,turn.requestId,'SUCCEEDED')).toBe(false);
 expect((await pool.query('SELECT successes FROM ai_quota WHERE subject=$1',[h.binding.subject])).rows[0].successes).toBe(1);
});
it('QA-AI-039 repeated London 01:30 across DST does not reset fifty-success daily quota',async()=>{
 await clock('2026-10-25T00:30:00Z');const h=await setup();
 await pool.query("INSERT INTO ai_quota(subject,london_date,successes,minute_start) VALUES($1,'2026-10-25',49,clock_timestamp())",[h.binding.subject]);
 const turn=h.turn();await h.c.request(h.s.id,h.binding,turn);await waitFor(async()=>{const r=await h.c.status(h.s.id,h.binding,turn.requestId);return r.state!=='PENDING';});expect((await h.c.status(h.s.id,h.binding,turn.requestId)).state).toBe('SUCCEEDED');
 const first=(await pool.query("SELECT to_char(clock_timestamp() AT TIME ZONE 'Europe/London','YYYY-MM-DD HH24:MI') local")).rows[0].local;
 await clock('2026-10-25T01:30:00Z');expect((await pool.query("SELECT to_char(clock_timestamp() AT TIME ZONE 'Europe/London','YYYY-MM-DD HH24:MI') local")).rows[0].local).toBe(first);
 const next=await h.c.sessions.create(h.binding.subject),binding={...h.binding,deviceToken:next.deviceToken};
 await expect(h.c.request(next.id,binding,h.turn())).rejects.toMatchObject({code:'AI_QUOTA_EXCEEDED'});
 expect(h.calls).toHaveLength(1);expect((await pool.query('SELECT london_date::text,successes,reserved_success_slots FROM ai_quota WHERE subject=$1',[binding.subject])).rows).toEqual([{london_date:'2026-10-25',successes:50,reserved_success_slots:0}]);
});
