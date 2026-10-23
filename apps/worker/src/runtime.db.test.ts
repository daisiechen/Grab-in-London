import {afterAll,beforeAll,describe,expect,inject,it} from 'vitest';
import {loadConfig} from '@fancy/config';
import {migrate} from '@fancy/db';
import {createMigratedDatabase,type MigratedDatabase} from '@fancy/testkit/db';
import {randomUUID} from 'node:crypto';
import {createWorkerRuntime} from './main.ts';
import {createStatisticsRefresh} from '../../api/src/admin/statistics-refresh.ts';
let db:MigratedDatabase;
beforeAll(async()=>{db=await createMigratedDatabase(inject('pgServerUrl'),migrate);});afterAll(async()=>{await db.drop();});
describe('worker runtime assembly',()=>{
 it('seals a real snapshot once and keeps unavailable telemetry sources unavailable',async()=>{
  const config=loadConfig({ENVIRONMENT:'test',DATABASE_URL:db.url,AUTH_ADAPTER:'test',PLACES_ADAPTER:'fixture',MAIL_ADAPTER:'outbox_test',AI_PROVIDER:'mock',WEB_ORIGIN:'http://localhost:5174',SESSION_SECRET:'worker-test-session-secret-0123456789'});
  const runtime=createWorkerRuntime(db.pool,config);
  expect(await runtime.tick()).toMatchObject({claimed:0});expect(await runtime.tick()).toMatchObject({claimed:0});
  const {rows}=await db.pool.query(`SELECT source_status,quality FROM analytics_snapshots`);expect(rows).toHaveLength(1);
  expect(rows[0].source_status.analytics).toBe('partial');
  expect(rows[0].quality.incompleteSources).toEqual(expect.arrayContaining(['verifiedDiscovery','clientTelemetry']));
 });
 it('uses the later deployed-client coverage boundary only after explicit configuration',async()=>{
  const declared=new Date(Date.now()-1).toISOString();
  const config=loadConfig({ENVIRONMENT:'test',DATABASE_URL:db.url,AUTH_ADAPTER:'test',PLACES_ADAPTER:'fixture',MAIL_ADAPTER:'outbox_test',AI_PROVIDER:'mock',WEB_ORIGIN:'http://localhost:5174',SESSION_SECRET:'worker-test-session-secret-0123456789',ANALYTICS_COVERAGE_START:declared});
  await createWorkerRuntime(db.pool,config).tick();
  const row=(await db.pool.query(`SELECT history_coverage_start,source_status FROM analytics_snapshots ORDER BY created_at DESC LIMIT 1`)).rows[0];
  expect(row.history_coverage_start.toISOString()).toBe(new Date(declared).toISOString());
  expect(row.source_status.analytics).toBe('ready');
 });
 it('P09: a pending statistics refresh seals one snapshot and becomes ready in the same tick',async()=>{
  const config=loadConfig({ENVIRONMENT:'test',DATABASE_URL:db.url,AUTH_ADAPTER:'test',PLACES_ADAPTER:'fixture',MAIL_ADAPTER:'outbox_test',AI_PROVIDER:'mock',WEB_ORIGIN:'http://localhost:5174',SESSION_SECRET:'worker-test-session-secret-0123456789'});
  const runtime=createWorkerRuntime(db.pool,config);
  await runtime.tick(); // hourly snapshot taken; a refresh must not wait for the next hour
  const [admin,target]=await Promise.all([0,1].map(async()=>(await db.pool.query<{id:string}>(`INSERT INTO users DEFAULT VALUES RETURNING id`)).rows[0]!.id));
  const revision=(await db.pool.query<{revision:string}>(`INSERT INTO account_classifications(user_id,classification,actor_id,reason) VALUES($1,'test',$2,'Synthetic fixture') RETURNING revision::text`,[target,admin])).rows[0]!.revision;
  const c=await db.pool.connect();let refreshId:string;
  try{refreshId=(await createStatisticsRefresh(c,{actorId:admin!,intentKey:randomUUID(),requestId:'req-synthetic',targetUserId:target!,acceptedRevision:revision})).refreshId;}finally{c.release();}
  const before=(await db.pool.query(`SELECT 1 FROM analytics_snapshots`)).rowCount!;
  await runtime.tick();
  expect((await db.pool.query(`SELECT 1 FROM analytics_snapshots`)).rowCount).toBe(before+1);
  const {rows:[row]}=await db.pool.query(`SELECT state,snapshot_id FROM admin_statistics_refreshes WHERE id=$1`,[refreshId]);
  expect(row.state).toBe('READY');expect(row.snapshot_id).toBeTruthy();
  await runtime.tick(); // nothing pending: no extra snapshot
  expect((await db.pool.query(`SELECT 1 FROM analytics_snapshots`)).rowCount).toBe(before+1);
 });
});
