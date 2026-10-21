import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,expect,inject,it} from 'vitest';
import {Browser,createHarness,json,type Harness} from '../test/harness.ts';
import {pkceChallenge} from './tokens.ts';
let h:Harness;
beforeAll(async()=>{h=await createHarness(inject('pgServerUrl'));});
afterAll(async()=>{await h.close();});

it('links a native new-identity ticket only after original-identity login and its own PKCE proof',async()=>{
  const email=`${randomUUID()}@example.invalid`,browser=new Browser(h);
  const signed=await browser.signInWithEmail(email),userId=signed.body.data.session.user.id;
  const newVerifier='n'.repeat(43),originalVerifier='o'.repeat(43);
  const started=await h.app.inject({method:'POST',url:'/v1/auth/oauth/start',payload:{clientRequestId:randomUUID(),provider:'GOOGLE',client:'IOS',appChallenge:pkceChallenge(newVerifier)}});
  expect(started.statusCode,started.body).toBe(201);
  const grant=h.idp.consent(json(started).data.authorizationUrl,{subject:randomUUID(),email});
  const callback=await h.app.inject({method:'GET',url:`/v1/auth/oauth/callback?${new URLSearchParams(grant)}`});
  expect(callback.statusCode,callback.body).toBe(200);
  const pending=json(callback).data;expect(pending.outcome).toBe('LINK_REQUIRED');expect(pending.handoffCode).toBeUndefined();
  expect((await h.db.pool.query('SELECT count(*)::int n FROM users')).rows[0].n).toBe(1);

  // The first fixture email login is older than the documented resend cooldown.
  await h.db.pool.query("UPDATE auth_transactions SET created_at=created_at-interval '31 seconds' WHERE kind='EMAIL_OTP'");
  const otp=await h.app.inject({method:'POST',url:'/v1/auth/email/start',payload:{clientRequestId:randomUUID(),email,client:'IOS'}});
  expect(otp.statusCode,otp.body).toBe(201);
  const verified=await h.app.inject({method:'POST',url:'/v1/auth/email/verify',payload:{clientRequestId:randomUUID(),challengeId:json(otp).data.challengeId,code:h.idp.inbox.get(email)!.at(-1),appChallenge:pkceChallenge(originalVerifier)}});
  expect(verified.statusCode,verified.body).toBe(200);
  const outcome=json(verified).data;
  const exchanged=await h.app.inject({method:'POST',url:'/v1/auth/handoff',payload:{clientRequestId:randomUUID(),code:outcome.handoffCode,appVerifier:originalVerifier}});
  expect(exchanged.statusCode,exchanged.body).toBe(200);
  const access=json(exchanged).data.accessToken,key=randomUUID();
  const link=(appVerifier:string,intent:string)=>h.app.inject({method:'POST',url:'/v1/auth/links',headers:{authorization:`Bearer ${access}`,'idempotency-key':intent},payload:{linkTicket:pending.linkTicket,originalChallengeProof:outcome.authProof,appVerifier}});
  const wrong=await link('x'.repeat(43),randomUUID());expect(wrong.statusCode,wrong.body).toBe(409);expect(json(wrong).error.code).toBe('LINK_TICKET_INVALID');
  const linked=await link(newVerifier,key);expect(linked.statusCode,linked.body).toBe(200);
  expect(json(linked).data.identities.map((i:{provider:string})=>i.provider).sort()).toEqual(['EMAIL','GOOGLE']);
  expect((await link(newVerifier,key)).statusCode).toBe(200);
  const consumed=await link(newVerifier,randomUUID());expect(consumed.statusCode).toBe(409);
  expect((await h.db.pool.query('SELECT count(*)::int n FROM users')).rows[0].n).toBe(1);
  expect((await h.db.pool.query('SELECT user_id FROM identities WHERE provider=\'GOOGLE\'')).rows[0].user_id).toBe(userId);
});
