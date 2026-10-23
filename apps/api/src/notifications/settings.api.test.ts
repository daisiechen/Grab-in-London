import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { withTransaction } from '../common/transaction.ts';
import { createGroupConversation, joinConversation, leaveConversation } from '../membership/intervals.ts';
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


const get=(b:Browser,id:string)=>b.request('GET',`/v1/conversations/${id}/notification-settings`);
const put=(b:Browser,id:string,muted:boolean,version:string,key=randomUUID())=>b.request('PUT',`/v1/conversations/${id}/notification-settings`,{body:{muted},headers:{'if-match':`"${version}"`,'idempotency-key':key}});
describe('cross-device group notification settings',()=>{
 it('defaults false at version zero and isolates each actor',async()=>{
  const f=await setup();expect(json(await get(f.guest.b,f.id)).data).toEqual({muted:false,version:'0'});
  const changed=await put(f.guest.b,f.id,true,'0');expect(changed.statusCode,changed.body).toBe(200);
  expect(json(changed).data).toEqual({muted:true,version:'1'});
  expect(json(await get(f.host.b,f.id)).data).toEqual({muted:false,version:'0'});
  expect(json(await get(f.guest.b,f.id)).data).toEqual({muted:true,version:'1'});
 });
 it('rejects stale devices and keeps original intent replay from writing again',async()=>{
  const f=await setup(),key=randomUUID();const first=await put(f.guest.b,f.id,true,'0',key);
  expect((await put(f.guest.b,f.id,false,'1')).statusCode).toBe(200);
  const replay=await put(f.guest.b,f.id,true,'0',key);expect(json(replay).data).toEqual(json(first).data);
  expect(json(await get(f.guest.b,f.id)).data).toEqual({muted:false,version:'2'});
  const stale=await put(f.guest.b,f.id,true,'1');expect(stale.statusCode).toBe(409);expect(json(stale).error.currentVersion).toBe('2');
 });
 it('serializes concurrent devices so exactly one expected-version write wins',async()=>{
  const f=await setup();const responses=await Promise.all([put(f.guest.b,f.id,true,'0'),put(f.guest.b,f.id,false,'0')]);
  expect(responses.map(r=>r.statusCode).sort()).toEqual([200,409]);
  expect(json(await get(f.guest.b,f.id)).data.version).toBe('1');
 });
 it('requires current membership, including replay, without changing conversation read acknowledgements',async()=>{
  const f=await setup(),key=randomUUID();await put(f.guest.b,f.id,true,'0',key);
  expect((await h.db.pool.query(`SELECT * FROM conversation_reads WHERE conversation_id=$1 AND user_id=$2`,[f.id,f.guest.id])).rows).toEqual([]);
  await withTransaction(h.db.pool,tx=>leaveConversation(tx,f.id,f.guest.id,new Date()));
  expect((await get(f.guest.b,f.id)).statusCode).toBe(403);
  expect((await put(f.guest.b,f.id,true,'0',key)).statusCode).toBe(403);
  expect((await put(f.guest.b,f.id,false,'1')).statusCode).toBe(403);
 });
});
