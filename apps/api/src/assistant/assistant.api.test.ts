import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,describe,expect,inject,it} from 'vitest';
import {Browser,createHarness,json,type Harness} from '../test/harness.ts';
let h:Harness;
beforeAll(async()=>{h=await createHarness(inject('pgServerUrl'));});afterAll(async()=>{await h.close();});
describe('assistant HTTP security with model disabled',()=>{
 it('mints one opaque guest credential per durable intent and rejects replay after restart-equivalent metadata lookup',async()=>{
  const id=randomUUID();const response=await h.app.inject({method:'POST',url:'/v1/guest-sessions',payload:{clientRequestId:id,client:'IOS'}});
  expect(response.statusCode,response.body).toBe(201);const token=json(response).data.guestToken;expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  const replay=await h.app.inject({method:'POST',url:'/v1/guest-sessions',payload:{clientRequestId:id,client:'IOS'}});
  expect(replay.statusCode,replay.body).toBe(409);expect(json(replay).error.code).toBe('AI_CONFLICT');
  const {rows:[row]}=await h.db.pool.query(`SELECT row_to_json(g)::text value FROM guest_sessions g WHERE client_request_id=$1`,[id]);expect(row.value).not.toContain(token);
 });
 it('binds guest web writes to Origin plus CSRF, and AI sessions to a device proof',async()=>{
  const browser=new Browser(h);const guest=await browser.request('POST','/v1/guest-sessions',{body:{clientRequestId:randomUUID(),client:'WEB'}});
  expect(guest.statusCode,guest.body).toBe(201);expect(json(guest).data.guestToken).toBeNull();browser.csrf=json(guest).data.csrfToken;
  const challenge=Buffer.alloc(32,1).toString('base64url');
  const boot=await browser.request('POST','/v1/ai/sessions',{body:{deviceChallenge:challenge},headers:{'idempotency-key':randomUUID()}});
  expect(boot.statusCode,boot.body).toBe(201);const session=json(boot).data;
  expect((await browser.request('GET',`/v1/ai/sessions/${session.sessionId}`)).statusCode).toBe(410);
  expect((await browser.request('GET',`/v1/ai/sessions/${session.sessionId}`,{headers:{'ai-device-token':session.deviceToken}})).statusCode).toBe(200);
  const duplicate=await browser.request('POST','/v1/ai/sessions',{body:{deviceChallenge:challenge},headers:{'idempotency-key':randomUUID()}});expect(duplicate.statusCode).toBe(409);
  browser.csrf=null;
  expect((await browser.request('POST',`/v1/ai/sessions/${session.sessionId}/activity`,{body:{generation:1,activityEventId:randomUUID(),activityType:'EDIT'},headers:{'ai-device-token':session.deviceToken}})).statusCode).toBe(403);
  const wrongOrigin=await h.app.inject({method:'POST',url:'/v1/guest-sessions',headers:{origin:'https://evil.example.invalid'},payload:{clientRequestId:randomUUID(),client:'IOS'}});expect(wrongOrigin.statusCode).toBe(403);
 });
 it('keeps confirmed preference CRUD independent of unavailable AI and never persists response bodies',async()=>{
  const browser=new Browser(h);await browser.signInWithEmail(`${randomUUID()}@example.invalid`);
  const initial=await browser.request('GET','/v1/ai/preferences');expect(initial.statusCode,initial.body).toBe(200);expect(json(initial).data.version).toBe('0');
  const fields={areas:[],budgetMaxPence:3500,tableSizes:[4],dietaryCodes:[],languages:['en'],moods:[]};
  const saved=await browser.request('PUT','/v1/ai/preferences',{body:{fields,confirmation:true},headers:{'if-match':'"0"','idempotency-key':randomUUID()}});expect(saved.statusCode,saved.body).toBe(200);expect(json(saved).data.version).toBe('1');
  const boot=await browser.request('POST','/v1/ai/sessions',{body:{deviceChallenge:Buffer.alloc(32,2).toString('base64url')},headers:{'idempotency-key':randomUUID()}});expect(boot.statusCode,boot.body).toBe(201);const session=json(boot).data;
  const turn=await browser.request('POST',`/v1/ai/sessions/${session.sessionId}/requests`,{body:{requestId:randomUUID(),generation:1,input:'Find a meal',sourcePage:'DISCOVER',queryVersion:'0',preferenceVersion:'1',contextVersion:'0'},headers:{'ai-device-token':session.deviceToken}});
  expect(turn.statusCode,turn.body).toBe(503);expect(json(turn).error.code).toBe('AI_UNAVAILABLE');
  const removed=await browser.request('DELETE','/v1/ai/preferences',{headers:{'if-match':'"1"','idempotency-key':randomUUID()}});expect(removed.statusCode,removed.body).toBe(200);expect(json(removed).data).toMatchObject({version:'2',epoch:'2',confirmedAt:null});
  const {rows:[count]}=await h.db.pool.query(`SELECT count(*)::int n FROM idempotency WHERE operation LIKE '%AIPreferences%' OR operation LIKE '%AI'`);expect(count.n).toBe(0);
  expect(turn.headers['cache-control']).toBe('private, no-store');expect(turn.headers['x-request-id']).toBeTruthy();
 });
});
