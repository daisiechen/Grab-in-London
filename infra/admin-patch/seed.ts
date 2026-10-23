/** Synthetic SQL source facts for the dedicated admin rig; never used by production boot. */
import {randomUUID} from 'node:crypto';
import type {Pool} from '../../packages/db/src/index.ts';
export const ADMIN_TARGET='20000000-0000-4000-8000-000000000001';
export const ADMIN_HOST='30000000-0000-4000-8000-000000000001';
export const ADMIN_GUESTS=[ADMIN_TARGET,...[2,3,4].map(n=>`20000000-0000-4000-8000-${String(n).padStart(12,'0')}`)];
export const ADMIN_SCENARIO={meals:16,attendanceRows:80,knownAttendance:64,present:48,absent:16,unknown:16,coverage:{numerator:64,denominator:80}};
export async function seedAdminScenario(pool:Pool){
 const db=await pool.connect();
 try{
  await db.query('BEGIN');
  const {rows:[existing]}=await db.query<{n:string}>(`SELECT count(*)::text n FROM meals`);
  if(existing!.n!=='0')throw new Error('ADMIN_SEED_REQUIRES_EMPTY_MEALS');
  for(const id of [ADMIN_HOST,...ADMIN_GUESTS]){
   await db.query(`INSERT INTO users(id,created_at) VALUES($1,'2026-07-01') ON CONFLICT(id) DO NOTHING`,[id]);
   await db.query(`UPDATE users SET created_at='2026-07-01' WHERE id=$1`,[id]);
  }
  const venue=randomUUID();await db.query(`INSERT INTO venues(id,place_id,provider) VALUES($1,'admin-p11-synthetic-place','fixture')`,[venue]);
  for(let index=0;index<16;index++){
   const day=`2026-10-${String(index+2).padStart(2,'0')}`,meal=randomUUID();
   await db.query(`INSERT INTO meals(id,host_id,venue_ref,title,description,starts_at,closes_at,scheduled_end_at,start_local_date,start_local_time,start_offset,close_local_date,close_local_time,close_offset,minimum,capacity,budget_min_pence,budget_max_pence,languages,mood,area_code,booking_mode,terms_version,attempt_id,status,created_at)
    VALUES($1,$2,$3,$4,'Synthetic local admin acceptance meal; no real people or restaurant.',($5||'T12:00:00Z')::timestamptz,($5||'T11:00:00Z')::timestamptz,($5||'T14:00:00Z')::timestamptz,$5,'13:00',60,$5,'12:00',60,2,5,1000,$6,ARRAY['en','zh'],'EASY_CONVERSATION',$7,'EXTERNAL_PAY_AT_VENUE','synthetic-p11',$8,'COMPLETED','2026-09-20')`,
    [meal,ADMIN_HOST,venue,`Synthetic meal ${index+1}`,day,index%2?3000:2000,index%2?'shoreditch':'soho',randomUUID()]);
   await db.query(`INSERT INTO seat_events(meal_id,seq,user_id,type,effective_at,command_id) VALUES($1,1,$2,'HOST_CONFIRMED','2026-09-20',$3)`,[meal,ADMIN_HOST,randomUUID()]);
   await db.query(`INSERT INTO attendance_revisions(meal_id,subject_id,source,value,version,actor_id,created_at) VALUES($1,$2,'SELF','present',1,$2,($3||'T15:00:00Z')::timestamptz)`,[meal,ADMIN_HOST,day]);
   for(const [i,guest]of ADMIN_GUESTS.entries()){
    const application=randomUUID();
    await db.query(`INSERT INTO applications(id,meal_id,user_id,round,state,message,created_at,decided_at) VALUES($1,$2,$3,1,'CONFIRMED','Synthetic application text never exported.','2026-09-28T10:00:00Z','2026-09-28T13:00:00Z')`,[application,meal,guest]);
    await db.query(`INSERT INTO seat_events(meal_id,seq,user_id,application_id,type,effective_at,command_id) VALUES($1,$2,$3,$4,'GUEST_CONFIRMED','2026-09-28T13:00:00Z',$5)`,[meal,i+2,guest,application,randomUUID()]);
    if(i<3)await db.query(`INSERT INTO attendance_revisions(meal_id,subject_id,source,value,version,actor_id,created_at) VALUES($1,$2,'HOST',$3,1,$4,($5||'T15:00:00Z')::timestamptz)`,[meal,guest,i===0?'absent':'present',ADMIN_HOST,day]);
    if(i<2)await db.query(`INSERT INTO attendance_revisions(meal_id,subject_id,source,value,version,actor_id,created_at) VALUES($1,$2,'SELF',$3,2,$2,($4||'T16:00:00Z')::timestamptz)`,[meal,guest,i===0?'present':'absent',day]);
    if(i<2)await db.query(`INSERT INTO experience_revisions(meal_id,user_id,score,revision,created_at) VALUES($1,$2,$3,1,($4||'T16:15:00Z')::timestamptz)`,[meal,guest,i===0?5:3,day]);
   }
  }
  await db.query('COMMIT');return ADMIN_SCENARIO;
 }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
}
