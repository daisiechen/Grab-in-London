import {describe,expect,it,vi} from 'vitest';
import {ResendMailProvider} from './resend-provider.ts';
const id='f6440976-1cec-4d81-a0c8-cd59c5751872',mealId='b44e2f0e-f793-40f3-a0b4-9665ca55892a';
const input={idempotencyKey:id,email:'synthetic@example.invalid',template:'application_approved',refs:{mealId}};
// Constructed test sentinel only, never a configured provider credential.
const options={apiKey:['re','SYNTHETIC','NOT','A','REAL','KEY'].join('_'),from:'Fancy <noreply@example.invalid>',webOrigin:'https://fancy.example'};
describe('Resend sending-only production transport',()=>{
 it('sends one deterministic fixed-template request with opaque outbox idempotency key',async()=>{
  const fetcher=vi.fn<typeof fetch>(async()=>Response.json({id})),provider=new ResendMailProvider({...options,fetch:fetcher});
  expect(provider.kind).toBe('real');expect(await provider.send(input)).toEqual({status:'SENT',providerId:id});expect(fetcher).toHaveBeenCalledTimes(1);
  const [url,init]=fetcher.mock.calls[0]!;expect(url).toBe('https://api.resend.com/emails');expect(init?.method).toBe('POST');expect(init?.redirect).toBe('error');expect(init?.headers).toMatchObject({'Idempotency-Key':id});
  const body=JSON.parse(String(init?.body));expect(body.to).toEqual([input.email]);expect(body.tags).toEqual([{name:'outbox_id',value:id}]);expect(JSON.stringify(body.tags)).not.toContain(input.email);expect(body.subject).toBe('Your Fancy application was approved');expect(body.text).toContain('https://fancy.example/meals/'+mealId);expect(body).not.toHaveProperty('reply_to');
  await provider.send(input);expect(fetcher.mock.calls[1]![1]?.body).toBe(init?.body);expect(fetcher.mock.calls[1]![1]?.headers).toEqual(init?.headers);
 });
 it('does not call any API or infer NOT_SENT for an unknown lookup',async()=>{
  const fetcher=vi.fn<typeof fetch>(),provider=new ResendMailProvider({...options,fetch:fetcher});expect(await provider.lookup(id)).toEqual({status:'UNKNOWN'});expect(fetcher).not.toHaveBeenCalled();
 });
 for(const status of [408,409,500,503])it(`keeps ambiguous HTTP ${status} unknown without retry`,async()=>{
  const fetcher=vi.fn<typeof fetch>(async()=>new Response('PRIVATE_PROVIDER_DETAIL',{status})),provider=new ResendMailProvider({...options,fetch:fetcher});expect(await provider.send(input)).toEqual({status:'UNKNOWN'});expect(fetcher).toHaveBeenCalledTimes(1);
 });
 for(const status of [400,401,403,404,422,429])it(`returns retry for definitively refused HTTP ${status} without provider detail`,async()=>{
  const fetcher=vi.fn<typeof fetch>(async()=>new Response('PRIVATE_PROVIDER_DETAIL',{status})),provider=new ResendMailProvider({...options,fetch:fetcher});expect(await provider.send(input)).toEqual({status:'RETRY'});expect(fetcher).toHaveBeenCalledTimes(1);
 });
 it('treats transport failure and malformed success as UNKNOWN and logs no sensitive data',async()=>{
  const logs=[vi.spyOn(console,'log'),vi.spyOn(console,'warn'),vi.spyOn(console,'error')];
  try{for(const fetcher of [vi.fn<typeof fetch>(async()=>{throw Error('PRIVATE_PROVIDER_DETAIL');}),vi.fn<typeof fetch>(async()=>Response.json({email:input.email})),vi.fn<typeof fetch>(async()=>new Response('not json',{status:200}))]){expect(await new ResendMailProvider({...options,fetch:fetcher}).send(input)).toEqual({status:'UNKNOWN'});expect(fetcher).toHaveBeenCalledTimes(1);}for(const log of logs)expect(log).not.toHaveBeenCalled();}finally{for(const log of logs)log.mockRestore();}
 });
 it('uses an abort deadline and does not retry when it expires',async()=>{
  const fetcher=vi.fn<typeof fetch>((_url,init)=>new Promise((_resolve,reject)=>init?.signal?.addEventListener('abort',()=>reject(Error('private timeout')),{once:true})));
  const keepAlive=setInterval(()=>{},10);try{expect(await new ResendMailProvider({...options,timeoutMs:5,fetch:fetcher}).send(input)).toEqual({status:'UNKNOWN'});expect(fetcher).toHaveBeenCalledTimes(1);}finally{clearInterval(keepAlive);}
 });
 it('renders only the fixed notification set and validated origin/UUID references',async()=>{
  const fetcher=vi.fn<typeof fetch>(async()=>Response.json({id})),provider=new ResendMailProvider({...options,fetch:fetcher});
  for(const template of ['application_approved','application_declined','application_expired','meal_cancelled','deletion_received','deletion_completed'])expect((await provider.send({...input,template})).status).toBe('SENT');
  const count=fetcher.mock.calls.length;
  for(const bad of [{...input,template:'chat_message'},{...input,refs:{mealId:'https://evil.invalid'}},{...input,refs:{body:'PRIVATE_CHAT_CANARY'}},{...input,idempotencyKey:'\r\nsecret'}])expect(await provider.send(bad)).toEqual({status:'RETRY'});
  expect(fetcher).toHaveBeenCalledTimes(count);expect(JSON.stringify(fetcher.mock.calls)).not.toContain('PRIVATE_CHAT_CANARY');
 });
 it('refuses unsafe configuration without echoing its values',()=>{
  for(const webOrigin of ['https://user:PRIVATE@example.invalid','https://example.invalid/path','https://example.invalid?x=PRIVATE','http://public.example.invalid','javascript:PRIVATE'])expect(()=>new ResendMailProvider({...options,webOrigin})).toThrow('Invalid mail provider configuration');
  expect(()=>new ResendMailProvider({...options,from:'PRIVATE\r\nBcc: private@example.invalid'})).toThrow('Invalid mail provider configuration');
  expect(()=>new ResendMailProvider({...options,apiKey:''})).toThrow('Invalid mail provider configuration');
  expect(()=>new ResendMailProvider({...options,webOrigin:'http://127.0.0.1:5174'})).not.toThrow();
 });
});
it('requires current claim admission when configured and excludes the fencing token from provider data',async()=>{
 const fetcher=vi.fn<typeof fetch>(async()=>Response.json({id})),claimToken='dcb0544f-16c3-4342-a8b0-ef909159ddee';
 for(const onDispatch of [vi.fn(async()=>false),vi.fn(async()=>{throw Error('PRIVATE_ADMISSION_FAULT');})]){
  const provider=new ResendMailProvider({...options,fetch:fetcher,onDispatch});expect(await provider.send({...input,claimToken})).toEqual({status:'UNKNOWN'});
 }
 expect(fetcher).not.toHaveBeenCalled();const admission=vi.fn(async()=>true),provider=new ResendMailProvider({...options,fetch:fetcher,onDispatch:admission});expect(await provider.send(input)).toEqual({status:'UNKNOWN'});expect(admission).not.toHaveBeenCalled();
 expect((await provider.send({...input,claimToken})).status).toBe('SENT');expect(admission).toHaveBeenCalledWith({outboxId:id,claimToken,payloadSha256:expect.stringMatching(/^[0-9a-f]{64}$/)});expect(JSON.stringify(fetcher.mock.calls)).not.toContain(claimToken);
});
it('rechecks monotonic DB-derived destination budget after awaited dispatch hook, before fetch',async()=>{
 let monotonic=100;const now=vi.spyOn(performance,'now').mockImplementation(()=>monotonic),fetcher=vi.fn<typeof fetch>(async()=>Response.json({id}));
 try{const provider=new ResendMailProvider({...options,fetch:fetcher,onDispatch:async()=>{monotonic=201;return true;}});expect(await provider.send({...input,claimToken:mealId,dispatchDeadlineMs:200})).toEqual({status:'RETRY'});expect(fetcher).not.toHaveBeenCalled();
 const live=new ResendMailProvider({...options,fetch:fetcher,onDispatch:async()=>true});expect(await live.send({...input,claimToken:mealId,dispatchDeadlineMs:202})).toEqual({status:'SENT',providerId:id});expect(fetcher).toHaveBeenCalledTimes(1);expect(JSON.stringify(fetcher.mock.calls)).not.toContain('dispatchDeadlineMs');
 }finally{now.mockRestore();}
});
