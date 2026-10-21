import Fastify from 'fastify';
import {expect,it,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {DomainError} from '../common/errors.ts';
import {defineWrite} from './routes.ts';
import type {AppDeps} from './context.ts';
vi.mock('../identity/sessions.ts',()=>({authenticateToken:vi.fn(async()=>({userId:'actor',sessionId:'session',viaCookie:false}))}));
vi.mock('./rate-limit.ts',()=>({enforceRateLimit:vi.fn()}));
vi.mock('../common/idempotency.ts',()=>({claimIntent:vi.fn(async()=>({kind:'claimed'})),completeIntent:vi.fn(),releaseIntent:vi.fn(),replayIfAuthorized:vi.fn()}));

it('COMMIT serialization retry followed by a sealed rejection never runs an earlier attempt after callback',async()=>{
 let commits=0,attempts=0;const after=vi.fn();
 const client={query:vi.fn(async(sql:string)=>{
  if(sql==='COMMIT'&&++commits===1)throw Object.assign(new Error('serialization'),{code:'40001'});
  return {rows:[]};
 }),release:vi.fn()};
 // The real transaction runner receives controlled PostgreSQL COMMIT failures. Auth and intent
 // plumbing are isolated so this test exercises retry ownership of response side effects only.
 const deps={pool:{connect:async()=>client},config:{sessionSecret:'test'}} as unknown as AppDeps;
 const app=Fastify();
 defineWrite(app,deps,'confirmVenue',async()=>{
  if(++attempts===1)return {data:{},after};
  throw new DomainError('NOT_FOUND','Controlled rejection on retry.');
 });
 try{
  const response=await app.inject({method:'POST',url:'/v1/venues/confirm',headers:{authorization:`Bearer ${'a'.repeat(40)}`,'idempotency-key':randomUUID()},payload:{placeId:'synthetic_place'}});
  expect(response.statusCode,response.body).toBe(404);expect(attempts).toBe(2);expect(commits).toBe(2);expect(after).not.toHaveBeenCalled();
 }finally{await app.close();}
});
