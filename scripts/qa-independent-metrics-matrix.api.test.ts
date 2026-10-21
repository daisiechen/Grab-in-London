import {withTransaction} from '../apps/api/src/common/transaction.ts';
/** QA round four: post-meal exact windows and independent message/consent permissions. */
import {randomBytes,randomUUID} from 'node:crypto';
import {afterAll,beforeAll,expect,inject,it} from 'vitest';
import {Browser,createHarness,json,type Harness} from '../apps/api/src/test/harness.ts';
import {createGroupConversation,joinConversation} from '../apps/api/src/membership/intervals.ts';
let h:Harness;
beforeAll(async()=>{h=await createHarness(inject('pgServerUrl'));});afterAll(async()=>h.close());
async function actor(){const b=new Browser(h);const {body}=await b.signInWithEmail(`${randomUUID()}@example.invalid`);return{b,id:body.data.session.user.id as string};}
async function fixture(present=true,endAgoMs=8*86400_000){
 const host=await actor(),guest=await actor(),outsider=await actor();const end=new Date(Date.now()-endAgoMs),start=new Date(+end-7200_000),close=new Date(+start-3600_000);
 const venue=(await h.db.pool.query("INSERT INTO venues(place_id,provider) VALUES($1,'fixture') RETURNING id",['fixture_'+randomUUID()])).rows[0].id;
 const m=(await h.db.pool.query("INSERT INTO meals(host_id,venue_ref,title,description,starts_at,closes_at,scheduled_end_at,start_local_date,start_local_time,start_offset,close_local_date,close_local_time,close_offset,minimum,capacity,budget_min_pence,budget_max_pence,languages,mood,booking_mode,terms_version,attempt_id,status,head) VALUES($1,$2,'QA finished table','Synthetic independent post-meal fixture description',$3,$4,$5,'2026-10-20','19:00',60,'2026-10-20','18:00',60,2,4,1000,2000,ARRAY['en'],'EASY_CONVERSATION','EXTERNAL_PAY_AT_VENUE','2026-10-21',$6,'COMPLETED',2) RETURNING id",[host.id,venue,start,close,end,randomUUID()])).rows[0].id as string;
 for(const[index,user]of[host,guest].entries()){await h.db.pool.query('INSERT INTO seat_events(meal_id,seq,user_id,type,effective_at,command_id) VALUES($1,$2,$3,$4,$5,$6)',[m,index+1,user.id,index?'GUEST_CONFIRMED':'HOST_CONFIRMED',new Date(+close-60_000),randomUUID()]);await h.db.pool.query("INSERT INTO start_roster(meal_id,user_id,source_revision_hash,starts_at) VALUES($1,$2,'qa-independent',$3)",[m,user.id,start]);if(present)await h.db.pool.query("INSERT INTO attendance_revisions(meal_id,subject_id,source,value,version,actor_id,created_at) VALUES($1,$2,'SELF','present',1,$2,$3)",[m,user.id,end]);}
 const group=await withTransaction(h.db.pool,async tx=>{const g=await createGroupConversation(tx,{mealId:m,hostId:host.id,effectiveAt:close});await joinConversation(tx,g.conversationId,guest.id,close);return g.conversationId;});
 return{host,guest,outsider,m,end,group};
}

import {sealSourceSnapshot} from '../apps/api/src/admin/snapshots.ts';
import {loadAdminSnapshot} from '../apps/api/src/admin/pages.ts';
async function support(f:Awaited<ReturnType<typeof fixture>>,role='support'){
 const staff=await actor();await h.db.pool.query("INSERT INTO roles(user_id,role,granted_by) VALUES($1,$2,'qa-fixture')",[staff.id,role]);await h.db.pool.query("UPDATE session_families SET amr=ARRAY['mfa'] WHERE user_id=$1",[staff.id]);
 const c=(await h.db.pool.query("INSERT INTO support_cases(target_type,target_id,details) VALUES('MEAL',$1,'Independent synthetic attendance evidence') RETURNING id",[f.m])).rows[0].id;
 await h.db.pool.query('INSERT INTO support_case_grants(case_id,user_id) VALUES($1,$2)',[c,staff.id]);return{...staff,caseId:c};
}

