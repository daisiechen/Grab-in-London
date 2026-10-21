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
beforeAll(async()=>{db=await createMigratedDatabase(inject('pgServerUrl'),migrate);});afterAll(async()=>{await db.drop();});
beforeEach(async()=>{await db.pool.query('TRUNCATE meals CASCADE');userId=randomUUID();hostId=randomUUID();await db.pool.query(`INSERT INTO users(id) VALUES($1),($2)`,[userId,hostId]);});
const plan=(intent:string,patches:unknown[]=[],mealIds:string[]=[])=>({intent,patches,mealIds});
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
async function meal(budget=3000){
 const id=randomUUID();const venue=randomUUID();const starts=new Date(Date.now()+2*86400_000);const closes=new Date(starts.getTime()-3600_000);
 await db.pool.query(`INSERT INTO venues(id,place_id,provider,area_code) VALUES($1,$2,'fixture','soho')`,[venue,`synthetic-${venue}`]);
 await db.pool.query(`INSERT INTO meals(id,host_id,venue_ref,title,description,starts_at,closes_at,scheduled_end_at,start_local_date,start_local_time,start_offset,close_local_date,close_local_time,close_offset,minimum,capacity,budget_min_pence,budget_max_pence,languages,mood,area_code,booking_mode,terms_version,attempt_id)
 VALUES($1,$2,$3,'Synthetic Friday dinner','A relaxed synthetic fixture for local tests only.',$4,$5,$6,$7,'19:00',0,$7,'18:00',0,2,4,1000,$8,ARRAY['en'],'EASY_CONVERSATION','soho','EXTERNAL_PAY_AT_VENUE','2026-10-21',$9)`,[id,hostId,venue,starts,closes,new Date(starts.getTime()+7200_000),new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(starts),budget,randomUUID()]);
 return id;
}
const noWrites=async()=>({applications:Number((await db.pool.query('SELECT count(*) n FROM applications')).rows[0].n),messages:Number((await db.pool.query('SELECT count(*) n FROM messages')).rows[0].n),meals:Number((await db.pool.query('SELECT count(*) n FROM meals')).rows[0].n)});


