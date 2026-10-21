import type {Pool} from 'pg';
import {withTransaction} from '../../../api/src/common/transaction.ts';
import type {JobHandler} from '../runner/runner.ts';
import {StepwiseDeletionProvider,type DeletionSteps} from '../deletion/provider.ts';

/** Provider implementations must revoke Auth0 identities/refresh grants and Apple grants.
 * A timeout or an unconfigured provider never counts as completed. */
export interface DeletionProvider {
 revoke(userId:string,deletionId:string):Promise<'COMPLETED'|'NEEDS_SUPPORT'>;
}
export class UnavailableDeletionProvider implements DeletionProvider {
 async revoke():Promise<'NEEDS_SUPPORT'>{return 'NEEDS_SUPPORT';}
}
export function deletionHandler(pool:Pool,provider:DeletionProvider|DeletionSteps,policyApproved=false):JobHandler {
 const remoteProvider='auth0' in provider?new StepwiseDeletionProvider(pool,provider):provider;
 return async(job)=>{
  const {rows:[hint]}=await pool.query<{user_id:string;status:string}>(`SELECT user_id,status FROM deletion_requests WHERE id=$1`,[job.resourceId]);
  if(!hint||hint.status==='COMPLETED')return;
  // Local removal is atomic and repeatable. Historical seat/attendance facts remain intact;
  // only identities, private text and personal analytics are removed here.
  await withTransaction(pool,async(tx)=>{
   const [user]=await tx.locks.lock<{id:string;status:string}>('users',[hint.user_id],'update','id,status');
   if(!user||user.status==='ACTIVE')throw Object.assign(new Error('Invalid deletion barrier'),{code:'DELETION_BARRIER_MISSING'});
   const {rows:[receipt]}=await tx.client.query(`SELECT * FROM deletion_requests WHERE id=$1 FOR UPDATE`,[job.resourceId]);
   if(!receipt||receipt.status==='COMPLETED'||receipt.provider_steps.local==='COMPLETED')return;
   await tx.client.query(`SET LOCAL fancy.privacy_purge='on'`);
   await tx.client.query(`DELETE FROM profiles WHERE user_id=$1`,[hint.user_id]);
   await tx.client.query(`DELETE FROM product_surveys WHERE user_id=$1`,[hint.user_id]);
   await tx.client.query(`DELETE FROM private_contact WHERE user_id=$1`,[hint.user_id]);
   await tx.client.query(`DELETE FROM ai_preferences WHERE user_id=$1`,[hint.user_id]);
   await tx.client.query(`UPDATE messages SET body='Message removed',redacted=true WHERE sender_id=$1`,[hint.user_id]);
   await tx.client.query(`UPDATE applications SET message='This application has been removed.' WHERE user_id=$1`,[hint.user_id]);
   await tx.client.query(`UPDATE meals SET title='Meal unavailable',description='This meal description has been removed.' WHERE host_id=$1`,[hint.user_id]);
   await tx.client.query(`DELETE FROM public_review_revisions WHERE author_id=$1 OR subject_id=$1`,[hint.user_id]);
   await tx.client.query(`DELETE FROM experience_revisions WHERE user_id=$1`,[hint.user_id]);
   await tx.client.query(`DELETE FROM analytics_events WHERE user_id=$1 OR auth_family_id IN(SELECT id FROM session_families WHERE user_id=$1)`,[hint.user_id]);
   await tx.client.query(`DELETE FROM analytics_discovery_requests WHERE user_id=$1`,[hint.user_id]);
   await tx.client.query(`DELETE FROM analytics_deliveries WHERE user_id=$1`,[hint.user_id]);
   await tx.client.query(`DELETE FROM analytics_consents WHERE scope_key IN(SELECT 'family:'||id::text FROM session_families WHERE user_id=$1)`,[hint.user_id]);
   await tx.client.query(`DELETE FROM analytics_snapshot_facts WHERE snapshot_id IN(SELECT snapshot_id FROM analytics_snapshot_subjects WHERE user_id=$1)`,[hint.user_id]);
   await tx.client.query(`DELETE FROM idempotency WHERE actor_id=$1`,[hint.user_id]);
   await tx.client.query(`DELETE FROM auth_transactions WHERE user_id=$1 OR result_family_id IN(SELECT id FROM session_families WHERE user_id=$1)`,[hint.user_id]);
   await tx.client.query(`DELETE FROM session_families WHERE user_id=$1`,[hint.user_id]);
   await tx.client.query(`DELETE FROM roles WHERE user_id=$1`,[hint.user_id]);
   await tx.client.query(`DELETE FROM support_case_grants WHERE user_id=$1`,[hint.user_id]);
   await tx.client.query(`UPDATE outbox SET status='DEAD',last_error_code='RECIPIENT_UNAVAILABLE',claim_token=NULL,lease_until=NULL WHERE recipient_id=$1 AND status<>'SENT'`,[hint.user_id]);
   await tx.client.query(`UPDATE deletion_requests SET status='PROCESSING',provider_steps=provider_steps||'{"local":"COMPLETED"}'::jsonb WHERE id=$1`,[job.resourceId]);
  });
  // Remote calls are outside SQL locks. They use the stable deletion ID for provider dedupe.
  let remote:'COMPLETED'|'NEEDS_SUPPORT';
  try{remote=await remoteProvider.revoke(hint.user_id,job.resourceId);}catch{remote='NEEDS_SUPPORT';}
  await withTransaction(pool,async(tx)=>{
   await tx.locks.lock('users',[hint.user_id],'update');
   const {rows:[receipt]}=await tx.client.query(`SELECT status FROM deletion_requests WHERE id=$1 FOR UPDATE`,[job.resourceId]);
   if(!receipt||receipt.status==='COMPLETED')return;
   const completed=remote==='COMPLETED'&&policyApproved;
   if(completed){
    await tx.client.query(`DELETE FROM identities WHERE user_id=$1`,[hint.user_id]);
    await tx.client.query(`UPDATE users SET status='DELETED',updated_at=clock_timestamp() WHERE id=$1`,[hint.user_id]);
   }
   await tx.client.query(`UPDATE deletion_requests SET status=$2,completed_at=CASE WHEN $2='COMPLETED' THEN clock_timestamp() ELSE NULL END,provider_steps=provider_steps||jsonb_build_object('identity',$3::text,'retention',$4::text) WHERE id=$1`,[job.resourceId,completed?'COMPLETED':'NEEDS_SUPPORT',remote,policyApproved?'APPROVED':'NEEDS_APPROVAL']);
  });
 };
}