import {calculateMetrics,type Facts,type Filters,type Meal} from '../apps/api/src/admin/metrics.ts';
import {ANALYTICS_CONSENT_VERSION} from '../apps/api/src/admin/ingest.ts';
const filters:Filters={from:null,to:null,areas:[],languages:[],budgetBands:[],sizes:[],sources:[],segments:[],budgetUpToPence:null};
const asOf='2026-11-01T12:00:00Z';
const metricMeal=(id:string,budget=2000):Meal=>({id,host_id:'h',starts_at:'2026-10-01T12:00:00Z',closes_at:'2026-10-01T11:00:00Z',scheduled_end_at:'2026-10-01T14:00:00Z',minimum:2,capacity:4,budget_max_pence:budget,languages:['en','zh'],area_code:'soho',status:'COMPLETED',cancel_reason:null,created_at:'2026-09-01T00:00:00Z'});
function fact():Facts{return{users:['h','a'].map(id=>({id,created_at:'2026-09-01T00:00:00Z'})),meals:[metricMeal('m')],applications:[],seats:[{meal_id:'m',seq:'1',user_id:'h',application_id:null,type:'HOST_CONFIRMED',effective_at:'2026-09-30T10:00:00Z'},{meal_id:'m',seq:'2',user_id:'a',application_id:null,type:'GUEST_CONFIRMED',effective_at:'2026-09-30T11:00:00Z'}],attendance:['h','a'].map(id=>({meal_id:'m',subject_id:id,source:'SELF',value:'present',version:'1',actor_id:id,created_at:'2026-10-01T15:00:00Z'})),experiences:[],surveys:[],events:[]};}
it('QA-METRIC-011 ratings are person-meal submissions while survey is one latest user with independent multi-select factors',()=>{
 const f=fact();f.experiences=['h','a'].map(id=>({meal_id:'m',user_id:id,score:5,revision:'1',created_at:'2026-10-01T16:00:00Z'}));f.surveys=[{user_id:'a',version:'1',again:true,reasons:['venue','cost'],submitted_at:'2026-10-02T10:00:00Z'}];
 const a=calculateMetrics(f,filters,asOf),b=calculateMetrics(f,{...filters,areas:['unknown']},asOf);expect(a.metrics.feedback).toEqual({numerator:2,denominator:2});expect(a.metrics.survey).toEqual({numerator:1,denominator:1});expect(a.series['survey.reasons'].filter(x=>['venue','cost'].includes(x.key)).map(x=>x.value)).toEqual([1,1]);expect(b.metrics.survey).toEqual(a.metrics.survey);expect(b.metrics.feedback).toEqual({numerator:0,denominator:0});
});
it('QA-METRIC-012 exclusive GBP bands handle exact upper boundaries and language OR without duplicate meals',()=>{
 const f=fact();f.meals=[metricMeal('p20',2000),metricMeal('p20plus',2001),metricMeal('p30',3000),metricMeal('p30plus',3001),metricMeal('p40',4000),metricMeal('p40plus',4001)];f.seats=[];f.attendance=[];
 const result=(bands:string[],languages=['en','zh'])=>calculateMetrics(f,{...filters,budgetBands:bands,languages},asOf).rows.formation.map(r=>r.rowId);
 expect(result(['0-20'])).toEqual(['p20']);expect(result(['20-30']).sort()).toEqual(['p20plus','p30'].sort());expect(result(['30-40']).sort()).toEqual(['p30plus','p40'].sort());expect(result(['40+'])).toEqual(['p40plus']);expect(result([])).toHaveLength(6);
});
it('QA-METRIC-008 meeting recruitment minimum and cancellation are independent facts',()=>{
 const f=fact();f.meals[0]!.status='CANCELLED';f.meals[0]!.cancel_reason='host';const r=calculateMetrics(f,filters,asOf);expect(r.metrics.formation).toEqual({numerator:1,denominator:1});expect(r.metrics.cancellation).toEqual({numerator:1,denominator:1});expect(r.metrics.coverage).toEqual({numerator:0,denominator:0});
});
it('QA-METRIC-002 actual ingress accepts once duplicates once and rejects forged business success without metric effects',async()=>{
 const b=new Browser(h),body=(events:unknown[])=>({schemaVersion:1,consent:{analytics:true,version:ANALYTICS_CONSENT_VERSION},events});await b.request('POST','/v1/analytics/events',{body:body([])});
 const event={eventId:randomUUID(),type:'map_opened',occurredAt:new Date().toISOString(),anonymousId:'qa-metric',sessionId:'qa-session',appVersion:'web-mvp-1',properties:{}};
 const send=async(e:unknown)=>{const r=await b.request('POST','/v1/analytics/events',{body:body([e])});expect(r.statusCode,r.body).toBe(200);return json(r).data.results[0];};expect((await send(event)).status).toBe('accepted');expect((await send(event)).status).toBe('duplicate');const forged=await b.request('POST','/v1/analytics/events',{body:body([{...event,eventId:randomUUID(),type:'application_created',properties:{mealId:randomUUID()}}])});expect(forged.statusCode,forged.body).toBe(422);expect(json(forged).error.code).toBe('VALIDATION_FAILED');
 const s=await sealSourceSnapshot(h.db.pool,new Date('2026-01-01'),{verifiedDiscovery:true,clientTelemetry:true});const loaded=await loadAdminSnapshot(h.db.pool,{snapshotId:s});expect(loaded.calculated.metrics.applications).toBe(0);expect((await h.db.pool.query('SELECT count(*)::int n FROM analytics_events WHERE event_id=$1',[event.eventId])).rows[0].n).toBe(1);
});
it('QA-METRIC-003 late received event enters S1 but cannot alter sealed S0',async()=>{
 const before=await sealSourceSnapshot(h.db.pool,new Date('2026-01-01'),{clientTelemetry:true});const old=await h.db.pool.query("SELECT facts FROM analytics_snapshot_facts WHERE snapshot_id=$1 AND kind='events'",[before]);
 const id=randomUUID();await h.db.pool.query("INSERT INTO analytics_events(event_id,anonymous_id,session_id,app_version,type,occurred_at,received_at,schema_version,environment,consent_version,classification,properties,request_hash) VALUES($1,'qa-late','qa-late','web-mvp-1','map_opened',clock_timestamp()-interval '1 day',clock_timestamp(),1,'production','2026-10-21','regular','{}',$2)",[id,'a'.repeat(64)]);
 const next=await sealSourceSnapshot(h.db.pool,new Date('2026-01-01'),{clientTelemetry:true});const read=async(s:string)=>(await h.db.pool.query("SELECT facts FROM analytics_snapshot_facts WHERE snapshot_id=$1 AND kind='events'",[s])).rows[0].facts;
 expect((await read(before)).some((e:{event_id:string})=>e.event_id===id)).toBe(false);expect((await read(next)).some((e:{event_id:string})=>e.event_id===id)).toBe(true);expect(await read(before)).toEqual(old.rows[0].facts);
});
it('QA-METRIC-013 classification excludes the account contribution and hosted meal only in rebuilt snapshots then restores without rewriting S0',async()=>{
 const f=await fixture(),staff=await support(f,'data_admin');await h.db.pool.query("INSERT INTO roles(user_id,role,granted_by) VALUES($1,'analyst','qa-fixture')",[staff.id]);
 const seal=()=>sealSourceSnapshot(h.db.pool,new Date('2026-01-01'));const s0=await seal();
 const classify=async(user:string,classification:string,v:string)=>{const r=await staff.b.request('PUT',`/v1/admin/classifications/${user}`,{body:{classification,reason:'Independent classification restoration test.'},headers:{'idempotency-key':randomUUID(),'if-match':`"${v}"`}});expect(r.statusCode,r.body).toBe(200);return json(r).data.revision;};
 const facts=async(s:string,kind:string)=>(await h.db.pool.query('SELECT facts FROM analytics_snapshot_facts WHERE snapshot_id=$1 AND kind=$2',[s,kind])).rows[0].facts;
 const v=await classify(f.guest.id,'test','0'),s1=await seal();expect((await facts(s1,'users')).some((u:{id:string})=>u.id===f.guest.id)).toBe(false);expect((await facts(s1,'meals')).some((m:{id:string})=>m.id===f.m)).toBe(true);
 const hostVersion=await classify(f.host.id,'staff','0');const s2=await seal();expect((await facts(s2,'meals')).some((m:{id:string})=>m.id===f.m)).toBe(false);
 await classify(f.guest.id,'regular',v);await classify(f.host.id,'regular',hostVersion);const s3=await seal();expect((await facts(s3,'meals')).some((m:{id:string})=>m.id===f.m)).toBe(true);expect((await facts(s3,'users')).some((u:{id:string})=>u.id===f.guest.id)).toBe(true);expect((await facts(s0,'users')).some((u:{id:string})=>u.id===f.guest.id)).toBe(true);
});