const patch=(field:string,value:unknown,source:string,op='SET')=>({field,op,value,source});
it('QA-AI-003 CLEAR survives later UNSET and suppresses saved budget ranking without mutating page filters',async()=>{
 const cheap=await meal(3500),costly=await meal(4500);await db.pool.query("UPDATE meals SET starts_at=starts_at-interval '1 minute',scheduled_end_at=scheduled_end_at-interval '1 minute' WHERE id=$1",[costly]);
 const h=await setup([plan('SEARCH',[patch('budgetMaxPence',3500,'£35')]),plan('SEARCH',[patch('budgetMaxPence',null,'any budget','CLEAR')]),plan('SEARCH',[patch('dates',[], 'tomorrow')])],{...emptyPreferences(),budgetMaxPence:3500});
 const applied={areas:['soho']};const a=await h.run(h.turn('under £35',{appliedFilters:applied}));expect(a.result!.cards.map(c=>c.mealId)).toEqual([cheap]);
 const b=await h.run(h.turn('any budget',{appliedFilters:applied}));expect(b.result!.cards.map(c=>c.mealId)).toEqual([costly,cheap]);
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London'}).format(new Date(Date.now()+86400_000));await db.pool.query('UPDATE meals SET start_local_date=$1',[date]);
 const c=await h.run(h.turn('tomorrow',{appliedFilters:applied}));expect(c.result!.cards.map(c=>c.mealId)).toEqual([costly,cheap]);expect(applied).toEqual({areas:['soho']});
 expect(h.runtime.conditions(h.s.id,h.b)).toMatchObject({hard:{dates:[date]},cleared:['budgetMaxPence']});
});
it('QA-AI-004 only table size changes while prior explicit area/date remain and capacity includes host',async()=>{
 const id=await meal();const h=await setup([plan('SEARCH',[patch('areas',['soho'],'soho'),patch('dates',[],'tomorrow')]),plan('SEARCH',[patch('tableSizes',[4],'4 people')])]);
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London'}).format(new Date(Date.now()+86400_000));await db.pool.query('UPDATE meals SET start_local_date=$2 WHERE id=$1',[id,date]);
 await h.run(h.turn('soho tomorrow'));const result=await h.run(h.turn('4 people'));expect(result.result!.cards.map(c=>c.mealId)).toEqual([id]);
 expect(h.runtime.conditions(h.s.id,h.b).hard).toEqual({areas:['soho'],dates:[date],tableSizes:[4]});expect(result.result!.cards[0]!.capacity).toBe(4);
});
it('QA-AI-005 the soft winner at source position21 is ranked before truncating20 and cards cap3',async()=>{
 const ids=[];for(let n=0;n<21;n++)ids.push(await meal(4500));const winner=ids[20]!;
 await db.pool.query("UPDATE meals SET starts_at=starts_at+interval '1 hour',scheduled_end_at=scheduled_end_at+interval '1 hour',budget_max_pence=3500 WHERE id=$1",[winner]);
 const h=await setup([plan('SEARCH')],{...emptyPreferences(),budgetMaxPence:3500});const r=await h.run(h.turn('Find options'));expect(r.result!.cards).toHaveLength(3);expect(r.result!.cards[0]!.mealId).toBe(winner);
});
it('QA-AI-006 unknown diet is excluded by vegan hard but remains eligible under Any with zero vegan soft match',async()=>{
 const u=await meal(),v=await meal();await db.pool.query("UPDATE meals SET dietary_codes=ARRAY['VEGAN'] WHERE id=$1",[v]);
 const h=await setup([plan('SEARCH',[patch('dietaryCodes',['VEGAN'],'vegan')]),plan('SEARCH',[patch('dietaryCodes',null,'any diet','CLEAR')])],{...emptyPreferences(),dietaryCodes:['VEGAN']});
 const a=await h.run(h.turn('vegan'));expect(a.result!.cards.map(c=>c.mealId)).toEqual([v]);const b=await h.run(h.turn('any diet'));expect(b.result!.cards.map(c=>c.mealId).sort()).toEqual([u,v].sort());expect(JSON.stringify(b.result)).not.toMatch(/allergy.safe|allergen.free/i);
});
it('QA-AI-007 Spanish alone clarifies before an explicit language Spanish becomes es',async()=>{
 const h=await setup([plan('SEARCH'),plan('SEARCH',[patch('languages',['es'],'language Spanish')])]);const a=await h.run(h.turn('Spanish'));expect(a.state).toBe('NEEDS_INPUT');expect(a.result!.cards).toEqual([]);expect(h.runtime.conditions(h.s.id,h.b).hard).toEqual({});
 const b=await h.run(h.turn('language Spanish'));expect(b.state).toBe('SUCCEEDED');expect(h.runtime.conditions(h.s.id,h.b).hard).toEqual({languages:['es']});
});
it('QA-AI-008 cheaper must offer a budget clarification without changing existing area/date/budget',async()=>{
 const h=await setup([plan('SEARCH',[patch('areas',['soho'],'soho'),patch('dates',[],'tomorrow'),patch('budgetMaxPence',3500,'£35')]),plan('SEARCH')]);await h.run(h.turn('soho tomorrow £35'));const before=h.runtime.conditions(h.s.id,h.b);const r=await h.run(h.turn('cheaper please'));expect(r.state).toBe('NEEDS_INPUT');expect(h.runtime.conditions(h.s.id,h.b)).toEqual(before);expect(r.result!.replyText).toMatch(/budget|£|pounds/i);
});
it.each(['PENDING','CONFIRMED','DECLINED','WITHDRAWN'])('QA-AI-046 %s exclusion and explicit own state explanation',async state=>{
 const m=await meal();await db.pool.query('INSERT INTO applications(meal_id,user_id,round,state,message) VALUES($1,$2,1,$3,$4)',[m,userId,state,'SYNTHETIC_PRIVATE_TEXT']);const h=await setup([plan('SEARCH'),plan('EXPLAIN',[],[m])]);const a=await h.run(h.turn('Find options'));expect(a.result!.cards.map(c=>c.mealId)).toEqual(state==='WITHDRAWN'?[m]:[]);
 const b=await h.run(h.turn('Explain selected meal',{explicitMealId:m}));expect(b.result!.replyText).toContain(state);expect(JSON.stringify(b.result)).not.toContain('SYNTHETIC_PRIVATE_TEXT');
});
it('QA-AI-047 exactly one unknown-soft candidate yields exactly that card and no invented IDs',async()=>{
 const m=await meal();const h=await setup([plan('SEARCH')],{...emptyPreferences(),dietaryCodes:['VEGAN'],languages:['es']});const r=await h.run(h.turn('Find options'));expect(r.state).toBe('SUCCEEDED');expect(r.result!.cards.map(c=>c.mealId)).toEqual([m]);
});
it.each(['Explain this meal','解释这顿饭'])('QA-AI-048 no current explicit target clarifies in current input language: %s',async input=>{
 const m=await meal(),h=await setup([plan('EXPLAIN',[],[m]),plan('EXPLAIN')]);await h.run(h.turn('Explain selected meal',{explicitMealId:m}));const r=await h.run(h.turn(input));expect(r.result!.cards).toEqual([]);expect(r.result).not.toHaveProperty('draft');if(/[\u4e00-\u9fff]/.test(input))expect(r.result!.replyText).toMatch(/[\u4e00-\u9fff]/);else expect(r.result!.replyText).toMatch(/[A-Za-z]/);
});
it.each([['APPLICATION',301],['CREATE_TITLE',81],['CREATE_DESCRIPTION',1001]])('QA-AI-049 %s length%d cannot produce transferable content',async(kind,n)=>{
 const m=await meal(),create=kind.startsWith('CREATE');const content=kind==='CREATE_TITLE'?{title:'a'.repeat(n),description:'A friendly shared evening for local neighbours.'}:kind==='CREATE_DESCRIPTION'?{title:'Friendly evening',description:'a'.repeat(n)}:{text:'a'.repeat(n)};
 const h=await setup([plan(create?'DRAFT_CREATE':'DRAFT_APPLICATION'),content]),before=await noWrites();const r=await h.run(h.turn('Prepare candidate',{explicitMealId:m}));expect(r.state).toBe('FAILED');expect(r.result).toBeNull();expect(await noWrites()).toEqual(before);
});

import {createDraft} from '../apps/api/src/assistant/drafts.ts';
it('QA-AI-049 group 1001 rejects; application300 group1000 create80/1000 remain within original editor limits',()=>{
 expect(()=>createDraft('GROUP',randomUUID(),'1','0',{text:'a'.repeat(1001)},'')).toThrow('AI_CONFLICT');
 expect(createDraft('GROUP',randomUUID(),'1','0',{text:'a'.repeat(1000)},'').text).toHaveLength(1000);
 expect(createDraft('APPLICATION',randomUUID(),'1','0',{text:'a'.repeat(300)},'').text).toHaveLength(300);
 expect(createDraft('CREATE',null,null,'0',{title:'a'.repeat(80),description:'a'.repeat(1000)},'').fields).toEqual({title:'a'.repeat(80),description:'a'.repeat(1000)});
});
