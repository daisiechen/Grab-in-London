import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { withTransaction } from '../common/transaction.ts';
import { createGroupConversation, joinConversation } from '../membership/intervals.ts';
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
const send = (b: Browser, id: string, body: string, key = randomUUID()) => b.request('POST', `/v1/conversations/${id}/messages`, { body: { body, clientMessageId: key } });
const read = (b: Browser, id: string, query = 'mode=HISTORY') => b.request('GET', `/v1/conversations/${id}/messages?${query}`);
async function leave(b: Browser, id: string, op: 'leave' | 'dissolve') {
  const { rows: [r] } = await h.db.pool.query(`SELECT version FROM conversations WHERE id=$1`,[id]);
  return b.request('POST', `/v1/conversations/${id}/${op}`, { body: { confirm: true }, headers: { 'if-match': `"${r.version}"`, 'idempotency-key': randomUUID() } });
}
describe('conversation interval API', () => {
  it('dedupes only the same authorized message, rejects key changes and outsiders, keeps text literal', async () => {
    const { host, guest, id } = await setup(); const key = randomUUID();
    const first = await send(host.b,id,'<script>literal</script>',key);
    expect(first.statusCode,first.body).toBe(201);
    expect(json(await send(host.b,id,'<script>literal</script>',key)).data.id).toBe(json(first).data.id);
    expect((await send(host.b,id,'different',key)).statusCode).toBe(409);
    const outsider = await member(); expect((await read(outsider.b,id)).statusCode).toBe(404);
    expect(json(await read(guest.b,id)).data[0].body).toBe('<script>literal</script>');
  });
  it('retains authorized history, excludes leave/rejoin gaps and refuses replay after leaving', async () => {
    const { host, guest, id } = await setup(); const key = randomUUID();
    await send(guest.b,id,'before leaving',key);
    expect((await leave(guest.b,id,'leave')).statusCode).toBe(200);
    await send(host.b,id,'hidden gap');
    expect((await read(guest.b,id,'mode=LIVE&afterSeq=0')).statusCode).toBe(403);
    expect((await send(guest.b,id,'before leaving',key)).statusCode).toBe(403);
    expect(json(await read(guest.b,id)).data.map((m: { body: string })=>m.body)).toEqual(['before leaving']);
    await withTransaction(h.db.pool,(tx)=>joinConversation(tx,id,guest.id,new Date()));
    await send(host.b,id,'after rejoining');
    expect(json(await read(guest.b,id)).data.map((m: { body: string })=>m.body)).toEqual(['after rejoining','before leaving']);
    const inbox = json(await guest.b.request('GET','/v1/inbox')).data;
    expect(inbox.find((i: { conversation: { id: string } })=>i.conversation.id===id).lastMessage.preview).toBe('after rejoining');
  });
  it('paginates live delivery without advancing past undelivered messages, scopes signed cursors and dissolves terminally', async () => {
    const { host, guest, id } = await setup();
    for (const body of ['one','two','three']) await send(host.b,id,body);
    const first = json(await read(guest.b,id,'mode=LIVE&afterSeq=0&limit=1'));
    expect(first.data.map((m: { body: string })=>m.body)).toEqual(['one']); expect(first.page.hasMore).toBe(true);
    expect(first.page.scannedThroughSeq).toBe(first.data[0].seq);
    expect((await read(host.b,id,`mode=LIVE&cursor=${first.page.nextCursor}&limit=1`)).statusCode).toBe(422);
    const next = json(await read(guest.b,id,`mode=LIVE&cursor=${first.page.nextCursor}&limit=1`));
    expect(next.data[0].body).toBe('two');
    expect((await leave(guest.b,id,'dissolve')).statusCode).toBe(403);
    expect((await leave(host.b,id,'dissolve')).statusCode).toBe(200);
    expect((await send(host.b,id,'not sent')).statusCode).toBe(403);
    expect(json(await read(guest.b,id)).data).toHaveLength(3);
  });
});


describe('QA-F01 application meal summary',()=>{
 it('returns matching public metadata for two pending meals, masks deleted hosts and does not add private fields',async()=>{
  const first=await setup(),second=await setup(),applicant=await member();
  const meals:string[]=[];
  for(const [index,fixture] of [first,second].entries()){
   const {rows:[c]}=await h.db.pool.query('SELECT meal_id FROM conversations WHERE id=$1',[fixture.id]);meals.push(c.meal_id);
   await h.db.pool.query(`UPDATE meals SET title=$2,starts_at=$3::timestamptz,closes_at=$3::timestamptz-interval '1 hour',scheduled_end_at=$3::timestamptz+interval '2 hours',start_local_date=($3::timestamptz AT TIME ZONE 'Europe/London')::date,start_local_time=to_char($3::timestamptz AT TIME ZONE 'Europe/London','HH24:MI'),close_local_date=(($3::timestamptz-interval '1 hour') AT TIME ZONE 'Europe/London')::date,close_local_time=to_char(($3::timestamptz-interval '1 hour') AT TIME ZONE 'Europe/London','HH24:MI') WHERE id=$1`,[c.meal_id,index?'Saturday brunch':'Friday dinner',index?'2030-01-02T12:30:00Z':'2030-01-01T18:00:00Z']);
   await h.db.pool.query(`INSERT INTO profiles(user_id,display_name) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET display_name=EXCLUDED.display_name`,[fixture.host.id,index?'Emma Hill':'Maya Chen']);
   await h.db.pool.query(`INSERT INTO applications(meal_id,user_id,round,state,message) VALUES($1,$2,1,'PENDING','Private QA applicant introduction')`,[c.meal_id,applicant.id]);
  }
  const response=await applicant.b.request('GET','/v1/inbox');expect(response.statusCode,response.body).toBe(200);
  const items=json(response).data;expect(items).toHaveLength(2);
  for(const [index,id] of meals.entries()){
   const item=items.find((i:{application:{mealId:string}})=>i.application.mealId===id);
   expect(item.applicationMeal).toMatchObject({title:index?'Saturday brunch':'Friday dinner',hostDisplayName:index?'Emma Hill':'Maya Chen',startsAt:{localTime:index?'12:30':'18:00',timeZone:'Europe/London'}});
   expect(Object.keys(item.applicationMeal).sort()).toEqual(['hostDisplayName','startsAt','title']);expect(item.conversation).toBeUndefined();
  }
  await h.db.pool.query(`UPDATE users SET status='DELETING' WHERE id=$1`,[first.host.id]);
  const deleted=json(await applicant.b.request('GET','/v1/inbox')).data.find((i:{application:{mealId:string}})=>i.application.mealId===meals[0]);
  expect(deleted.applicationMeal).toMatchObject({title:'Meal unavailable',hostDisplayName:'Deleted member'});
 });
});
