import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,expect,inject,it} from 'vitest';
import {Browser,createHarness,json,type Harness} from '../apps/api/src/test/harness.ts';
import {londonTime} from '../apps/api/src/meals/time.ts';
import {createRunner} from '../apps/worker/src/runner/runner.ts';
import {lifecycleHandler} from '../apps/worker/src/handlers/lifecycle.ts';
import {mailDelivery,type MailProvider} from '../apps/worker/src/mail/delivery.ts';
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


it('QA-NOTIFY-001 actual approved/declined/cancel recipient matrix excludes withdrawn and left; messages never email',async()=>{
 const host=await actor(),confirmed=await actor(),pending=await actor(),declined=await actor(),withdrawn=await actor(),left=await actor();
 const meal=await publish(host.b),ids=new Map<string,string>();
 for(const p of [confirmed,pending,declined,withdrawn,left]){const response=await apply(p.b,meal.id);expect(response.statusCode,response.body).toBe(201);ids.set(p.id,json(response).data.id);}
 for(const p of [confirmed,left])expect((await decide(host.b,ids.get(p.id)!)).statusCode).toBe(200);
 expect((await decide(host.b,ids.get(declined.id)!,'1','DECLINE')).statusCode).toBe(200);
 expect((await withdrawn.b.request('POST',`/v1/applications/${ids.get(withdrawn.id)}/withdraw`,{headers:{'if-match':'"1"','idempotency-key':randomUUID()}})).statusCode).toBe(200);
 const current=(await detail(left.b,meal.id)).meal;expect((await left.b.request('POST',`/v1/meals/${meal.id}/leave`,{headers:{'if-match':`"${current.version}"`,'idempotency-key':randomUUID()}})).statusCode).toBe(200);
 const approved=(await h.db.pool.query(`SELECT recipient_id FROM outbox WHERE template='application_approved' AND payload->>'mealId'=$1 ORDER BY recipient_id`,[meal.id])).rows.map(x=>x.recipient_id);expect(approved.sort()).toEqual([confirmed.id,left.id].sort());
 expect((await h.db.pool.query(`SELECT recipient_id FROM notifications WHERE template='application_approved' AND refs->>'mealId'=$1 ORDER BY recipient_id`,[meal.id])).rows.map(x=>x.recipient_id).sort()).toEqual([confirmed.id,left.id].sort());
 expect((await h.db.pool.query(`SELECT recipient_id FROM outbox WHERE template='application_declined' AND payload->>'mealId'=$1`,[meal.id])).rows.map(x=>x.recipient_id)).toEqual([declined.id]);
 const rejected=(await h.db.pool.query(`SELECT recipient_id FROM notifications WHERE template='application_declined' AND refs->>'mealId'=$1`,[meal.id])).rows.map(x=>x.recipient_id);expect(rejected).toEqual([declined.id]);
 const convo=(await h.db.pool.query('SELECT id FROM conversations WHERE meal_id=$1',[meal.id])).rows[0].id;
 const before=Number((await h.db.pool.query('SELECT count(*) n FROM outbox')).rows[0].n),privateBody='QA_NOTIFICATION_PRIVATE_CHAT_BODY';
 const message=await confirmed.b.request('POST',`/v1/conversations/${convo}/messages`,{body:{body:privateBody,clientMessageId:randomUUID()}});expect(message.statusCode,message.body).toBe(201);
 expect(Number((await h.db.pool.query('SELECT count(*) n FROM outbox')).rows[0].n)).toBe(before);
 const inbox=json(await host.b.request('GET','/v1/inbox')).data;expect(inbox.find((x:{conversation?:{id:string}})=>x.conversation?.id===convo).unreadCount).toBe(1);
 const latest=(await detail(host.b,meal.id)).meal,cancel=await host.b.request('POST',`/v1/meals/${meal.id}/cancel`,{body:{reason:'booking'},headers:{'if-match':`"${latest.version}"`,'idempotency-key':randomUUID()}});expect(cancel.statusCode,cancel.body).toBe(200);
 const expected=[host.id,confirmed.id,pending.id].sort();
 for(const [table,field]of [['outbox','payload'],['notifications','refs']]){const rows=(await h.db.pool.query(`SELECT recipient_id FROM ${table} WHERE template='meal_cancelled' AND ${field}->>'mealId'=$1 ORDER BY recipient_id`,[meal.id])).rows;expect(rows.map(x=>x.recipient_id).sort()).toEqual(expected);}
 const rows=(await h.db.pool.query(`SELECT event_id,recipient_id,channel,template,payload FROM outbox WHERE payload->>'mealId'=$1`,[meal.id])).rows;
 expect(new Set(rows.map(r=>`${r.event_id}:${r.recipient_id}:${r.channel}`)).size).toBe(rows.length);
 for(const r of rows){expect(Object.keys(r.payload).every(k=>['mealId','applicationId'].includes(k))).toBe(true);expect(JSON.stringify(r.payload)).not.toContain(privateBody);}
});
it('QA-NOTIFY-002 actual approval seat and in-app notice survive ambiguous mail failure',async()=>{
 const host=await actor(),guest=await actor(),meal=await publish(host.b);const applied=await apply(guest.b,meal.id);expect(applied.statusCode).toBe(201);const app=json(applied).data;expect((await decide(host.b,app.id)).statusCode).toBe(200);
 const id=(await h.db.pool.query(`SELECT id FROM outbox WHERE template='application_approved' AND recipient_id=$1 AND payload->>'mealId'=$2`,[guest.id,meal.id])).rows[0].id;
 const provider:MailProvider={kind:'test',send:async()=>{throw Error('synthetic network ambiguity');},lookup:async()=>({status:'UNKNOWN'})};await mailDelivery(h.db.pool,provider,'test').tick();
 expect((await h.db.pool.query('SELECT status FROM outbox WHERE id=$1',[id])).rows[0].status).toBe('UNKNOWN');expect((await h.db.pool.query('SELECT state FROM applications WHERE id=$1',[app.id])).rows[0].state).toBe('CONFIRMED');
 expect((await h.db.pool.query(`SELECT count(*)::int n FROM seat_events WHERE meal_id=$1 AND user_id=$2 AND type='GUEST_CONFIRMED'`,[meal.id,guest.id])).rows[0].n).toBe(1);
 expect((await h.db.pool.query(`SELECT count(*)::int n FROM notifications WHERE recipient_id=$1 AND template='application_approved' AND refs->>'mealId'=$2`,[guest.id,meal.id])).rows[0].n).toBe(1);
});

