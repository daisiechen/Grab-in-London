import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { migrate } from '@fancy/db';
import { createMigratedDatabase, waitForLockWaiters, type MigratedDatabase } from '@fancy/testkit/db';
import { AssistantRuntime, ProviderError, emptyPreferences } from '../../../../packages/assistant/src/index.ts';
import { BudgetLedger } from './budget.ts';
import { PreferenceService } from './preferences.ts';
import { SessionService, createGuest, authenticateGuest } from './sessions.ts';
import { RequestService } from './requests.ts';
import { prelockUserAI,invalidateUserAI } from './invalidate.ts';
import { transaction } from './transaction.ts';
import { runBudgetedCall } from './provider-call.ts';
let db: MigratedDatabase;
let ledger: BudgetLedger;
let userId: string; let subject: string; let sessionId: string; let requestId: string;
let day: string; let month: string;
beforeAll(async () => { db = await createMigratedDatabase(inject('pgServerUrl'), migrate); ledger = new BudgetLedger(db.pool); });
afterAll(async () => { await db.drop(); });
beforeEach(async () => {
  await db.pool.query('TRUNCATE ai_budget_reconciliations,ai_calls,ai_requests,ai_quota,ai_subjects,ai_session_meta,ai_preferences,ai_budget');
  userId = randomUUID(); subject = `user:${userId}`; sessionId = randomUUID(); requestId = randomUUID();
  await db.pool.query('INSERT INTO users(id) VALUES($1)', [userId]);
  await db.pool.query(`INSERT INTO ai_session_meta(id,subject,device_hash,revoke_hash,preference_epoch,last_activity_at,expires_at,status) VALUES($1,$2,'hash','hash',0,clock_timestamp(),clock_timestamp()+interval '30 minutes','ACTIVE')`, [sessionId,subject]);
  await db.pool.query(`INSERT INTO ai_requests(subject,request_id,session_id,generation,payload_hmac,state,deadline,quota_date) VALUES($1,$2,$3,1,'hmac','PENDING',clock_timestamp()+interval '30 seconds',current_date)`, [subject,requestId,sessionId]);
  const { rows: [clock] } = await db.pool.query(`SELECT 'D:'||to_char(clock_timestamp() AT TIME ZONE 'Europe/London','YYYY-MM-DD') AS day_period,'M:'||to_char(clock_timestamp() AT TIME ZONE 'Europe/London','YYYY-MM') AS month_period`);
  day=clock.day_period; month=clock.month_period;
});
const reservation = (callId = randomUUID(), maxMicroCny=70n) => ({ callId, subject, requestId, priceVersion: 'synthetic-CNY-price-for-tests', maxMicroCny });
const configure = async (cap=100n) => { await ledger.configure(day,cap,100,true); await ledger.configure(month,cap,100,true); };
const totals = async () => (await db.pool.query(`SELECT used_micro_cny::text used,reserved_micro_cny::text reserved,enabled,calls FROM ai_budget WHERE period=$1`,[month])).rows[0];

