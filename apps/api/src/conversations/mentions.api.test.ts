import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { requireRecovery } from '../recovery/replay.ts';
import { withTransaction } from '../common/transaction.ts';
import { createGroupConversation, createDirectConversation, joinConversation, leaveConversation } from '../membership/intervals.ts';
import { Browser, createHarness, json, type Harness } from '../test/harness.ts';
let h: Harness;
beforeAll(async () => { h = await createHarness(inject('pgServerUrl')); });
afterAll(async () => { await h.close(); });
async function member() { const b = new Browser(h); const { body } = await b.signInWithEmail(`${randomUUID()}@example.invalid`); return { b, id: body.data.session.user.id as string }; }
async function setup() {
  const host = await member(); const guest = await member();
  const venue = (await h.db.pool.query(`INSERT INTO venues(place_id,provider) VALUES ($1,'fixture') RETURNING id`, [randomUUID()])).rows[0].id;
  const meal = (await h.db.pool.query(`INSERT INTO meals(host_id,venue_ref,title,description,starts_at,closes_at,scheduled_end_at,start_local_date,start_local_time,start_offset,close_local_date,close_local_time,close_offset,minimum,capacity,budget_min_pence,budget_max_pence,languages,mood,booking_mode,terms_version,attempt_id)
    VALUES($1,$2,'Chat test meal','A test meal for conversation history','2030-01-01 18:00Z','2030-01-01 17:00Z','2030-01-01 20:00Z','2030-01-01','18:00',0,'2030-01-01','17:00',0,2,4,1000,2000,ARRAY['en'],'EASY_CONVERSATION','EXTERNAL_PAY_AT_VENUE','test',$3) RETURNING id`, [host.id, venue, randomUUID()])).rows[0].id;
  const { conversationId: id } = await withTransaction(h.db.pool, (tx) => createGroupConversation(tx, { mealId: meal, hostId: host.id, effectiveAt: new Date() }));
  await withTransaction(h.db.pool, (tx) => joinConversation(tx,id,guest.id,new Date()));
  return { host, guest, id };
}

async function named(id: string, name: string) { await h.db.pool.query(`INSERT INTO profiles(user_id,display_name) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET display_name=EXCLUDED.display_name`,[id,name]); }
const sendV2 = (b: Browser,id: string,body: string,mentions: unknown[] = [],key = randomUUID()) => b.request('POST',`/v2/conversations/${id}/messages`,{body:{body,clientMessageId:key,mentions}});
const history = (b: Browser,id: string) => b.request('GET',`/v2/conversations/${id}/messages?mode=HISTORY`);
const events = async (message: string) => (await h.db.pool.query(`SELECT * FROM message_notification_recipients WHERE message_id=$1`,[message])).rows;

