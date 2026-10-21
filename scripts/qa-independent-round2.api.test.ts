/** Independent exact concurrency, persistence and authorisation probes; isolated PostgreSQL. */
import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,describe,expect,inject,it} from 'vitest';
import {Browser,createHarness,json,type Harness} from '../apps/api/src/test/harness.ts';
let h:Harness;
beforeAll(async()=>{h=await createHarness(inject('pgServerUrl'));});
afterAll(async()=>h.close());
const headers=(version?:string,key=randomUUID())=>({'idempotency-key':key,...(version?{'if-match':`"${version}"`}:{})});
async function actor(){const b=new Browser(h);const {body}=await b.signInWithEmail(`${randomUUID()}@example.invalid`);const id=body.data.session.user.id as string;const r=await b.request('PATCH','/v1/me',{body:{displayName:'QA Round Two',bio:'Synthetic isolated QA profile for concurrent safety checks.',languages:['en'],lifeStatus:'NEW_TO_LONDON',interests:['FOOD'],ageConfirmedVersion:'2026-10-21',communityAcceptedVersion:'2026-10-21'},headers:headers('1')});expect(r.statusCode,r.body).toBe(200);return{b,id};}
async function meal(b:Browser,capacity=4){const venue=await b.request('POST','/v1/venues/confirm',{body:{placeId:'fixture_fancy_north'},headers:headers()});expect(venue.statusCode,venue.body).toBe(200);const r=await b.request('POST','/v1/meals',{body:{venueRef:json(venue).data.venueRef,title:'QA concurrency isolated table',description:'Synthetic table with no external restaurant or customer activity.',start:{localDate:'2030-10-23',localTime:'18:00',timeZone:'Europe/London',utcOffsetMinutes:60},close:{localDate:'2030-10-23',localTime:'17:00',timeZone:'Europe/London',utcOffsetMinutes:60},minimum:2,capacity,budgetMinPence:2000,budgetMaxPence:3500,languages:['en'],mood:'EASY_CONVERSATION',bookingMode:'EXTERNAL_PAY_AT_VENUE',attemptId:randomUUID(),bookingDeclarationConfirmed:true,reviewConfirmed:true,termsVersion:'2026-10-21'},headers:headers()});expect(r.statusCode,r.body).toBe(201);return json(r).data;}
const apply=(b:Browser,id:string,key=randomUUID(),message='Independent synthetic application for QA.')=>b.request('POST',`/v1/meals/${id}/applications`,{body:{message},headers:headers(undefined,key)});
const approve=(b:Browser,id:string)=>b.request('POST',`/v1/applications/${id}/decision`,{body:{decision:'APPROVE'},headers:headers('1')});
async function count(sql:string,values:unknown[]){return Number((await h.db.pool.query(sql,values)).rows[0].n);}
describe('independent QA second safety round',()=>{
 it('QA-DB-001 capacity four last-seat race has one seat JOIN and notification per channel',async()=>{
  const host=await actor();const m=await meal(host.b);for(let i=0;i<2;i++){const guest=await actor();const a=await apply(guest.b,m.id);expect(a.statusCode,a.body).toBe(201);expect((await approve(host.b,json(a).data.id)).statusCode).toBe(200);}
  const a=await actor(),b=await actor();const aa=json(await apply(a.b,m.id)).data,ba=json(await apply(b.b,m.id)).data;
  const results=await Promise.all([approve(host.b,aa.id),approve(host.b,ba.id)]);expect(results.map(r=>r.statusCode).sort()).toEqual([200,409]);
  expect(json(await host.b.request('GET',`/v1/meals/${m.id}`)).data.meal.confirmedCount).toBe(4);
  const winner=results[0]!.statusCode===200?a:b;const loser=winner===a?b:a;
  expect(await count('SELECT count(*) n FROM seat_events WHERE meal_id=$1 AND user_id=$2 AND type=$3',[m.id,winner.id,'GUEST_CONFIRMED'])).toBe(1);
  expect(await count('SELECT count(*) n FROM membership_intervals i JOIN conversations c ON c.id=i.conversation_id WHERE c.meal_id=$1 AND i.user_id=$2',[m.id,winner.id])).toBe(1);
  for(const table of ['notifications','outbox']){expect(await count(`SELECT count(*) n FROM ${table} WHERE recipient_id=$1 AND template='application_approved'`,[winner.id])).toBe(1);expect(await count(`SELECT count(*) n FROM ${table} WHERE recipient_id=$1 AND template='application_approved'`,[loser.id])).toBe(0);}
 });
 it('QA-DB-004 same application intent retries one round but changed body conflicts without extra fact',async()=>{
  const host=await actor(),guest=await actor(),m=await meal(host.b);const key=randomUUID();const concurrent=await Promise.all([apply(guest.b,m.id,key),apply(guest.b,m.id,key)]);expect(concurrent.some(r=>r.statusCode===201)).toBe(true);for(const r of concurrent)expect([201,409],r.body).toContain(r.statusCode);const first=concurrent.find(r=>r.statusCode===201)!;const replay=await apply(guest.b,m.id,key);expect(json(replay).data.id).toBe(json(first).data.id);expect(replay.headers['idempotent-replay']).toBe('true');const changed=await apply(guest.b,m.id,key,'A different synthetic introduction for this request.');expect(changed.statusCode,changed.body).toBe(409);
  expect(await count('SELECT count(*) n FROM applications WHERE meal_id=$1 AND user_id=$2',[m.id,guest.id])).toBe(1);expect(await count("SELECT count(*) n FROM business_events WHERE aggregate_id=$1 AND kind='application.submitted'",[m.id])).toBe(1);
 });
 it('QA-CHAT-001 pending applicant cannot fetch group history LIVE or private summaries',async()=>{
  const host=await actor(),guest=await actor(),m=await meal(host.b);const group=(await h.db.pool.query('SELECT id FROM conversations WHERE meal_id=$1',[m.id])).rows[0].id;const marker='QA_PRIVATE_'+randomUUID();expect((await host.b.request('POST',`/v1/conversations/${group}/messages`,{body:{body:marker,clientMessageId:randomUUID()}})).statusCode).toBe(201);expect((await apply(guest.b,m.id)).statusCode).toBe(201);
  for(const mode of ['HISTORY','LIVE']){const r=await guest.b.request('GET',`/v1/conversations/${group}/messages?mode=${mode}&afterSeq=0`);expect([403,404],r.body).toContain(r.statusCode);expect(r.body).not.toContain(marker);}
  const inbox=await guest.b.request('GET','/v1/inbox');expect(inbox.body).not.toContain(marker);expect(inbox.body).not.toContain(group);expect(json(await guest.b.request('GET',`/v1/meals/${m.id}`)).data.conversationId).toBeNull();
 });
 it('QA-CHAT-012 empty and 2001 fail; 1 and 2000 persist exactly once as literal text',async()=>{
  const host=await actor(),m=await meal(host.b);const group=(await h.db.pool.query('SELECT id FROM conversations WHERE meal_id=$1',[m.id])).rows[0].id;
  for(const [body,valid] of [['   ',false],['x',true],['z'.repeat(2000),true],['q'.repeat(2001),false],['<b>literal</b>',true]] as const){const key=randomUUID();const r=await host.b.request('POST',`/v1/conversations/${group}/messages`,{body:{body,clientMessageId:key}});expect(r.statusCode,r.body).toBe(valid?201:422);expect(await count('SELECT count(*) n FROM messages WHERE conversation_id=$1 AND client_message_id=$2',[group,key])).toBe(valid?1:0);if(valid)expect(json(r).data.body).toBe(body);}
 });
 it('QA-DB-014 host cannot apply to or leave own confirmed seat and cannot forge cancellation reason',async()=>{
  const host=await actor(),guest=await actor(),m=await meal(host.b);const a=await apply(host.b,m.id);expect([403,409],a.body).toContain(a.statusCode);const leave=await host.b.request('POST',`/v1/meals/${m.id}/leave`,{headers:headers('1')});expect([403,409],leave.body).toContain(leave.statusCode);for(const reason of ['host','insufficient']){const r=await guest.b.request('POST',`/v1/meals/${m.id}/cancel`,{body:{reason},headers:headers('1')});expect([403,422],r.body).toContain(r.statusCode);}expect(await count("SELECT count(*) n FROM business_events WHERE aggregate_id=$1 AND kind='meal.cancelled'",[m.id])).toBe(0);expect(json(await host.b.request('GET',`/v1/meals/${m.id}`)).data.meal).toMatchObject({confirmedCount:1,status:'OPEN'});expect(await count("SELECT count(*) n FROM seat_events WHERE meal_id=$1 AND type='LEFT'",[m.id])).toBe(0);
 });
 it('QA-API-003 stale profile version and client clocks are rejected with original fields intact',async()=>{
  const a=await actor();const stale=await a.b.request('PATCH','/v1/me',{body:{displayName:'Should not replace'},headers:headers('1')});expect(stale.statusCode,stale.body).toBe(409);for(const field of ['actorId','effectiveNow','reportedAt','status','roles']){const r=await a.b.request('PATCH','/v1/me',{body:{[field]:'forged'},headers:headers('2')});expect(r.statusCode,r.body).toBe(422);}const invalidEnum=await a.b.request('PATCH','/v1/me',{body:{lifeStatus:'invented-status'},headers:headers('2')});expect(invalidEnum.statusCode,invalidEnum.body).toBe(422);expect(json(await a.b.request('GET','/v1/me')).data).toMatchObject({version:'2',displayName:'QA Round Two'});
 });
});
