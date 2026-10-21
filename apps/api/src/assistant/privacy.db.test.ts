import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,describe,expect,inject,it} from 'vitest';
import {migrate} from '@fancy/db';
import {createMigratedDatabase,type MigratedDatabase} from '@fancy/testkit/db';
import {AssistantRuntime,type SessionBinding} from '../../../../packages/assistant/src/index.ts';
import {SessionService} from './sessions.ts';
import {RequestService} from './requests.ts';
let db:MigratedDatabase;
beforeAll(async()=>{db=await createMigratedDatabase(inject('pgServerUrl'),migrate);});afterAll(async()=>{await db.drop();});
describe('cross-subject AI privacy barrier',()=>{
 it('blocks old transcripts and an in-flight result after any deletion epoch without charging a success',async()=>{
  const user=(await db.pool.query(`INSERT INTO users DEFAULT VALUES RETURNING id`)).rows[0].id;
  const runtime=new AssistantRuntime(),sessions=new SessionService(db.pool,runtime),requests=new RequestService(db.pool,sessions,'local-privacy-test-hmac-secret-0123456789');
  const subject=`user:${user}`,session=await sessions.create(subject),binding:SessionBinding={subject,deviceToken:session.deviceToken,generation:1,preferenceEpoch:'0'};
  runtime.appendMessage(session.id,binding,'assistant','A public author fact before deletion');
  const requestId=randomUUID();await requests.accept(session.id,binding,requestId,{input:'Fixture read'});
  await db.pool.query(`UPDATE privacy_control SET epoch=epoch+1 WHERE id=1`);
  let published=false;
  expect(await requests.finish(subject,requestId,'SUCCEEDED',null,async()=>{published=true;})).toBe(true);
  expect(published).toBe(false);
  expect((await db.pool.query(`SELECT state FROM ai_requests WHERE request_id=$1`,[requestId])).rows[0].state).toBe('SUPERSEDED');
  expect((await db.pool.query(`SELECT successes,reserved_success_slots FROM ai_quota WHERE subject=$1`,[subject])).rows[0]).toMatchObject({successes:0,reserved_success_slots:0});
  await expect(sessions.read(session.id,binding)).rejects.toMatchObject({code:'AI_SESSION_EXPIRED'});
 });
});