it('QA-NOTIFY-001 qualified deadline expires pending once with in-app and email through actual lifecycle worker',async()=>{
 const host=await actor(),confirmed=await actor(),pending=await actor(),meal=await publish(host.b);
 const approved=json(await apply(confirmed.b,meal.id)).data,waiting=json(await apply(pending.b,meal.id)).data;expect((await decide(host.b,approved.id)).statusCode).toBe(200);
 // Dedicated disposable fixture only: make the previously valid close plan due, preserving real command-created facts.
 await h.db.pool.query(`UPDATE meals SET closes_at=clock_timestamp()-interval '1 millisecond' WHERE id=$1`,[meal.id]);
 await h.db.pool.query(`UPDATE jobs j SET due_at=m.closes_at,run_after=m.closes_at FROM meals m WHERE j.resource_id=m.id AND m.id=$1 AND j.kind='meal.close'`,[meal.id]);
 const runner=createRunner({pool:h.db.pool,owner:'qa-notification-deadline',handlers:{'meal.close':lifecycleHandler(h.db.pool)}});const tick=await runner.tick();const jobs=(await h.db.pool.query('SELECT kind,state,last_error FROM jobs WHERE resource_id=$1',[meal.id])).rows;expect(tick,JSON.stringify(jobs)).toMatchObject({done:1});expect((await runner.tick()).claimed).toBe(0);
 expect((await h.db.pool.query('SELECT state FROM applications WHERE id=$1',[waiting.id])).rows[0].state).toBe('EXPIRED');expect((await h.db.pool.query('SELECT status FROM meals WHERE id=$1',[meal.id])).rows[0].status).toBe('OPEN');
 for(const [table,field]of [['outbox','payload'],['notifications','refs']]){const rows=(await h.db.pool.query(`SELECT recipient_id FROM ${table} WHERE template='application_expired' AND ${field}->>'mealId'=$1`,[meal.id])).rows;expect(rows).toEqual([{recipient_id:pending.id}]);}
 const rows=(await h.db.pool.query(`SELECT event_id,recipient_id,channel,payload FROM outbox WHERE payload->>'mealId'=$1`,[meal.id])).rows;expect(new Set(rows.map(r=>`${r.event_id}:${r.recipient_id}:${r.channel}`)).size).toBe(rows.length);for(const r of rows)expect(Object.keys(r.payload).sort()).toEqual(['applicationId','mealId']);
});