describe('P1.1 group mention API', () => {
 it('uses code-point offsets, persists effective entities and dedupes original event/notice on replay', async () => {
  const f = await setup(); await named(f.guest.id,'Alex'); const key=randomUUID();
  const mentions=[{kind:'user',userId:f.guest.id,start:2,end:7}];
  const first=await sendV2(f.host.b,f.id,'😀 @Alex',mentions,key);
  expect(first.statusCode,first.body).toBe(201); const message=json(first).data;
  expect(message.body).toBe('😀 @Alex'); expect(message.mentions).toEqual(mentions);
  expect(json(await sendV2(f.host.b,f.id,'😀 @Alex',mentions,key)).data).toEqual(message);
  expect(await events(message.id)).toHaveLength(1);
  expect((await events(message.id))[0].template).toBe('group_mention');
  expect((await h.db.pool.query(`SELECT * FROM notifications WHERE event_id=$1`,[(await events(message.id))[0].event_id])).rows).toHaveLength(1);
  expect((await sendV2(f.host.b,f.id,'😀 @Alex',[],key)).statusCode).toBe(409);
  expect(json(await history(f.guest.b,f.id)).data[0].mentions).toEqual(mentions);
 });
 it('rejects spoofed everyone, overlap, invalid ranges and a misleading member marker atomically', async () => {
  const f=await setup(); await named(f.guest.id,'Alex');
  expect((await sendV2(f.guest.b,f.id,'@everyone',[{kind:'everyone',start:0,end:9}])).statusCode).toBe(403);
  for (const mentions of [[{kind:'everyone',start:0,end:9},{kind:'everyone',start:0,end:9}],[{kind:'everyone',start:1,end:9}],[{kind:'user',userId:f.guest.id,start:0,end:9}]]) {
   expect((await sendV2(f.host.b,f.id,'@everyone',mentions)).statusCode).toBe(422);
  }
  expect(json(await history(f.host.b,f.id)).data).toEqual([]);
 });
 it('dedupes multiple mentions and host everyone into one recipient notification', async () => {
  const f=await setup(); await named(f.guest.id,'Alex');
  const response=await sendV2(f.host.b,f.id,'@Alex @Alex @everyone',[{kind:'user',userId:f.guest.id,start:0,end:5},{kind:'user',userId:f.guest.id,start:6,end:11},{kind:'everyone',start:12,end:21}]);
  expect(response.statusCode,response.body).toBe(201);
  const rows=await events(json(response).data.id); expect(rows).toHaveLength(1); expect(rows[0].recipient_id).toBe(f.guest.id); expect(rows[0].template).toBe('group_mention');
 });
 it('downgrades a departed target to literal text and preserves replay warnings after rejoin', async () => {
  const f=await setup(); await named(f.guest.id,'Alex');
  await withTransaction(h.db.pool,tx=>leaveConversation(tx,f.id,f.guest.id,new Date()));
  const key=randomUUID(), mentions=[{kind:'user',userId:f.guest.id,start:0,end:5}];
  const first=await sendV2(f.host.b,f.id,'@Alex hello',mentions,key);
  expect(first.statusCode,first.body).toBe(201); expect(json(first).data.mentions).toEqual([]);
  expect(json(first).data.warnings.droppedMentionIds).toEqual([f.guest.id]); expect(await events(json(first).data.id)).toHaveLength(0);
  await withTransaction(h.db.pool,tx=>joinConversation(tx,f.id,f.guest.id,new Date()));
  expect(json(await sendV2(f.host.b,f.id,'@Alex hello',mentions,key)).data).toEqual(json(first).data);
 });
 it('retains literal v1/v2 text compatibility without mention notices and excludes hidden gaps', async () => {
  const f=await setup();
  const plain=await f.host.b.request('POST',`/v1/conversations/${f.id}/messages`,{body:{body:'@everyone literal',clientMessageId:randomUUID()}});
  expect(plain.statusCode,plain.body).toBe(201); expect(json(plain).data).not.toHaveProperty('mentions');
  const event=(await events(json(plain).data.id))[0]; expect(event.template).toBe('group_message'); expect(event.notification_id).toBeNull();
  await withTransaction(h.db.pool,tx=>leaveConversation(tx,f.id,f.guest.id,new Date()));
  expect((await events(json(plain).data.id))[0].state).toBe('REVOKED');
  await sendV2(f.host.b,f.id,'hidden gap');
  expect(json(await history(f.guest.b,f.id)).data.map((m:{body:string})=>m.body)).toEqual(['@everyone literal']);
  expect((await f.guest.b.request('GET',`/v2/conversations/${f.id}/messages?mode=LIVE&afterSeq=0`)).statusCode).toBe(403);
  expect((await sendV2(f.guest.b,f.id,'cannot send')).statusCode).toBe(403);
  await withTransaction(h.db.pool,tx=>joinConversation(tx,f.id,f.guest.id,new Date()));
  const newMessage=await sendV2(f.host.b,f.id,'new epoch');
  expect((await events(json(newMessage).data.id))[0].membership_epoch).not.toBe(event.membership_epoch);
  expect((await events(json(plain).data.id))[0].state).toBe('REVOKED');
  expect(json(await history(f.guest.b,f.id)).data.map((m:{body:string})=>m.body)).toEqual(['new epoch','@everyone literal']);
 });
 it('paginates only current writable members and keeps everyone host-only', async () => {
  const f=await setup(); await named(f.guest.id,'Alex');
  const path=`/v1/conversations/${f.id}/mention-candidates`;
  const first=await f.host.b.request('GET',path+'?limit=1'); expect(first.statusCode,first.body).toBe(200);
  expect(json(first).data[0].kind).toBe('everyone'); expect(json(first).page.hasMore).toBe(true);
  const next=await f.host.b.request('GET',path+'?limit=1&cursor='+encodeURIComponent(json(first).page.nextCursor)); expect(next.statusCode,next.body).toBe(200); expect(json(next).data[0].kind).toBe('user');
  expect(json(await f.guest.b.request('GET',path)).data.every((x:{kind:string})=>x.kind==='user')).toBe(true);
  expect(json(await f.host.b.request('GET',path+'?q=Alex')).data.map((x:{userId:string})=>x.userId)).toEqual([f.guest.id]);
  await withTransaction(h.db.pool,tx=>leaveConversation(tx,f.id,f.guest.id,new Date()));
  expect((await f.guest.b.request('GET',path)).statusCode).toBe(403);
  expect(json(await f.host.b.request('GET',path+'?q=Alex')).data).toEqual([]);
 });
 it('serializes concurrent identical sends and rejects a stale renamed selection without losing text', async () => {
  const f=await setup(); await named(f.guest.id,'Alex'); const key=randomUUID();
  const mentions=[{kind:'user',userId:f.guest.id,start:0,end:5}];
  const responses=await Promise.all([sendV2(f.host.b,f.id,'@Alex hello',mentions,key),sendV2(f.host.b,f.id,'@Alex hello',mentions,key)]);
  expect(responses.map(r=>r.statusCode)).toEqual([201,201]);
  expect(json(responses[0]!).data.id).toBe(json(responses[1]!).data.id);
  expect(await events(json(responses[0]!).data.id)).toHaveLength(1);
  await named(f.guest.id,'Alex Smith');
  expect((await sendV2(f.host.b,f.id,'@Alex hello',mentions)).statusCode).toBe(422);
  const spaced=await sendV2(f.host.b,f.id,'@Alex Smith hello',[{kind:'user',userId:f.guest.id,start:0,end:11}]);
  expect(spaced.statusCode,spaced.body).toBe(201);
 });
 it('rejects the group-only v2 protocol and roster for direct conversations', async () => {
  const a=await member(), b=await member(); const [low,high]=[a.id,b.id].sort();
  const pair=(await h.db.pool.query(`INSERT INTO user_pairs(low_user,high_user) VALUES($1,$2) RETURNING id`,[low,high])).rows[0].id;
  const {conversationId}=await withTransaction(h.db.pool,async tx=>{
   await tx.locks.lock('user_pairs',[pair],'update');
   return createDirectConversation(tx,{pairId:pair,userIds:[a.id,b.id],effectiveAt:new Date()});
  });
  expect((await sendV2(a.b,conversationId,'no group protocol')).statusCode).toBe(403);
  expect((await history(a.b,conversationId)).statusCode).toBe(403);
  expect((await a.b.request('GET',`/v1/conversations/${conversationId}/mention-candidates`)).statusCode).toBe(403);
 });

 it('applies recovery fencing and private no-store headers to the actual v2 ingress', async () => {
  const f=await setup();
  expect((await history(f.host.b,f.id)).headers['cache-control']).toBe('private, no-store');
  await requireRecovery(h.db.pool,{version:1,entries:[]});
  try {
   expect((await sendV2(f.host.b,f.id,'fenced')).statusCode).toBe(503);
   expect((await history(f.host.b,f.id)).statusCode).toBe(503);
   expect((await h.db.pool.query(`SELECT * FROM messages WHERE conversation_id=$1`,[f.id])).rows).toEqual([]);
  } finally { await h.db.pool.query(`UPDATE recovery_control SET state='READY' WHERE id=1`); }
 });

});
