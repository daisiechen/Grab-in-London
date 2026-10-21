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
beforeEach(async()=>{userId=randomUUID();hostId=randomUUID();await db.pool.query(`INSERT INTO users(id) VALUES($1),($2)`,[userId,hostId]);});
const plan=(intent:string,patches:unknown[]=[],mealIds:string[]=[])=>({intent,patches,mealIds});
async function setup(outputs:unknown[],preferences=emptyPreferences(),venueDisplay?:VenueDisplay){
 const captured:string[]=[];const runtime=new AssistantRuntime();const sessions=new SessionService(db.pool,runtime);
 const provider=mockProvider('test',async request=>{captured.push(request.input);return {parsed:outputs.shift(),usage:{inputTokens:10,outputTokens:10},providerRequestId:`synthetic-${randomUUID()}`};});
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

it('QA-AI-015 normal create transfer contains only title/description; repeated transfers never publish',async()=>{
 const h=await setup([plan('DRAFT_CREATE'),{title:'A quiet evening table',description:'A friendly dinner to meet neighbours and share easy conversation.'}]),before=await noWrites();
 const r=await h.run(h.turn('Prepare a meal draft'));expect(r.state).toBe('SUCCEEDED');const d=r.result!.draft!;
 expect(Object.keys(d.fields!).sort()).toEqual(['description','title']);expect(d.targetId).toBeNull();expect(await noWrites()).toEqual(before);
 const input={draftId:d.id,editorKind:'CREATE' as const,targetId:null,editorVersion:'0',replaceConfirmed:false};
 const first=await h.c.transfer(h.s.id,h.b,input);expect(await h.c.transfer(h.s.id,h.b,input)).toEqual(first);
 expect(Object.keys(first.fields!).sort()).toEqual(['description','title']);expect(await noWrites()).toEqual(before);
 for(const forbidden of ['placeId','venueRef','startsAt','closesAt','bookingConfirmed','termsAccepted','reviewConfirmed','payment','publish'])expect(first.fields).not.toHaveProperty(forbidden);
});
it('QA-AI-015 provider cannot inject venue/time/terms or booking confirmation into create candidate',async()=>{
 const h=await setup([plan('DRAFT_CREATE'),{title:'A quiet evening table',description:'A friendly dinner to meet neighbours and share easy conversation.',placeId:'invented-place',startsAt:'2026-10-30T18:00:00Z',termsAccepted:true,bookingConfirmed:true}]),before=await noWrites();
 const r=await h.run(h.turn('Prepare a meal draft'));expect(r.state).toBe('FAILED');expect(r.result).toBeNull();expect(await noWrites()).toEqual(before);
});
it('QA-AI-014 draft generate transfer replacement and replay never submit an application',async()=>{
 const m=await meal(),h=await setup([plan('DRAFT_APPLICATION'),{text:'I would enjoy sharing a relaxed dinner and meeting new neighbours.'}]),before=await noWrites();
 const r=await h.run(h.turn('Draft an introduction',{explicitMealId:m,editorVersion:'5',editorText:'Existing unsent text remains mine.'}));expect(r.state).toBe('SUCCEEDED');expect(await noWrites()).toEqual(before);
 const d=r.result!.draft!,input={draftId:d.id,editorKind:'APPLICATION' as const,targetId:m,editorVersion:'6',replaceConfirmed:false};
 await expect(h.c.transfer(h.s.id,h.b,input)).rejects.toThrow('EDITOR_CONFLICT');expect(await noWrites()).toEqual(before);
 const transferred=await h.c.transfer(h.s.id,h.b,{...input,replaceConfirmed:true});expect(transferred.text).toBe(d.text);expect(transferred.text).not.toContain('Existing unsent');
 expect(await h.c.transfer(h.s.id,h.b,{...input,replaceConfirmed:true})).toEqual(transferred);expect(await noWrites()).toEqual(before);
});
