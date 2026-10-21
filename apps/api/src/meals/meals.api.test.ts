import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,describe,expect,inject,it} from 'vitest';
import {Browser,createHarness,json,type Harness} from '../test/harness.ts';
import {londonTime} from './time.ts';
let h:Harness;
beforeAll(async()=>{h=await createHarness(inject('pgServerUrl'));});afterAll(async()=>{await h.close();});
async function actor(complete=true){const b=new Browser(h);const {body}=await b.signInWithEmail(`${randomUUID()}@example.invalid`);if(complete){const response=await b.request('PATCH','/v1/me',{body:{displayName:'Alex Test',bio:'I enjoy shared meals and meeting new people.',languages:['en','zh'],lifeStatus:'NEW_TO_LONDON',interests:['FOOD'],ageConfirmedVersion:'2026-10-21',communityAcceptedVersion:'2026-10-21'},headers:{'if-match':'"1"','idempotency-key':randomUUID()}});expect(response.statusCode,response.body).toBe(200);}return {b,id:body.data.session.user.id as string};}
function times(days=5){const start=new Date(Math.floor((Date.now()+days*86_400_000)/60_000)*60_000);const close=new Date(start.getTime()-3_600_000);return {start:londonTime(start),close:londonTime(close)};}
const timeInput=(t:ReturnType<typeof londonTime>)=>({localDate:t.localDate,localTime:t.localTime,timeZone:t.timeZone,utcOffsetMinutes:t.utcOffsetMinutes});
async function create(host:Browser,extra:Record<string,unknown>={},key=randomUUID()){
 const confirmed=await host.request('POST','/v1/venues/confirm',{body:{placeId:'fixture_fancy_north'},headers:{'idempotency-key':randomUUID()}});expect(confirmed.statusCode,confirmed.body).toBe(200);
 const t=times();const body={venueRef:json(confirmed).data.venueRef,title:'Friendly lunch with new people',description:'Join a relaxed meal to share stories and good food.',start:timeInput(t.start),close:timeInput(t.close),minimum:2,capacity:3,budgetMinPence:1000,budgetMaxPence:3000,languages:['en','zh'],mood:'EASY_CONVERSATION',cuisineCode:'CHINESE',dietaryCodes:['VEGAN'],bookingMode:'EXTERNAL_PAY_AT_VENUE',attemptId:randomUUID(),bookingDeclarationConfirmed:true,reviewConfirmed:true,termsVersion:'2026-10-21',...extra};
 const result=await host.request('POST','/v1/meals',{body,headers:{'idempotency-key':key}});return {result,body,key};
}
async function publish(host:Browser,extra:Record<string,unknown>={}){const {result}=await create(host,extra);expect(result.statusCode,result.body).toBe(201);return json(result).data;}
const apply=(b:Browser,mealId:string,key=randomUUID())=>b.request('POST',`/v1/meals/${mealId}/applications`,{body:{message:'I would enjoy meeting everyone at this meal.'},headers:{'idempotency-key':key}});
const decide=(b:Browser,id:string,version='1',decision='APPROVE')=>b.request('POST',`/v1/applications/${id}/decision`,{body:{decision},headers:{'idempotency-key':randomUUID(),'if-match':`"${version}"`}});
const detail=async(b:Browser,id:string)=>json(await b.request('GET',`/v1/meals/${id}`)).data;

