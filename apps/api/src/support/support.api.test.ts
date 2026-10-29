import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { Browser, createHarness, json, type Harness } from '../test/harness.ts';
let h: Harness;
beforeAll(async () => { h=await createHarness(inject('pgServerUrl')); });afterAll(async()=>{await h.close();});
async function member(){const b=new Browser(h);const {body}=await b.signInWithEmail(`${randomUUID()}@example.invalid`);return {b,id:body.data.session.user.id as string};}
const write=(b:Browser,url:string,body?:unknown,version?:string)=>b.request('POST',url,{...(body===undefined?{}:{body}),headers:{'idempotency-key':randomUUID(),...(version?{'if-match':`"${version}"`}:{})}});
describe('private report and support access',()=>{
 it('issues a private receipt, hides details from others and requires per-case staff grants with MFA',async()=>{
  const reporter=await member(),target=await member(),staff=await member();
  const created=await write(reporter.b,'/v1/reports',{targetType:'USER',targetId:target.id,reason:'private_concern',details:'Private concern only support may read.'});
  expect(created.statusCode,created.body).toBe(201);const report=json(created).data;
  expect(report).toMatchObject({status:'RECEIVED',targetType:'USER',publicOutcome:expect.stringContaining('received your report')});expect(created.body).not.toContain('Private concern');
  expect((await target.b.request('GET',`/v1/me/reports/${report.id}`)).statusCode).toBe(404);
  const {rows:[c]}=await h.db.pool.query(`SELECT id FROM support_cases WHERE report_id=$1`,[report.id]);
  expect((await staff.b.request('GET',`/v1/support/cases/${c.id}`)).statusCode).toBe(403);
  await h.db.pool.query(`INSERT INTO roles(user_id,role,granted_by) VALUES($1,'support','test')`,[staff.id]);
  expect((await staff.b.request('GET',`/v1/support/cases/${c.id}`)).statusCode).toBe(403);
  await h.db.pool.query(`UPDATE session_families SET amr=ARRAY['mfa'] WHERE user_id=$1`,[staff.id]);
  expect((await staff.b.request('GET',`/v1/support/cases/${c.id}`)).statusCode).toBe(404);
  await h.db.pool.query(`INSERT INTO support_case_grants(case_id,user_id) VALUES($1,$2)`,[c.id,staff.id]);
  const opened=await staff.b.request('GET',`/v1/support/cases/${c.id}`);expect(opened.statusCode).toBe(200);expect(json(opened).data.details).toContain('Private concern');
  const resolved=await write(staff.b,`/v1/support/cases/${c.id}/status`,{status:'RESOLVED',publicOutcome:'Your report has been reviewed.',reason:'Reviewed the relevant evidence.'},'1');expect(resolved.statusCode,resolved.body).toBe(200);
  expect(json(await reporter.b.request('GET',`/v1/me/reports/${report.id}`)).data).toMatchObject({status:'RESPONDED',publicOutcome:'Your report has been reviewed.'});
  expect((await h.db.pool.query(`SELECT action FROM audit_events WHERE aggregate_id=$1`,[c.id])).rows.map(r=>r.action)).toContain('support.case_viewed');
 });
 it('paginates only own notifications and marking read does not leak another owner',async()=>{
  const a=await member(),b=await member();
  for(let i=0;i<3;i++)await h.db.pool.query(`INSERT INTO notifications(event_id,recipient_id,template) VALUES($1,$2,'test_notification')`,[randomUUID(),a.id]);
  const first=json(await a.b.request('GET','/v1/me/notifications?limit=1'));expect(first.data).toHaveLength(1);expect(first.page.hasMore).toBe(true);
  expect((await b.b.request('GET',`/v1/me/notifications?limit=1&cursor=${first.page.nextCursor}`)).statusCode).toBe(422);
  expect((await write(b.b,`/v1/me/notifications/${first.data[0].id}/read`)).statusCode).toBe(404);
  const marked=await write(a.b,`/v1/me/notifications/${first.data[0].id}/read`);expect(marked.statusCode).toBe(200);expect(json(marked).data.readAt).not.toBeNull();
  const next=json(await a.b.request('GET',`/v1/me/notifications?limit=1&cursor=${first.page.nextCursor}`));expect(next.data[0].id).not.toBe(first.data[0].id);
 });
});
