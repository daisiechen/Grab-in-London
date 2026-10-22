import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,describe,expect,inject,it} from 'vitest';
import {loadConfig} from '@fancy/config';
import {Browser,createHarness,json,WEB_ORIGIN,type Harness} from '../test/harness.ts';
import {registerExportRoutes,purgeSnapshotExports} from './exports.ts';
import {sealSourceSnapshot} from './snapshots.ts';
import {readAdminPage} from './pages.ts';
let h:Harness;
beforeAll(async()=>{
 h=await createHarness(inject('pgServerUrl'));
 if(!h.app.hasRoute({method:'POST',url:'/v1/admin/exports'}))registerExportRoutes(h.app,{pool:h.db.pool,identity:h.idp,publicOrigin:WEB_ORIGIN,config:loadConfig({ENVIRONMENT:'test',DATABASE_URL:h.db.url,AUTH_ADAPTER:'test',PLACES_ADAPTER:'fixture',MAIL_ADAPTER:'outbox_test',AI_PROVIDER:'mock',WEB_ORIGIN,SESSION_SECRET:'api-test-session-secret-0123456789abcdef',IOS_REDIRECT_URI:'fancy://auth/callback'})});
});
afterAll(async()=>{await h.close();});
async function analyst(mfa=true,role='analyst'){
 const b=new Browser(h);const {body}=await b.signInWithEmail(`${randomUUID()}@example.invalid`);const id=body.data.session.user.id as string;
 if(role)await h.db.pool.query(`INSERT INTO roles(user_id,role,granted_by) VALUES($1,$2,'test-bootstrap')`,[id,role]);
 if(mfa)await h.db.pool.query(`UPDATE session_families SET amr=ARRAY['otp','mfa'] WHERE user_id=$1`,[id]);
 return{b,id};
}
const snapshot=()=>sealSourceSnapshot(h.db.pool,new Date('2026-01-01T00:00:00Z'));
const create=(b:Browser,snapshotId:string,metric='formation',filters:Record<string,unknown>={},key=randomUUID())=>b.request('POST','/v1/admin/exports',{body:{snapshotId,metric,filters},headers:{'idempotency-key':key}});
describe('private short-lived CSV exports',()=>{
 it('exports real metric with exactly page snapshot/filter metadata and idempotent ticket',async()=>{
  const a=await analyst();const id=await snapshot();const filters={languages:'zh,en',budgetBands:'20-30,0-20'};const key=randomUUID();
  const result=await create(a.b,id,'formation',filters,key);expect(result.statusCode,result.body).toBe(201);
  const ticket=json(result).data;expect(json(await create(a.b,id,'formation',filters,key)).data).toEqual(ticket);
  const csv=await a.b.request('GET',`/v1/admin/exports/${ticket.exportId}`);expect(csv.statusCode,csv.body).toBe(200);
  expect(csv.body).toContain('"dataSource","synthetic_fixture"');expect(csv.body).toContain('"environment","test"');
  expect(csv.headers['content-type']).toContain('text/csv');expect(csv.headers['cache-control']).toBe('private, no-store');
  const page=await readAdminPage(h.db.pool,'supply',{snapshotId:id,...filters});
  expect(csv.body).toContain(`"snapshotId","${id}"`);expect(csv.body).toContain(`"filterHash","${page.filterHash}"`);expect(csv.body).toContain('"formation","","0","0"');
  expect((await h.db.pool.query(`SELECT id FROM analytics_exports WHERE id=$1`,[ticket.exportId])).rows).toHaveLength(1);
 });
 it('exports available retention metrics and explicitly empty unavailable rows from one partial-source snapshot',async()=>{
  const a=await analyst();const id=await snapshot();const filters={languages:'en'};const key=randomUUID();
  const page=await readAdminPage(h.db.pool,'retention',{snapshotId:id,...filters});
  expect(page.metrics.laterOpportunity).toBeNull();
  const result=await create(a.b,id,'summary.retention',filters,key);expect(result.statusCode,result.body).toBe(201);
  const ticket=json(result).data;expect(json(await create(a.b,id,'summary.retention',filters,key)).data).toEqual(ticket);
  const csv=await a.b.request('GET',`/v1/admin/exports/${ticket.exportId}`);expect(csv.statusCode,csv.body).toBe(200);
  expect(csv.body).toContain(`"snapshotId","${id}"`);expect(csv.body).toContain(`"filterHash","${page.filterHash}"`);
  expect(csv.body).toContain('"metric","value","numerator","denominator","status"');
  expect(csv.body).toContain('"laterOpportunity","","","","unavailable"');
  for(const [metric,value] of Object.entries(page.metrics)){
   expect(csv.body.split('\r\n').filter(line=>line.startsWith(`"${metric}",`))).toHaveLength(1);
   if(typeof value==='number')expect(csv.body).toContain(`"${metric}","${value}","","","available"`);
   else if(value&&typeof value==='object'&&'numerator' in value&&'denominator' in value){const n=Number(value.numerator),d=Number(value.denominator);expect(csv.body).toContain(`"${metric}","${d===0?'':n/d}","${n}","${d}","${d===0?'no_denominator':'available'}"`);}
  }
 });
 it('requires staff role plus MFA for creation and download; tickets belong to one actor',async()=>{
  const a=await analyst();const other=await analyst();const noMfa=await analyst(false);const noRole=await analyst(true,'');const id=await snapshot();
  const ticket=json(await create(a.b,id)).data;
  expect((await create(noMfa.b,id)).statusCode).toBe(403);expect((await create(noRole.b,id)).statusCode).toBe(403);
  expect((await other.b.request('GET',`/v1/admin/exports/${ticket.exportId}`)).statusCode).toBe(404);
  await h.db.pool.query(`UPDATE session_families SET amr=ARRAY['otp'] WHERE user_id=$1`,[a.id]);
  expect((await a.b.request('GET',`/v1/admin/exports/${ticket.exportId}`)).statusCode).toBe(403);
 });
 it('keeps unavailable single metrics rejected and marks partial supply summaries without dropping rows',async()=>{
  const a=await analyst();const id=await snapshot();
  for(const metric of ['discovery','discovery7']){
   const result=await create(a.b,id,metric);expect(result.statusCode,metric+': '+result.body).toBe(503);
  }
  const summary=await create(a.b,id,'summary.supply');expect(summary.statusCode,summary.body).toBe(201);
  const csv=await a.b.request('GET',`/v1/admin/exports/${json(summary).data.exportId}`);expect(csv.statusCode,csv.body).toBe(200);
  expect(csv.body).toContain('"discovery","","","","unavailable"');
  expect(csv.body).toContain('"formation","","0","0","no_denominator"');
  expect((await create(a.b,id,'summary.supply',{userId:a.id})).statusCode).toBe(422);
  expect((await create(a.b,id,'formation',{userId:a.id})).statusCode).toBe(201);
 });
 it('expires tickets with 410 and removes bytes on snapshot privacy revocation',async()=>{
  const a=await analyst();const id=await snapshot();const ticket=json(await create(a.b,id)).data;
  await h.db.pool.query(`UPDATE analytics_exports SET created_at=clock_timestamp()-interval '1 hour',expires_at=clock_timestamp()-interval '1 second' WHERE id=$1`,[ticket.exportId]);
  expect((await a.b.request('GET',`/v1/admin/exports/${ticket.exportId}`)).statusCode).toBe(410);
  const live=json(await create(a.b,id)).data;purgeSnapshotExports([id]);
  await h.db.pool.query(`UPDATE analytics_snapshots SET revoked_at=clock_timestamp() WHERE id=$1`,[id]);
  const result=await a.b.request('GET',`/v1/admin/exports/${live.exportId}`);expect(result.statusCode).toBe(410);expect(json(result).error.code).toBe('SNAPSHOT_REVOKED');
  expect((await create(a.b,id)).statusCode).toBe(410);
 });
});
