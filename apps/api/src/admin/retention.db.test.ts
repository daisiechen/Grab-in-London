import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,expect,inject,it} from 'vitest';
import {migrate} from '@fancy/db';
import {createMigratedDatabase,type MigratedDatabase} from '@fancy/testkit/db';
import {DEFAULT_ANALYTICS_RETENTION,analyticsEventFloor,analyticsRetention,purgeExpiredAnalytics} from './retention.ts';
let db:MigratedDatabase;
beforeAll(async()=>{db=await createMigratedDatabase(inject('pgServerUrl'),migrate);});afterAll(async()=>{await db.drop();});

/** A London-local time `days` before today, at `hour`:00 (as timestamptz). */
const londonDay=(days:number,hour:number)=>`((date_trunc('day',clock_timestamp() AT TIME ZONE 'Europe/London')-make_interval(days=>${days})+make_interval(hours=>${hour})) AT TIME ZONE 'Europe/London')`;
async function snapshot(asOfSql:string,revoked=false):Promise<string>{
 const {rows:[row]}=await db.pool.query<{id:string}>(`INSERT INTO analytics_snapshots(as_of,definition_version,history_coverage_start,privacy_epoch,classification_revision,source_status,quality,dimensions,revoked_at)
  SELECT t,'v5',t-interval '1 day',0,0,'{}','{}','{"areas":[],"sources":[]}',CASE WHEN $1 THEN clock_timestamp() END FROM (SELECT ${asOfSql} AS t) x RETURNING id`,[revoked]);
 return row!.id;
}

it('keeps the latest 48 snapshots, then one unrevoked snapshot per London day for 120 days, deleting facts, subjects and exports with the rest',async()=>{
 const user=(await db.pool.query(`INSERT INTO users DEFAULT VALUES RETURNING id`)).rows[0].id as string;
 const recent:string[]=[];for(let i=0;i<48;i++)recent.push(await snapshot(`clock_timestamp()-make_interval(mins=>${i})`));
 const dayEarly=await snapshot(londonDay(10,10)),dayLate=await snapshot(londonDay(10,20));
 const unrevoked=await snapshot(londonDay(11,10)),revokedLater=await snapshot(londonDay(11,20),true);
 const tooOld=await snapshot(londonDay(130,12));
 for(const id of [...recent.slice(0,2),dayEarly,dayLate,unrevoked,revokedLater,tooOld]){
  await db.pool.query(`INSERT INTO analytics_snapshot_facts(snapshot_id,kind,facts) VALUES($1,'users','[]')`,[id]);
  await db.pool.query(`INSERT INTO analytics_snapshot_subjects(snapshot_id,user_id) VALUES($1,$2)`,[id,user]);
  await db.pool.query(`INSERT INTO analytics_exports(actor_id,snapshot_id,privacy_epoch,metric,filter_hash,filters,byte_count,row_count,expires_at) VALUES($1,$2,0,'feedback',$3,'{}',0,0,clock_timestamp()+interval '1 hour')`,[user,id,'a'.repeat(64)]);
 }
 const result=await purgeExpiredAnalytics(db.pool);
 expect(result.snapshots).toBe(3);
 const {rows}=await db.pool.query<{id:string}>(`SELECT id FROM analytics_snapshots`);
 const kept=new Set(rows.map(r=>r.id));
 for(const id of recent)expect(kept.has(id)).toBe(true);
 expect(kept.has(dayLate)).toBe(true);expect(kept.has(dayEarly)).toBe(false);
 expect(kept.has(unrevoked)).toBe(true);expect(kept.has(revokedLater)).toBe(false);
 expect(kept.has(tooOld)).toBe(false);
 for(const table of ['analytics_snapshot_facts','analytics_snapshot_subjects','analytics_exports']){
  const {rows:[left]}=await db.pool.query(`SELECT count(*)::int AS n FROM ${table} WHERE snapshot_id=ANY($1::uuid[])`,[[dayEarly,revokedLater,tooOld]]);
  expect(left.n,table).toBe(0);
 }
 const {rows:[still]}=await db.pool.query(`SELECT count(*)::int AS n FROM analytics_snapshot_facts WHERE snapshot_id=ANY($1::uuid[])`,[[dayLate,unrevoked,recent[0]]]);
 expect(still.n).toBe(3);
 // Idempotent: a second pass finds nothing more to delete.
 expect((await purgeExpiredAnalytics(db.pool)).snapshots).toBe(0);
});

