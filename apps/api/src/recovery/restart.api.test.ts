import {randomUUID} from 'node:crypto';
import {expect,inject,it} from 'vitest';
import {loadConfig} from '@fancy/config';
import {createHarness,json,WEB_ORIGIN} from '../test/harness.ts';
import {buildServer} from '../http/server.ts';
it('QA-AI-034 new process runtime rejects old RAM session over actual HTTP boundary with same database',async()=>{
 const h=await createHarness(inject('pgServerUrl'));let restarted:Awaited<ReturnType<typeof buildServer>>|undefined;
 try{
  const guest=json(await h.app.inject({method:'POST',url:'/v1/guest-sessions',payload:{clientRequestId:randomUUID(),client:'IOS'}})).data;
  const headers={authorization:`Bearer ${guest.guestToken}`,'idempotency-key':randomUUID()};
  const boot=await h.app.inject({method:'POST',url:'/v1/ai/sessions',headers,payload:{deviceChallenge:Buffer.alloc(32,7).toString('base64url')}});expect(boot.statusCode,boot.body).toBe(201);
  const s=json(boot).data,proof={authorization:headers.authorization,'ai-device-token':s.deviceToken};
  expect((await h.app.inject({method:'GET',url:`/v1/ai/sessions/${s.sessionId}`,headers:proof})).statusCode).toBe(200);
  await h.app.close();
  const config=loadConfig({ENVIRONMENT:'test',DATABASE_URL:h.db.url,AUTH_ADAPTER:'test',PLACES_ADAPTER:'fixture',MAIL_ADAPTER:'outbox_test',AI_PROVIDER:'mock',WEB_ORIGIN,SESSION_SECRET:'api-test-session-secret-0123456789abcdef',IOS_REDIRECT_URI:'fancy://auth/callback'});
  restarted=await buildServer({config,pool:h.db.pool,identity:h.idp,publicOrigin:WEB_ORIGIN});
  const old=await restarted.inject({method:'GET',url:`/v1/ai/sessions/${s.sessionId}`,headers:proof});expect(old.statusCode,old.body).toBe(410);
  expect((await h.db.pool.query(`SELECT count(*)::int n FROM ai_calls`)).rows[0].n).toBe(0);
 }finally{await restarted?.close();await h.close();}
});
