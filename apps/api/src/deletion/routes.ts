import type { FastifyInstance } from 'fastify';
import { appendAudit, enqueueJob } from '@fancy/db';
import { DomainError } from '../common/errors.ts';
import { registerLockTable } from '../common/locks.ts';
import { lockActiveActor } from '../common/actor.ts';
import { defineRoute, defineWrite } from '../http/routes.ts';
import type { AppDeps } from '../http/context.ts';
import { keyedHash, SESSION_COOKIE } from '../http/security.ts';
import { assertFreshAuth } from '../identity/reauth.ts';
import { revokeAllForUser } from '../identity/sessions.ts';
import { sha256Hex } from '../identity/tokens.ts';
import { invalidateUserAI, prelockUserAI } from '../assistant/invalidate.ts';
import { advanceLifecycle, cancelMealState, type MealRow } from '../meals/lifecycle.ts';
import { addSeat, currentSeats } from '../meals/commands.ts';
import { leaveConversation } from '../membership/intervals.ts';
import { revokePairsForDeletion } from '../connections/service.ts';
import { purgeSnapshotExports } from '../admin/exports.ts';
registerLockTable('user_pairs','pair');
const statusDto=(r:Record<string,unknown>)=>({status:r.status,requestedAt:(r.requested_at as Date).toISOString(),completedAt:(r.completed_at as Date|null)?.toISOString()??null});
export function registerDeletionRoutes(app:FastifyInstance,deps:AppDeps){
 const receiptRates=new Map<string,{start:number;count:number}>();
 defineRoute(app,deps,'deletionStatus',async({request})=>{
  const key=keyedHash(deps.config.sessionSecret,'receipt-ip',request.ip),now=Date.now();
  if(receiptRates.size>10_000)for(const[k,v]of receiptRates)if(now-v.start>=60_000)receiptRates.delete(k);
  const previous=receiptRates.get(key),rate=previous&&now-previous.start<60_000?previous:{start:now,count:0};rate.count++;receiptRates.set(key,rate);
  if(rate.count>20||receiptRates.size>10_000)throw new DomainError('RATE_LIMITED','Please wait before checking again.',{retryAfterSeconds:60});
  const {receiptToken}=request.body as {receiptToken:string};
  const {rows:[row]}=await deps.pool.query(`SELECT status,requested_at,completed_at,expires_at FROM deletion_requests WHERE receipt_token_hash=$1`,[sha256Hex(receiptToken)]);
  if(!row)throw new DomainError('NOT_FOUND','Deletion receipt not found.');
  if(row.expires_at&&row.expires_at<=new Date())throw new DomainError('RECEIPT_EXPIRED','This deletion receipt has expired.');return{data:statusDto(row)};
 });
 defineWrite(app,deps,'requestDeletion',async({request,auth,ifMatch},tx)=>{
  const actor=await lockActiveActor(tx,auth.userId,'update');
  if(actor.version!==ifMatch)throw new DomainError('VERSION_CONFLICT','Your account changed. Reload before confirming.',{currentVersion:actor.version});
  // Holding this user UPDATE blocks new applications, approvals and messages involving the actor.
  const {rows:pairs}=await tx.client.query<{id:string}>(`SELECT id FROM user_pairs WHERE low_user=$1 OR high_user=$1 ORDER BY id`,[auth.userId]);
  const pairIds=pairs.map(p=>p.id);
  const {rows:mealIds}=await tx.client.query<{id:string}>(`SELECT id FROM meals WHERE host_id=$1 OR id IN(SELECT meal_id FROM applications WHERE user_id=$1 AND state IN('PENDING','CONFIRMED')) OR id IN(SELECT basis_meal_id FROM pair_consents WHERE pair_id=ANY($2::uuid[])) ORDER BY id`,[auth.userId,pairIds]);
  const meals=await tx.locks.lock<MealRow>('meals',mealIds.map(m=>m.id),'update','*');
  if(pairIds.length)await tx.locks.lock('user_pairs',pairIds,'update');
  const {rows:conversations}=await tx.client.query<{id:string}>(`SELECT id FROM conversations WHERE meal_id=ANY($1::uuid[]) OR pair_id=ANY($2::uuid[]) OR id IN(SELECT conversation_id FROM membership_intervals WHERE user_id=$3 AND leave_seq IS NULL) ORDER BY id`,[mealIds.map(m=>m.id),pairIds,auth.userId]);
  await tx.locks.lock('conversations',conversations.map(c=>c.id),'update');
  await prelockUserAI(tx.client,auth.userId);
  await tx.locks.privacyControl();
  const now=await tx.effectiveNow();assertFreshAuth(auth.authTime,now);
  await invalidateUserAI(tx.client,deps.assistantRuntime!,auth.userId,'ACCOUNT_DELETED');
  for(const meal of meals){
   await advanceLifecycle(tx,meal,now);
   if(now<meal.starts_at&&meal.status==='OPEN'){
    if(meal.host_id===auth.userId)await cancelMealState(tx,meal,'host',now,auth.userId);
    else{
     const {rows:[application]}=await tx.client.query(`SELECT id,state FROM applications WHERE meal_id=$1 AND user_id=$2 AND state IN('PENDING','CONFIRMED') FOR UPDATE`,[meal.id,auth.userId]);
     if(application?.state==='CONFIRMED'){
      await addSeat(tx,meal,auth.userId,application.id,'LEFT',now,request.id);
      await tx.client.query(`UPDATE meals SET version=version+1 WHERE id=$1`,[meal.id]);meal.version=String(BigInt(meal.version)+1n);
     }
     if(application)await tx.client.query(`UPDATE applications SET state=$2,version=version+1,decided_at=$3 WHERE id=$1`,[application.id,application.state==='PENDING'?'WITHDRAWN':'CANCELLED',now]);
     if(application?.state==='CONFIRMED'&&now>=meal.closes_at&&(await currentSeats(tx,meal,now)).length<meal.minimum)await cancelMealState(tx,meal,'insufficient',now,auth.userId);
    }
   }else await tx.client.query(`UPDATE applications SET state='WITHDRAWN',version=version+1,decided_at=$3 WHERE meal_id=$1 AND user_id=$2 AND state='PENDING'`,[meal.id,auth.userId,now]);
  }
  await revokePairsForDeletion(tx,auth.userId,now);
  for(const c of conversations)await leaveConversation(tx,c.id,auth.userId,now);
  await tx.client.query(`UPDATE users SET status='DELETING',version=version+1,privacy_epoch=privacy_epoch+1,updated_at=$2 WHERE id=$1`,[auth.userId,now]);
  await revokeAllForUser(tx.client,auth.userId,'ACCOUNT_DELETION');
  await tx.client.query(`UPDATE privacy_control SET epoch=epoch+1 WHERE id=1`);
  const {rows:revoked}=await tx.client.query<{id:string}>(`UPDATE analytics_snapshots SET revoked_at=COALESCE(revoked_at,$2) WHERE id IN(SELECT snapshot_id FROM analytics_snapshot_subjects WHERE user_id=$1) RETURNING id`,[auth.userId,now]);
  const revokedIds=revoked.map(s=>s.id);
  purgeSnapshotExports(revokedIds);
  await tx.client.query(`UPDATE analytics_exports SET revoked_at=COALESCE(revoked_at,$2) WHERE snapshot_id=ANY($1::uuid[])`,[revokedIds,now]);
  const token=(request.body as {receiptToken:string}).receiptToken;
  const days=deps.config.retentionPolicy?.deletionReceiptDays;
  const expires=typeof days==='number'&&Number.isInteger(days)&&days>0?new Date(now.getTime()+days*86_400_000):null;
  const {rows:[row]}=await tx.client.query(`INSERT INTO deletion_requests(user_id,receipt_token_hash,status,requested_at,expires_at,policy_version) VALUES($1,$2,'PENDING',$3,$4,$5) RETURNING *`,[auth.userId,sha256Hex(token),now,expires,deps.config.privacyPolicyVersion??'unconfigured']);
  await tx.client.query(`INSERT INTO deletion_journal(deletion_id,user_id) VALUES($1,$2)`,[row.id,auth.userId]);
  await enqueueJob(tx.client,{kind:'account.purge',resourceId:row.id,dueAt:now});
  await appendAudit(tx.client,{actorKind:'USER',actorId:auth.userId,action:'account.deletion_accepted',aggregateType:'deletion',aggregateId:row.id,requestId:request.id});
  return{data:statusDto(row),resourceId:row.id,after:(reply)=>{void reply.clearCookie(SESSION_COOKIE,{path:'/'});}};
 });
}
