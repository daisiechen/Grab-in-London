import { describe, expect, it } from 'vitest';
import { AssistantRuntime, SESSION_TTL_MS } from './runtime.ts';
import { emptyPreferences, validatePreferences } from './preferences.ts';
import { deepSeekProvider, maximumCost, mockProvider } from './provider.ts';

const subject = 'user:00000000-0000-4000-8000-000000000001';
function setup() {
  let now = 0;
  const runtime = new AssistantRuntime({ now: () => now, maxSessions: 1 });
  const s = runtime.create(subject, '0');
  const binding = { subject, deviceToken: s.deviceToken, generation: s.generation, preferenceEpoch: '0' };
  return { runtime, s, binding, time: (n: number) => { now = n; } };
}
describe('AI RAM boundary', () => {
  it('expires at the exact 30-minute boundary; reads and replayed activity never extend it', () => {
    const h = setup();
    h.time(1000); expect(h.runtime.activity(h.s.id, h.binding, 'edit-1', 'EDIT')).toBe(1000 + SESSION_TTL_MS);
    h.time(2000); expect(h.runtime.activity(h.s.id, h.binding, 'edit-1', 'EDIT')).toBe(1000 + SESSION_TTL_MS);
    h.time(SESSION_TTL_MS); h.runtime.read(h.s.id, h.binding);
    h.time(SESSION_TTL_MS + 1000); expect(() => h.runtime.read(h.s.id, h.binding)).toThrow('AI_SESSION_EXPIRED');
  });
  it('binds owner/device/epoch and aborts on preference deletion before any late publish', () => {
    const h = setup();
    const signal = h.runtime.begin(h.s.id, h.binding);
    expect(() => h.runtime.read(h.s.id, { ...h.binding, subject: 'other' })).toThrow('AI_SESSION_EXPIRED');
    expect(() => h.runtime.read(h.s.id, { ...h.binding, preferenceEpoch: '1' })).toThrow('AI_SUPERSEDED');
    h.runtime.invalidateSubject(subject);
    expect(signal.aborted).toBe(true);
    expect(() => h.runtime.publish(h.s.id, h.binding, 'request', { text: 'late' })).toThrow('AI_SESSION_EXPIRED');
  });
  it('does not evict active sessions to admit new ones and loses results on restart', () => {
    const h = setup();
    expect(() => h.runtime.create(subject, '0')).toThrow('AI_UNAVAILABLE');
    h.runtime.publish(h.s.id, h.binding, 'r', { text: 'private' });
    const restarted = new AssistantRuntime();
    expect(() => restarted.result(h.s.id, h.binding, 'r')).toThrow('AI_SESSION_EXPIRED');
    h.runtime.shutdown();
    expect(() => h.runtime.read(h.s.id, h.binding)).toThrow('AI_SESSION_EXPIRED');
  });
});
describe('preferences validation', () => {
  it('accepts only confirmed-value domains for the six fields', () => {
    expect(validatePreferences({ ...emptyPreferences(), areas: ['soho'], budgetMaxPence: 3500 }, ['soho'])).toMatchObject({ budgetMaxPence: 3500 });
    for (const value of [{ ...emptyPreferences(), biography: 'secret' }, { ...emptyPreferences(), areas: ['unknown'] }, { ...emptyPreferences(), languages: ['invented'] }, { ...emptyPreferences(), budgetMaxPence: 1.1 }]) expect(() => validatePreferences(value, ['soho'])).toThrow('AI_INVALID_PREFERENCES');
  });
});
describe('provider boundary', () => {
  it('fails closed before network without verified model/prices/credentials and refuses production mocks', async () => {
    let sent = 0;
    const p = deepSeekProvider({ enabled: true, apiKey: '', model: 'unverified', modelVerified: false, priceVersion: '', fetch: async () => { sent++; throw Error(); } });
    await expect(p.generate({ schema: {}, input: 'private', callId: 'r', deadline: Date.now() + 1000, maxOutputTokens: 2000 })).rejects.toThrow('PROVIDER_UNAVAILABLE');
    expect(sent).toBe(0);
    expect(() => mockProvider('production', async () => { throw Error(); })).toThrow('PROVIDER_UNAVAILABLE');
  });
  it('rounds costs upwards using integer microCNY and never assumes cached-input pricing', () => {
    expect(maximumCost(1, 1, { inputMicroCnyPerMillion: 1n, outputMicroCnyPerMillion: 1n })).toBe(2n);
    expect(maximumCost(16000, 2000, { inputMicroCnyPerMillion: 2_000_000n, outputMicroCnyPerMillion: 3_000_000n })).toBe(38_000n);
  });
});

describe('DeepSeek transport with isolated provider responses',()=>{
  const request=()=>({schema:{type:'object'},input:'Synthetic example only',callId:'call',deadline:Date.now()+1000,maxOutputTokens:100});
  const syntheticProviderKey='synthetic-test-key';
  const config={enabled:true,apiKey:syntheticProviderKey,model:'synthetic-verified-model',modelVerified:true,priceVersion:'synthetic-CNY'};
  it('posts JSON/nonthinking with an explicit output ceiling and never retries network uncertainty',async()=>{
    let calls=0;let body:Record<string,unknown>={};
    const provider=deepSeekProvider({...config,fetch:async(_url,init)=>{calls++;body=JSON.parse(String(init?.body)) as Record<string,unknown>;throw new Error('secret provider trace');}});
    await expect(provider.generate(request())).rejects.toMatchObject({code:'PROVIDER_UNAVAILABLE',cost:'UNKNOWN',message:'PROVIDER_UNAVAILABLE'});
    expect(calls).toBe(1);expect(body).toMatchObject({stream:false,thinking:{type:'disabled'},max_tokens:100,response_format:{type:'json_object'}});
    expect(body).not.toHaveProperty('tools');
  });
  it('requires known usage and a complete JSON reply; truncation never returns a usable draft',async()=>{
    const replies=[{id:'r',choices:[{finish_reason:'length',message:{content:'{"draft":"partial"}'}}],usage:{prompt_tokens:10,completion_tokens:100}},
      {id:'r2',choices:[{finish_reason:'stop',message:{content:'{}'}}]},
      {id:'r3',choices:[{finish_reason:'stop',message:{content:'{"intent":"CLARIFY"}'}}],usage:{prompt_tokens:12,completion_tokens:8}}];
    const provider=deepSeekProvider({...config,fetch:async()=>({ok:true,json:async()=>replies.shift()}) as Response});
    await expect(provider.generate(request())).rejects.toMatchObject({code:'PROVIDER_INVALID_RESULT',cost:'KNOWN',providerRequestId:'r'});
    await expect(provider.generate(request())).rejects.toMatchObject({code:'PROVIDER_INVALID_RESULT',cost:'UNKNOWN'});
    await expect(provider.generate(request())).resolves.toEqual({parsed:{intent:'CLARIFY'},usage:{inputTokens:12,outputTokens:8},providerRequestId:'r3'});
  });
});
