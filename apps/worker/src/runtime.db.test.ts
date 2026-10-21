import {afterAll,beforeAll,describe,expect,inject,it} from 'vitest';
import {loadConfig} from '@fancy/config';
import {migrate} from '@fancy/db';
import {createMigratedDatabase,type MigratedDatabase} from '@fancy/testkit/db';
import {createWorkerRuntime} from './main.ts';
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
});