describe('concurrent CNY budget admission', () => {
  it('cancels an undispatched reservation when an operator disables either budget period', async () => {
    await configure();const r=reservation();await ledger.reserve(r);
    await db.pool.query('UPDATE ai_budget SET enabled=false WHERE period=$1',[day]);
    expect(await ledger.dispatch(r.callId)).toBe(false);
    expect(await totals()).toMatchObject({used:'0',reserved:'0'});
    expect((await db.pool.query('SELECT state FROM ai_calls WHERE call_id=$1',[r.callId])).rows[0].state).toBe('CANCELLED');
  });
  it('admits only one request competing for the final global budget, counting both periods', async () => {
    await configure();
    const results=await Promise.allSettled([ledger.reserve(reservation()),ledger.reserve(reservation())]);
    expect(results.filter(x=>x.status==='fulfilled')).toHaveLength(1);
    expect(results.filter(x=>x.status==='rejected')).toHaveLength(1);
    expect(await totals()).toMatchObject({ used:'0',reserved:'70',calls:1 });
  });
  it('same callId is admitted exactly once across concurrent API callers and dispatch CAS', async () => {
    await configure(); const r=reservation();
    const results=await Promise.all([ledger.reserve(r),ledger.reserve(r)]);
    expect(results.map(x=>x.admitted).sort()).toEqual([false,true]);
    expect(await Promise.all([ledger.dispatch(r.callId),ledger.dispatch(r.callId)])).toContain(false);
    expect(await totals()).toMatchObject({reserved:'70',calls:1});
  });
  it('requires explicit daily/monthly approvals and never permits above CNY50 cap', async () => {
    await expect(ledger.reserve(reservation())).rejects.toThrow('AI_BUDGET_EXCEEDED');
    await expect(ledger.configure(month,50_000_001n,100,true)).rejects.toThrow('AI_CONFLICT');
    await ledger.configure(month,50_000_000n,100,true);
    await ledger.configure(day,50_000_000n,100,false);
    await expect(ledger.reserve(reservation())).rejects.toThrow('AI_BUDGET_EXCEEDED');
  });
  it('settles actual usage once, releases the difference, and fences cancellation after dispatch', async () => {
    await configure(); const r=reservation(); await ledger.reserve(r); await ledger.dispatch(r.callId);
    expect(await ledger.cancelBeforeDispatch(r.callId)).toBe(false);
    const usage={inputTokens:10,outputTokens:2,providerRequestId:'test-provider-reference'};
    expect(await ledger.settle(r.callId,30n,usage)).toBe(true);
    expect(await ledger.settle(r.callId,30n,usage)).toBe(false);
    await expect(ledger.settle(r.callId,20n,usage)).rejects.toThrow('AI_CONFLICT');
    expect(await totals()).toMatchObject({used:'30',reserved:'0'});
  });
  it('cancels only undispatched reservations and releases them once', async () => {
    await configure(); const r=reservation(); await ledger.reserve(r);
    expect(await ledger.cancelBeforeDispatch(r.callId)).toBe(true);
    expect(await ledger.cancelBeforeDispatch(r.callId)).toBe(false);
    expect(await ledger.dispatch(r.callId)).toBe(false);
    expect(await totals()).toMatchObject({used:'0',reserved:'0'});
  });
  it('restart preserves maximum UNKNOWN liability and refuses resend or automatic zero settlement', async () => {
    await configure(); const r=reservation(); await ledger.reserve(r); await ledger.dispatch(r.callId);
    const restarted=new BudgetLedger(db.pool); await restarted.recoverAfterRestart();
    expect(await restarted.reserve(r)).toEqual({admitted:false,state:'UNKNOWN'});
    expect(await restarted.dispatch(r.callId)).toBe(false);
    await expect(restarted.settle(r.callId,0n,{inputTokens:0,outputTokens:0,providerRequestId:'guess'})).rejects.toThrow('AI_CONFLICT');
    await expect(restarted.reserve(reservation())).rejects.toThrow('AI_BUDGET_EXCEEDED');
    expect(await totals()).toMatchObject({used:'0',reserved:'70'});
  });
  it('dedicated MFA reconciliation uses CAS and an idempotency key; ordinary support cannot release funds', async () => {
    await configure(); const r=reservation(); await ledger.reserve(r); await ledger.dispatch(r.callId); await ledger.unknown(r.callId);
    const {rows:[call]}=await db.pool.query(`SELECT version::text FROM ai_calls WHERE call_id=$1`,[r.callId]);
    const input={callId:r.callId,expectedVersion:call.version,key:randomUUID(),actualMicroCny:20n,providerReference:'bill-sha256-synthetic',reason:'Matched synthetic provider statement',actorId:userId,roles:['support'],mfa:true};
    await expect(ledger.reconcile(input)).rejects.toThrow('AI_CONFLICT');
    expect(await ledger.reconcile({...input,roles:['ai_budget_ops']})).toBe(true);
    expect(await ledger.reconcile({...input,roles:['ai_budget_ops']})).toBe(false);
    expect(await totals()).toMatchObject({used:'20',reserved:'0'});
  });
  it('records unexpected actual overrun and disables further calls rather than concealing cost',async()=>{
    await configure(); const r=reservation(); await ledger.reserve(r); await ledger.dispatch(r.callId);
    await ledger.settle(r.callId,120n,{inputTokens:100,outputTokens:100,providerRequestId:'synthetic-overrun'});
    expect(await totals()).toMatchObject({used:'120',reserved:'0',enabled:false});
  });
});
describe('budgeted provider dispatch',()=>{
  it('calls once after durable admission, settles known usage, and retains timeout uncertainty',async()=>{
    await configure();let sent=0;
    const price={version:'synthetic-verified-CNY',inputMicroCnyPerMillion:1_000_000n,outputMicroCnyPerMillion:1_000_000n,verified:true,validUntil:Date.now()+60_000};
    const req={schema:{},input:'Synthetic input',deadline:Date.now()+10_000,maxOutputTokens:10,callId:randomUUID()};
    const deps={ledger,price,countInputTokens:()=>20,provider:{generate:async()=>{sent++;return {parsed:{text:'synthetic'},usage:{inputTokens:10,outputTokens:2},providerRequestId:'synthetic-bill-ref'};}}};
    await runBudgetedCall(deps,subject,requestId,req);
    await expect(runBudgetedCall(deps,subject,requestId,req)).rejects.toThrow('AI_CONFLICT');expect(sent).toBe(1);
    expect(await totals()).toMatchObject({used:'12',reserved:'0'});
    await expect(runBudgetedCall({...deps,provider:{generate:async()=>{sent++;throw new ProviderError('PROVIDER_TIMEOUT');}}},subject,requestId,{...req,callId:randomUUID()})).rejects.toThrow('PROVIDER_TIMEOUT');
    expect(sent).toBe(2);expect(await totals()).toMatchObject({used:'12',reserved:'30'});
    await expect(runBudgetedCall(deps,subject,requestId,{...req,callId:randomUUID()})).rejects.toThrow('AI_CONFLICT');
    expect(sent).toBe(2);
  });
});
describe('confirmed preference CAS and invalidation',()=>{
  it('prelock is read-only: rejected authorization may commit without erasing RAM or metadata',async()=>{
    const runtime=new AssistantRuntime();const s=runtime.create(subject,'0');const b={subject,deviceToken:s.deviceToken,generation:1,preferenceEpoch:'0'};
    runtime.append(s.id,b,'Synthetic pending text');
    await transaction(db.pool,async c=>{await c.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[userId]);await prelockUserAI(c,userId);});
    expect(runtime.read(s.id,b).text).toEqual(['Synthetic pending text']);
    expect((await db.pool.query('SELECT status FROM ai_session_meta WHERE id=$1',[sessionId])).rows[0].status).toBe('ACTIVE');
    expect((await db.pool.query('SELECT state FROM ai_requests WHERE request_id=$1',[requestId])).rows[0].state).toBe('PENDING');
  });

  it('only one concurrent replacement wins; deletion increments a tombstone and aborts RAM',async()=>{
    const runtime=new AssistantRuntime(); const s=runtime.create(subject,'0');
    const signal=runtime.begin(s.id,{subject,deviceToken:s.deviceToken,generation:1,preferenceEpoch:'0'});
    const prefs=new PreferenceService(db.pool,runtime,['soho']);
    const results=await Promise.allSettled([
      prefs.replace(userId,'0',{...emptyPreferences(),budgetMaxPence:3500},true),
      prefs.replace(userId,'0',{...emptyPreferences(),budgetMaxPence:4500},true),
    ]);
    expect(results.filter(x=>x.status==='fulfilled')).toHaveLength(1);
    expect(signal.aborted).toBe(true);
    expect(await prefs.remove(userId,'1')).toMatchObject({fields:emptyPreferences(),version:'2',epoch:'2',confirmed_at:null});
    expect((await db.pool.query(`SELECT status FROM ai_session_meta WHERE subject=$1`,[subject])).rows[0].status).toBe('INVALIDATED');
  });
  it('rejects unconfirmed or unknown fields without saving',async()=>{
    const prefs=new PreferenceService(db.pool,new AssistantRuntime(),['soho']);
    await expect(prefs.replace(userId,'0',emptyPreferences(),false)).rejects.toThrow('AI_INVALID_PREFERENCES');
    await expect(prefs.replace(userId,'0',{...emptyPreferences(),input:'private'},true)).rejects.toThrow('AI_INVALID_PREFERENCES');
    expect(await prefs.read(userId)).toMatchObject({version:'0',epoch:'0'});
  });
});


