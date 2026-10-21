/** Production regression: scan bound and no-write observation on real PostgreSQL. */
import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,expect,inject,it} from 'vitest';
import {Browser,createHarness,json,type Harness} from '../test/harness.ts';
let h:Harness;
beforeAll(async()=>{h=await createHarness(inject('pgServerUrl'));});afterAll(async()=>h.close());
it('500 ineligible candidates yield continuation rather than scanning beyond the cap or falsely ending',async()=>{
 const host=randomUUID(),venue=randomUUID();await h.db.pool.query('INSERT INTO users(id) VALUES($1)',[host]);await h.db.pool.query("INSERT INTO venues(id,place_id,provider) VALUES($1,'fixture_fancy_north','fixture')",[venue]);
 await h.db.pool.query(`INSERT INTO meals(host_id,venue_ref,title,description,starts_at,closes_at,scheduled_end_at,start_local_date,start_local_time,start_offset,close_local_date,close_local_time,close_offset,minimum,capacity,budget_min_pence,budget_max_pence,languages,mood,booking_mode,terms_version,attempt_id)
 SELECT $1,$2,'Independent scan fixture','Synthetic bounded discovery fixture without real participants.',t,CASE WHEN n<=500 THEN clock_timestamp()-interval '1 hour' ELSE t-interval '1 hour' END,t+interval '2 hours','2030-10-23','12:00',60,'2030-10-23','11:00',60,2,4,1000,2000,ARRAY['en'],'EASY_CONVERSATION','EXTERNAL_PAY_AT_VENUE','2026-10-21',gen_random_uuid() FROM (SELECT n,'2030-10-23T11:00Z'::timestamptz+n*interval '1 second' t FROM generate_series(1,501)n)s`,[host,venue]);
 await h.db.pool.query("INSERT INTO seat_events(meal_id,seq,user_id,type,effective_at,command_id) SELECT id,1,host_id,'HOST_CONFIRMED',closes_at-interval '1 minute',gen_random_uuid() FROM meals WHERE host_id=$1",[host]);
 const before=(await h.db.pool.query('SELECT count(*)::int n FROM business_events')).rows[0].n;
 const b=new Browser(h),r=await b.request('GET','/v1/meals?limit=1');expect(r.statusCode,r.body).toBe(200);expect((await h.db.pool.query('SELECT count(*)::int n FROM business_events')).rows[0].n).toBe(before);expect((await h.db.pool.query("SELECT count(*)::int n FROM meals WHERE host_id=$1 AND status='OPEN'",[host])).rows[0].n).toBe(501);
 expect(json(r).data).toHaveLength(0);expect(json(r).page.hasMore).toBe(true);expect(json(r).page.nextCursor).toBeTruthy();
 const next=await b.request('GET',`/v1/meals?limit=1&cursor=${encodeURIComponent(json(r).page.nextCursor)}`);expect(next.statusCode,next.body).toBe(200);expect(json(next).data).toHaveLength(1);expect(json(next).page.hasMore).toBe(false);
});
it('page-full cursors retain unreturned candidates and analytics counts beyond 500 independently',async()=>{
 await h.db.pool.query("UPDATE meals SET closes_at=starts_at-interval '1 hour'");
 await h.db.pool.query(`WITH first AS (SELECT id,row_number() OVER(ORDER BY starts_at,id) n FROM meals ORDER BY starts_at,id LIMIT 2) UPDATE meals m SET starts_at='2030-10-23T11:00:00Z'::timestamptz+first.n*interval '1 microsecond',scheduled_end_at='2030-10-23T13:00:00Z'::timestamptz+first.n*interval '1 microsecond' FROM first WHERE m.id=first.id`);
 const b=new Browser(h);
 await b.request('POST','/v1/analytics/events',{body:{schemaVersion:1,consent:{analytics:true,version:'2026-10-21'},events:[]}});
 const r=await b.request('GET','/v1/meals?limit=1&keyword=Synthetic',{headers:{'x-fancy-analytics':'enabled'}});
 expect(r.statusCode,r.body).toBe(200);expect(json(r).data).toHaveLength(1);expect(json(r).page.hasMore).toBe(true);
 const {rows:[stats]}=await h.db.pool.query('SELECT result_count,result_meal_ids FROM analytics_discovery_requests WHERE request_id=$1',[json(r).meta.requestId]);expect(stats.result_count).toBe(501);expect(stats.result_meal_ids).toEqual([json(r).data[0].id]);
 const next=await b.request('GET',`/v1/meals?limit=1&keyword=Synthetic&cursor=${encodeURIComponent(json(r).page.nextCursor)}`);
 expect(next.statusCode,next.body).toBe(200);expect(json(next).data[0].id).not.toBe(json(r).data[0].id);
 const {rows}=await h.db.pool.query('SELECT id FROM meals ORDER BY starts_at,id LIMIT 2');expect(json(r).data[0].id).toBe(rows[0].id);expect(json(next).data[0].id).toBe(rows[1].id);
 const mismatch=await b.request('GET',`/v1/meals?limit=1&keyword=Different&cursor=${encodeURIComponent(json(r).page.nextCursor)}`);expect(mismatch.statusCode).toBe(422);
});
it('exactly 500 filtered rows expose a conservative final empty continuation',async()=>{
 await h.db.pool.query("UPDATE meals SET closes_at=clock_timestamp()-interval '1 hour'");
 // Retain exactly one physical scan batch, including lifecycle-ineligible rows.
 await h.db.pool.query("UPDATE meals SET status='CANCELLED',cancel_reason='host' WHERE id=(SELECT id FROM meals ORDER BY starts_at DESC,id DESC LIMIT 1)");
 const b=new Browser(h),r=await b.request('GET','/v1/meals?limit=100');expect(r.statusCode,r.body).toBe(200);expect(json(r).data).toEqual([]);expect(json(r).page.hasMore).toBe(true);
 const next=await b.request('GET',`/v1/meals?limit=100&cursor=${encodeURIComponent(json(r).page.nextCursor)}`);expect(next.statusCode,next.body).toBe(200);expect(json(next).data).toEqual([]);expect(json(next).page).toEqual({hasMore:false,nextCursor:null});
});
