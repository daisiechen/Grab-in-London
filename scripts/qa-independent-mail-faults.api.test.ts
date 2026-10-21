import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,expect,inject,it,vi} from 'vitest';
import {createHarness,type Harness} from '../apps/api/src/test/harness.ts';
import {mailDelivery,type MailProvider} from '../apps/worker/src/mail/delivery.ts';
let h:Harness;
beforeAll(async()=>{h=await createHarness(inject('pgServerUrl'));});afterAll(async()=>{await h.close();});
async function queued(){
 const user=(await h.db.pool.query('INSERT INTO users DEFAULT VALUES RETURNING id')).rows[0].id;
 await h.db.pool.query('INSERT INTO private_contact(user_id,email,email_verified_at) VALUES($1,$2,clock_timestamp())',[user,`${randomUUID()}@example.invalid`]);
 return(await h.db.pool.query(`INSERT INTO outbox(event_id,recipient_id,channel,template,payload) VALUES($1,$2,'EMAIL','application_approved',$3) RETURNING id`,[randomUUID(),user,{mealId:randomUUID(),applicationId:randomUUID()}])).rows[0].id as string;
}
const row=async(id:string)=>(await h.db.pool.query('SELECT status,attempts,lookup_attempts,last_error_code FROM outbox WHERE id=$1',[id])).rows[0];
const due=(id:string)=>h.db.pool.query('UPDATE outbox SET next_attempt_at=clock_timestamp() WHERE id=$1',[id]);
it('QA-NOTIFY-002 UNKNOWN lookup failure never blindly resends; authoritative NOT_SENT alone permits same-ID retry',async()=>{
 const id=await queued();let sends=0,lookups=0;
 const provider:MailProvider={kind:'test',send:async input=>{sends++;expect(input.idempotencyKey).toBe(id);expect(Object.keys(input.refs).sort()).toEqual(['applicationId','mealId']);return sends===1?{status:'UNKNOWN'}:{status:'SENT',providerId:'synthetic-only'};},lookup:async key=>{lookups++;expect(key).toBe(id);if(lookups===1)throw Error('synthetic timeout');return {status:'NOT_SENT'};}};
 const service=mailDelivery(h.db.pool,provider,'test');await service.tick();expect(await row(id)).toMatchObject({status:'UNKNOWN',attempts:1});
 await due(id);await service.tick();expect(await row(id)).toMatchObject({status:'UNKNOWN',attempts:1,lookup_attempts:1});expect(sends).toBe(1);
 await due(id);await service.tick();expect(await row(id)).toMatchObject({status:'PENDING',attempts:1,lookup_attempts:2});expect(sends).toBe(1);
 await due(id);await service.tick();expect(await row(id)).toMatchObject({status:'SENT',attempts:2});expect(sends).toBe(2);expect(lookups).toBe(2);
});
it('QA-NOTIFY-003 raw private payload is dead-lettered without provider dispatch or logs containing its body',async()=>{
 const id=await queued(),marker='QA_PRIVATE_APPLICATION_BODY_'+randomUUID();await h.db.pool.query('UPDATE outbox SET payload=$2 WHERE id=$1',[id,{mealId:randomUUID(),body:marker}]);
 let calls=0;const provider:MailProvider={kind:'test',send:async()=>{calls++;return {status:'SENT',providerId:'synthetic'};},lookup:async()=>{calls++;return {status:'UNKNOWN'};}};
 const logs=vi.spyOn(console,'error').mockImplementation(()=>{}),warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
 try{await mailDelivery(h.db.pool,provider,'test').tick();expect(calls).toBe(0);expect(await row(id)).toMatchObject({status:'DEAD',last_error_code:'INVALID_PAYLOAD'});expect(JSON.stringify([logs.mock.calls,warn.mock.calls])).not.toContain(marker);}finally{logs.mockRestore();warn.mockRestore();}
});
it('QA-NOTIFY-002 exhausting eight failed attempts must produce an observable dead-letter alert',async()=>{
 const id=await queued();await h.db.pool.query(`UPDATE outbox SET status='FAILED',attempts=8 WHERE id=$1`,[id]);let calls=0;
 const provider:MailProvider={kind:'test',send:async()=>{calls++;return {status:'RETRY'};},lookup:async()=>{calls++;return {status:'UNKNOWN'};}};
 const errors=vi.spyOn(console,'error').mockImplementation(()=>{}),warnings=vi.spyOn(console,'warn').mockImplementation(()=>{});
 try{await mailDelivery(h.db.pool,provider,'test').tick();expect(await row(id)).toMatchObject({status:'DEAD',attempts:8,last_error_code:'RETRY_EXHAUSTED'});expect(calls).toBe(0);expect(errors.mock.calls.length+warnings.mock.calls.length,'Accepted design requires observable mail dead-letter alarm; no observer hook exists and neither warning nor error event emitted').toBeGreaterThan(0);}finally{errors.mockRestore();warnings.mockRestore();}
});
