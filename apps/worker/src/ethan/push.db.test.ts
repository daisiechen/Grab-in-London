import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,beforeEach,describe,expect,inject,it} from 'vitest';
import {migrate} from '@fancy/db';
import {createMigratedDatabase,type MigratedDatabase} from '@fancy/testkit/db';
import {ethanDelivery,TestEthanPush,type EthanDeadEvent} from './push.ts';
import {mailDelivery,type MailProvider} from '../mail/delivery.ts';

let db:MigratedDatabase;beforeAll(async()=>{db=await createMigratedDatabase(inject('pgServerUrl'),migrate);});afterAll(async()=>{await db.drop();});
const ADMIN='https://fancyabite.uk/admin/';
const stats={open:2,autoLimited:0,overdue:0,dueWithin6h:0,oldestHoursLeft:23.5,urgentOpen:2};
async function alert(kind='urgent',reportIds=[randomUUID()],count=1){
 const id=(await db.pool.query(`INSERT INTO moderation_alerts(kind,alert_day,reason,report_ids,report_count,stats) VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
  [kind,kind==='urgent'?null:new Date(Date.UTC(2026,10,1)+Math.floor(Math.random()*1e6)*86_400_000).toISOString().slice(0,10),kind==='urgent'?'under_18':null,reportIds,count,stats])).rows[0].id as string;
 const outbox=(await db.pool.query(`INSERT INTO outbox(event_id,recipient_id,channel,template,payload) VALUES($1,NULL,'ETHAN',$2,$3) RETURNING id`,[id,`moderation_${kind}`,{alertId:id}])).rows[0].id as string;
 return {id,outbox};
}
const row=async(id:string)=>(await db.pool.query(`SELECT * FROM outbox WHERE id=$1`,[id])).rows[0];
const due=(id:string)=>db.pool.query(`UPDATE outbox SET next_attempt_at=clock_timestamp() WHERE id=$1`,[id]);

describe('Ethan push delivery',()=>{
 beforeEach(async()=>{await db.pool.query(`UPDATE outbox SET status='SENT' WHERE channel='ETHAN' AND status<>'DEAD'`);});
 it('sends the alert as counts and an admin link, once',async()=>{
  const reportId=randomUUID(),a=await alert('urgent',[reportId],3),push=new TestEthanPush();
  const service=ethanDelivery(db.pool,push,{adminUrl:ADMIN,environment:'test',now:()=>new Date('2026-11-05T09:00:00Z')});
  await service.tick();
  expect(push.sent).toEqual([{idempotencyKey:a.outbox,payload:{kind:'urgent',sentAt:'2026-11-05T09:00:00.000Z',open:2,autoLimited:0,overdue:0,dueWithin6h:0,oldestHoursLeft:23.5,urgentOpen:2,reason:'under_18',count:3,adminUrl:`${ADMIN}#moderation/${reportId}`}}]);
  expect((await row(a.outbox)).status).toBe('SENT');
  await service.tick();expect(push.sent).toHaveLength(1);
 });
 it('retries 429/5xx with backoff, dead-letters other 4xx without the token, and leaves email rows alone',async()=>{
  const a=await alert('morning'),push=new TestEthanPush(),dead:EthanDeadEvent[]=[];
  push.next=[{status:'RETRY',errorCode:'HTTP_429'},{status:'REJECTED',httpStatus:401}];
  const service=ethanDelivery(db.pool,push,{adminUrl:ADMIN,environment:'test',onDead:(e)=>dead.push(e)});
  await service.tick();
  const retry=await row(a.outbox);
  expect(retry).toMatchObject({status:'FAILED',attempts:1,last_error_code:'HTTP_429'});
  expect(retry.next_attempt_at.getTime()).toBeGreaterThan(Date.now()+20_000);
  await service.tick();expect((await row(a.outbox)).attempts).toBe(1);
  await due(a.outbox);await service.tick();
  expect(await row(a.outbox)).toMatchObject({status:'DEAD',last_error_code:'HTTP_401',attempts:2});
  expect(dead).toEqual([{event:'ethan_push_dead',outboxId:a.outbox,errorCode:'HTTP_401',attempts:2}]);
  // The mail loop never claims ETHAN rows, and vice versa.
  const b=await alert('evening');let mailed=0;
  const mail:MailProvider={kind:'test',send:async()=>{mailed++;return{status:'SENT',providerId:'x'};},lookup:async()=>({status:'UNKNOWN'})};
  await mailDelivery(db.pool,mail,'test',{support:{email:'support@example.invalid',adminUrl:ADMIN}}).tick();
  expect(mailed).toBe(0);expect((await row(b.outbox)).status).toBe('PENDING');
 });
 it('gives up after 8 attempts or 24 hours, keeps rows pending without an adapter, and refuses the test adapter when deployed',async()=>{
  const a=await alert('morning');
  await ethanDelivery(db.pool,null,{adminUrl:ADMIN,environment:'test'}).tick();
  expect(await row(a.outbox)).toMatchObject({status:'PENDING',attempts:0});
  await db.pool.query(`UPDATE outbox SET attempts=8,status='FAILED' WHERE id=$1`,[a.outbox]);
  const dead:EthanDeadEvent[]=[];
  await ethanDelivery(db.pool,null,{adminUrl:ADMIN,environment:'test',onDead:(e)=>dead.push(e)}).tick();
  expect(await row(a.outbox)).toMatchObject({status:'DEAD',last_error_code:'RETRY_EXHAUSTED'});
  expect(dead.map((d)=>d.outboxId)).toContain(a.outbox);
  expect(()=>ethanDelivery(db.pool,new TestEthanPush(),{adminUrl:ADMIN,environment:'production'})).toThrow('TEST_PUSH_FORBIDDEN');
 });
 it('dead-letters a malformed row without sending',async()=>{
  const id=(await db.pool.query(`INSERT INTO outbox(event_id,recipient_id,channel,template,payload) VALUES($1,NULL,'ETHAN','moderation_urgent',$2) RETURNING id`,[randomUUID(),{alertId:randomUUID(),body:'PRIVATE'}])).rows[0].id as string;
  const push=new TestEthanPush();await ethanDelivery(db.pool,push,{adminUrl:ADMIN,environment:'test',onDead:()=>{}}).tick();
  expect(push.sent).toEqual([]);expect(await row(id)).toMatchObject({status:'DEAD',last_error_code:'INVALID_PAYLOAD'});
 });
});

