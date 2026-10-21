/** QA-AI-017/018: actual HTTP checks at generation, transfer and send, independent of meal cancellation. */
import {randomBytes,randomUUID} from 'node:crypto';
import {afterEach,beforeEach,expect,inject,it} from 'vitest';
import {Browser,createHarness,json,type Harness} from '../apps/api/src/test/harness.ts';
import {mockProvider} from '../packages/assistant/src/index.ts';
import {BudgetLedger} from '../apps/api/src/assistant/budget.ts';
let h:Harness,captured:string[]=[];
const TEXT='Could we meet outside the restaurant a few minutes early?';
beforeEach(async()=>{
 captured=[];h=await createHarness(inject('pgServerUrl'),{allowedAreas:[],provider:mockProvider('test',async req=>{captured.push(req.input);const body=JSON.parse(req.input);return{parsed:body.kind==='GROUP'?{text:TEXT}:{intent:'DRAFT_GROUP',patches:[],mealIds:[]},usage:{inputTokens:10,outputTokens:10},providerRequestId:randomUUID()};}),price:{version:'synthetic-QA-not-real-price',verified:true,inputMicroCnyPerMillion:1000000n,outputMicroCnyPerMillion:1000000n,validUntil:Date.now()+60000},countInputTokens:()=>1024});
 const p=(await h.db.pool.query("SELECT 'D:'||to_char(clock_timestamp() AT TIME ZONE 'Europe/London','YYYY-MM-DD') day_period,'M:'||to_char(clock_timestamp() AT TIME ZONE 'Europe/London','YYYY-MM') month_period")).rows[0],budget=new BudgetLedger(h.db.pool);await budget.configure(p.day_period,10000000n,100,true);await budget.configure(p.month_period,10000000n,100,true);
});afterEach(async()=>h.close());
const headers=(version?:string,key=randomUUID())=>({'idempotency-key':key,...(version?{'if-match':`"${version}"`}:{})});
async function actor(){const b=new Browser(h);const {body}=await b.signInWithEmail(`${randomUUID()}@example.invalid`);const id=body.data.session.user.id as string;const r=await b.request('PATCH','/v1/me',{body:{displayName:'QA Round Two',bio:'Synthetic isolated QA profile for concurrent safety checks.',languages:['en'],lifeStatus:'NEW_TO_LONDON',interests:['FOOD'],ageConfirmedVersion:'2026-10-21',communityAcceptedVersion:'2026-10-21'},headers:headers('1')});expect(r.statusCode,r.body).toBe(200);return{b,id};}
async function meal(b:Browser,capacity=4,extra:Record<string,unknown>={},expectedStatus=201){const venue=await b.request('POST','/v1/venues/confirm',{body:{placeId:'fixture_fancy_north'},headers:headers()});expect(venue.statusCode,venue.body).toBe(200);const r=await b.request('POST','/v1/meals',{body:{venueRef:json(venue).data.venueRef,title:'QA concurrency isolated table',description:'Synthetic table with no external restaurant or customer activity.',start:{localDate:'2030-10-23',localTime:'18:00',timeZone:'Europe/London',utcOffsetMinutes:60},close:{localDate:'2030-10-23',localTime:'17:00',timeZone:'Europe/London',utcOffsetMinutes:60},minimum:2,capacity,budgetMinPence:2000,budgetMaxPence:3500,languages:['en'],mood:'EASY_CONVERSATION',bookingMode:'EXTERNAL_PAY_AT_VENUE',attemptId:randomUUID(),bookingDeclarationConfirmed:true,reviewConfirmed:true,termsVersion:'2026-10-21',...extra},headers:headers()});expect(r.statusCode,r.body).toBe(expectedStatus);return expectedStatus===201?json(r).data:json(r).error;}