async function analyst(){const a=await actor();await h.db.pool.query("INSERT INTO roles(user_id,role,granted_by) VALUES($1,'analyst','qa-fixture')",[a.id]);await h.db.pool.query("UPDATE session_families SET amr=ARRAY['mfa'] WHERE user_id=$1",[a.id]);return a;}
async function exported(b:Browser,snapshotId:string,metric:string,filters:Record<string,string>={}){const r=await b.request('POST','/v1/admin/exports',{headers:{'idempotency-key':randomUUID()},body:{snapshotId,metric,filters}});expect(r.statusCode,r.body).toBe(201);const csv=await b.request('GET',`/v1/admin/exports/${json(r).data.exportId}`);expect(csv.statusCode,csv.body).toBe(200);return csv.body;}
it('QA-METRIC-001 zero denominator remains empty CSV value with exact0/0 and pinned v4 metadata',async()=>{
 const a=await analyst(),id=await sealSourceSnapshot(h.db.pool,new Date('2026-01-01')),filters={from:'2020-01-01',to:'2020-01-02'};
 const r=await a.b.request('GET',`/v1/admin/retention?snapshotId=${id}&from=${filters.from}&to=${filters.to}`);expect(r.statusCode,r.body).toBe(200);expect(json(r).data.metrics.feedback).toEqual({numerator:0,denominator:0});
 const csv=await exported(a.b,id,'feedback',filters);expect(csv).toContain('"feedback","","0","0"');expect(csv).toContain(`"snapshotId","${id}"`);expect(csv).toContain('"definitionVersion","v4"');expect(csv).toContain('"asOf"');expect(csv).toContain('"filterHash"');
});
it('QA-METRIC-010 independent survey filters preserve rows and factors while UI/API and CSV expose scope and user units',async()=>{
 const f=await fixture();await h.db.pool.query("INSERT INTO product_surveys(user_id,version,again,reasons,submitted_at) VALUES($1,1,true,ARRAY['venue','cost'],clock_timestamp())",[f.guest.id]);const a=await analyst(),id=await sealSourceSnapshot(h.db.pool,new Date('2026-01-01'));
 const read=async(extra:string)=>{const r=await a.b.request('GET',`/v1/admin/retention?snapshotId=${id}${extra}`);expect(r.statusCode,r.body).toBe(200);return json(r).data;};
 const all=await read(''),narrow=await read('&areas=missing&languages=zh&sizes=6&budgetBands=40%2B');expect(narrow.metrics.survey).toEqual(all.metrics.survey);expect(narrow.series['survey.reasons']).toEqual(all.series['survey.reasons']);
 const csv=await exported(a.b,id,'survey',{areas:'missing',languages:'zh',sizes:'6',budgetBands:'40+'});expect(csv).toContain('"surveyScope","date_and_user_segment"');expect(csv).toContain('"unit","users"');expect(csv).toContain('"surveyFactor:venue","1"');expect(csv).toContain('"surveyFactor:cost","1"');
});

