import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,beforeEach,expect,inject,it,vi} from 'vitest';
import {migrate} from '@fancy/db';
import {createMigratedDatabase,type MigratedDatabase} from '@fancy/testkit/db';
import {AssistantRuntime,emptyPreferences,mockProvider,type SessionBinding} from '../../../../packages/assistant/src/index.ts';
import {AssistantController,type AssistantTurn} from './controller.ts';
import {SessionService,createGuest} from './sessions.ts';
import {type VenueDisplay} from './context.ts';
let db:MigratedDatabase;let userId:string;let hostId:string;
beforeAll(async()=>{db=await createMigratedDatabase(inject('pgServerUrl'),migrate);});afterAll(async()=>{await db.drop();});
beforeEach(async()=>{userId=randomUUID();hostId=randomUUID();await db.pool.query(`INSERT INTO users(id) VALUES($1),($2)`,[userId,hostId]);});
const plan=(intent:string,patches:unknown[]=[],mealIds:string[]=[])=>({intent,patches,mealIds});
async function setup(outputs:unknown[],preferences=emptyPreferences(),venueDisplay?:VenueDisplay){
 const captured:string[]=[];const runtime=new AssistantRuntime();const sessions=new SessionService(db.pool,runtime);
 const provider=mockProvider('test',async request=>{captured.push(request.input);const next=outputs.shift();return {parsed:typeof next==='function'?await next():next,usage:{inputTokens:10,outputTokens:10},providerRequestId:`synthetic-${randomUUID()}`};});
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

async function profile(){await db.pool.query(`INSERT INTO profiles(user_id,display_name,bio,languages,interests,background) VALUES($1,'Public Name','I study design. PUBLIC_BIO_MARKER.',ARRAY['en'],ARRAY['FOOD'],'{"privateNote":"PRIVATE_BACKGROUND_MARKER"}')`,[userId]);await db.pool.query(`INSERT INTO private_contact(user_id,email,email_verified_at) VALUES($1,'private-profile-marker@example.invalid',clock_timestamp())`,[userId]);}
it('uses only this-turn explicitly authorized four public fields and never inherits authorization',async()=>{
 await profile();const m=await meal();const h=await setup([plan('SEARCH'),plan('DRAFT_APPLICATION'),{text:'I study design. It would be nice to join your table.'},plan('SEARCH')]);
 expect((await h.run(h.turn('Find meals'))).state).toBe('SUCCEEDED');expect(h.captured.join('')).not.toContain('PUBLIC_BIO_MARKER');
 expect((await h.run(h.turn('Please use my public profile introduction, name, languages and interests to draft my application.',{explicitMealId:m}))).state).toBe('SUCCEEDED');
 const draftInput=h.captured[2]!;for(const value of ['PUBLIC_BIO_MARKER','Public Name','FOOD'])expect(draftInput).toContain(value);
 for(const value of ['PRIVATE_BACKGROUND_MARKER','private-profile-marker@example.invalid'])expect(h.captured.join('')).not.toContain(value);
 expect((await h.run(h.turn('Find meals'))).state).toBe('SUCCEEDED');expect(h.captured[3]).not.toContain('PUBLIC_BIO_MARKER');expect(h.captured[3]).not.toContain('Public Name');
});
it('editor and history alone never authorize reading own introduction',async()=>{
 await profile();const m=await meal();const h=await setup([plan('DRAFT_APPLICATION'),{text:'Would be happy to meet everyone at your table.'}]);
 expect((await h.run(h.turn('Draft my application',{explicitMealId:m,editorText:'Please use my public profile introduction.'}))).state).toBe('SUCCEEDED');expect(h.captured.join('')).not.toContain('PUBLIC_BIO_MARKER');
});

it.each(['version','fields'] as const)('profile %s change while generation is in flight supersedes rather than publishing',async(change)=>{
 await profile();const m=await meal();let release!:()=>void,entered=false;const gate=new Promise<void>(resolve=>{release=resolve;});
 const h=await setup([plan('DRAFT_APPLICATION'),async()=>{entered=true;await gate;return {text:'Would be nice to meet new people at your table.'};}]);
 const running=h.run(h.turn('Use my introduction to draft an application',{explicitMealId:m}));
 const stop=Date.now()+3000;while(!entered){if(Date.now()>stop)throw Error('provider did not enter');await new Promise<void>(r=>setImmediate(r));}
 if(change==='version')await db.pool.query('UPDATE users SET version=version+1 WHERE id=$1',[userId]);
 else await db.pool.query(`UPDATE profiles SET bio='An updated public biography for the active request.' WHERE user_id=$1`,[userId]);
 release();const result=await running;expect(result.state).toBe('SUPERSEDED');expect(result.result).toBeNull();
});
it('explicit guest request cannot read another user profile',async()=>{
 await profile();const m=await meal();const h=await setup([plan('DRAFT_APPLICATION')]);
 const guest=await createGuest(db.pool),subject=`guest:${guest.id}`,s=await h.c.sessions.create(subject),binding={subject,deviceToken:s.deviceToken,generation:1,preferenceEpoch:'0'};
 const turn=h.turn('Please use my introduction to write an application',{explicitMealId:m,preferenceVersion:'0'});
 await h.c.request(s.id,binding,turn);let result=await h.c.status(s.id,binding,turn.requestId);const end=Date.now()+3000;
 while(result.state==='PENDING'){if(Date.now()>end)throw Error('guest turn did not finish');await new Promise<void>(r=>setImmediate(r));result=await h.c.status(s.id,binding,turn.requestId);}
 expect(result.result?.draft).toBeUndefined();expect(h.captured).toHaveLength(1);expect(h.captured.join('')).not.toContain('PUBLIC_BIO_MARKER');
});
it('profile SQL failure fails closed without generating biography',async()=>{
 await profile();const m=await meal(),h=await setup([plan('DRAFT_APPLICATION')]);const original=db.pool.query.bind(db.pool);
 const spy=vi.spyOn(db.pool,'query').mockImplementation((...args:Parameters<typeof db.pool.query>)=>{
  if(typeof args[0]==='string'&&args[0].startsWith('SELECT u.version::text,p.display_name'))throw Error('controlled projection failure');
  return original(...args);
 });
 try{const result=await h.run(h.turn('Use my bio to draft an application',{explicitMealId:m}));expect(result.state).toBe('FAILED');expect(result.result).toBeNull();expect(h.captured).toHaveLength(1);}finally{spy.mockRestore();}
});
it('a name containing a profession cannot authorize invented job or completion claims',async()=>{
 await profile();await db.pool.query(`UPDATE profiles SET display_name='I work at BigCorp' WHERE user_id=$1`,[userId]);const m=await meal();
 const h=await setup([plan('DRAFT_APPLICATION'),{text:'I work at BigCorp. Looking forward to your table.'},plan('DRAFT_APPLICATION'),{text:'Your meal is booked and paid. See you there.'}]);
 for(let i=0;i<2;i++){const result=await h.run(h.turn('Use my profile to draft an application',{explicitMealId:m}));expect(result.state).toBe('FAILED');expect(result.result).toBeNull();}
});

it('signed-in actor with no profile is asked for their introduction without a draft model call',async()=>{
 const m=await meal(),h=await setup([plan('DRAFT_APPLICATION')]);
 const result=await h.run(h.turn('请用我的公开简介写申请',{explicitMealId:m}));
 expect(result.state).toBe('SUCCEEDED');expect(result.result?.draft).toBeUndefined();expect(result.result?.replyText).toContain('provide your own public introduction');expect(h.captured).toHaveLength(1);
});
