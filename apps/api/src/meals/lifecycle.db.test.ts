import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,describe,expect,inject,it} from 'vitest';
import {migrate} from '@fancy/db';
import {createMigratedDatabase,type MigratedDatabase} from '@fancy/testkit/db';
import {withTransaction} from '../common/transaction.ts';
import {DomainError} from '../common/errors.ts';
import {lockMeal} from './commands.ts';
let db:MigratedDatabase;
beforeAll(async()=>{db=await createMigratedDatabase(inject('pgServerUrl'),migrate);});afterAll(async()=>{await db.drop();});
async function history(options:{guest?:boolean;left?:'before-close'|'at-close'|'after-start'}={}){
 const ids=[randomUUID(),randomUUID(),randomUUID()];for(const id of ids)await db.pool.query(`INSERT INTO users(id) VALUES($1)`,[id]);
 const host=ids[0]!,guest=ids[1]!,pending=ids[2]!;
 const {rows:[venue]}=await db.pool.query(`INSERT INTO venues(place_id,provider,area_code) VALUES($1,'fixture','unknown') RETURNING id`,[`fixture_${randomUUID().replaceAll('-','')}`]);
 const start=new Date(Date.now()-3*3_600_000),close=new Date(start.getTime()-3_600_000),end=new Date(start.getTime()+2*3_600_000);
 const {rows:[meal]}=await db.pool.query(`INSERT INTO meals(host_id,venue_ref,title,description,starts_at,closes_at,scheduled_end_at,start_local_date,start_local_time,start_offset,close_local_date,close_local_time,close_offset,minimum,capacity,budget_min_pence,budget_max_pence,languages,mood,booking_mode,terms_version,attempt_id) VALUES($1,$2,'Historical fixture','Historical fixture meal description',$3,$4,$5,'2026-10-21','12:00',0,'2026-10-21','11:00',0,2,4,1000,2000,ARRAY['en'],'EASY_CONVERSATION','EXTERNAL_PAY_AT_VENUE','2026-10-21',$6) RETURNING id`,[host,venue.id,start,close,end,randomUUID()]);
 const id=meal.id as string;let seq=0;
 const event=async(userId:string,type:string,at:Date)=>{seq++;await db.pool.query(`INSERT INTO seat_events(meal_id,seq,user_id,type,effective_at,command_id) VALUES($1,$2,$3,$4,$5,$6)`,[id,seq,userId,type,at,randomUUID()]);};
 await event(host,'HOST_CONFIRMED',new Date(close.getTime()-3_600_000));
 if(options.guest){await event(guest,'GUEST_CONFIRMED',new Date(close.getTime()-60_000));if(options.left)await event(guest,'LEFT',new Date(options.left==='after-start'?start.getTime()+1:options.left==='at-close'?close.getTime():close.getTime()-1));}
 await db.pool.query(`UPDATE meals SET head=$2 WHERE id=$1`,[id,seq]);
 await db.pool.query(`INSERT INTO applications(meal_id,user_id,round,state,message) VALUES($1,$2,1,'PENDING','A pending historical application message')`,[id,pending]);
 return {id,host,guest,pending,start,close,end};
}
describe('delayed lifecycle uses authoritative seat history',()=>{
 it('completes once and seals historical start roster even if a guest left later',async()=>{
  const fixture=await history({guest:true,left:'after-start'});
  await withTransaction(db.pool,tx=>lockMeal(tx,fixture.id,fixture.host));
  let row=(await db.pool.query(`SELECT status FROM meals WHERE id=$1`,[fixture.id])).rows[0];expect(row.status).toBe('COMPLETED');
  expect((await db.pool.query(`SELECT user_id FROM start_roster WHERE meal_id=$1 ORDER BY user_id`,[fixture.id])).rows.map(r=>r.user_id)).toEqual([fixture.host,fixture.guest].sort());
  const facts=(await db.pool.query(`SELECT kind,effective_at FROM business_events WHERE aggregate_id=$1 ORDER BY aggregate_seq`,[fixture.id])).rows;
  expect(facts.map(r=>r.kind)).toEqual(['meal.close','meal.start','meal.end']);
  expect(facts.map(r=>(r.effective_at as Date).getTime())).toEqual([fixture.close,fixture.start,fixture.end].map(d=>d.getTime()));
  await withTransaction(db.pool,tx=>lockMeal(tx,fixture.id,fixture.host));
  expect((await db.pool.query(`SELECT * FROM lifecycle_marks WHERE meal_id=$1`,[fixture.id])).rowCount).toBe(3);
  row=(await db.pool.query(`SELECT count(*) FROM business_events WHERE aggregate_id=$1`,[fixture.id])).rows[0];expect(Number(row.count)).toBe(3);
 });
 it('cancels at the cutoff with equal-time exit excluded, expires pending and notifies every pending recipient',async()=>{
  const fixture=await history({guest:true,left:'at-close'});
  await withTransaction(db.pool,tx=>lockMeal(tx,fixture.id,fixture.host));
  const row=(await db.pool.query(`SELECT status,cancel_reason FROM meals WHERE id=$1`,[fixture.id])).rows[0];expect(row).toEqual({status:'CANCELLED',cancel_reason:'insufficient'});
  expect((await db.pool.query(`SELECT * FROM start_roster WHERE meal_id=$1`,[fixture.id])).rowCount).toBe(0);
  expect((await db.pool.query(`SELECT state FROM applications WHERE meal_id=$1`,[fixture.id])).rows[0].state).toBe('EXPIRED');
  const recipients=(await db.pool.query(`SELECT recipient_id FROM notifications WHERE refs->>'mealId'=$1`,[fixture.id])).rows.map(r=>r.recipient_id);expect(recipients).toContain(fixture.pending);expect(recipients).toContain(fixture.host);
  const event=(await db.pool.query(`SELECT effective_at FROM business_events WHERE aggregate_id=$1 AND kind='meal.cancelled'`,[fixture.id])).rows[0];expect(event.effective_at.getTime()).toBe(fixture.close.getTime());
 });
 it('commits overdue facts even when the subsequent business command is refused',async()=>{
  const fixture=await history();
  await expect(withTransaction(db.pool,async tx=>{await lockMeal(tx,fixture.id,fixture.host);throw new DomainError('MEAL_CANCELLED','Cancelled.');},{commitOnDomainError:true})).rejects.toMatchObject({code:'MEAL_CANCELLED'});
  expect((await db.pool.query(`SELECT status FROM meals WHERE id=$1`,[fixture.id])).rows[0].status).toBe('CANCELLED');
 });
});
