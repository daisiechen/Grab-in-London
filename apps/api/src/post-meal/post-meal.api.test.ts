import {withTransaction} from '../common/transaction.ts';
import {lockConnection} from '../connections/service.ts';
import {createDirectConversation} from '../membership/intervals.ts';
import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,describe,expect,inject,it} from 'vitest';
import {Browser,createHarness,json,type Harness} from '../test/harness.ts';
import {publishedReviewsForProfile} from './reviews.ts';
let h:Harness;
beforeAll(async()=>{h=await createHarness(inject('pgServerUrl'));});afterAll(async()=>{await h.close();});
async function actor(){const b=new Browser(h);const {body}=await b.signInWithEmail(`${randomUUID()}@example.invalid`);return {b,id:body.data.session.user.id as string};}
async function fixture(endAgoMs=3_600_000){
 const host=await actor(),guest=await actor(),outsider=await actor();const end=new Date(Date.now()-endAgoMs),start=new Date(end.getTime()-2*3_600_000),close=new Date(start.getTime()-3_600_000);
 const {rows:[venue]}=await h.db.pool.query(`INSERT INTO venues(place_id,provider) VALUES($1,'fixture') RETURNING id`,[`fixture_${randomUUID().replaceAll('-','')}`]);
 const {rows:[m]}=await h.db.pool.query(`INSERT INTO meals(host_id,venue_ref,title,description,starts_at,closes_at,scheduled_end_at,start_local_date,start_local_time,start_offset,close_local_date,close_local_time,close_offset,minimum,capacity,budget_min_pence,budget_max_pence,languages,mood,booking_mode,terms_version,attempt_id,status) VALUES($1,$2,'A finished fixture','This is a completed meal fixture description',$3,$4,$5,'2026-10-20','12:00',60,'2026-10-20','11:00',60,2,4,1000,2000,ARRAY['en'],'EASY_CONVERSATION','EXTERNAL_PAY_AT_VENUE','2026-10-21',$6,'COMPLETED') RETURNING id`,[host.id,venue.id,start,close,end,randomUUID()]);const mealId=m.id as string;
 for(const [index,user] of [host,guest].entries()){
  await h.db.pool.query(`INSERT INTO seat_events(meal_id,seq,user_id,type,effective_at,command_id) VALUES($1,$2,$3,$4,$5,$6)`,[mealId,index+1,user.id,index===0?'HOST_CONFIRMED':'GUEST_CONFIRMED',new Date(close.getTime()-60_000),randomUUID()]);
  await h.db.pool.query(`INSERT INTO start_roster(meal_id,user_id,source_revision_hash,starts_at) VALUES($1,$2,'fixture',$3)`,[mealId,user.id,start]);
 }
 await h.db.pool.query(`UPDATE meals SET head=2 WHERE id=$1`,[mealId]);return {host,guest,outsider,mealId,end};
}
const write=(b:Browser,method:string,path:string,body:unknown,version='0')=>b.request(method,path,{...(body===undefined?{}:{body}),headers:{'idempotency-key':randomUUID(),'if-match':`"${version}"`}});
const attendance=(b:Browser,mealId:string,subject:string,value='present',version='0')=>write(b,'PUT',`/v1/meals/${mealId}/attendance/${subject}`,{value},version);
const choice=(b:Browser,mealId:string,subject:string,selected=true,version='0')=>write(b,'PUT',`/v1/meals/${mealId}/reconnect/${subject}`,{selected},version);
async function present(f:Awaited<ReturnType<typeof fixture>>){expect((await attendance(f.host.b,f.mealId,f.host.id)).statusCode).toBe(200);expect((await attendance(f.guest.b,f.mealId,f.guest.id)).statusCode).toBe(200);}

