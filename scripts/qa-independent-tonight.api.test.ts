/** Independent controlled-provider probes. Helpers adapted from controller.db.test.ts; no real AI calls. */
import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,beforeEach,expect,inject,it} from 'vitest';
import {migrate} from '../packages/db/src/index.ts';
import {createMigratedDatabase,type MigratedDatabase} from '../packages/testkit/src/db/index.ts';
import {AssistantRuntime,emptyPreferences,mockProvider,type SessionBinding} from '../packages/assistant/src/index.ts';
import {AssistantController,type AssistantTurn} from '../apps/api/src/assistant/controller.ts';
import {SessionService} from '../apps/api/src/assistant/sessions.ts';
import {type VenueDisplay} from '../apps/api/src/assistant/context.ts';
let db:MigratedDatabase;let userId:string;let hostId:string;
let clock:Awaited<ReturnType<typeof createLocalClock>>;beforeAll(async()=>{db=await createMigratedDatabase(inject('pgServerUrl'),migrate);clock=await createLocalClock(db,{FANCY_LOCAL_ACCEPTANCE:'1',FANCY_LOCAL_CLOCK:'1',FANCY_LOCAL_CLOCK_START:'2026-10-22T18:00:00.000Z'});db.pool=clock.pool;});afterAll(async()=>{await clock.close();await db.drop();});
beforeEach(async()=>{await db.pool.query('TRUNCATE meals CASCADE');userId=randomUUID();hostId=randomUUID();await db.pool.query(`INSERT INTO users(id) VALUES($1),($2)`,[userId,hostId]);});
async function setup(outputs:unknown[],preferences=emptyPreferences(),venueDisplay?:VenueDisplay,gate?:Promise<void>){
 const captured:string[]=[];const runtime=new AssistantRuntime();const sessions=new SessionService(db.pool,runtime);
 const provider=mockProvider('test',async request=>{captured.push(request.input);await gate;return {parsed:outputs.shift(),usage:{inputTokens:10,outputTokens:10},providerRequestId:`synthetic-${randomUUID()}`};});
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

import {createLocalClock} from '../infra/local-clock.ts';
import {londonTime,resolveLondonTime} from '../apps/api/src/meals/time.ts';
async function timed(instant:string){const id=randomUUID(),v=randomUUID(),start=londonTime(new Date(instant)),close=londonTime(new Date(Date.parse(instant)-1800_000));await db.pool.query("INSERT INTO venues(id,place_id,provider) VALUES($1,$2,'fixture')",[v,'synthetic_'+v]);
 await db.pool.query(`INSERT INTO meals(id,host_id,venue_ref,title,description,starts_at,closes_at,scheduled_end_at,start_local_date,start_local_time,start_offset,close_local_date,close_local_time,close_offset,minimum,capacity,budget_min_pence,budget_max_pence,languages,mood,booking_mode,terms_version,attempt_id) VALUES($1,$2,$3,'Independent tonight table','Synthetic future table for exact tonight filtering.',$4,$5,$6,$7,$8,$9,$10,$11,$12,2,4,1000,3500,ARRAY['en'],'EASY_CONVERSATION','EXTERNAL_PAY_AT_VENUE','2026-10-21',$13)`,[id,hostId,v,instant,close.instant,new Date(Date.parse(instant)+7200_000),start.localDate,start.localTime,start.utcOffsetMinutes,close.localDate,close.localTime,close.utcOffsetMinutes,randomUUID()]);return id;}
it('QA-AI-010 fixed London19:00 only future today18-23:59 eligible meals; DST ambiguous/nonexistent times never silently submit',async()=>{
 await timed('2026-10-22T16:30:00Z');await timed('2026-10-22T18:00:00Z');const future=await timed('2026-10-22T19:00:00Z'),late=await timed('2026-10-22T22:30:00Z');await timed('2026-10-23T19:00:00Z');
 const h=await setup([{intent:'SEARCH',patches:[{field:'dates',op:'SET',value:[],source:'tonight'}],mealIds:[]}]);const r=await h.run(h.turn('tonight'));expect(r.state).toBe('SUCCEEDED');expect(r.result!.cards.map(c=>c.mealId)).toEqual([future,late]);
 expect(()=>resolveLondonTime({localDate:'2026-10-25',localTime:'01:30',timeZone:'Europe/London'})).toThrow('Choose BST or GMT');
 expect(resolveLondonTime({localDate:'2026-10-25',localTime:'01:30',timeZone:'Europe/London',utcOffsetMinutes:60}).instant).toBe('2026-10-25T00:30:00.000Z');expect(resolveLondonTime({localDate:'2026-10-25',localTime:'01:30',timeZone:'Europe/London',utcOffsetMinutes:0}).instant).toBe('2026-10-25T01:30:00.000Z');expect(()=>resolveLondonTime({localDate:'2026-03-29',localTime:'01:30',timeZone:'Europe/London'})).toThrow('does not exist');
});
