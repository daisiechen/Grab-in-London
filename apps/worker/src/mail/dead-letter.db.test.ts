import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,expect,inject,it,vi} from 'vitest';
import {loadConfig} from '@fancy/config';
import {createWorkerRuntime} from '../main.ts';
import {migrate} from '@fancy/db';
import {createMigratedDatabase,type MigratedDatabase} from '@fancy/testkit/db';
import {mailDelivery,UnavailableMailProvider,type MailProvider} from './delivery.ts';
let db:MigratedDatabase;beforeAll(async()=>{db=await createMigratedDatabase(inject('pgServerUrl'),migrate);});afterAll(async()=>{await db.drop();});
async function queued(payload:Record<string,string>={mealId:randomUUID()}){
 const user=(await db.pool.query(`INSERT INTO users DEFAULT VALUES RETURNING id`)).rows[0].id;
 const email=`private-mail-${randomUUID()}@example.invalid`;
 await db.pool.query(`INSERT INTO private_contact(user_id,email,email_verified_at) VALUES($1,$2,clock_timestamp())`,[user,email]);
 const {rows:[row]}=await db.pool.query(`INSERT INTO outbox(event_id,recipient_id,channel,template,payload) VALUES($1,$2,'EMAIL','meal_cancelled',$3) RETURNING id`,[randomUUID(),user,payload]);return {id:row.id as string,email,user};
}
const row=async(id:string)=>(await db.pool.query(`SELECT status,attempts,lookup_attempts,last_error_code FROM outbox WHERE id=$1`,[id])).rows[0];
const provider:MailProvider={kind:'test',send:async()=>({status:'RETRY'}),lookup:async()=>({status:'UNKNOWN'})};
it.each(['send','lookup','age'])('observable safe dead-letter event on %s exhaustion, with concurrent and later ticks emitting once',async(reason)=>{
 const marker=`PRIVATE_BODY_${randomUUID()}`,f=await queued({body:marker});
 await db.pool.query(`UPDATE outbox SET status='FAILED',attempts=$2,lookup_attempts=$3,created_at=clock_timestamp()-make_interval(secs=>$4) WHERE id=$1`,[f.id,reason==='send'?8:0,reason==='lookup'?8:0,reason==='age'?86401:0]);
 const logs=vi.spyOn(console,'error').mockImplementation(()=>{});
 try{
  await Promise.all([mailDelivery(db.pool,provider,'test').tick(),mailDelivery(db.pool,provider,'test').tick()]);await mailDelivery(db.pool,provider,'test').tick();
  expect(await row(f.id)).toMatchObject({status:'DEAD',last_error_code:'RETRY_EXHAUSTED'});
  expect(logs).toHaveBeenCalledTimes(1);
  const event=JSON.parse(String(logs.mock.calls[0]![0]));expect(event).toEqual({event:'mail_dead',outboxId:f.id,errorCode:'RETRY_EXHAUSTED',attempts:reason==='send'?8:0,lookupAttempts:reason==='lookup'?8:0});
  const output=JSON.stringify(logs.mock.calls);for(const value of [marker,f.email,f.user,'body','mealId'])expect(output).not.toContain(value);
 }finally{logs.mockRestore();}
});
it('unconfigured sender still alerts exhausted historical work without dispatching fresh pending work',async()=>{
 const exhausted=await queued(),fresh=await queued();await db.pool.query(`UPDATE outbox SET attempts=8,status='FAILED' WHERE id=$1`,[exhausted.id]);
 const logs=vi.spyOn(console,'error').mockImplementation(()=>{});
 try{await mailDelivery(db.pool,new UnavailableMailProvider(),'test').tick();expect(await row(exhausted.id)).toMatchObject({status:'DEAD'});expect(await row(fresh.id)).toMatchObject({status:'PENDING',attempts:0});expect(logs).toHaveBeenCalledTimes(1);}finally{logs.mockRestore();await db.pool.query(`DELETE FROM outbox WHERE id=$1`,[fresh.id]);}
});
it('an eighth active lookup lease cannot be killed by another tick before authoritative SENT returns',async()=>{
 const f=await queued();await db.pool.query(`UPDATE outbox SET status='UNKNOWN',attempts=1,lookup_attempts=7 WHERE id=$1`,[f.id]);
 let release!:()=>void,entered=false;const hold=new Promise<void>(resolve=>{release=resolve;});let sends=0;
 const controlled:MailProvider={kind:'test',send:async()=>{sends++;return {status:'RETRY'};},lookup:async()=>{entered=true;await hold;return {status:'SENT',providerId:'synthetic-only'};}};
 const logs=vi.spyOn(console,'error').mockImplementation(()=>{});const first=mailDelivery(db.pool,controlled,'test').tick();
 try{
  const end=performance.now()+3000;while(!entered){if(performance.now()>end)throw Error('lookup did not enter');await new Promise<void>(resolve=>setImmediate(resolve));}
  await mailDelivery(db.pool,controlled,'test').tick();expect(await row(f.id)).toMatchObject({status:'UNKNOWN',lookup_attempts:8});expect(logs).not.toHaveBeenCalled();
 }finally{release();await first;logs.mockRestore();}
 expect(await row(f.id)).toMatchObject({status:'SENT',attempts:1,lookup_attempts:8});expect(sends).toBe(0);
});
it('async observer rejection is awaited and falls back safely without changing committed DEAD or resending',async()=>{
 const f=await queued();await db.pool.query(`UPDATE outbox SET attempts=8,status='FAILED' WHERE id=$1`,[f.id]);
 const marker=`PRIVATE_OBSERVER_${randomUUID()}`;const observer=vi.fn(async()=>{await Promise.resolve();throw Error(marker);}),logs=vi.spyOn(console,'error').mockImplementation(()=>{});
 try{
  const service=mailDelivery(db.pool,provider,'test',{onDead:observer});await service.tick();await service.tick();
  expect(observer).toHaveBeenCalledTimes(1);expect(logs).toHaveBeenCalledTimes(1);expect(JSON.stringify(logs.mock.calls)).not.toContain(marker);expect(await row(f.id)).toMatchObject({status:'DEAD',attempts:8});
 }finally{logs.mockRestore();}
});
it('real worker runtime explicitly wires one safe alert even with unavailable mail credentials',async()=>{
 const f=await queued();await db.pool.query(`UPDATE outbox SET attempts=8,status='FAILED' WHERE id=$1`,[f.id]);
 const config=loadConfig({ENVIRONMENT:'test',DATABASE_URL:db.url,AUTH_ADAPTER:'test',PLACES_ADAPTER:'fixture',MAIL_ADAPTER:'outbox_test',AI_PROVIDER:'disabled',WEB_ORIGIN:'http://localhost:5174',SESSION_SECRET:'mail-alert-runtime-synthetic-secret-0123456789'});
 const logs=vi.spyOn(console,'error').mockImplementation(()=>{});
 try{const runtime=createWorkerRuntime(db.pool,config);await runtime.tick();await runtime.tick();expect(logs).toHaveBeenCalledTimes(1);expect(JSON.parse(String(logs.mock.calls[0]![0]))).toMatchObject({event:'mail_dead',outboxId:f.id,errorCode:'RETRY_EXHAUSTED'});expect(await row(f.id)).toMatchObject({status:'DEAD',attempts:8});}finally{logs.mockRestore();}
});