describe('post-meal qualified revisions and private connections',()=>{
 it('starts unknown, forbids non-roster access and makes SELF override HOST with optimistic revisions',async()=>{
  const f=await fixture();const state=await f.host.b.request('GET',`/v1/meals/${f.mealId}/post-meal`);expect(state.statusCode,state.body).toBe(200);expect(json(state).data.attendance.every((a:{value:string})=>a.value==='unknown')).toBe(true);
  expect((await f.outsider.b.request('GET',`/v1/meals/${f.mealId}/post-meal`)).statusCode).toBe(403);
  const self=await attendance(f.guest.b,f.mealId,f.guest.id);expect(json(self).data).toMatchObject({value:'present',source:'SELF',version:'1'});
  const host=await attendance(f.host.b,f.mealId,f.guest.id,'absent','1');expect(json(host).data).toMatchObject({value:'present',source:'SELF',hostValue:'absent',selfValue:'present',version:'2'});
  expect((await attendance(f.host.b,f.mealId,f.guest.id,'present','1')).statusCode).toBe(409);
  expect((await attendance(f.guest.b,f.mealId,f.host.id)).statusCode).toBe(403);
 });
 it('scores only present people and retains rating revisions without double counting current submissions',async()=>{
  const f=await fixture();expect((await write(f.guest.b,'PUT',`/v1/meals/${f.mealId}/experience`,{score:5})).statusCode).toBe(403);
  await attendance(f.guest.b,f.mealId,f.guest.id);
  expect(json(await write(f.guest.b,'PUT',`/v1/meals/${f.mealId}/experience`,{score:1})).data.version).toBe('1');
  expect(json(await write(f.guest.b,'PUT',`/v1/meals/${f.mealId}/experience`,{score:5},'1')).data.version).toBe('2');
  const state=json(await f.guest.b.request('GET',`/v1/meals/${f.mealId}/post-meal`)).data;expect(state.experience).toEqual({score:5,version:'2'});
  expect((await h.db.pool.query(`SELECT * FROM experience_revisions WHERE meal_id=$1`,[f.mealId])).rowCount).toBe(2);
 });
 it('keeps one-sided references private, publishes after mutual reviews, and withdraws immediately after eligibility loss',async()=>{
  const f=await fixture();await present(f);
  const review=await write(f.host.b,'PUT',`/v1/meals/${f.mealId}/reviews/${f.guest.id}`,{body:'Thoughtful and friendly conversation.'});expect(json(review).data.visibility).toBe('PENDING');expect(await publishedReviewsForProfile(h.db.pool,f.guest.id)).toHaveLength(0);
  const reciprocal=await write(f.guest.b,'PUT',`/v1/meals/${f.mealId}/reviews/${f.host.id}`,{body:'A welcoming host and a pleasant evening.'});expect(json(reciprocal).data.visibility).toBe('PUBLISHED');expect(await publishedReviewsForProfile(h.db.pool,f.guest.id)).toHaveLength(1);
  expect((await write(f.host.b,'PUT',`/v1/meals/${f.mealId}/reviews/${f.host.id}`,{body:'Self review'})).statusCode).toBe(403);
  await attendance(f.guest.b,f.mealId,f.guest.id,'absent','1');expect(await publishedReviewsForProfile(h.db.pool,f.guest.id)).toHaveLength(0);
 });
 it('closes the self-service window at exactly seven continuous days; unpaired references publish after the deadline',async()=>{
  const f=await fixture(7*86_400_000+10_000);
  expect((await attendance(f.host.b,f.mealId,f.host.id)).statusCode).toBe(409);
  for(const person of [f.host,f.guest])await h.db.pool.query(`INSERT INTO attendance_revisions(meal_id,subject_id,source,value,version,actor_id) VALUES($1,$2,'SELF','present',1,$2)`,[f.mealId,person.id]);
  await h.db.pool.query(`INSERT INTO public_review_revisions(meal_id,author_id,subject_id,body,revision) VALUES($1,$2,$3,'An overdue reference',1)`,[f.mealId,f.host.id,f.guest.id]);
  expect(await publishedReviewsForProfile(h.db.pool,f.guest.id)).toHaveLength(1);
  expect((await choice(f.host.b,f.mealId,f.guest.id)).statusCode).toBe(409);
 });
 it('does not expose the other side unilateral choice or version; mutual consent creates one direct history',async()=>{
  const f=await fixture();await present(f);
  const one=await choice(f.host.b,f.mealId,f.guest.id);expect(json(one).data).toMatchObject({selected:true,connection:'WAITING',version:'1'});
  const otherState=json(await f.guest.b.request('GET',`/v1/meals/${f.mealId}/post-meal`)).data.reconnect.find((r:{subjectId:string})=>r.subjectId===f.host.id);expect(otherState).toMatchObject({selected:false,connection:'CLOSED',version:'0'});
  expect((await f.host.b.request('GET',`/v1/connections/${f.guest.id}/conversation`)).statusCode).toBe(404);
  const mutual=await choice(f.guest.b,f.mealId,f.host.id);expect(json(mutual).data.connection).toBe('OPEN');
  const direct=await f.host.b.request('GET',`/v1/connections/${f.guest.id}/conversation`);expect(direct.statusCode,direct.body).toBe(200);expect(json(direct).data).toMatchObject({kind:'DIRECT',canSend:true,head:'2'});
  expect((await h.db.pool.query(`SELECT * FROM conversations WHERE pair_id=(SELECT id FROM user_pairs WHERE low_user=$1 AND high_user=$2)`,[[f.host.id,f.guest.id].sort()[0],[f.host.id,f.guest.id].sort()[1]])).rowCount).toBe(1);
 });
 it('revocation/block clears both choices, unblock never restores consent, and direct history remains read-only',async()=>{
  const f=await fixture();await present(f);await choice(f.host.b,f.mealId,f.guest.id);await choice(f.guest.b,f.mealId,f.host.id);
  const block=await write(f.host.b,'PUT',`/v1/blocks/${f.guest.id}`,undefined);expect(json(block).data).toMatchObject({blocked:true,version:'1'});
  let direct=await f.host.b.request('GET',`/v1/connections/${f.guest.id}/conversation`);expect(json(direct).data.canSend).toBe(false);
  const unblock=await write(f.host.b,'DELETE',`/v1/blocks/${f.guest.id}`,undefined,'1');expect(json(unblock).data).toMatchObject({blocked:false,version:'2'});
  direct=await f.host.b.request('GET',`/v1/connections/${f.guest.id}/conversation`);expect(json(direct).data.canSend).toBe(false);
  const state=json(await f.host.b.request('GET',`/v1/meals/${f.mealId}/post-meal`)).data.reconnect.find((r:{subjectId:string})=>r.subjectId===f.guest.id);expect(state.selected).toBe(false);
  const reselect=await choice(f.host.b,f.mealId,f.guest.id,true,state.version);expect(json(reselect).data.connection).toBe('WAITING');
 });
});

