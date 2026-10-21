import type { PoolClient } from 'pg';
import { emptyPreferences, tokenHash, type AssistantRuntime } from '../../../../packages/assistant/src/index.ts';

export type InvalidationReason='LOGOUT'|'ACCOUNT_CHANGE'|'PREFERENCES_CHANGED'|'PREFERENCES_DELETED'|'ACCOUNT_DELETED';

/**
 * Caller holds the core user's UPDATE barrier (or guest revocation lock), in the SAME transaction.
 * RAM failure aborts DB acceptance. No bodies/drafts survive; metadata changes are all atomic.
 * Conservative UNKNOWN liabilities are never released, including when late usage arrives.
 */
/**
 * Read/lock phase only, called after user UPDATE and before the final privacy lock/clock/auth check.
 * It must not clear RAM or write rows: a later authorization rejection may be committed by callers.
 */
export async function prelockUserAI(c:PoolClient,userId:string):Promise<void>{
  const subject=`user:${userId}`;
  await c.query(`SELECT user_id FROM ai_preferences WHERE user_id=$1 FOR UPDATE`,[userId]);
  await c.query(`SELECT subject FROM ai_subjects WHERE subject=$1 FOR UPDATE`,[subject]);
  await c.query(`SELECT id FROM ai_session_meta WHERE subject=$1 ORDER BY id FOR UPDATE`,[subject]);
  await c.query(`SELECT request_id FROM ai_requests WHERE subject=$1 ORDER BY request_id FOR UPDATE`,[subject]);
  await c.query(`SELECT london_date FROM ai_quota WHERE subject=$1 ORDER BY london_date FOR UPDATE`,[subject]);
  const {rows:calls}=await c.query(`SELECT call_id,day_period,month_period FROM ai_calls WHERE subject=$1 ORDER BY call_id FOR UPDATE`,[subject]);
  const periods=[...new Set(calls.flatMap(row=>[row.day_period as string,row.month_period as string]))].sort();
  if(periods.length)await c.query(`SELECT period FROM ai_budget WHERE period=ANY($1::text[]) ORDER BY period FOR UPDATE`,[periods]);
}

export async function invalidateSubjectAI(c:PoolClient,runtime:AssistantRuntime,subject:string,reason:InvalidationReason){
  if(subject.startsWith('user:'))await prelockUserAI(c,subject.slice(5));
  runtime.invalidateSubject(subject);
  if(reason==='ACCOUNT_DELETED'&&subject.startsWith('user:')){
    await c.query(`UPDATE ai_preferences SET fields=$2,version=version+1,epoch=epoch+1,confirmed_at=NULL WHERE user_id=$1`,[subject.slice(5),JSON.stringify(emptyPreferences())]);
  }
  await c.query(`INSERT INTO ai_subjects(subject) VALUES($1) ON CONFLICT DO NOTHING`,[subject]);
  await c.query(`SELECT subject FROM ai_subjects WHERE subject=$1 FOR UPDATE`,[subject]);
  await c.query(`SELECT id FROM ai_session_meta WHERE subject=$1 ORDER BY id FOR UPDATE`,[subject]);
  await c.query(`UPDATE ai_session_meta SET status='INVALIDATED',generation=generation+1,active_request_id=NULL WHERE subject=$1 AND status='ACTIVE'`,[subject]);
  const {rows:requests}=await c.query(`SELECT request_id,quota_date FROM ai_requests WHERE subject=$1 AND state='PENDING' ORDER BY request_id FOR UPDATE`,[subject]);
  for(const request of requests){
    await c.query(`UPDATE ai_quota SET reserved_success_slots=reserved_success_slots-1 WHERE subject=$1 AND london_date=$2`,[subject,request.quota_date]);
    await c.query(`UPDATE ai_requests SET state='SUPERSEDED',error_code='SUPERSEDED',finished_at=clock_timestamp() WHERE subject=$1 AND request_id=$2`,[subject,request.request_id]);
  }
  await c.query(`UPDATE ai_subjects SET active_request_id=NULL WHERE subject=$1`,[subject]);
  const {rows:calls}=await c.query(`SELECT call_id,state,day_period,month_period,max_micro_cny FROM ai_calls WHERE subject=$1 AND state IN ('RESERVED','IN_FLIGHT') ORDER BY call_id FOR UPDATE`,[subject]);
  for(const call of calls){
    if(call.state==='RESERVED'){
      const periods=[call.day_period,call.month_period].sort();
      await c.query(`SELECT period FROM ai_budget WHERE period=ANY($1::text[]) ORDER BY period FOR UPDATE`,[periods]);
      await c.query(`UPDATE ai_budget SET reserved_micro_cny=reserved_micro_cny-$2,version=version+1 WHERE period=ANY($1::text[])`,[periods,call.max_micro_cny]);
      await c.query(`UPDATE ai_calls SET state='CANCELLED',actual_micro_cny=0,version=version+1 WHERE call_id=$1`,[call.call_id]);
    }else await c.query(`UPDATE ai_calls SET state='UNKNOWN',version=version+1 WHERE call_id=$1`,[call.call_id]);
  }
}
export const invalidateUserAI=(c:PoolClient,runtime:AssistantRuntime,userId:string,reason:InvalidationReason)=>invalidateSubjectAI(c,runtime,`user:${userId}`,reason);

/** Login conversion: a guest credential never migrates preferences or RAM into a user account. */
export async function revokeGuestAI(c:PoolClient,runtime:AssistantRuntime,token:string){
  if(!/^[A-Za-z0-9_-]{43}$/.test(token))return;
  const {rows:[guest]}=await c.query(`SELECT id FROM guest_sessions WHERE token_hash=$1 AND revoked_at IS NULL FOR UPDATE`,[tokenHash(token)]);
  if(!guest)return;
  await invalidateSubjectAI(c,runtime,`guest:${guest.id}`,'ACCOUNT_CHANGE');
  await c.query(`UPDATE guest_sessions SET revoked_at=clock_timestamp() WHERE id=$1`,[guest.id]);
}