describe('urgent alert email',()=>{
 it('mails the urgent alert to the support address as admin links only',async()=>{
  const reports=[randomUUID(),randomUUID()];
  const id=(await db.pool.query(`INSERT INTO moderation_alerts(kind,reason,report_ids,report_count,stats) VALUES('urgent','safety',$1,2,$2) RETURNING id`,[reports,stats])).rows[0].id as string;
  const outbox=(await db.pool.query(`INSERT INTO outbox(event_id,recipient_id,channel,template,payload) VALUES($1,NULL,'EMAIL','moderation_urgent',$2) RETURNING id`,[id,{alertId:id}])).rows[0].id as string;
  const seen:unknown[]=[];
  const mail:MailProvider={kind:'test',send:async(input)=>{seen.push({email:input.email,template:input.template,links:input.links});return{status:'SENT',providerId:'urgent'};},lookup:async()=>({status:'UNKNOWN'})};
  await mailDelivery(db.pool,mail,'test',{support:{email:'support@example.invalid',adminUrl:ADMIN}}).tick();
  expect(seen).toEqual([{email:'support@example.invalid',template:'moderation_urgent',links:reports.map((r)=>`${ADMIN}#moderation/${r}`)}]);
  expect((await row(outbox)).status).toBe('SENT');
 });
});
