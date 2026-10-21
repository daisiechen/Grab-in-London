import {describe,it,expect,vi} from 'vitest';
import {deepSeekProvider,maximumCost,type ModelInput} from './provider.ts';
const syntheticProviderKey='synthetic-provider-fixture';
const config={apiKey:syntheticProviderKey,model:'synthetic-verified-model',modelVerified:true,enabled:true,priceVersion:'synthetic-price'};
const request=():ModelInput=>({schema:{type:'object',properties:{intent:{type:'string'}}},input:'合成餐局 / synthetic meal',deadline:Date.now()+2000,maxOutputTokens:100,callId:'synthetic-call'});
const body=(overrides:Record<string,unknown>={})=>({id:'synthetic-provider-id',choices:[{finish_reason:'stop',message:{content:'{"intent":"SEARCH"}'}}],usage:{prompt_tokens:12,completion_tokens:8},...overrides});
const reply=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
describe('DeepSeek official chat transport: QA-AI-050/052 local preparation',()=>{
 it('uses only the allowlisted official JSON/nonthinking parameters, never OpenAI store or tools',async()=>{
  const fetch=vi.fn<typeof globalThis.fetch>().mockResolvedValue(reply(body()));
  const value=await deepSeekProvider({...config,fetch}).generate(request());expect(value.usage).toEqual({inputTokens:12,outputTokens:8});
  const [url,init]=fetch.mock.calls[0]!;expect(url).toBe('https://api.deepseek.com/chat/completions');expect(init?.redirect).toBe('error');
  const sent=JSON.parse(String(init?.body)) as Record<string,unknown>;
  expect(Object.keys(sent).sort()).toEqual(['max_tokens','messages','model','response_format','stream','thinking']);
  expect(sent).toMatchObject({max_tokens:100,stream:false,thinking:{type:'disabled'},response_format:{type:'json_object'}});
  expect(sent.messages).toEqual([{role:'system',content:expect.stringContaining('JSON')},{role:'user',content:'合成餐局 / synthetic meal'}]);
  expect(sent).not.toHaveProperty('store');expect(sent).not.toHaveProperty('user_id');expect(sent).not.toHaveProperty('tools');
 });
 it.each(['length','content_filter','tool_calls','insufficient_system_resource','aborted'])('rejects %s without a usable result, retaining known usage',async finish_reason=>{
  const fetch=vi.fn<typeof globalThis.fetch>().mockResolvedValue(reply(body({choices:[{finish_reason,message:{content:'{}'}}]})));
  await expect(deepSeekProvider({...config,fetch}).generate(request())).rejects.toMatchObject({code:'PROVIDER_INVALID_RESULT',cost:'KNOWN',usage:{inputTokens:12,outputTokens:8}});expect(fetch).toHaveBeenCalledTimes(1);
 });
 it.each(['','   ','{','null','[]','"refused"'])('rejects empty, partial or nonobject JSON (%s)',async content=>{
  await expect(deepSeekProvider({...config,fetch:async()=>reply(body({choices:[{finish_reason:'stop',message:{content}}]}))}).generate(request())).rejects.toMatchObject({code:'PROVIDER_INVALID_RESULT',cost:'KNOWN'});
 });
 it.each([{refusal:'denied'}, {tool_calls:[{function:{name:'apply'}}]}])('rejects unexpected refusal/tool messages even with stop (%j)',async extra=>{
  await expect(deepSeekProvider({...config,fetch:async()=>reply(body({choices:[{finish_reason:'stop',message:{content:'{}',...extra}}]}))}).generate(request())).rejects.toMatchObject({code:'PROVIDER_INVALID_RESULT',cost:'KNOWN'});
 });
 it.each([undefined,{prompt_tokens:-1,completion_tokens:3},{prompt_tokens:1.1,completion_tokens:3},{prompt_tokens:10,completion_tokens:'3'},{prompt_tokens:1,completion_tokens:Number.MAX_SAFE_INTEGER+1}])('never guesses missing or invalid usage (%j)',async usage=>{
  await expect(deepSeekProvider({...config,fetch:async()=>reply(body({usage}))}).generate(request())).rejects.toMatchObject({code:'PROVIDER_INVALID_RESULT',cost:'UNKNOWN',usage:null});
 });
 it('retains full billed completion tokens including reasoning in usage and rejects output overflow',async()=>{
  await expect(deepSeekProvider({...config,fetch:async()=>reply(body({usage:{prompt_tokens:9,completion_tokens:101,completion_tokens_details:{reasoning_tokens:90}}}))}).generate(request())).rejects.toMatchObject({cost:'KNOWN',usage:{inputTokens:9,outputTokens:101}});
 });
 it.each([400,401,402,429,500,503])('does not retry HTTP %s or expose provider diagnostics',async status=>{
  const fetch=vi.fn<typeof globalThis.fetch>().mockResolvedValue(reply({error:'synthetic confidential diagnostic'},status));
  await expect(deepSeekProvider({...config,fetch}).generate(request())).rejects.toMatchObject({code:'PROVIDER_UNAVAILABLE',cost:'UNKNOWN',message:'PROVIDER_UNAVAILABLE'});expect(fetch).toHaveBeenCalledTimes(1);
 });
 it('does not send an already cancelled/expired/noninteger request',async()=>{
  const fetch=vi.fn<typeof globalThis.fetch>();const c=new AbortController();c.abort();const provider=deepSeekProvider({...config,fetch});
  for(const req of [{...request(),signal:c.signal},{...request(),deadline:0},{...request(),maxOutputTokens:1.5}])await expect(provider.generate(req)).rejects.toMatchObject({cost:'KNOWN'});
  expect(fetch).not.toHaveBeenCalled();
 });
 it('preserves known usage when completion arrives after deadline',async()=>{
  let now=0;const req={...request(),deadline:1000};
  await expect(deepSeekProvider({...config,now:()=>now,fetch:async()=>{now=1001;return reply(body());}}).generate(req)).rejects.toMatchObject({code:'PROVIDER_TIMEOUT',cost:'KNOWN',usage:{inputTokens:12,outputTokens:8}});
 });
 it('prices the candidate at uncached peak CNY with no silent off-peak/cache discount',()=>{
  expect(maximumCost(16000,2000,{inputMicroCnyPerMillion:2_000_000n,outputMicroCnyPerMillion:8_000_000n})).toBe(48_000n);
 });
});
it.each([null,[],42])('rejects malformed top-level provider envelope (%j) with unknown cost',async value=>{
 await expect(deepSeekProvider({...config,fetch:async()=>reply(value)}).generate(request())).rejects.toMatchObject({code:'PROVIDER_INVALID_RESULT',cost:'UNKNOWN'});
});
it('rejects missing provider identity with known usage instead of inventing one',async()=>{
 await expect(deepSeekProvider({...config,fetch:async()=>reply(body({id:null}))}).generate(request())).rejects.toMatchObject({code:'PROVIDER_INVALID_RESULT',cost:'KNOWN',providerRequestId:null});
});
it('aborts dispatched transport on caller cancellation and retains unknown sent cost without retry',async()=>{
 const cancel=new AbortController();let sent=0;
 const provider=deepSeekProvider({...config,fetch:async(_url,init)=>{sent++;return new Promise<Response>((_resolve,reject)=>{init?.signal?.addEventListener('abort',()=>reject(new Error('synthetic abort diagnostic')),{once:true});});}});
 const done=expect(provider.generate({...request(),signal:cancel.signal})).rejects.toMatchObject({code:'PROVIDER_TIMEOUT',cost:'UNKNOWN',usage:null});cancel.abort();await done;expect(sent).toBe(1);
});