it('deletes raw events after 13 months, discovery checks after 30 days and delivery records after 90 days',async()=>{
 const event=async(age:string)=>{const id=randomUUID();await db.pool.query(`INSERT INTO analytics_events(event_id,anonymous_id,session_id,app_version,type,occurred_at,received_at,schema_version,environment,consent_version,classification,properties,request_hash) VALUES($1,'anon','session','1','detail_view',clock_timestamp()-$2::interval,clock_timestamp()-$2::interval,1,'production','v1','regular','{}',$3)`,[id,age,'b'.repeat(64)]);return id;};
 const oldEvent=await event('14 months'),keptEvent=await event('12 months');
 const discovery=async(age:string)=>{const id=randomUUID();await db.pool.query(`INSERT INTO analytics_discovery_requests(request_id,scope_key,anonymous_id,session_id,result_count,result_meal_ids,eligible_meal_ids,outcome,filters,occurred_at,received_at,environment,classification) VALUES($1,'guest:x','anon','session',0,'{}','{}','success','{}',clock_timestamp()-$2::interval,clock_timestamp()-$2::interval,'production','regular')`,[id,age]);return id;};
 const oldDiscovery=await discovery('31 days'),keptDiscovery=await discovery('29 days');
 const delivery=async(age:string)=>(await db.pool.query(`INSERT INTO analytics_deliveries(outcome,received_at,environment,classification) VALUES('accepted',clock_timestamp()-$1::interval,'production','regular') RETURNING id`,[age])).rows[0].id as string;
 const oldDelivery=await delivery('91 days'),keptDelivery=await delivery('89 days');
 const result=await purgeExpiredAnalytics(db.pool);
 expect(result).toMatchObject({events:1,discoveryRequests:1,deliveries:1});
 expect((await db.pool.query(`SELECT event_id FROM analytics_events WHERE event_id=ANY($1::uuid[])`,[[oldEvent,keptEvent]])).rows.map(r=>r.event_id)).toEqual([keptEvent]);
 expect((await db.pool.query(`SELECT request_id FROM analytics_discovery_requests WHERE request_id=ANY($1::uuid[])`,[[oldDiscovery,keptDiscovery]])).rows.map(r=>r.request_id)).toEqual([keptDiscovery]);
 expect((await db.pool.query(`SELECT id FROM analytics_deliveries WHERE id=ANY($1::uuid[])`,[[oldDelivery,keptDelivery]])).rows.map(r=>r.id)).toEqual([keptDelivery]);
 // Snapshot history never claims coverage before the event retention floor.
 const floor=await analyticsEventFloor(db.pool,DEFAULT_ANALYTICS_RETENTION);
 expect(Date.now()-floor.getTime()).toBeGreaterThan(390*86_400_000);expect(Date.now()-floor.getTime()).toBeLessThan(400*86_400_000);
});

it('reads overrides from RETENTION_POLICY_JSON and ignores invalid values',()=>{
 expect(analyticsRetention(null)).toEqual(DEFAULT_ANALYTICS_RETENTION);
 expect(DEFAULT_ANALYTICS_RETENTION).toEqual({analyticsHourlySnapshots:48,analyticsDailySnapshotDays:120,analyticsEventMonths:13,analyticsDiscoveryRequestDays:30,analyticsDeliveryDays:90});
 expect(analyticsRetention({analyticsEventMonths:18,analyticsDeliveryDays:60})).toMatchObject({analyticsEventMonths:18,analyticsDeliveryDays:60,analyticsDiscoveryRequestDays:30});
 // Raw events must outlive the 30-day observation window plus a comparison period.
 for(const bad of [0,1,1.5,'13',null,1000])expect(analyticsRetention({analyticsEventMonths:bad}).analyticsEventMonths).toBe(13);
 expect(analyticsRetention({analyticsHourlySnapshots:-1}).analyticsHourlySnapshots).toBe(48);
});