describe('connection qualification changes and message authorization',()=>{
 it('keeps a connection through another valid shared meal, then clears both choices when the last basis is lost',async()=>{
  const f=await fixture();await present(f);await choice(f.host.b,f.mealId,f.guest.id);await choice(f.guest.b,f.mealId,f.host.id);
  const {rows:[other]}=await h.db.pool.query(`INSERT INTO meals(host_id,venue_ref,title,description,starts_at,closes_at,scheduled_end_at,start_local_date,start_local_time,start_offset,close_local_date,close_local_time,close_offset,minimum,capacity,budget_min_pence,budget_max_pence,languages,mood,booking_mode,terms_version,attempt_id,status) SELECT host_id,venue_ref,title,description,starts_at,closes_at,scheduled_end_at,start_local_date,start_local_time,start_offset,close_local_date,close_local_time,close_offset,minimum,capacity,budget_min_pence,budget_max_pence,languages,mood,booking_mode,terms_version,$2,'COMPLETED' FROM meals WHERE id=$1 RETURNING id`,[f.mealId,randomUUID()]);const otherId=other.id as string;
  await h.db.pool.query(`INSERT INTO start_roster(meal_id,user_id,source_revision_hash,starts_at) SELECT $2,user_id,source_revision_hash,starts_at FROM start_roster WHERE meal_id=$1`,[f.mealId,otherId]);
  await h.db.pool.query(`INSERT INTO seat_events(meal_id,seq,user_id,type,effective_at,command_id) SELECT $2,seq,user_id,type,effective_at,gen_random_uuid() FROM seat_events WHERE meal_id=$1`,[f.mealId,otherId]);
  for(const person of [f.host,f.guest])await h.db.pool.query(`INSERT INTO attendance_revisions(meal_id,subject_id,source,value,version,actor_id) VALUES($1,$2,'SELF','present',1,$2)`,[otherId,person.id]);
  const absent=await attendance(f.guest.b,f.mealId,f.guest.id,'absent','1');expect(absent.statusCode,absent.body).toBe(200);
  expect(json(await f.host.b.request('GET',`/v1/connections/${f.guest.id}/conversation`)).data.canSend).toBe(true);
  const lostLast=await attendance(f.guest.b,otherId,f.guest.id,'absent','1');expect(lostLast.statusCode,lostLast.body).toBe(200);
  expect(json(await f.host.b.request('GET',`/v1/connections/${f.guest.id}/conversation`)).data.canSend).toBe(false);
  await attendance(f.guest.b,f.mealId,f.guest.id,'present','2');
  expect(json(await f.host.b.request('GET',`/v1/connections/${f.guest.id}/conversation`)).data.canSend).toBe(false);
 });
 it('sends under mutual qualification, rejects sends after revocation, and preserves authorized historical messages',async()=>{
  const f=await fixture();await present(f);await choice(f.host.b,f.mealId,f.guest.id);await choice(f.guest.b,f.mealId,f.host.id);
  const conversation=json(await f.host.b.request('GET',`/v1/connections/${f.guest.id}/conversation`)).data;
  const sent=await f.host.b.request('POST',`/v1/conversations/${conversation.id}/messages`,{body:{body:'A private follow-up message.',clientMessageId:randomUUID()}});expect(sent.statusCode,sent.body).toBe(201);
  const revoke=await write(f.host.b,'POST',`/v1/connections/${f.guest.id}/revoke`,undefined,'1');expect(revoke.statusCode,revoke.body).toBe(200);
  const denied=await f.host.b.request('POST',`/v1/conversations/${conversation.id}/messages`,{body:{body:'This should not be sent.',clientMessageId:randomUUID()}});expect(denied.statusCode,denied.body).toBe(403);
  const history=await f.host.b.request('GET',`/v1/conversations/${conversation.id}/messages?mode=HISTORY`);expect(history.statusCode,history.body).toBe(200);expect(json(history).data.map((m:{body:string})=>m.body)).toContain('A private follow-up message.');
  expect((await f.outsider.b.request('GET',`/v1/conversations/${conversation.id}/messages?mode=HISTORY`)).statusCode).toBe(404);
 });
});


