import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,describe,expect,inject,it} from 'vitest';
import {migrate} from '@fancy/db';
import {createMigratedDatabase,type MigratedDatabase} from '@fancy/testkit/db';
import {mailDelivery,UnavailableMailProvider,type MailProvider} from './delivery.ts';
let db:MigratedDatabase;beforeAll(async()=>{db=await createMigratedDatabase(inject('pgServerUrl'),migrate);});afterAll(async()=>{await db.drop();});
async function queued(template='meal_cancelled',payload:Record<string,string>={mealId:randomUUID()}){
 const user=(await db.pool.query(`INSERT INTO users DEFAULT VALUES RETURNING id`)).rows[0].id;
 await db.pool.query(`INSERT INTO private_contact(user_id,email,email_verified_at) VALUES($1,$2,clock_timestamp())`,[user,`${randomUUID()}@example.invalid`]);
 return(await db.pool.query(`INSERT INTO outbox(event_id,recipient_id,channel,template,payload) VALUES($1,$2,'EMAIL',$3,$4) RETURNING id`,[randomUUID(),user,template,payload])).rows[0].id as string;
}
const row=async(id:string)=>(await db.pool.query(`SELECT * FROM outbox WHERE id=$1`,[id])).rows[0];
describe('transactional mail delivery',()=>{
 it('uses one provider idempotency identity and never resends an ambiguous outcome without lookup proof',async()=>{
  const id=await queued();let sent=0,lookups=0;
  const provider:MailProvider={kind:'test',send:async(input)=>{sent++;expect(input.idempotencyKey).toBe(id);expect(Object.keys(input.refs)).toEqual(['mealId']);return{status:'UNKNOWN'};},lookup:async(key)=>{lookups++;expect(key).toBe(id);return{status:'SENT',providerId:'synthetic-provider-message'};}};
  const service=mailDelivery(db.pool,provider,'test');expect(await service.tick()).toBe(1);expect((await row(id)).status).toBe('UNKNOWN');
  await db.pool.query(`UPDATE outbox SET next_attempt_at=clock_timestamp() WHERE id=$1`,[id]);expect(await service.tick()).toBe(1);expect((await row(id)).status).toBe('SENT');expect(sent).toBe(1);expect(lookups).toBe(1);
 });
 it('recovers an expired sending lease as UNKNOWN and never dispatches raw body payloads',async()=>{
  const id=await queued();await db.pool.query(`UPDATE outbox SET status='SENDING',claim_token=gen_random_uuid(),lease_until=clock_timestamp()-interval '1 second' WHERE id=$1`,[id]);
  const bad=await queued('meal_cancelled',{body:'private-message-sentinel'});let sent=0;
  const provider:MailProvider={kind:'test',send:async()=>{sent++;return{status:'SENT',providerId:'test'};},lookup:async()=>({status:'UNKNOWN'})};
  await mailDelivery(db.pool,provider,'test').tick();expect(sent).toBe(0);expect((await row(id)).status).toBe('UNKNOWN');expect((await row(bad)).last_error_code).toBe('INVALID_PAYLOAD');
 });
 it('preserves pending work without credentials, and refuses test adapters in production',async()=>{
  const id=await queued();await mailDelivery(db.pool,new UnavailableMailProvider(),'test').tick();expect((await row(id)).attempts).toBe(0);
  expect(()=>mailDelivery(db.pool,{kind:'test',send:async()=>({status:'UNKNOWN'}),lookup:async()=>({status:'UNKNOWN'})},'production')).toThrow('TEST_MAIL_FORBIDDEN');
 });
});
