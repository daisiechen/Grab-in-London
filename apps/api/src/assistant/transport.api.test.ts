import {randomBytes,randomUUID} from 'node:crypto';
import {afterAll,beforeAll,describe,expect,inject,it} from 'vitest';
import {mockProvider} from '../../../../packages/assistant/src/index.ts';
import {BudgetLedger} from './budget.ts';
import {Browser,createHarness,json,type Harness} from '../test/harness.ts';
let h:Harness;let calls=0;
beforeAll(async()=>{
 h=await createHarness(inject('pgServerUrl'),{allowedAreas:[],provider:mockProvider('test',async()=>{calls++;return {parsed:{intent:'SEARCH',patches:[],mealIds:[]},usage:{inputTokens:10,outputTokens:10},providerRequestId:`synthetic-${randomUUID()}`};}),price:{version:'test-only-no-real-price',verified:true,inputMicroCnyPerMillion:1_000_000n,outputMicroCnyPerMillion:1_000_000n,validUntil:Date.now()+60_000},countInputTokens:()=>1024});
 const {rows:[period]}=await h.db.pool.query(`SELECT 'D:'||to_char(clock_timestamp() AT TIME ZONE 'Europe/London','YYYY-MM-DD') AS day,'M:'||to_char(clock_timestamp() AT TIME ZONE 'Europe/London','YYYY-MM') AS month`);
 const ledger=new BudgetLedger(h.db.pool);await ledger.configure(period.day,10_000_000n,100,true);await ledger.configure(period.month,50_000_000n,100,true);
});afterAll(async()=>{await h.close();});
describe('injected mock provider through real assistant HTTP transport',()=>{
 it('authenticates a native guest bearer, keeps device proof separate, deduplicates a turn and persists no result body',async()=>{
  const guest=await h.app.inject({method:'POST',url:'/v1/guest-sessions',payload:{clientRequestId:randomUUID(),client:'IOS'}});expect(guest.statusCode).toBe(201);
  const bearer={authorization:`Bearer ${json(guest).data.guestToken}`};
  const boot=await h.app.inject({method:'POST',url:'/v1/ai/sessions',headers:{...bearer,'idempotency-key':randomUUID()},payload:{deviceChallenge:randomBytes(32).toString('base64url')}});expect(boot.statusCode,boot.body).toBe(201);
  const session=json(boot).data,requestId=randomUUID(),headers={...bearer,'ai-device-token':session.deviceToken,'idempotency-key':requestId};
  const body={requestId,generation:session.generation,input:'Find a meal',sourcePage:'DISCOVER',queryVersion:'0',preferenceVersion:'0',contextVersion:'0'};
  const send=()=>h.app.inject({method:'POST',url:`/v1/ai/sessions/${session.sessionId}/requests`,headers,payload:body});
  expect((await send()).statusCode).toBe(202);
  let status;
  for(let attempt=0;attempt<100;attempt++){
   status=await h.app.inject({method:'GET',url:`/v1/ai/requests/${requestId}?sessionId=${session.sessionId}&generation=${session.generation}`,headers});
   expect(status.statusCode,status.body).toBe(200);if(json(status).data.state!=='PENDING')break;await new Promise<void>(resolve=>setImmediate(resolve));
  }
  expect(json(status!).data).toMatchObject({state:'SUCCEEDED',result:{cards:[]}});
  expect((await send()).statusCode).toBe(202);expect(calls).toBe(1);
  expect((await h.db.pool.query(`SELECT count(*)::int AS n FROM idempotency WHERE operation='requestAI'`)).rows[0].n).toBe(0);
  const metadata=JSON.stringify((await h.db.pool.query(`SELECT * FROM ai_requests WHERE request_id=$1`,[requestId])).rows);
  expect(metadata).not.toContain('Find a meal');expect(metadata).not.toContain('No eligible public meals');
  const forged=await h.app.inject({method:'GET',url:`/v1/ai/sessions/${session.sessionId}`,headers:bearer});expect(forged.statusCode).toBe(410);
  const other=new Browser(h);const login=await other.signInWithEmail(`${randomUUID()}@example.invalid`);
  const deletion=await other.request('POST','/v1/me/deletion',{body:{confirm:true,receiptToken:randomBytes(32).toString('base64url')},headers:{'idempotency-key':randomUUID(),'if-match':`"${login.body.data.session.user.version}"`}});
  expect(deletion.statusCode,deletion.body).toBe(202);
  const expired=await h.app.inject({method:'GET',url:`/v1/ai/sessions/${session.sessionId}`,headers});expect(expired.statusCode,expired.body).toBe(410);
 });
});
