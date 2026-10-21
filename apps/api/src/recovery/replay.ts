import {createHash,randomBytes,randomUUID} from 'node:crypto';
import type {Pool} from 'pg';
import type {AppDeps} from '../http/context.ts';
import {withTransaction} from '../common/transaction.ts';
import {applyDeletion,restoreInstantMicros} from '../deletion/routes.ts';
export interface DeletionLedger {version:1;entries:Array<{userId:string;deletionId:string;acceptedAt:string;receiptTokenHash:string;expiresAt:string|null;policyVersion:string}>}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Input comes from an independently preserved deletion ledger, never the restored backup alone. */
export function ledgerDigest(ledger:DeletionLedger):string {
 if(ledger.version!==1||!Array.isArray(ledger.entries)||ledger.entries.length>100000||ledger.entries.some(e=>!e||!uuid.test(e.userId)||!uuid.test(e.deletionId)||!/^[0-9a-f]{64}$/.test(e.receiptTokenHash)||typeof e.policyVersion!=='string'||e.policyVersion.length>128))throw new Error('INVALID_DELETION_LEDGER');
 for(const e of ledger.entries){const accepted=restoreInstantMicros(e.acceptedAt);if(e.expiresAt!==null&&restoreInstantMicros(e.expiresAt)<=accepted)throw new Error('INVALID_DELETION_LEDGER');}
 if(new Set(ledger.entries.map(e=>e.userId)).size!==ledger.entries.length)throw new Error('DUPLICATE_DELETION_SUBJECT');
 return createHash('sha256').update(JSON.stringify(ledger)).digest('hex');
}
export async function recoveryReady(pool:Pool){const{rows:[r]}=await pool.query(`SELECT state FROM recovery_control WHERE id=1`);return r?.state==='READY';}
/** Stop ingress and workers BEFORE restoring, then arm this gate before either process restarts. */
export async function requireRecovery(pool:Pool,ledger:DeletionLedger){const digest=ledgerDigest(ledger);await pool.query(`UPDATE recovery_control SET state='REPLAY_REQUIRED',ledger_digest=$1,replayed_count=0,updated_at=clock_timestamp() WHERE id=1`,[digest]);return digest;}
/** Offline-only operator boundary. Uses the same deletion transition as the authenticated API. */
export async function replayDeletionLedger(deps:AppDeps,ledger:DeletionLedger){
 const digest=ledgerDigest(ledger);
 const{rows:[gate]}=await deps.pool.query(`SELECT state,ledger_digest FROM recovery_control WHERE id=1`);
 if(gate?.state!=='REPLAY_REQUIRED'||gate.ledger_digest!==digest)throw new Error('RECOVERY_LEDGER_MISMATCH');
 // Validate the entire trusted manifest before replaying any entry. Preserve timestamp text
 // in SQL rather than truncating microseconds through JS Date, including for absent subjects.
 const {rows:[times]}=await deps.pool.query(`SELECT NOT EXISTS(SELECT 1 FROM jsonb_to_recordset($1::jsonb) AS e("userId" uuid,"acceptedAt" timestamptz) LEFT JOIN users u ON u.id=e."userId" WHERE e."acceptedAt">clock_timestamp() OR e."acceptedAt"<u.created_at) AS valid`,[JSON.stringify(ledger.entries.map(e=>({userId:e.userId,acceptedAt:e.acceptedAt})))]);
 if(!times?.valid)throw new Error('INVALID_DELETION_LEDGER');
 for(const entry of ledger.entries){
  await withTransaction(deps.pool,async tx=>{
   const {rows:[user]}=await tx.client.query(`SELECT status FROM users WHERE id=$1`,[entry.userId]);
   if(!user)return; // Subject created after the restored backup: no old identity/data to revive.
   if(user.status==='ACTIVE')await applyDeletion(tx,deps,{kind:'RESTORE',deletionId:entry.deletionId,acceptedAt:entry.acceptedAt,receiptTokenHash:entry.receiptTokenHash,expiresAt:entry.expiresAt,policyVersion:entry.policyVersion,userId:entry.userId,receiptToken:randomBytes(32).toString('base64url'),requestId:randomUUID()});
   else await tx.client.query(`UPDATE session_families SET revoked_at=COALESCE(revoked_at,clock_timestamp()),revoke_reason='ACCOUNT_DELETION' WHERE user_id=$1`,[entry.userId]);
  });
 }
 // With ingress stopped, this proves all recorded subjects are fenced before readiness changes.
 await withTransaction(deps.pool,async tx=>{
  const{rows:[gate]}=await tx.client.query(`SELECT state,ledger_digest FROM recovery_control WHERE id=1 FOR UPDATE`);
  if(gate?.state!=='REPLAY_REQUIRED'||gate.ledger_digest!==digest)throw new Error('RECOVERY_LEDGER_MISMATCH');
  const ids=ledger.entries.map(e=>e.userId);
  const{rows:[unsafe]}=await tx.client.query(`SELECT (SELECT count(*) FROM users WHERE id=ANY($1::uuid[]) AND status='ACTIVE')+(SELECT count(*) FROM session_families WHERE user_id=ANY($1::uuid[]) AND revoked_at IS NULL) AS n`,[ids]);
  if(Number(unsafe.n)!==0)throw new Error('RECOVERY_BARRIER_INCOMPLETE');
  await tx.client.query(`UPDATE recovery_control SET state='READY',replayed_count=$1,updated_at=clock_timestamp() WHERE id=1`,[ids.length]);
 });deps.assistantRuntime?.shutdown();
 return {replayed:ledger.entries.length,digest};
}