it('QA-METRIC-012 legally omitted discovery-request budget stays unknown rather than borrowing a meal budget',()=>{
 const f=fact();f.discoveryReady=true;f.events=[{event_id:'unknown-request',anonymous_id:'synthetic',user_id:null,session_id:'synthetic',type:'discovery_results',occurred_at:'2026-10-01T10:00:00Z',received_at:'2026-10-01T10:00:01Z',properties:{serverOnly:true,resultCount:0,filters:{languages:'en,zh'}}}];
 const unknown=calculateMetrics(f,{...filters,budgetBands:['unknown'],languages:['en','zh']},asOf);expect(unknown.metrics.discovery).toEqual({numerator:1,denominator:1});
 const concrete=calculateMetrics(f,{...filters,budgetBands:['0-20','20-30','30-40','40+']},asOf);expect(concrete.metrics.discovery).toEqual({numerator:0,denominator:0});expect(calculateMetrics(f,{...filters,budgetUpToPence:5000},asOf).metrics.discovery).toEqual({numerator:0,denominator:0});
});

it('QA-METRIC-018 real server deduplicates a session meal across new event IDs and rejects ineligible discovery target',async()=>{
 const f=await fixture();await h.db.pool.query("UPDATE meals SET starts_at='2030-10-23T17:00Z',closes_at='2030-10-23T16:00Z',scheduled_end_at='2030-10-23T19:00Z',start_local_date='2030-10-23',close_local_date='2030-10-23',status='OPEN' WHERE id=$1",[f.m]);
 const b=new Browser(h),batch=(events:unknown[])=>({schemaVersion:1,consent:{analytics:true,version:ANALYTICS_CONSENT_VERSION},events});expect((await b.request('POST','/v1/analytics/events',{body:batch([])})).statusCode).toBe(200);
 const discovery=await b.request('GET','/v1/meals?limit=100',{headers:{'x-fancy-analytics':'enabled'}});expect(discovery.statusCode,discovery.body).toBe(200);const requestId=json(discovery).meta.requestId;
 const event=(mealId=f.m)=>({eventId:randomUUID(),type:'meal_impression',occurredAt:new Date().toISOString(),anonymousId:'qa-exposure',sessionId:'qa-exposure',appVersion:'web-mvp-1',properties:{mealId,discoveryRequestId:requestId,visibleRatio:.5,durationMs:1000,eligible:true,foreground:true}});
 const send=async(e:unknown)=>{const r=await b.request('POST','/v1/analytics/events',{body:batch([e])});expect(r.statusCode,r.body).toBe(200);return json(r).data.results[0];};expect((await send(event())).status).toBe('accepted');expect((await send(event())).status).toBe('duplicate');expect((await send(event(randomUUID()))).reason).toBe('not_eligible');expect((await h.db.pool.query("SELECT count(*)::int n FROM analytics_events WHERE type='meal_impression' AND properties->>'mealId'=$1",[f.m])).rows[0].n).toBe(1);
});

