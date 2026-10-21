import { randomUUID } from 'node:crypto';
import { afterAll,beforeAll,describe,expect,inject,it } from 'vitest';
import { Browser,createHarness,json,type Harness } from '../test/harness.ts';
let h:Harness;beforeAll(async()=>{h=await createHarness(inject('pgServerUrl'));});afterAll(async()=>{await h.close();});
describe('database request limits',()=>{
 it('limits polling per actor/resource and supplies a retry bound across server instances',async()=>{
  const b=new Browser(h);const {body}=await b.signInWithEmail(`${randomUUID()}@example.invalid`);const user=body.data.session.user.id;
  await h.db.pool.query(`INSERT INTO api_rate_limits(actor_id,bucket,window_start,count) VALUES($1,'poll:/v1/inbox',date_trunc('minute',clock_timestamp()),40)`,[user]);
  const limited=await b.request('GET','/v1/inbox');expect(limited.statusCode,limited.body).toBe(429);expect(json(limited).error.code).toBe('RATE_LIMITED');expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
  const other=new Browser(h);await other.signInWithEmail(`${randomUUID()}@example.invalid`);expect((await other.request('GET','/v1/inbox')).statusCode).toBe(200);
 });
});