async function table(host:Awaited<ReturnType<typeof actor>>,guest:Awaited<ReturnType<typeof actor>>){const m=await meal(host.b);const a=await guest.b.request('POST',`/v1/meals/${m.id}/applications`,{headers:headers(),body:{message:'Synthetic explicit application for authorization QA.'}});expect(a.statusCode,a.body).toBe(201);const decision=await host.b.request('POST',`/v1/applications/${json(a).data.id}/decision`,{headers:headers('1'),body:{decision:'APPROVE'}});expect(decision.statusCode,decision.body).toBe(200);return{m,group:(await h.db.pool.query('SELECT id FROM conversations WHERE meal_id=$1',[m.id])).rows[0].id as string};}
async function version(table:string,id:string){return String((await h.db.pool.query(`SELECT version FROM ${table} WHERE id=$1`,[id])).rows[0].version);}
async function boot(b:Browser){const r=await b.request('POST','/v1/ai/sessions',{headers:headers(),body:{deviceChallenge:randomBytes(32).toString('base64url')}});expect(r.statusCode,r.body).toBe(201);return json(r).data;}
async function draft(b:Browser,s:Record<string,string|number>,group:string){const id=randomUUID(),head={...headers(undefined,id),'ai-device-token':String(s.deviceToken)};
 const r=await b.request('POST',`/v1/ai/sessions/${s.sessionId}/requests`,{headers:head,body:{requestId:id,generation:s.generation,input:'Draft a short coordination message for this group',sourcePage:'INBOX',explicitConversationId:group,editorVersion:'0',queryVersion:'0',preferenceVersion:'0',contextVersion:'0'}});expect(r.statusCode,r.body).toBe(202);
 const end=Date.now()+5000;for(;;){const p=await b.request('GET',`/v1/ai/requests/${id}?sessionId=${s.sessionId}&generation=${s.generation}`,{headers:head});expect(p.statusCode,p.body).toBe(200);if(json(p).data.state!=='PENDING')return json(p).data;if(Date.now()>end)throw Error('controlled draft did not finish');await new Promise<void>(r=>setImmediate(r));}
}
const transfer=(b:Browser,s:Record<string,string|number>,d:{id:string;targetId:string})=>b.request('POST',`/v1/ai/drafts/${d.id}/transfer`,{headers:{...headers(),'ai-device-token':String(s.deviceToken)},body:{sessionId:s.sessionId,generation:s.generation,editorKind:'GROUP',targetId:d.targetId,editorVersion:'0',replaceConfirmed:false}});
const send=(b:Browser,group:string,body:string)=>b.request('POST',`/v1/conversations/${group}/messages`,{body:{body,clientMessageId:randomUUID()}});
async function messageCount(group:string){return Number((await h.db.pool.query('SELECT count(*) n FROM messages WHERE conversation_id=$1',[group])).rows[0].n);}
it('QA-AI-017 generation transfer and Send each recheck permission without reading group bodies or writing during AI stages',async()=>{
 const host=await actor(),guest=await actor(),one=await table(host,guest),secret='PRIVATE_GROUP_SENTINEL_'+randomUUID();expect((await send(host.b,one.group,secret)).statusCode).toBe(201);
 const s=await boot(guest.b),before=await messageCount(one.group),generated=await draft(guest.b,s,one.group);expect(generated.state).toBe('SUCCEEDED');expect(await messageCount(one.group)).toBe(before);expect(captured.join('')).not.toContain(secret);
 const left=await guest.b.request('POST',`/v1/conversations/${one.group}/leave`,{headers:headers(await version('conversations',one.group)),body:{confirm:true}});expect(left.statusCode,left.body).toBe(200);
 const forbidden=await transfer(guest.b,s,generated.result.draft);expect(forbidden.statusCode,forbidden.body).toBe(409);expect(json(forbidden).error.code).toBe('TARGET_CHANGED');expect(await messageCount(one.group)).toBe(before);
 const cannotGenerate=await draft(guest.b,s,one.group);expect(cannotGenerate.state).toBe('SUPERSEDED');expect(cannotGenerate.result).toBeNull();
 const two=await table(host,guest),ready=await draft(guest.b,s,two.group);expect(ready.state).toBe('SUCCEEDED');const accepted=await transfer(guest.b,s,ready.result.draft);expect(accepted.statusCode,accepted.body).toBe(200);expect(await messageCount(two.group)).toBe(0);
 const dissolved=await host.b.request('POST',`/v1/conversations/${two.group}/dissolve`,{headers:headers(await version('conversations',two.group)),body:{confirm:true}});expect(dissolved.statusCode,dissolved.body).toBe(200);
 await h.db.pool.query("DELETE FROM api_rate_limits WHERE actor_id=$1 AND bucket='write-burst'",[guest.id]);
 expect((await send(guest.b,two.group,json(accepted).data.text)).statusCode).toBe(403);expect(await messageCount(two.group)).toBe(0);expect(captured.join('')).not.toContain(secret);
});
it('QA-AI-018 cancelled meal retains member ability to draft transfer and explicitly send while outsiders remain denied',async()=>{
 const host=await actor(),guest=await actor(),outsider=await actor(),f=await table(host,guest);
 const cancelled=await host.b.request('POST',`/v1/meals/${f.m.id}/cancel`,{headers:headers(await version('meals',f.m.id)),body:{reason:'host'}});expect(cancelled.statusCode,cancelled.body).toBe(200);
 const s=await boot(guest.b),r=await draft(guest.b,s,f.group);expect(r.state).toBe('SUCCEEDED');expect(await messageCount(f.group)).toBe(0);
 const moved=await transfer(guest.b,s,r.result.draft);expect(moved.statusCode,moved.body).toBe(200);expect(await messageCount(f.group)).toBe(0);
 expect((await send(guest.b,f.group,json(moved).data.text)).statusCode).toBe(201);expect(await messageCount(f.group)).toBe(1);expect((await send(outsider.b,f.group,'Unauthorized stranger message')).statusCode).toBe(404);expect(await messageCount(f.group)).toBe(1);
 expect((await h.db.pool.query('SELECT dissolved_at FROM conversations WHERE id=$1',[f.group])).rows[0].dissolved_at).toBeNull();
});
