import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,expect,inject,it} from 'vitest';
import {migrate,loadMigrations} from '../packages/db/src/index.ts';
import {createMigratedDatabase,type MigratedDatabase} from '../packages/testkit/src/db/index.ts';
let db:MigratedDatabase;let hostId:string;
beforeAll(async()=>{db=await createMigratedDatabase(inject('pgServerUrl'),migrate);hostId=randomUUID();await db.pool.query('INSERT INTO users(id) VALUES($1)',[hostId]);});afterAll(async()=>{await db.drop();});
async function meal(budget=3000){
 const id=randomUUID();const venue=randomUUID();const starts=new Date(Date.now()+2*86400_000);const closes=new Date(starts.getTime()-3600_000);
 await db.pool.query(`INSERT INTO venues(id,place_id,provider,area_code) VALUES($1,$2,'fixture','soho')`,[venue,`synthetic-${venue}`]);
 await db.pool.query(`INSERT INTO meals(id,host_id,venue_ref,title,description,starts_at,closes_at,scheduled_end_at,start_local_date,start_local_time,start_offset,close_local_date,close_local_time,close_offset,minimum,capacity,budget_min_pence,budget_max_pence,languages,mood,area_code,booking_mode,terms_version,attempt_id)
 VALUES($1,$2,$3,'Synthetic Friday dinner','A relaxed synthetic fixture for local tests only.',$4,$5,$6,$7,'19:00',0,$7,'18:00',0,2,4,1000,$8,ARRAY['en'],'EASY_CONVERSATION','soho','EXTERNAL_PAY_AT_VENUE','2026-10-21',$9)`,[id,hostId,venue,starts,closes,new Date(starts.getTime()+7200_000),new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(starts),budget,randomUUID()]);
 return id;
}

it('QA-CODE-002 direct SQL rejects active duplicate application, invalid capacity, foreign keys and duplicate message without TypeScript guards',async()=>{
 const m=await meal(),actor=randomUUID();await db.pool.query('INSERT INTO users(id) VALUES($1)',[actor]);
 await db.pool.query("INSERT INTO applications(meal_id,user_id,round,state,message) VALUES($1,$2,1,'PENDING','Independent synthetic request text')",[m,actor]);
 await expect(db.pool.query("INSERT INTO applications(meal_id,user_id,round,state,message) VALUES($1,$2,2,'CONFIRMED','Independent synthetic request text')",[m,actor])).rejects.toMatchObject({code:'23505',constraint:'applications_one_active'});
 await expect(db.pool.query('UPDATE meals SET capacity=7 WHERE id=$1',[m])).rejects.toMatchObject({code:'23514'});
 await expect(db.pool.query('UPDATE meals SET host_id=$2 WHERE id=$1',[m,randomUUID()])).rejects.toMatchObject({code:'23503'});
 const c=randomUUID(),messageId=randomUUID();await db.pool.query("INSERT INTO conversations(id,kind,meal_id,head) VALUES($1,'GROUP',$2,2)",[c,m]);
 await db.pool.query("INSERT INTO conversation_events(conversation_id,seq,kind,actor_id,effective_at) VALUES($1,1,'JOIN',$2,clock_timestamp()),($1,2,'MESSAGE',$2,clock_timestamp())",[c,hostId]);
 await db.pool.query('INSERT INTO messages(conversation_id,seq,sender_id,client_message_id,body,created_at) VALUES($1,2,$2,$3,$4,clock_timestamp())',[c,hostId,messageId,'Independent synthetic text']);
 await expect(db.pool.query('INSERT INTO messages(conversation_id,seq,sender_id,client_message_id,body,created_at) VALUES($1,2,$2,$3,$4,clock_timestamp())',[c,hostId,messageId,'Duplicated independent text'])).rejects.toMatchObject({code:'23505'});
 expect((await db.pool.query('SELECT capacity,host_id FROM meals WHERE id=$1',[m])).rows[0]).toEqual({capacity:4,host_id:hostId});
});
it('QA-CODE-002 empty migration and seeded upgrade preserve data across a failed future migration and subsequent retry',async()=>{
 const all=loadMigrations(),fresh=await createMigratedDatabase(inject('pgServerUrl'),url=>migrate(url,all.slice(0,1))),client=fresh.pool;
 try{
  expect(await migrate(fresh.url,all.slice(0,1))).toEqual([]);const id=randomUUID();await client.query('INSERT INTO users(id,version) VALUES($1,7)',[id]);
  expect(await migrate(fresh.url)).toEqual(all.slice(1).map(m=>m.version));expect(await migrate(fresh.url)).toEqual([]);
  const bad={version:'9999_qa_failure',checksum:'synthetic',sql:'CREATE TABLE qa_partial(id int); UPDATE users SET version=999; SELECT 1/0;'};
  await expect(migrate(fresh.url,[...all,bad])).rejects.toThrow(/division by zero/);
  expect((await client.query('SELECT version::text FROM users WHERE id=$1',[id])).rows[0].version).toBe('7');
  expect((await client.query("SELECT to_regclass('qa_partial') t")).rows[0].t).toBeNull();
  expect((await client.query('SELECT count(*)::int n FROM schema_migrations')).rows[0].n).toBe(all.length);expect(await migrate(fresh.url)).toEqual([]);
 }finally{await fresh.drop();}
});