import {advanceLifecycle,type MealRow} from '../apps/api/src/meals/lifecycle.ts';
it('QA-METRIC-008 QA-METRIC-014 classified then deleted third seat recomputes analysis peak2 without changing authoritative formation history',async()=>{
 const f=await fixture(),third=await actor();await h.db.pool.query("UPDATE meals SET minimum=3,head=3,status='OPEN' WHERE id=$1",[f.m]);await h.db.pool.query("INSERT INTO seat_events(meal_id,seq,user_id,type,effective_at,command_id) SELECT id,3,$2,'GUEST_CONFIRMED',closes_at-interval '1 minute',$3 FROM meals WHERE id=$1",[f.m,third.id,randomUUID()]);
 await withTransaction(h.db.pool,async tx=>{await tx.locks.lock('users',[f.host.id],'share');const [m]=await tx.locks.lock<MealRow>('meals',[f.m],'update','*');await tx.locks.lock('conversations',[f.group],'update');await advanceLifecycle(tx,m!,await tx.effectiveNow());});
 const business=async()=>(await h.db.pool.query('SELECT id,kind,payload FROM business_events WHERE aggregate_id=$1 ORDER BY id',[f.m])).rows;const original=await business();expect(original.some(x=>x.kind==='meal.close')).toBe(true);
 const seal=async()=>loadAdminSnapshot(h.db.pool,{snapshotId:await sealSourceSnapshot(h.db.pool,new Date('2026-01-01'))});
 const peak=(data:Awaited<ReturnType<typeof seal>>)=>data.calculated.rows.formation!.find(r=>r.rowId===f.m)!;expect(peak(await seal()).attributes.peakConfirmed).toBe(3);
 const staff=await analyst();await h.db.pool.query("INSERT INTO roles(user_id,role,granted_by) VALUES($1,'data_admin','qa-fixture')",[staff.id]);
 const classify=async(value:string,version:string)=>{const r=await staff.b.request('PUT',`/v1/admin/classifications/${third.id}`,{headers:{'idempotency-key':randomUUID(),'if-match':`"${version}"`},body:{classification:value,reason:'Independent peak reconciliation fixture.'}});expect(r.statusCode,r.body).toBe(200);return json(r).data.revision;};
 const v=await classify('test','0'),excluded=await seal();expect(peak(excluded)).toMatchObject({inNumerator:false,attributes:{peakConfirmed:2}});expect(await business()).toEqual(original);await classify('regular',v);expect(peak(await seal()).attributes.peakConfirmed).toBe(3);
 const deletion=await third.b.request('POST','/v1/me/deletion',{headers:{'idempotency-key':randomUUID(),'if-match':'"1"'},body:{confirm:true,receiptToken:randomBytes(32).toString('base64url')}});expect(deletion.statusCode,deletion.body).toBe(202);const removed=await seal();expect(peak(removed)).toMatchObject({inNumerator:false,attributes:{peakConfirmed:2}});expect(removed.calculated.rows.attendance!.some(r=>r.attributes.userId===third.id)).toBe(false);expect(await business()).toEqual(original);
});

