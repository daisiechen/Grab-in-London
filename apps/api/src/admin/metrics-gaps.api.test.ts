import { randomUUID } from 'node:crypto';
import { afterAll,beforeAll,describe,expect,inject,it } from 'vitest';
import { Browser,createHarness,json,type Harness } from '../test/harness.ts';
import { sealSourceSnapshot } from './snapshots.ts';
let h:Harness;
beforeAll(async()=>{h=await createHarness(inject('pgServerUrl'));});afterAll(async()=>{await h.close();});
describe('classification restoration and form error evidence through HTTP',()=>{
 it('restores authenticated historical events without relinking anonymous history and exports fixed error fields',async()=>{
  const browser=new Browser(h);const login=await browser.signInWithEmail(`${randomUUID()}@example.invalid`);const id=login.body.data.session.user.id as string;
  await h.db.pool.query(`UPDATE users SET created_at='2026-07-01' WHERE id=$1`,[id]);
  await h.db.pool.query(`INSERT INTO roles(user_id,role,granted_by) VALUES($1,'analyst','test-bootstrap'),($1,'data_admin','test-bootstrap')`,[id]);
  await h.db.pool.query(`UPDATE session_families SET amr=ARRAY['otp','mfa'] WHERE user_id=$1`,[id]);
  const classify=async(classification:string,revision:string)=>{
   const res=await browser.request('PUT',`/v1/admin/classifications/${id}`,{body:{classification,reason:'Classification recovery regression'},headers:{'if-match':`"${revision}"`,'idempotency-key':randomUUID()}});
   expect(res.statusCode,res.body).toBe(200);return json(res).data.revision as string;
  };
  const revision=await classify('test','0');const attempt=randomUUID(),eventIds=[randomUUID(),randomUUID(),randomUUID()];
  for(const [index,eventId]of eventIds.entries()){
   await h.db.pool.query(`INSERT INTO analytics_events(event_id,anonymous_id,user_id,session_id,app_version,type,occurred_at,received_at,schema_version,environment,consent_version,classification,properties,request_hash) VALUES($1,'same-visitor',$2,'session','web-mvp-1','form_error','2026-09-01T12:00:00Z','2026-09-01T12:00:01Z',1,'production','2026-10-21',$3,$4,$5)`,[eventId,index===0?id:null,index===2?'regular':'test',{attemptId:attempt,step:'arrange',field:'venue',errorCode:'required'},'a'.repeat(64)]);
  }
  const first=await sealSourceSnapshot(h.db.pool,new Date('2026-07-01'),{clientTelemetry:true,verifiedDiscovery:true});
  const before=await browser.request('GET',`/v1/admin/journey?snapshotId=${first}`);expect(before.statusCode,before.body).toBe(200);expect(json(before).data.metrics.formErrors).toBe(1);
  await classify('regular',revision);
  const second=await sealSourceSnapshot(h.db.pool,new Date('2026-07-01'),{clientTelemetry:true,verifiedDiscovery:true});
  const page=await browser.request('GET',`/v1/admin/journey?snapshotId=${second}`);expect(page.statusCode,page.body).toBe(200);const data=json(page).data;
  expect(data.metrics.formErrors).toBe(2);expect(data.series['form.errors.byStep']).toEqual([{key:'arrange',value:2}]);
  const details=await browser.request('GET',`/v1/admin/drilldowns/formErrors?snapshotId=${second}&filterHash=${data.filterHash}&q=venue`);expect(details.statusCode,details.body).toBe(200);expect(json(details).data).toHaveLength(2);
  expect(json(details).data.map((r:{rowId:string})=>r.rowId)).not.toContain(eventIds[1]);
  const ticket=await browser.request('POST','/v1/admin/exports',{body:{snapshotId:second,metric:'formErrors',filters:{q:'venue'}},headers:{'idempotency-key':randomUUID()}});expect(ticket.statusCode,ticket.body).toBe(201);
  const csv=await browser.request('GET',`/v1/admin/exports/${json(ticket).data.exportId}`);expect(csv.statusCode,csv.body).toBe(200);expect(csv.body).toContain('"formErrors","2"');expect(csv.body).toContain('"step"');expect(csv.body).toContain('"required"');expect(csv.body).not.toContain(eventIds[1]);
  const original=(await h.db.pool.query(`SELECT classification FROM analytics_events WHERE event_id=$1`,[eventIds[0]])).rows[0];expect(original.classification).toBe('test');
  expect(json(await browser.request('GET',`/v1/admin/journey?snapshotId=${first}`)).data.metrics.formErrors).toBe(1);
 });
});
