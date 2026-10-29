import {expireDeletionMail,isDeletionMail,resolveDeletionMail,type DeletionMailEncryption} from '@fancy/db';
import {randomUUID} from 'node:crypto';
import type {Pool} from 'pg';
export type DeliveryOutcome={status:'SENT';providerId:string}|{status:'UNKNOWN'}|{status:'RETRY'};
export interface MailProvider {
 kind:'test'|'real'|'unavailable';
 send(input:{idempotencyKey:string;email:string;template:string;refs:Record<string,string>;claimToken?:string;dispatchDeadlineMs?:number;
  /** moderation_digest only: admin deep links to open reports (ids only, no report text). */
  links?:readonly string[]}):Promise<DeliveryOutcome>;
 /** NOT_SENT is only valid with provider-authoritative proof, never a lookup timeout/not-found. */
 lookup(idempotencyKey:string):Promise<DeliveryOutcome|{status:'NOT_SENT'}>;
}
export class UnavailableMailProvider implements MailProvider {
 readonly kind='unavailable' as const;
 async send():Promise<DeliveryOutcome>{return {status:'RETRY'};}
 async lookup():Promise<DeliveryOutcome>{return {status:'UNKNOWN'};}
}
const TEMPLATES=new Set(['application_approved','application_declined','application_expired','meal_cancelled','deletion_received','deletion_completed','moderation_digest']);
const REF_KEYS=new Set(['mealId','applicationId','conversationId','deletionId','digestId']);
interface DeliveryRow {id:string;recipient_id:string|null;template:string;payload:Record<string,string>;attempts:number;lookup_attempts:number;status:string;claim_token:string}
export type MailDeadCode='RETRY_EXHAUSTED'|'INVALID_PAYLOAD'|'RECIPIENT_UNAVAILABLE';
export interface MailDeadEvent {readonly event:'mail_dead';readonly outboxId:string;readonly errorCode:MailDeadCode;readonly attempts:number;readonly lookupAttempts:number}
export function logMailDead(event:MailDeadEvent){
 // Re-project the sink payload: never serialize a row, recipient, refs or provider exception.
 console.error(JSON.stringify({event:'mail_dead',outboxId:event.outboxId,errorCode:event.errorCode,attempts:event.attempts,lookupAttempts:event.lookupAttempts}));
}
type DeadRow=Pick<DeliveryRow,'id'|'attempts'|'lookup_attempts'>;
export function mailDelivery(pool:Pool,provider:MailProvider,environment:'development'|'test'|'staging'|'production',options:{deletionMailEncryption?:DeletionMailEncryption|null;onDead?:(event:MailDeadEvent)=>void|Promise<void>;
 /** Moderation digest destination and admin console URL (SUPPORT_EMAIL / ADMIN_URL). */
 support?:{email:string|null;adminUrl:string}}={}){
 if(provider.kind==='test'&&environment!=='test'&&environment!=='development')throw new Error('TEST_MAIL_FORBIDDEN');
 async function alert(row:DeadRow,errorCode:MailDeadCode){
  const event:MailDeadEvent=Object.freeze({event:'mail_dead',outboxId:row.id,errorCode,attempts:row.attempts,lookupAttempts:row.lookup_attempts});
  try{await (options.onDead??logMailDead)(event);}catch{
   // The database transition already committed. A failed observer must not undo it or resend.
   // Fall back to the same bounded metadata, never the observer's exception text.
   try{logMailDead(event);}catch{/* Logging failure cannot alter committed delivery state. */}
  }
 }
 async function markDead(id:string,token:string,errorCode:MailDeadCode){
  const {rows}=await pool.query<DeadRow>(`UPDATE outbox SET status='DEAD',last_error_code=$3,claim_token=NULL,lease_until=NULL,updated_at=clock_timestamp() WHERE id=$1 AND claim_token=$2 RETURNING id,attempts,lookup_attempts`,[id,token,errorCode]);
  for(const row of rows)await alert(row,errorCode);
 }
 async function withMailTransaction<T>(work:(client:import('pg').PoolClient)=>Promise<T>){const client=await pool.connect();try{await client.query('BEGIN');const value=await work(client);await client.query('COMMIT');return value;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}}
 async function tick(){
  await withMailTransaction(client=>expireDeletionMail(client,options.deletionMailEncryption??null));
  await pool.query(`UPDATE outbox SET status='UNKNOWN',claim_token=NULL,lease_until=NULL,next_attempt_at=clock_timestamp(),last_error_code='LEASE_EXPIRED' WHERE status='SENDING' AND lease_until<clock_timestamp()`);
  const {rows:exhausted}=await pool.query<DeadRow>(`UPDATE outbox SET status='DEAD',claim_token=NULL,lease_until=NULL,last_error_code='RETRY_EXHAUSTED',updated_at=clock_timestamp() WHERE status IN('PENDING','FAILED','UNKNOWN') AND (lease_until IS NULL OR lease_until<clock_timestamp()) AND (attempts>=8 OR lookup_attempts>=8 OR created_at<=clock_timestamp()-interval '24 hours') RETURNING id,attempts,lookup_attempts`);
  for(const row of exhausted)await alert(row,'RETRY_EXHAUSTED');
  if(provider.kind==='unavailable')return 0;
  const token=randomUUID();
  const {rows}=await pool.query<DeliveryRow>(`WITH due AS(SELECT id FROM outbox WHERE status IN('PENDING','FAILED','UNKNOWN') AND (lease_until IS NULL OR lease_until<clock_timestamp()) AND next_attempt_at<=clock_timestamp() AND attempts<8 AND lookup_attempts<8 ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT 10)
   UPDATE outbox o SET claim_token=$1,lease_until=clock_timestamp()+interval '60 seconds',status=CASE WHEN o.status='UNKNOWN' THEN 'UNKNOWN' ELSE 'SENDING' END,attempts=o.attempts+CASE WHEN o.status='UNKNOWN' THEN 0 ELSE 1 END,lookup_attempts=o.lookup_attempts+CASE WHEN o.status='UNKNOWN' THEN 1 ELSE 0 END
   FROM due WHERE o.id=due.id AND (o.lease_until IS NULL OR o.lease_until<clock_timestamp()) RETURNING o.*`,[token]);
  for(const row of rows){
   let outcome:DeliveryOutcome|{status:'NOT_SENT'};
   if(!TEMPLATES.has(row.template)||Object.entries(row.payload).some(([k,v])=>!REF_KEYS.has(k)||typeof v!=='string'||!/^[0-9a-f-]{36}$/i.test(v))){await markDead(row.id,token,'INVALID_PAYLOAD');continue;}
   if(row.status==='UNKNOWN'){
    try{outcome=await provider.lookup(row.id);}catch{outcome={status:'UNKNOWN'};}
   }else{
    const beforeResolution=performance.now();
    const deletionDestination=isDeletionMail(row.template)?await withMailTransaction(client=>resolveDeletionMail(client,row,options.deletionMailEncryption??null)):null;
    const digest=row.template==='moderation_digest';
    const email=digest?options.support?.email:isDeletionMail(row.template)?deletionDestination?.email:(await pool.query<{email:string}>(`SELECT c.email FROM private_contact c JOIN users u ON u.id=c.user_id WHERE c.user_id=$1 AND u.status='ACTIVE'`,[row.recipient_id])).rows[0]?.email;
    if(!email){await markDead(row.id,token,'RECIPIENT_UNAVAILABLE');continue;}
    // Digest links carry report ids only; staff open them in the admin console after signing in.
    const links=digest?(await pool.query<{report_ids:string[]}>(`SELECT report_ids FROM moderation_digests WHERE id=$1`,[row.payload.digestId])).rows[0]?.report_ids.map(id=>`${options.support!.adminUrl}#moderation/${id}`):undefined;
    if(digest&&!links?.length){await markDead(row.id,token,'INVALID_PAYLOAD');continue;}
    try{outcome=await provider.send({idempotencyKey:row.id,email,template:row.template,refs:row.payload,claimToken:row.claim_token,...(links?{links}:{}),...(deletionDestination?{dispatchDeadlineMs:beforeResolution+deletionDestination.remainingMs}:{})});}catch{outcome={status:'UNKNOWN'};}
   }
   const status=outcome.status==='SENT'?'SENT':outcome.status==='UNKNOWN'?'UNKNOWN':outcome.status==='NOT_SENT'?'PENDING':'FAILED';
   await pool.query(`UPDATE outbox SET status=$3,provider_id=$4,claim_token=NULL,lease_until=NULL,updated_at=clock_timestamp(),next_attempt_at=clock_timestamp()+make_interval(secs=>$5),last_error_code=$6 WHERE id=$1 AND claim_token=$2`,[row.id,token,status,outcome.status==='SENT'?outcome.providerId:null,Math.min(3600,30*2**Math.max(row.attempts,row.lookup_attempts)),status==='SENT'?null:status==='UNKNOWN'?'PROVIDER_UNKNOWN_OUTCOME':'PROVIDER_UNAVAILABLE']);
  }
  return rows.length;
 }
 return {tick};
}
