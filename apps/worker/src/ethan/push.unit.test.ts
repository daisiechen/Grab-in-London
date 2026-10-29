import {describe,expect,it,vi} from 'vitest';
import {buildEthanPayload,ethanPushFor,HttpEthanPush,TestEthanPush} from './push.ts';

// Constructed test sentinel only, never a configured credential.
const token=['ethan','SYNTHETIC','NOT','A','REAL','TOKEN'].join('_');
const reportId='b44e2f0e-f793-40f3-a0b4-9665ca55892a',otherId='f6440976-1cec-4d81-a0c8-cd59c5751872';
const stats={open:3,autoLimited:1,overdue:0,dueWithin6h:2,oldestHoursLeft:4.5,urgentOpen:2};
const KEYS=['kind','sentAt','open','autoLimited','overdue','dueWithin6h','oldestHoursLeft','urgentOpen','reason','count','adminUrl'];

describe('Ethan push payload',()=>{
 it('has exactly the contract fields: counts, reason, cumulative count and one admin link',()=>{
  const sentAt=new Date('2026-11-05T09:00:00Z');
  const urgent=buildEthanPayload({kind:'urgent',reason:'safety',report_ids:[reportId],report_count:4,stats},sentAt,'https://fancyabite.uk/admin/');
  expect(Object.keys(urgent).sort()).toEqual([...KEYS].sort());
  expect(urgent).toEqual({kind:'urgent',sentAt:'2026-11-05T09:00:00.000Z',open:3,autoLimited:1,overdue:0,dueWithin6h:2,oldestHoursLeft:4.5,urgentOpen:2,reason:'safety',count:4,adminUrl:`https://fancyabite.uk/admin/#moderation/${reportId}`});
  const batch=buildEthanPayload({kind:'urgent',reason:'harassment',report_ids:[reportId,otherId],report_count:2,stats},sentAt,'https://fancyabite.uk/admin/');
  expect(batch.adminUrl).toBe('https://fancyabite.uk/admin/#moderation');
  const morning=buildEthanPayload({kind:'morning',reason:null,report_ids:[],report_count:3,stats:{...stats,oldestHoursLeft:null}},sentAt,'https://fancyabite.uk/admin/');
  expect(morning).toMatchObject({kind:'morning',reason:null,count:3,oldestHoursLeft:null,adminUrl:'https://fancyabite.uk/admin/#moderation'});
 });
 it('drops anything that is not a whitelisted count, so no text or ids can leak from stats',()=>{
  const leaky={...stats,details:'PRIVATE_REPORT_TEXT',email:'someone@example.invalid',userId:otherId,open:'3; drop',overdue:-1};
  const body=JSON.stringify(buildEthanPayload({kind:'evening',reason:'safety',report_ids:[otherId],report_count:1,stats:leaky},new Date(),'https://fancyabite.uk/admin/'));
  for(const secret of ['PRIVATE','@example','drop',otherId])expect(body).not.toContain(secret);
  expect(JSON.parse(body)).toMatchObject({open:0,overdue:0,reason:null});
 });
});

describe('Ethan HTTP transport',()=>{
 const payload=buildEthanPayload({kind:'morning',reason:null,report_ids:[],report_count:3,stats},new Date('2026-11-05T09:00:00Z'),'https://fancyabite.uk/admin/');
 it('POSTs JSON with the Bearer token and an idempotency key',async()=>{
  const fetcher=vi.fn<typeof fetch>(async()=>new Response(null,{status:204}));
  const push=new HttpEthanPush({url:'https://ethan.example.test/hooks/fancy',token,fetch:fetcher});
  expect(await push.send({idempotencyKey:otherId,payload})).toEqual({status:'SENT'});
  const [url,init]=fetcher.mock.calls[0]!;
  expect(url).toBe('https://ethan.example.test/hooks/fancy');
  expect(init).toMatchObject({method:'POST',redirect:'error',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','Idempotency-Key':otherId}});
  expect(JSON.parse(String(init?.body))).toEqual(payload);
  expect(JSON.stringify(push)).not.toContain(token);
 });
 it.each([[429,'RETRY'],[500,'RETRY'],[503,'RETRY'],[400,'REJECTED'],[401,'REJECTED'],[404,'REJECTED'],[410,'REJECTED']] as const)('treats HTTP %i as %s',async(status,kind)=>{
  const push=new HttpEthanPush({url:'https://ethan.example.test/x',token,fetch:async()=>new Response('PRIVATE_DETAIL',{status})});
  const outcome=await push.send({idempotencyKey:otherId,payload});
  expect(outcome.status).toBe(kind);
  expect(JSON.stringify(outcome)).not.toContain(token);
  expect(JSON.stringify(outcome)).not.toContain('PRIVATE_DETAIL');
 });
 it('retries a network failure',async()=>{
  const push=new HttpEthanPush({url:'https://ethan.example.test/x',token,fetch:async()=>{throw new Error(`boom ${token}`);}});
  expect(await push.send({idempotencyKey:otherId,payload})).toEqual({status:'RETRY',errorCode:'NETWORK'});
 });
 it('uses the in-memory adapter outside staging/production and nothing when unconfigured',()=>{
  expect(ethanPushFor({environment:'development',ethanModeration:null})).toBeNull();
  expect(ethanPushFor({environment:'development',ethanModeration:{url:'http://127.0.0.1:9/x',token}})).toBeInstanceOf(TestEthanPush);
  expect(ethanPushFor({environment:'test',ethanModeration:{url:'http://127.0.0.1:9/x',token}})).toBeInstanceOf(TestEthanPush);
  expect(ethanPushFor({environment:'production',ethanModeration:{url:'https://ethan.example.test/x',token}})).toBeInstanceOf(HttpEthanPush);
 });
});
