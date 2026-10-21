import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,describe,expect,inject,it} from 'vitest';
import {migrate} from '@fancy/db';
import {createMigratedDatabase,type MigratedDatabase} from '@fancy/testkit/db';
import {createRunner} from '../runner/runner.ts';
import {lifecycleHandler} from './lifecycle.ts';
let db:MigratedDatabase;beforeAll(async()=>{db=await createMigratedDatabase(inject('pgServerUrl'),migrate);});afterAll(async()=>{await db.drop();});
describe('lifecycle worker integration',()=>{
 it('claims a due job and cancels an undersubscribed meal once at its historical deadline',async()=>{
  const {rows:[user]}=await db.pool.query(`INSERT INTO users DEFAULT VALUES RETURNING id`);
  const {rows:[venue]}=await db.pool.query(`INSERT INTO venues(place_id,provider) VALUES($1,'fixture') RETURNING id`,[randomUUID()]);
  const start=new Date(Date.now()+3600_000),close=new Date(Date.now()-60_000);
  const {rows:[meal]}=await db.pool.query(`INSERT INTO meals(host_id,venue_ref,title,description,starts_at,closes_at,scheduled_end_at,start_local_date,start_local_time,start_offset,close_local_date,close_local_time,close_offset,minimum,capacity,budget_min_pence,budget_max_pence,languages,mood,booking_mode,terms_version,attempt_id)
   VALUES($1,$2,'Worker test meal','Worker fixture for delayed lifecycle',$3,$4,$3::timestamptz+interval '2 hours','2026-10-21','18:00',0,'2026-10-21','17:00',0,2,4,1000,2000,ARRAY['en'],'EASY_CONVERSATION','EXTERNAL_PAY_AT_VENUE','test',$5) RETURNING id`,[user.id,venue.id,start,close,randomUUID()]);
  await db.pool.query(`INSERT INTO seat_events(meal_id,seq,user_id,type,effective_at,command_id) VALUES($1,1,$2,'HOST_CONFIRMED',$3,$4)`,[meal.id,user.id,new Date(close.getTime()-60000),randomUUID()]);
  await db.pool.query(`INSERT INTO jobs(kind,resource_id,due_at,run_after) VALUES('meal.close',$1,$2,$2)`,[meal.id,close]);
  const runner=createRunner({pool:db.pool,owner:'lifecycle-test',handlers:{'meal.close':lifecycleHandler(db.pool)}});
  expect(await runner.tick()).toMatchObject({claimed:1,done:1});expect(await runner.tick()).toMatchObject({claimed:0});
  const {rows:[result]}=await db.pool.query(`SELECT status,cancel_reason FROM meals WHERE id=$1`,[meal.id]);expect(result).toEqual({status:'CANCELLED',cancel_reason:'insufficient'});
  const {rows:events}=await db.pool.query(`SELECT effective_at FROM business_events WHERE aggregate_id=$1 AND kind='meal.cancelled'`,[meal.id]);expect(events).toHaveLength(1);expect(events[0].effective_at).toEqual(close);
 });
});