describe('persistent request dedup and lifecycle',()=>{
  const make=async()=>{
    // The request seeded for isolated ledger tests has no quota reservation; lifecycle tests
    // start from the service's real acceptance path instead of that accounting-only fixture.
    await db.pool.query('DELETE FROM ai_requests WHERE request_id=$1',[requestId]);
    const runtime=new AssistantRuntime(); const sessions=new SessionService(db.pool,runtime);
    const s=await sessions.create(subject); const binding={subject,deviceToken:s.deviceToken,generation:1,preferenceEpoch:'0'};
    return {runtime,sessions,s,binding,requests:new RequestService(db.pool,sessions,'synthetic-test-hmac-key-at-least-32-bytes')};
  };
  it.each(['SUCCEEDED','NEEDS_INPUT'] as const)('fences %s publication after settled usage when the budget is stopped',async(state)=>{
    await configure();const h=await make();const id=randomUUID();await h.requests.accept(h.s.id,h.binding,id,{});
    const r={...reservation(),requestId:id};await ledger.reserve(r);await ledger.dispatch(r.callId);
    await ledger.settle(r.callId,20n,{inputTokens:10,outputTokens:10,providerRequestId:'synthetic-stopped-call'});
    await db.pool.query('UPDATE ai_budget SET enabled=false WHERE period=$1',[month]);
    let published=false;
    await h.requests.finish(subject,id,state,null,async()=>{published=true;});
    expect(published).toBe(false);
    expect((await db.pool.query('SELECT state,error_code FROM ai_requests WHERE request_id=$1',[id])).rows[0]).toEqual({state:'FAILED',error_code:'UNAVAILABLE'});
    expect((await db.pool.query('SELECT successes,reserved_success_slots FROM ai_quota WHERE subject=$1',[subject])).rows[0]).toMatchObject({successes:0,reserved_success_slots:0});
    expect(await totals()).toMatchObject({used:'20',reserved:'0',enabled:false});
    expect((await db.pool.query('SELECT state FROM ai_calls WHERE call_id=$1',[r.callId])).rows[0].state).toBe('KNOWN');
  });
  it('waits for a concurrent operator stop to commit before deciding publication',async()=>{
    await configure();const h=await make();const id=randomUUID();await h.requests.accept(h.s.id,h.binding,id,{});
    const r={...reservation(),requestId:id};await ledger.reserve(r);await ledger.dispatch(r.callId);
    await ledger.settle(r.callId,20n,{inputTokens:10,outputTokens:10,providerRequestId:'synthetic-concurrent-stop'});
    const operator=await db.connect();await operator.query('BEGIN');
    let published=false;let finishing:Promise<boolean>|undefined;
    try{
      await operator.query('UPDATE ai_budget SET enabled=false WHERE period=$1',[day]);
      finishing=h.requests.finish(subject,id,'SUCCEEDED',null,async()=>{published=true;});
      await waitForLockWaiters(db.pool,1);
      await operator.query('COMMIT');await finishing;
    }finally{await operator.query('ROLLBACK');await finishing;}
    expect(published).toBe(false);
    expect((await db.pool.query('SELECT state FROM ai_requests WHERE request_id=$1',[id])).rows[0].state).toBe('FAILED');
    expect(await totals()).toMatchObject({used:'20',reserved:'0'});
  });
  it('core deletion barrier clears RAM, refunds undispatched cost and keeps in-flight UNKNOWN liability',async()=>{
    await configure();const h=await make();const id=randomUUID();await h.requests.accept(h.s.id,h.binding,id,{});
    const first={...reservation(),requestId:id,maxMicroCny:30n};const second={...reservation(),requestId:id,maxMicroCny:40n};
    await ledger.reserve(first);await ledger.reserve(second);await ledger.dispatch(second.callId);
    const signal=h.runtime.begin(h.s.id,h.binding);h.runtime.append(h.s.id,h.binding,'private content');
    await transaction(db.pool,async c=>{
      await c.query(`SELECT id FROM users WHERE id=$1 FOR UPDATE`,[userId]);
      await invalidateUserAI(c,h.runtime,userId,'ACCOUNT_DELETED');
      await c.query(`UPDATE users SET status='DELETING' WHERE id=$1`,[userId]);
    });
    expect(signal.aborted).toBe(true);
    expect(()=>h.runtime.read(h.s.id,h.binding)).toThrow('AI_SESSION_EXPIRED');
    expect(await totals()).toMatchObject({used:'0',reserved:'40'});
    expect((await db.pool.query(`SELECT state FROM ai_calls ORDER BY max_micro_cny`)).rows.map(r=>r.state)).toEqual(['CANCELLED','UNKNOWN']);
    expect(await ledger.dispatch(first.callId)).toBe(false);
    const {rows:[q]}=await db.pool.query(`SELECT successes,reserved_success_slots FROM ai_quota WHERE subject=$1`,[subject]);expect(q).toMatchObject({successes:0,reserved_success_slots:0});
  });
  it('admits one same-id request across concurrent callers, stores only HMAC and rejects changed payload',async()=>{
    const h=await make(); const id=randomUUID();
    const results=await Promise.all([h.requests.accept(h.s.id,h.binding,id,{input:'private user phrase'}),h.requests.accept(h.s.id,h.binding,id,{input:'private user phrase'})]);
    expect(results.map(x=>x.admitted).sort()).toEqual([false,true]);
    await expect(h.requests.accept(h.s.id,h.binding,id,{input:'changed'})).rejects.toThrow('AI_CONFLICT');
    const {rows:[row]}=await db.pool.query(`SELECT row_to_json(ai_requests)::text serialized FROM ai_requests WHERE request_id=$1`,[id]);
    expect(row.serialized).not.toContain('private user phrase');
    expect(row.serialized).toContain('payload_hmac');
  });
  it('reserves the final user successful turn once and counts success only on validated publish',async()=>{
    const h=await make();
    await db.pool.query(`INSERT INTO ai_quota(subject,london_date,minute_start,successes) VALUES($1,(clock_timestamp() AT TIME ZONE 'Europe/London')::date,clock_timestamp(),49)`,[subject]);
    const a=randomUUID();const b=randomUUID();
    const results=await Promise.allSettled([h.requests.accept(h.s.id,h.binding,a,{}),h.requests.accept(h.s.id,h.binding,b,{})]);
    expect(results.filter(x=>x.status==='fulfilled')).toHaveLength(1);
    const {rows:[pending]}=await db.pool.query(`SELECT active_request_id FROM ai_subjects WHERE subject=$1`,[subject]);
    let published=0;
    await h.requests.finish(subject,pending.active_request_id,'SUCCEEDED',null,async()=>{h.runtime.read(h.s.id,h.binding);published++;});
    expect(published).toBe(1);
    expect(await h.requests.finish(subject,pending.active_request_id,'SUCCEEDED')).toBe(false);
    await expect(h.requests.accept(h.s.id,h.binding,randomUUID(),{})).rejects.toThrow('AI_QUOTA_EXCEEDED');
    const {rows:[quota]}=await db.pool.query(`SELECT successes,reserved_success_slots FROM ai_quota WHERE subject=$1`,[subject]);
    expect(quota).toMatchObject({successes:50,reserved_success_slots:0});
  });
  it('preference deletion invalidates an in-flight result and refunds only its success slot',async()=>{
    const h=await make();const id=randomUUID();await h.requests.accept(h.s.id,h.binding,id,{});
    await new PreferenceService(db.pool,h.runtime,['soho']).remove(userId,'0');
    let published=false;await h.requests.finish(subject,id,'SUCCEEDED',null,async()=>{published=true;});
    expect(published).toBe(false);
    const {rows:[r]}=await db.pool.query(`SELECT state FROM ai_requests WHERE request_id=$1`,[id]);expect(r.state).toBe('SUPERSEDED');
    const {rows:[q]}=await db.pool.query(`SELECT successes,reserved_success_slots FROM ai_quota WHERE subject=$1`,[subject]);expect(q).toMatchObject({successes:0,reserved_success_slots:0});
  });
  it('timeout/restart release slots exactly once without replaying work',async()=>{
    const h=await make();const id=randomUUID();await h.requests.accept(h.s.id,h.binding,id,{});
    await db.pool.query(`UPDATE ai_requests SET deadline=clock_timestamp() WHERE request_id=$1`,[id]);
    await h.requests.expireDeadlines();await h.requests.expireDeadlines();
    const id2=randomUUID();await h.requests.accept(h.s.id,h.binding,id2,{});
    await h.requests.recoverAfterRestart();await h.requests.recoverAfterRestart();
    const {rows:[q]}=await db.pool.query(`SELECT successes,reserved_success_slots FROM ai_quota WHERE subject=$1`,[subject]);expect(q).toMatchObject({successes:0,reserved_success_slots:0});
  });
  it('guest identity survives AI NEW/bootstrap and has fixed nonrolling 24h expiry',async()=>{
    const guest=await createGuest(db.pool);const guestSubject=await authenticateGuest(db.pool,guest.token);
    const runtime=new AssistantRuntime();const sessions=new SessionService(db.pool,runtime);
    const first=await sessions.create(guestSubject);const second=await sessions.create(guestSubject,first.revokeHandle);
    expect(second.id).not.toBe(first.id);
    const {rows:[row]}=await db.pool.query(`SELECT expires_at,created_at FROM guest_sessions WHERE id=$1`,[guest.id]);
    expect(row.expires_at.getTime()-row.created_at.getTime()).toBe(24*60*60*1000);
    expect(await authenticateGuest(db.pool,guest.token)).toBe(guestSubject);
    await db.pool.query(`UPDATE guest_sessions SET revoked_at=clock_timestamp() WHERE id=$1`,[guest.id]);
    await expect(authenticateGuest(db.pool,guest.token)).rejects.toThrow('AI_SESSION_EXPIRED');
  });
});
