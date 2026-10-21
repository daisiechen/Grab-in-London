/** Independent report privacy and replay authorization; real HTTP and isolated PostgreSQL. */
import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,describe,expect,inject,it} from 'vitest';
import {Browser,createHarness,json,type Harness} from '../apps/api/src/test/harness.ts';
let h:Harness;
beforeAll(async()=>{h=await createHarness(inject('pgServerUrl'));});
afterAll(async()=>h.close());
async function actor(){const b=new Browser(h);const {body}=await b.signInWithEmail(`${randomUUID()}@example.invalid`);return {b,id:body.data.session.user.id as string};}
async function setup(){const reporter=await actor(),target=await actor(),staff=await actor();const marker=`PRIVATE_REPORT_${randomUUID()}`;const key=randomUUID();const body={targetType:'USER',targetId:target.id,reason:'private_concern',details:marker};const r=await reporter.b.request('POST','/v1/reports',{body,headers:{'idempotency-key':key}});expect(r.statusCode,r.body).toBe(201);const report=json(r).data;const c=(await h.db.pool.query('SELECT id FROM support_cases WHERE report_id=$1',[report.id])).rows[0].id as string;await h.db.pool.query("INSERT INTO roles(user_id,role,granted_by) VALUES($1,'support','qa')",[staff.id]);await h.db.pool.query("UPDATE session_families SET amr=ARRAY['mfa'] WHERE user_id=$1",[staff.id]);await h.db.pool.query('INSERT INTO support_case_grants(case_id,user_id) VALUES($1,$2)',[c,staff.id]);return {reporter,target,staff,marker,key,body,report,c};}
describe('independent report privacy and revoked replay',()=>{
 it('QA-PRIVACY-001 receipt moves RECEIVED IN_REVIEW RESPONDED without exposing report details or notifying the target',async()=>{
  const f=await setup();const read=()=>f.reporter.b.request('GET',`/v1/me/reports/${f.report.id}`);
  const initial=await read();expect(json(initial).data).toMatchObject({status:'RECEIVED',publicOutcome:null});expect(initial.body).not.toContain(f.marker);
  for(const state of ['OPEN','RESOLVED']){const current=(await h.db.pool.query('SELECT version FROM support_cases WHERE id=$1',[f.c])).rows[0].version;const publicOutcome=state==='RESOLVED'?'Your report has been reviewed.':null;const response=await f.staff.b.request('POST',`/v1/support/cases/${f.c}/status`,{headers:{'idempotency-key':randomUUID(),'if-match':`"${current}"`},body:{status:state,publicOutcome,reason:'Independent synthetic evidence review.'}});expect(response.statusCode,response.body).toBe(200);const receipt=await read();expect(json(receipt).data).toMatchObject({status:state==='RESOLVED'?'RESPONDED':'IN_REVIEW',publicOutcome});expect(receipt.body).not.toContain(f.marker);}
  for(const stranger of [f.target,await actor()]){const r=await stranger.b.request('GET',`/v1/me/reports/${f.report.id}`);expect(r.statusCode,r.body).toBe(404);expect(r.body).not.toContain(f.marker);expect(r.body).not.toContain(f.report.receipt);}
  for(const who of [f.reporter,f.target]){const r=await who.b.request('GET','/v1/me/notifications');expect(r.statusCode,r.body).toBe(200);expect(r.body).not.toContain(f.marker);}
  expect((await h.db.pool.query('SELECT count(*)::int n FROM reports WHERE reporter_id=$1',[f.reporter.id])).rows[0].n).toBe(1);
 });
 it('QA-API-006 cached support response cannot bypass grant removal or role removal',async()=>{
  const f=await setup(),key=randomUUID();const url=`/v1/support/cases/${f.c}/status`;const request=()=>f.staff.b.request('POST',url,{headers:{'idempotency-key':key,'if-match':'"1"'},body:{status:'RESOLVED',publicOutcome:'Reviewed.',reason:'Independent review completed.'}});
  const first=await request();expect(first.statusCode,first.body).toBe(200);const replay=await request();expect(replay.statusCode,replay.body).toBe(200);expect(replay.headers['idempotent-replay']).toBe('true');
  await h.db.pool.query('DELETE FROM support_case_grants WHERE case_id=$1 AND user_id=$2',[f.c,f.staff.id]);const deniedGrant=await request();expect(deniedGrant.statusCode,deniedGrant.body).toBe(403);expect(deniedGrant.body).not.toContain(f.marker);
  await h.db.pool.query('INSERT INTO support_case_grants(case_id,user_id) VALUES($1,$2)',[f.c,f.staff.id]);await h.db.pool.query("DELETE FROM roles WHERE user_id=$1 AND role='support'",[f.staff.id]);const deniedRole=await request();expect(deniedRole.statusCode,deniedRole.body).toBe(403);expect(deniedRole.body).not.toContain(f.marker);
  expect((await h.db.pool.query('SELECT version FROM support_cases WHERE id=$1',[f.c])).rows[0].version).toBe('2');
 });
 it('QA-API-006 cached own report cannot bypass session family revocation or deleting actor',async()=>{
  for(const mode of ['SESSION','DELETING']){const f=await setup();const request=()=>f.reporter.b.request('POST','/v1/reports',{body:f.body,headers:{'idempotency-key':f.key}});expect((await request()).statusCode).toBe(201);if(mode==='SESSION')await h.db.pool.query("UPDATE session_families SET revoked_at=clock_timestamp(),revoke_reason='LOGOUT' WHERE user_id=$1",[f.reporter.id]);else await h.db.pool.query("UPDATE users SET status='DELETING' WHERE id=$1",[f.reporter.id]);const denied=await request();expect([401,403],denied.body).toContain(denied.statusCode);expect(denied.body).not.toContain(f.report.receipt);expect((await h.db.pool.query('SELECT count(*)::int n FROM reports WHERE reporter_id=$1',[f.reporter.id])).rows[0].n).toBe(1);}
 });
});
