import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import type {PoolClient} from 'pg';
import {enqueueOutbox} from './queries/outbox.ts';
export interface DeletionMailEncryption {currentVersion:string;keys:Readonly<Record<string,string>>}
export type DeletionMailTemplate='deletion_received'|'deletion_completed';
export const isDeletionMail=(template:string):template is DeletionMailTemplate=>template==='deletion_received'||template==='deletion_completed';
interface Envelope {deletion_id:string;user_id:string;accepted_at:Date;expires_at:Date;key_version:string|null;nonce:string|null;ciphertext:string|null;auth_tag:string|null;state:string;received_event_id:string;completed_event_id:string;completed_enqueued:boolean}
const keyFor=(config:DeletionMailEncryption|null,version:string)=>{
 const value=config?.keys[version];if(!value)return null;
 const key=Buffer.from(value,'base64');return key.length===32&&key.toString('base64')===value?key:null;
};
const aad=(row:Pick<Envelope,'deletion_id'|'user_id'|'accepted_at'|'expires_at'>)=>Buffer.from(JSON.stringify(['deletion-mail-v1',row.deletion_id,row.user_id,row.accepted_at.toISOString(),row.expires_at.toISOString(),'deletion_received','deletion_completed']));
export function encryptDeletionRecipient(email:string,row:Pick<Envelope,'deletion_id'|'user_id'|'accepted_at'|'expires_at'>,config:DeletionMailEncryption|null){
 const version=config?.currentVersion,key=version?keyFor(config,version):null;
 if(!key||!version||!/^[-a-zA-Z0-9_.]{1,64}$/.test(version)||email.length>320||!/^[^\s@<>]+@[^\s@<>]+$/.test(email))return null;
 const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,nonce);cipher.setAAD(aad(row));
 return{key_version:version,nonce:nonce.toString('base64'),ciphertext:Buffer.concat([cipher.update(email,'utf8'),cipher.final()]).toString('base64'),auth_tag:cipher.getAuthTag().toString('base64')};
}
export function decryptDeletionRecipient(row:Envelope,config:DeletionMailEncryption|null):string|null {
 try{const key=row.key_version?keyFor(config,row.key_version):null;if(!key||!row.nonce||!row.ciphertext||!row.auth_tag)return null;
 const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(row.nonce,'base64'));decipher.setAAD(aad(row));decipher.setAuthTag(Buffer.from(row.auth_tag,'base64'));
 const email=Buffer.concat([decipher.update(Buffer.from(row.ciphertext,'base64')),decipher.final()]).toString('utf8');return email.length<=320&&/^[^\s@<>]+@[^\s@<>]+$/.test(email)?email:null;}catch{return null;}
}
/** Call only in live USER deletion acceptance transaction. Restore must never call capture. */
export async function captureDeletionMail(client:PoolClient,deletionId:string,userId:string,config:DeletionMailEncryption|null){
 const {rows:[basis]}=await client.query<{accepted_at:Date;expires_at:Date;email:string|null}>(`SELECT d.requested_at AS accepted_at,d.requested_at+interval '168 hours' AS expires_at,c.email FROM deletion_requests d LEFT JOIN private_contact c ON c.user_id=d.user_id AND c.email_verified_at<=clock_timestamp() WHERE d.id=$1 AND d.user_id=$2`,[deletionId,userId]);
 if(!basis)return;
 const encrypted=basis.email?encryptDeletionRecipient(basis.email,{...basis,deletion_id:deletionId,user_id:userId},config):null;
 await client.query(`INSERT INTO deletion_mail_envelopes(deletion_id,user_id,accepted_at,expires_at,key_version,nonce,ciphertext,auth_tag,state) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(deletion_id) DO NOTHING`,[deletionId,userId,basis.accepted_at,basis.expires_at,encrypted?.key_version??null,encrypted?.nonce??null,encrypted?.ciphertext??null,encrypted?.auth_tag??null,encrypted?'ACTIVE':'UNAVAILABLE']);
 await enqueueDeletionMail(client,deletionId,'deletion_received');
}
export async function enqueueDeletionMail(client:PoolClient,deletionId:string,template:DeletionMailTemplate){
 const {rows:[row]}=await client.query<Envelope>(`SELECT e.* FROM deletion_mail_envelopes e JOIN deletion_requests d ON d.id=e.deletion_id WHERE e.deletion_id=$1 FOR UPDATE OF e`,[deletionId]);
 if(!row||row.state!=='ACTIVE')return false;
 const {rows:[allowed]}=await client.query(`SELECT e.expires_at>clock_timestamp() AND ($2='deletion_received' OR d.status='COMPLETED') AS ok FROM deletion_mail_envelopes e JOIN deletion_requests d ON d.id=e.deletion_id WHERE e.deletion_id=$1`,[deletionId,template]);if(!allowed?.ok)return false;
 await enqueueOutbox(client,{eventId:template==='deletion_received'?row.received_event_id:row.completed_event_id,recipientId:row.user_id,channel:'EMAIL',template,payload:{deletionId}});
 if(template==='deletion_completed')await client.query(`UPDATE deletion_mail_envelopes SET completed_enqueued=true WHERE deletion_id=$1`,[deletionId]);return true;
}
export async function clearDeletionMail(client:PoolClient,deletionId:string,state:'UNAVAILABLE'|'EXPIRED'|'SUPPRESSED'|'CLEARED'){
 await client.query(`UPDATE deletion_mail_envelopes SET state=$2,key_version=NULL,nonce=NULL,ciphertext=NULL,auth_tag=NULL WHERE deletion_id=$1 AND state='ACTIVE'`,[deletionId,state]);
 await client.query(`UPDATE outbox SET status='DEAD',last_error_code='RECIPIENT_UNAVAILABLE',claim_token=NULL,lease_until=NULL WHERE template IN('deletion_received','deletion_completed') AND payload=jsonb_build_object('deletionId',$1::text) AND recipient_id=(SELECT user_id FROM deletion_mail_envelopes WHERE deletion_id=$1::uuid) AND status<>'SENT'`,[deletionId]);
}
/** Caller owns the outbox claim; envelope is read under a short transaction only. */
export async function resolveDeletionMail(client:PoolClient,input:{id:string;recipient_id:string|null;template:string;payload:Record<string,string>},config:DeletionMailEncryption|null):Promise<{email:string;remainingMs:number}|null>{
 if(!isDeletionMail(input.template)||Object.keys(input.payload).length!==1||!input.payload.deletionId)return null;
 const {rows:[row]}=await client.query<Envelope>(`SELECT e.* FROM deletion_mail_envelopes e JOIN deletion_requests d ON d.id=e.deletion_id WHERE e.deletion_id=$1 AND e.user_id=$2 AND ($3='deletion_received' OR d.status='COMPLETED') AND EXISTS(SELECT 1 FROM outbox o WHERE o.id=$4 AND o.event_id=CASE WHEN $3='deletion_received' THEN e.received_event_id ELSE e.completed_event_id END AND o.template=$3 AND o.payload=jsonb_build_object('deletionId',e.deletion_id::text) AND o.recipient_id=e.user_id) FOR UPDATE OF e`,[input.payload.deletionId,input.recipient_id,input.template,input.id]);
 if(!row||row.state!=='ACTIVE')return null;
 const {rows:[clock]}=await client.query(`SELECT floor(extract(epoch FROM (expires_at-clock_timestamp()))*1000)::float8 AS remaining_ms FROM deletion_mail_envelopes WHERE deletion_id=$1`,[row.deletion_id]);
 if(!clock||clock.remaining_ms<=0){await clearDeletionMail(client,row.deletion_id,'EXPIRED');return null;}
 const email=decryptDeletionRecipient(row,config);if(!email)await clearDeletionMail(client,row.deletion_id,'UNAVAILABLE');return email?{email,remainingMs:Number(clock.remaining_ms)}:null;
}
/** Also runs when sending is unavailable: retention never depends on provider uptime. */
export async function expireDeletionMail(client:PoolClient,config:DeletionMailEncryption|null=null){
 const {rows}=await client.query<Envelope&{expired:boolean;terminal:boolean}>(`SELECT e.*,e.expires_at<=clock_timestamp() AS expired,(e.completed_enqueued AND NOT EXISTS(SELECT 1 FROM outbox o WHERE o.recipient_id=e.user_id AND o.payload=jsonb_build_object('deletionId',e.deletion_id::text) AND o.template IN('deletion_received','deletion_completed') AND o.status NOT IN('SENT','DEAD'))) AS terminal FROM deletion_mail_envelopes e WHERE e.state='ACTIVE' ORDER BY e.deletion_id FOR UPDATE`);
 for(const row of rows){const {rows:[clock]}=await client.query(`SELECT expires_at<=clock_timestamp() AS expired FROM deletion_mail_envelopes WHERE deletion_id=$1`,[row.deletion_id]);const state=clock?.expired?'EXPIRED':row.terminal?'CLEARED':!row.key_version||!keyFor(config,row.key_version)?'UNAVAILABLE':null;if(state)await clearDeletionMail(client,row.deletion_id,state);}
}
/** Shared order for dispatch/callback: purpose envelope, then all its outbox rows by id. */
export async function prelockDeletionMail(client:PoolClient,outboxId:string):Promise<string|null>{
 const {rows:[hint]}=await client.query<{deletion_id:string}>(`SELECT e.deletion_id FROM outbox o JOIN deletion_mail_envelopes e ON o.payload=jsonb_build_object('deletionId',e.deletion_id::text) AND o.recipient_id=e.user_id WHERE o.id=$1 AND o.template IN('deletion_received','deletion_completed')`,[outboxId]);
 if(!hint)return null;
 await client.query(`SELECT deletion_id FROM deletion_mail_envelopes WHERE deletion_id=$1 FOR UPDATE`,[hint.deletion_id]);
 await client.query(`SELECT id FROM outbox WHERE payload=jsonb_build_object('deletionId',$1::text) AND recipient_id=(SELECT user_id FROM deletion_mail_envelopes WHERE deletion_id=$1::uuid) AND template IN('deletion_received','deletion_completed') ORDER BY id FOR UPDATE`,[hint.deletion_id]);
 return hint.deletion_id;
}
