/** Independent scan bound and no-write observation on real PostgreSQL. */
import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,expect,inject,it} from 'vitest';
import {Browser,createHarness,json,type Harness} from '../apps/api/src/test/harness.ts';
let h:Harness;
beforeAll(async()=>{h=await createHarness(inject('pgServerUrl'));});afterAll(async()=>h.close());
it('QA-DISCOVERY-007 500 ineligible candidates yield continuation rather than scanning beyond the cap or falsely ending',async()=>{
 const host=randomUUID(),venue=randomUUID();await h.db.pool.query('INSERT INTO users(id) VALUES($1)',[host]);await h.db.pool.query("INSERT INTO venues(id,place_id,provider) VALUES($1,'fixture_fancy_north','fixture')",[venue]);
 await h.db.pool.query(`INSERT INTO meals(host_id,venue_ref,title,description,starts_at,closes_at,scheduled_end_at,start_local_date,start_local_time,start_offset,close_local_date,close_local_time,close_offset,minimum,capacity,budget_min_pence,budget_max_pence,languages,mood,booking_mode,terms_version,attempt_id)
 SELECT $1,$2,'Independent scan fixture','Synthetic bounded discovery fixture without real participants.',t,CASE WHEN n<=500 THEN clock_timestamp()-interval '1 hour' ELSE t-interval '1 hour' END,t+interval '2 hours','2030-10-23','12:00',60,'2030-10-23','11:00',60,2,4,1000,2000,ARRAY['en'],'EASY_CONVERSATION','EXTERNAL_PAY_AT_VENUE','2026-10-21',gen_random_uuid() FROM (SELECT n,'2030-10-23T11:00Z'::timestamptz+n*interval '1 second' t FROM generate_series(1,501)n)s`,[host,venue]);
 await h.db.pool.query("INSERT INTO seat_events(meal_id,seq,user_id,type,effective_at,command_id) SELECT id,1,host_id,'HOST_CONFIRMED',closes_at-interval '1 minute',gen_random_uuid() FROM meals WHERE host_id=$1",[host]);
 const before=(await h.db.pool.query('SELECT count(*)::int n FROM business_events')).rows[0].n;
 const b=new Browser(h),r=await b.request('GET','/v1/meals?limit=1');expect(r.statusCode,r.body).toBe(200);expect((await h.db.pool.query('SELECT count(*)::int n FROM business_events')).rows[0].n).toBe(before);expect((await h.db.pool.query("SELECT count(*)::int n FROM meals WHERE host_id=$1 AND status='OPEN'",[host])).rows[0].n).toBe(501);
 expect(json(r).data).toHaveLength(0);expect(json(r).page.hasMore).toBe(true);expect(json(r).page.nextCursor).toBeTruthy();
 const next=await b.request('GET',`/v1/meals?limit=1&cursor=${encodeURIComponent(json(r).page.nextCursor)}`);expect(next.statusCode,next.body).toBe(200);expect(json(next).data).toHaveLength(1);expect(json(next).page.hasMore).toBe(false);
});

import {createPool} from '../packages/db/src/index.ts';
import {loadConfig} from '../packages/config/src/index.ts';
import {buildServer} from '../apps/api/src/http/server.ts';
import {WEB_ORIGIN} from '../apps/api/src/test/harness.ts';
it('QA-DISCOVERY-007 public list/detail work under PG read-only mode which rejects writes and row-locking reads',async()=>{
 const url=new URL(h.db.url);url.searchParams.set('options','-c default_transaction_read_only=on');const pool=createPool(url.toString());const deps={pool:h.db.pool,identity:h.idp,publicOrigin:WEB_ORIGIN,config:loadConfig({ENVIRONMENT:'test',DATABASE_URL:url.toString(),AUTH_ADAPTER:'test',PLACES_ADAPTER:'fixture',MAIL_ADAPTER:'outbox_test',AI_PROVIDER:'mock',WEB_ORIGIN,SESSION_SECRET:'api-test-session-secret-0123456789abcdef',IOS_REDIRECT_URI:'fancy://auth/callback'})};const app=await buildServer(deps);deps.pool=pool;
 try{await expect(pool.query('UPDATE meals SET title=title')).rejects.toMatchObject({code:'25006'});await expect(pool.query('SELECT id FROM meals FOR UPDATE')).rejects.toMatchObject({code:'25006'});expect((await app.inject({method:'GET',url:'/v1/meals?limit=100'})).statusCode).toBe(200);
 const id=(await h.db.pool.query('SELECT id FROM meals ORDER BY starts_at LIMIT 1')).rows[0].id;const r=await app.inject({method:'GET',url:`/v1/meals/${id}`});expect(r.statusCode,r.body).toBe(200);expect(json(r).data.meal.allowedActions).not.toContain('APPLY');
 }finally{await app.close();await pool.end();}
});
