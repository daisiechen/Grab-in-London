import type { Pool, PoolClient } from 'pg';
import { AssistantError } from '../../../../packages/assistant/src/errors.ts';
import { transaction } from './transaction.ts';

export const MONTHLY_HARD_CAP_MICRO_CNY = 50_000_000n;
export interface CallReservation { callId: string; subject: string; requestId: string; priceVersion: string; maxMicroCny: bigint }
type CallRow = { call_id: string; subject: string; request_id: string; price_version: string; max_micro_cny: string; actual_micro_cny: string | null; state: string; day_period: string; month_period: string; version: string };
const periods = (row: CallRow) => [row.day_period, row.month_period].sort();
const money = (amount: bigint) => { if (amount < 0n || amount > 9_000_000_000_000_000n) throw new AssistantError('AI_CONFLICT'); };

/** Durable per-call ledger; no transaction spans a provider request. UNKNOWN never releases money. */
export class BudgetLedger {
  private readonly pool: Pool;
  constructor(pool: Pool) { this.pool = pool; }
  async configure(period: string, capMicroCny: bigint, callCap: number, enabled = false) {
    if (!/^[DM]:\d{4}-\d{2}(-\d{2})?$/.test(period) || capMicroCny <= 0n || capMicroCny > MONTHLY_HARD_CAP_MICRO_CNY || !Number.isSafeInteger(callCap) || callCap < 1) throw new AssistantError('AI_CONFLICT');
    await this.pool.query(`INSERT INTO ai_budget(period,cap_micro_cny,call_cap,enabled) VALUES($1,$2,$3,$4)
      ON CONFLICT(period) DO UPDATE SET cap_micro_cny=EXCLUDED.cap_micro_cny,call_cap=EXCLUDED.call_cap,enabled=EXCLUDED.enabled,version=ai_budget.version+1`, [period, capMicroCny.toString(), callCap, enabled]);
  }
  async reserve(input: CallReservation): Promise<{ admitted: boolean; state: string }> {
    money(input.maxMicroCny);
    if (input.maxMicroCny === 0n || !input.priceVersion || input.priceVersion.length > 100) throw new AssistantError('AI_CONFLICT');
    return transaction(this.pool, async (c) => {
      const { rows: [request] } = await c.query(`SELECT state,deadline>clock_timestamp() valid FROM ai_requests WHERE subject=$1 AND request_id=$2 FOR UPDATE`, [input.subject,input.requestId]);
      if (!request || request.state !== 'PENDING' || !request.valid) throw new AssistantError('AI_SUPERSEDED');
      const { rows: [clock] } = await c.query(`SELECT 'D:'||to_char(clock_timestamp() AT TIME ZONE 'Europe/London','YYYY-MM-DD') AS day_period,'M:'||to_char(clock_timestamp() AT TIME ZONE 'Europe/London','YYYY-MM') AS month_period`);
      const configured = await c.query(`SELECT period FROM ai_budget WHERE period=ANY($1::text[])`, [[clock.day_period, clock.month_period]]);
      if (configured.rows.length !== 2) throw new AssistantError('AI_BUDGET_EXCEEDED');
      const inserted = await c.query(`INSERT INTO ai_calls(call_id,subject,request_id,day_period,month_period,price_version,max_micro_cny,state)
        VALUES($1,$2,$3,$4,$5,$6,$7,'RESERVED') ON CONFLICT DO NOTHING RETURNING call_id`, [input.callId, input.subject, input.requestId, clock.day_period, clock.month_period, input.priceVersion, input.maxMicroCny.toString()]);
      const call = await this.lockCall(c, input.callId);
      if (call.subject !== input.subject || call.request_id !== input.requestId || call.price_version !== input.priceVersion || BigInt(call.max_micro_cny) !== input.maxMicroCny) throw new AssistantError('AI_CONFLICT');
      if (!inserted.rows.length) return { admitted: false, state: call.state };
      const { rows: [count] } = await c.query(`SELECT count(*)::int n FROM ai_calls WHERE subject=$1 AND request_id=$2`,[input.subject,input.requestId]);
      if(count.n>2)throw new AssistantError('AI_CONFLICT');
      const budget = await this.lockPeriods(c, call);
      if (budget.length !== 2 || budget.some((b) => !b.enabled || BigInt(b.used_micro_cny) + BigInt(b.reserved_micro_cny) + input.maxMicroCny > BigInt(b.cap_micro_cny) || b.calls + 1 > b.call_cap)) throw new AssistantError('AI_BUDGET_EXCEEDED');
      await c.query(`UPDATE ai_budget SET reserved_micro_cny=reserved_micro_cny+$2,calls=calls+1,version=version+1 WHERE period=ANY($1::text[])`, [periods(call), input.maxMicroCny.toString()]);
      return { admitted: true, state: 'RESERVED' };
    });
  }
  /** Only the caller winning this CAS may issue network I/O. Never retry after dispatch. */
  async dispatch(callId: string): Promise<boolean> {
    return transaction(this.pool,async c=>{
      const call=await this.lockCall(c,callId);
      if(call.state!=='RESERVED')return false;
      const budgets=await this.lockPeriods(c,call);
      if(budgets.length!==2||budgets.some(b=>!b.enabled)){
        await c.query(`UPDATE ai_budget SET reserved_micro_cny=reserved_micro_cny-$2,version=version+1 WHERE period=ANY($1::text[])`,[periods(call),call.max_micro_cny]);
        await c.query(`UPDATE ai_calls SET state='CANCELLED',actual_micro_cny=0,version=version+1 WHERE call_id=$1`,[callId]);
        return false;
      }
      await c.query(`UPDATE ai_calls SET state='IN_FLIGHT',version=version+1 WHERE call_id=$1`,[callId]);
      return true;
    });
  }
  async cancelBeforeDispatch(callId: string): Promise<boolean> {
    return transaction(this.pool, async (c) => {
      const call = await this.lockCall(c, callId);
      if (call.state !== 'RESERVED') return false;
      await this.lockPeriods(c, call);
      await c.query(`UPDATE ai_budget SET reserved_micro_cny=reserved_micro_cny-$2,version=version+1 WHERE period=ANY($1::text[])`, [periods(call), call.max_micro_cny]);
      await c.query(`UPDATE ai_calls SET state='CANCELLED',version=version+1,actual_micro_cny=0 WHERE call_id=$1`, [callId]);
      return true;
    });
  }
  async unknown(callId: string) {
    await this.pool.query(`UPDATE ai_calls SET state='UNKNOWN',version=version+1 WHERE call_id=$1 AND state IN ('RESERVED','IN_FLIGHT')`, [callId]);
  }
  /** Startup: no persisted row can cause another provider send; conservative reservation survives. */
  async recoverAfterRestart() {
    await this.pool.query(`UPDATE ai_calls SET state='UNKNOWN',version=version+1 WHERE state IN ('RESERVED','IN_FLIGHT')`);
  }
  async settle(callId: string, actualMicroCny: bigint, usage: { inputTokens: number; outputTokens: number; providerRequestId: string }) {
    money(actualMicroCny);
    if (![usage.inputTokens, usage.outputTokens].every((x) => Number.isSafeInteger(x) && x >= 0) || !usage.providerRequestId || usage.providerRequestId.length > 200) throw new AssistantError('AI_CONFLICT');
    return transaction(this.pool, async (c) => {
      const call = await this.lockCall(c, callId);
      if (call.state === 'KNOWN') {
        if (BigInt(call.actual_micro_cny!) !== actualMicroCny) throw new AssistantError('AI_CONFLICT');
        return false;
      }
      if (call.state !== 'IN_FLIGHT') throw new AssistantError('AI_CONFLICT');
      await this.lockPeriods(c, call);
      await this.charge(c, call, actualMicroCny);
      await c.query(`UPDATE ai_calls SET state='KNOWN',actual_micro_cny=$2,input_tokens=$3,output_tokens=$4,provider_request_id=$5,version=version+1 WHERE call_id=$1`, [callId, actualMicroCny.toString(), usage.inputTokens, usage.outputTokens, usage.providerRequestId]);
      return true;
    });
  }
  /** Caller must provide server-verified dedicated role and MFA; no public route exposes this yet. */
  async reconcile(input: { callId: string; expectedVersion: string; key: string; actualMicroCny: bigint; providerReference: string; reason: string; actorId: string; roles: readonly string[]; mfa: boolean }) {
    if (!input.roles.includes('ai_budget_ops') || !input.mfa) throw new AssistantError('AI_CONFLICT');
    money(input.actualMicroCny);
    if (!input.providerReference.trim() || input.providerReference.length > 200 || !input.reason.trim() || input.reason.length > 300) throw new AssistantError('AI_CONFLICT');
    return transaction(this.pool, async (c) => {
      const call = await this.lockCall(c, input.callId);
      const { rows: [existing] } = await c.query(`SELECT call_id,actual_micro_cny::text,provider_reference,actor_id,reason FROM ai_budget_reconciliations WHERE idempotency_key=$1`, [input.key]);
      if (existing) {
        if (existing.call_id !== input.callId || BigInt(existing.actual_micro_cny) !== input.actualMicroCny || existing.provider_reference !== input.providerReference || existing.actor_id !== input.actorId || existing.reason !== input.reason) throw new AssistantError('AI_CONFLICT');
        return false;
      }
      if (call.state !== 'UNKNOWN' || call.version !== input.expectedVersion) throw new AssistantError('AI_CONFLICT');
      await this.lockPeriods(c, call);
      await this.charge(c, call, input.actualMicroCny);
      await c.query(`INSERT INTO ai_budget_reconciliations(idempotency_key,call_id,actual_micro_cny,provider_reference,actor_id,reason) VALUES($1,$2,$3,$4,$5,$6)`, [input.key, input.callId, input.actualMicroCny.toString(), input.providerReference, input.actorId, input.reason]);
      await c.query(`UPDATE ai_calls SET state='RECONCILED',actual_micro_cny=$2,version=version+1 WHERE call_id=$1`, [input.callId, input.actualMicroCny.toString()]);
      return true;
    });
  }
  private async lockCall(c: PoolClient, id: string): Promise<CallRow> {
    const { rows: [row] } = await c.query<CallRow>(`SELECT *,version::text FROM ai_calls WHERE call_id=$1 FOR UPDATE`, [id]);
    if (!row) throw new AssistantError('AI_CONFLICT');
    return row;
  }
  private async lockPeriods(c: PoolClient, call: CallRow) {
    // Balance writers still serialize; period keys stay unchanged, so FK KEY SHARE locks need not upgrade.
    const { rows } = await c.query<{ enabled: boolean; used_micro_cny: string; reserved_micro_cny: string; cap_micro_cny: string; calls: number; call_cap: number }>(`SELECT * FROM ai_budget WHERE period=ANY($1::text[]) ORDER BY period FOR NO KEY UPDATE`, [periods(call)]);
    return rows;
  }
  private async charge(c: PoolClient, call: CallRow, actual: bigint) {
    // If pricing assumptions were wrong, record the actual liability and disable further calls;
    // never conceal an overrun by clamping actual usage to a previously reserved upper bound.
    await c.query(`UPDATE ai_budget SET reserved_micro_cny=reserved_micro_cny-$2,used_micro_cny=used_micro_cny+$3,
      enabled=enabled AND $3::bigint <= $2::bigint AND used_micro_cny+$3+reserved_micro_cny-$2<=cap_micro_cny,version=version+1 WHERE period=ANY($1::text[])`, [periods(call), call.max_micro_cny, actual.toString()]);
  }
}