it('QA-ADMIN-004 actual CSV pins snapshot/asOf/filter/v4 and identifies synthetic fixture provenance without private fields',async()=>{
 const a=await analyst(),id=await sealSourceSnapshot(h.db.pool,new Date('2026-01-01')),loaded=await loadAdminSnapshot(h.db.pool,{snapshotId:id});const csv=await exported(a.b,id,'feedback');expect(csv).toContain(`"snapshotId","${id}"`);expect(csv).toContain(`"asOf","${loaded.snapshot.asOf}"`);expect(csv).toContain(`"filterHash","${loaded.filterHash}"`);expect(csv).toContain('"definitionVersion","v4"');expect(csv).not.toMatch(/@example.invalid|messageBody|pair_consents|reconnect|private_contact/);expect(csv).toMatch(/fixture|synthetic|sample|示例|模拟/i);
});
it('QA-NOTIFY-003 actual group message private report and unilateral reconnect never put private body or choice in email records',async()=>{
 const f=await fixture(true,3600_000),body='SYNTHETIC_MESSAGE_PRIVATE_5c91',details='SYNTHETIC_REPORT_PRIVATE_5c91';const sent=await f.host.b.request('POST',`/v1/conversations/${f.group}/messages`,{body:{body,clientMessageId:randomUUID()}});expect(sent.statusCode,sent.body).toBe(201);
 const report=await f.host.b.request('POST','/v1/reports',{headers:{'idempotency-key':randomUUID()},body:{targetType:'USER',targetId:f.guest.id,reason:'private_concern',details}});expect(report.statusCode,report.body).toBe(201);
 const selected=await f.host.b.request('PUT',`/v1/meals/${f.m}/reconnect/${f.guest.id}`,{headers:{'idempotency-key':randomUUID(),'if-match':'"0"'},body:{selected:true}});expect(selected.statusCode,selected.body).toBe(200);
 const rows=(await h.db.pool.query('SELECT payload FROM outbox')).rows;expect(JSON.stringify(rows)).not.toContain(body);expect(JSON.stringify(rows)).not.toContain(details);expect(JSON.stringify(rows)).not.toMatch(/selected|reconnect|WAITING/);
 expect((await h.db.pool.query('SELECT event_id,recipient_id,channel,count(*) n FROM outbox GROUP BY event_id,recipient_id,channel HAVING count(*)>1')).rows).toEqual([]);
});
