import type {Pool} from 'pg';
import {withTransaction} from '../common/transaction.ts';
import {DomainError} from '../common/errors.ts';
export interface VerifiedMailReceipt {svixId:string;outboxId:string;providerEmailId:string;eventType:'email.sent'|'email.delivered'|'email.bounced';payloadSha256:string;occurredAt:string;signedAttemptAt:string}
const conflict=()=>new DomainError('STATE_CONFLICT','Mail receipt evidence conflicts.');
/** Durable dispatch admission only; signature evidence is still required to prove acceptance. */
export async function admitResendDispatch(pool:Pool,input:{outboxId:string;claimToken:string;payloadSha256:string}):Promise<boolean>{
 return withTransaction(pool,async tx=>{
  const {rows}=await tx.client.query(`SELECT id FROM outbox WHERE id=$1 FOR UPDATE`,[input.outboxId]);
  if(!rows.length)return false;
  const {rows:admitted}=await tx.client.query(`INSERT INTO mail_provider_messages(outbox_id,dispatch_hash) SELECT id,$2 FROM outbox WHERE id=$1 AND claim_token=$3 AND status='SENDING' AND lease_until>clock_timestamp() AND channel='EMAIL' ON CONFLICT(outbox_id) DO UPDATE SET dispatch_hash=mail_provider_messages.dispatch_hash WHERE mail_provider_messages.dispatch_hash=EXCLUDED.dispatch_hash RETURNING outbox_id`,[input.outboxId,input.payloadSha256,input.claimToken]);
  return admitted.length===1;
 });
}
export async function recordResendReceipt(pool:Pool,event:VerifiedMailReceipt):Promise<'accepted'|'duplicate'|'ignored'>{
 try{return await withTransaction(pool,async tx=>{
  const {rows:[old]}=await tx.client.query<{payload_sha256:string}>(`SELECT payload_sha256 FROM mail_provider_receipts WHERE svix_id=$1`,[event.svixId]);
  if(old){if(old.payload_sha256!==event.payloadSha256)throw conflict();return 'duplicate';}
  const {rows:[outbox]}=await tx.client.query<{status:string;channel:string;attempts:number;provider_id:string|null}>(`SELECT status,channel,attempts,provider_id FROM outbox WHERE id=$1 FOR UPDATE`,[event.outboxId]);
  if(!outbox||outbox.channel!=='EMAIL'||outbox.attempts<1||!['SENDING','UNKNOWN','SENT','DEAD'].includes(outbox.status))return 'ignored';
  if(outbox.provider_id!==null&&outbox.provider_id!==event.providerEmailId)throw conflict();
  const {rows:mappings}=await tx.client.query<{outbox_id:string;provider_email_id:string|null}>(`SELECT outbox_id,provider_email_id FROM mail_provider_messages WHERE outbox_id=$1 OR provider_email_id=$2`,[event.outboxId,event.providerEmailId]);
  if(mappings.some(m=>m.outbox_id!==event.outboxId||(m.provider_email_id!==null&&m.provider_email_id!==event.providerEmailId)))throw conflict();
  if(!mappings.some(m=>m.outbox_id===event.outboxId))return 'ignored';
  await tx.client.query(`UPDATE mail_provider_messages SET provider_email_id=$2 WHERE outbox_id=$1`,[event.outboxId,event.providerEmailId]);
  const {rows}=await tx.client.query(`INSERT INTO mail_provider_receipts(svix_id,outbox_id,provider_email_id,event_type,payload_sha256,provider_occurred_at,signed_attempt_at) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(svix_id) DO NOTHING RETURNING svix_id`,[event.svixId,event.outboxId,event.providerEmailId,event.eventType,event.payloadSha256,event.occurredAt,event.signedAttemptAt]);
  if(!rows.length){const {rows:[existing]}=await tx.client.query<{payload_sha256:string}>(`SELECT payload_sha256 FROM mail_provider_receipts WHERE svix_id=$1`,[event.svixId]);if(existing?.payload_sha256!==event.payloadSha256)throw conflict();return 'duplicate';}
  const column=event.eventType==='email.sent'?'sent_at':event.eventType==='email.delivered'?'delivered_at':'bounced_at';
  await tx.client.query(`UPDATE mail_provider_messages SET ${column}=LEAST(${column},$2::timestamptz) WHERE outbox_id=$1`,[event.outboxId,event.occurredAt]);
  // Clearing the claim atomically fences a send/lookup already in flight. Delivery's
  // existing token CAS prevents its later UNKNOWN/RETRY/SENT response replacing evidence.
  await tx.client.query(`UPDATE outbox SET status=CASE WHEN $3 OR status='SENT' THEN 'SENT' WHEN status='DEAD' THEN 'DEAD' ELSE 'UNKNOWN' END,provider_id=$2,claim_token=NULL,lease_until=NULL,updated_at=clock_timestamp(),last_error_code=CASE WHEN last_error_code IN('RETRY_EXHAUSTED','INVALID_PAYLOAD','RECIPIENT_UNAVAILABLE') THEN last_error_code WHEN $3 OR status='SENT' THEN NULL ELSE 'PROVIDER_UNKNOWN_OUTCOME' END WHERE id=$1`,[event.outboxId,event.providerEmailId,event.eventType==='email.sent']);
  return 'accepted';
 });}catch(error){if((error as {code?:string}).code==='23505')throw conflict();throw error;}
}