describe('MVP production meal commands and privacy',()=>{
 it('publishes host seat, GROUP JOIN, three jobs and self-reported booking atomically; retries do not duplicate',async()=>{
  const {b}=await actor();const {result,body,key}=await create(b);expect(result.statusCode,result.body).toBe(201);const meal=json(result).data;
  expect(meal.confirmedCount).toBe(1);expect(meal.bookingDeclaration).toMatchObject({declaredCount:1,stale:false,status:'REPORTED_CONFIRMED'});
  const replay=await b.request('POST','/v1/meals',{body,headers:{'idempotency-key':key}});expect(replay.headers['idempotent-replay']).toBe('true');expect(json(replay).data.id).toBe(meal.id);
  expect((await h.db.pool.query(`SELECT * FROM conversations WHERE meal_id=$1`,[meal.id])).rowCount).toBe(1);
  expect((await h.db.pool.query(`SELECT * FROM seat_events WHERE meal_id=$1`,[meal.id])).rowCount).toBe(1);
  expect((await h.db.pool.query(`SELECT * FROM jobs WHERE resource_id=$1`,[meal.id])).rowCount).toBe(3);
  const otherKey=await b.request('POST','/v1/meals',{body,headers:{'idempotency-key':randomUUID()}});expect(otherKey.statusCode).toBe(409);
 });
 it('rejects incomplete profile, unknown restaurant and invalid deadlines without publishing',async()=>{
  const {b}=await actor(false);expect((await create(b)).result.statusCode).toBe(403);
  const ready=await actor();const invalid=await create(ready.b,{venueRef:randomUUID()});expect(invalid.result.statusCode).toBe(404);
  const t=times();expect((await create(ready.b,{close:timeInput(t.start)})).result.statusCode).toBe(422);
 });
 it('allows edit before first approval, marks booking stale, and permanently locks arrangement after approval and seat exit',async()=>{
  const host=await actor(),guest=await actor();const meal=await publish(host.b);
  const changed=await host.b.request('PATCH',`/v1/meals/${meal.id}`,{body:{title:'A different friendly meal title'},headers:{'idempotency-key':randomUUID(),'if-match':'"1"'}});expect(changed.statusCode,changed.body).toBe(200);expect(json(changed).data.bookingDeclaration.stale).toBe(true);
  const application=json(await apply(guest.b,meal.id)).data;expect((await decide(host.b,application.id)).statusCode).toBe(200);
  let latest=(await detail(guest.b,meal.id)).meal;expect(latest.arrangementLocked).toBe(true);
  const left=await guest.b.request('POST',`/v1/meals/${meal.id}/leave`,{headers:{'idempotency-key':randomUUID(),'if-match':`"${latest.version}"`}});expect(left.statusCode,left.body).toBe(200);
  latest=json(left).data.meal;
  const edit=await host.b.request('PATCH',`/v1/meals/${meal.id}`,{body:{title:'Trying to edit a locked table'},headers:{'idempotency-key':randomUUID(),'if-match':`"${latest.version}"`}});expect(json(edit).error.code).toBe('ARRANGEMENT_LOCKED');
  const c=await h.db.pool.query(`SELECT i.* FROM membership_intervals i JOIN conversations c ON c.id=i.conversation_id WHERE c.meal_id=$1 AND i.user_id=$2 AND i.leave_seq IS NULL`,[meal.id,guest.id]);expect(c.rowCount).toBe(1);
 });
 it('serializes simultaneous approvals for the last seat and joins exactly one guest',async()=>{
  const host=await actor(),a=await actor(),b=await actor();const meal=await publish(host.b,{capacity:2});
  const aa=json(await apply(a.b,meal.id)).data,ba=json(await apply(b.b,meal.id)).data;
  const responses=await Promise.all([decide(host.b,aa.id),decide(host.b,ba.id)]);expect(responses.map(r=>r.statusCode).sort()).toEqual([200,409]);
  expect((await detail(host.b,meal.id)).meal.confirmedCount).toBe(2);
  expect((await h.db.pool.query(`SELECT i.* FROM membership_intervals i JOIN conversations c ON c.id=i.conversation_id WHERE c.meal_id=$1 AND leave_seq IS NULL`,[meal.id])).rowCount).toBe(2);
 });
 it('pending applications do not take seats; withdrawal permits a new round while a declined round blocks forever',async()=>{
  const host=await actor(),guest=await actor();const meal=await publish(host.b,{capacity:2});
  const first=json(await apply(guest.b,meal.id)).data;expect((await detail(host.b,meal.id)).meal.confirmedCount).toBe(1);
  const withdrawn=await guest.b.request('POST',`/v1/applications/${first.id}/withdraw`,{headers:{'idempotency-key':randomUUID(),'if-match':'"1"'}});expect(withdrawn.statusCode,withdrawn.body).toBe(200);
  const second=json(await apply(guest.b,meal.id)).data;expect(second.round).toBe(2);expect(second.id).not.toBe(first.id);
  expect((await decide(host.b,second.id,'1','DECLINE')).statusCode).toBe(200);
  const retry=await apply(guest.b,meal.id);expect(json(retry).error.code).toBe('APPLICATION_DECLINED_FINAL');
  const listing=await guest.b.request('GET',`/v1/meals/${meal.id}/applications`);expect(json(listing).data).toHaveLength(2);
 });
 it('hides application text/identity and group access from public detail and unrelated users',async()=>{
  const host=await actor(),guest=await actor(),outsider=await actor();const meal=await publish(host.b);const application=json(await apply(guest.b,meal.id)).data;
  const publicResponse=await new Browser(h).request('GET',`/v1/meals/${meal.id}`);expect(publicResponse.body).not.toContain(application.message);expect(publicResponse.body).not.toContain(guest.id);expect(json(publicResponse).data.myApplication).toBeNull();expect(json(publicResponse).data.conversationId).toBeNull();
  expect(json(await outsider.b.request('GET',`/v1/meals/${meal.id}/applications`)).data).toEqual([]);
  expect((await decide(outsider.b,application.id)).statusCode).toBe(403);
 });
 it('cancels terminally, expires pending applications, writes recipient notifications and preserves the group',async()=>{
  const host=await actor(),guest=await actor();const meal=await publish(host.b);const application=json(await apply(guest.b,meal.id)).data;
  const cancel=await host.b.request('POST',`/v1/meals/${meal.id}/cancel`,{body:{reason:'booking'},headers:{'idempotency-key':randomUUID(),'if-match':'"1"'}});expect(cancel.statusCode,cancel.body).toBe(200);expect(json(cancel).data).toMatchObject({status:'CANCELLED',cancelReason:'booking'});
  expect((await h.db.pool.query(`SELECT state FROM applications WHERE id=$1`,[application.id])).rows[0].state).toBe('EXPIRED');
  expect((await h.db.pool.query(`SELECT * FROM notifications WHERE refs->>'mealId'=$1 AND template='meal_cancelled'`,[meal.id])).rowCount).toBe(2);
  expect((await h.db.pool.query(`SELECT dissolved_at FROM conversations WHERE meal_id=$1`,[meal.id])).rows[0].dissolved_at).toBeNull();
  expect((await apply(guest.b,meal.id)).statusCode).toBe(409);
 });
 it('filters discovery dimensions with OR within and AND across; public GET never advances lifecycle',async()=>{
  const host=await actor();const meal=await publish(host.b);
  const publicBrowser=new Browser(h);
  const response=await publicBrowser.request('GET','/v1/meals?languages=fr,zh&budgetMaxPence=3000&cuisineCodes=CHINESE&dietaryCodes=VEGAN&tableSizes=3');expect(response.statusCode,response.body).toBe(200);expect(json(response).data.some((m:{id:string})=>m.id===meal.id)).toBe(true);
  expect(json(await publicBrowser.request('GET','/v1/meals?budgetMaxPence=2999')).data.some((m:{id:string})=>m.id===meal.id)).toBe(false);
  const before=await h.db.pool.query(`SELECT * FROM lifecycle_marks WHERE meal_id=$1`,[meal.id]);await detail(publicBrowser,meal.id);expect((await h.db.pool.query(`SELECT * FROM lifecycle_marks WHERE meal_id=$1`,[meal.id])).rowCount).toBe(before.rowCount);
 });
 it('uses signed actor/filter-bound cursors and paginates every application round without skipping',async()=>{
  const host=await actor(),guest=await actor();const meal=await publish(host.b);
  const first=json(await apply(guest.b,meal.id)).data;await guest.b.request('POST',`/v1/applications/${first.id}/withdraw`,{headers:{'idempotency-key':randomUUID(),'if-match':'"1"'}});await apply(guest.b,meal.id);
  const page1=await guest.b.request('GET','/v1/me/meals?section=APPLICATIONS&limit=1');expect(json(page1).data).toHaveLength(1);const cursor=json(page1).page.nextCursor;expect(cursor).toContain('.');
  const page2=await guest.b.request('GET',`/v1/me/meals?section=APPLICATIONS&limit=1&cursor=${encodeURIComponent(cursor)}`);expect(page2.statusCode,page2.body).toBe(200);expect(json(page2).data[0].application.id).not.toBe(json(page1).data[0].application.id);
  expect((await host.b.request('GET',`/v1/me/meals?section=APPLICATIONS&limit=1&cursor=${encodeURIComponent(cursor)}`)).statusCode).toBe(422);
  expect((await guest.b.request('GET',`/v1/me/meals?section=HOSTING&limit=1&cursor=${encodeURIComponent(cursor)}`)).statusCode).toBe(422);
 });
});