describe('direct conversation lifetime',()=>{
 it('allows direct messages after the seven-day selection window when current mutual consent and attendance remain valid',async()=>{
  const f=await fixture(8*86_400_000);
  for(const person of [f.host,f.guest])await h.db.pool.query(`INSERT INTO attendance_revisions(meal_id,subject_id,source,value,version,actor_id) VALUES($1,$2,'SELF','present',1,$2)`,[f.mealId,person.id]);
  const direct=await withTransaction(h.db.pool,async tx=>{
   const {pair,now}=await lockConnection(tx,f.host.id,f.guest.id);
   for(const person of [f.host,f.guest])await tx.client.query(`INSERT INTO pair_consents(pair_id,user_id,epoch,revision,basis_meal_id,selected_at) VALUES($1,$2,$3,1,$4,$5)`,[pair.id,person.id,pair.consent_epoch,f.mealId,new Date(f.end.getTime()+3_600_000)]);
   return createDirectConversation(tx,{pairId:pair.id,userIds:[pair.low_user,pair.high_user],effectiveAt:now});
  });
  const response=await f.host.b.request('POST',`/v1/conversations/${direct.conversationId}/messages`,{body:{body:'We can still chat after a week.',clientMessageId:randomUUID()}});expect(response.statusCode,response.body).toBe(201);
  expect((await choice(f.host.b,f.mealId,f.guest.id,true,'1')).statusCode).toBe(409);
 });
});

describe('current authorization before sensitive idempotent replay',()=>{
 it('replays an unchanged mutual choice but never replays an obsolete OPEN response after revocation',async()=>{
  const f=await fixture();await present(f);await choice(f.guest.b,f.mealId,f.host.id);
  const key=randomUUID();const send=()=>f.host.b.request('PUT',`/v1/meals/${f.mealId}/reconnect/${f.guest.id}`,{body:{selected:true},headers:{'idempotency-key':key,'if-match':'"0"'}});
  const first=await send();expect(json(first).data.connection).toBe('OPEN');
  const replay=await send();expect(replay.statusCode,replay.body).toBe(200);expect(replay.headers['idempotent-replay']).toBe('true');
  await write(f.guest.b,'POST',`/v1/connections/${f.host.id}/revoke`,undefined,'1');
  const stale=await send();expect(stale.statusCode,stale.body).toBe(403);
 });
 it('does not replay a rating or private review after the current attendance qualification is lost',async()=>{
  const f=await fixture();await present(f);
  const rateKey=randomUUID();const rate=()=>f.host.b.request('PUT',`/v1/meals/${f.mealId}/experience`,{body:{score:4},headers:{'idempotency-key':rateKey,'if-match':'"0"'}});
  expect((await rate()).statusCode).toBe(200);expect((await rate()).statusCode).toBe(200);
  await attendance(f.host.b,f.mealId,f.host.id,'absent','1');
  expect((await rate()).statusCode).toBe(403);
 });
});
