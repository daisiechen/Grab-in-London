import type {FastifyInstance} from 'fastify';
import type {AppDeps} from '../http/context.ts';
import {defineRoute,defineWrite} from '../http/routes.ts';
import {DomainError} from '../common/errors.ts';
import {assertWindow,assertRoster} from '../post-meal/attendance.ts';
import type {MealRow} from '../meals/lifecycle.ts';
import {publicProfile} from '../meals/read.ts';
import {assertDirectAuthorized,clearPairConsents,connectionState,lockConnection,selectPair,setBlock,type PairRow} from './service.ts';
export function registerConnectionRoutes(app:FastifyInstance,deps:AppDeps) {
 async function replayAllowed(actorId:string,subjectId:string,operation:string,key:unknown) {
  if(typeof key!=='string')return false;
  const users=[actorId,subjectId].sort();const {rows:[pair]}=await deps.pool.query<PairRow>(`SELECT * FROM user_pairs WHERE low_user=$1 AND high_user=$2`,users);if(!pair)return false;
  const {rows:[record]}=await deps.pool.query<{response_json:{data?:{version?:string;selected?:boolean;connection?:string;blocked?:boolean}}}>(`SELECT response_json FROM idempotency WHERE actor_id=$1 AND operation=$2 AND key=$3`,[actorId,operation,key]);const old=record?.response_json?.data;if(!old)return false;
  if(operation==='block'||operation==='unblock') {
   const {rows:[latest]}=await deps.pool.query<{version:string;active:boolean}>(`SELECT version,active FROM block_revisions WHERE blocker=$1 AND blocked=$2 ORDER BY version DESC LIMIT 1`,[actorId,subjectId]);return Boolean(latest&&latest.version===old.version&&latest.active===old.blocked);
  }
  const current=await connectionState(deps.pool,pair,actorId,subjectId);
  return current.version===old.version&&current.selected===old.selected&&(old.connection!=='OPEN'||current.connection==='OPEN');
 }

 defineWrite(app,deps,'selectReconnect',async({request,auth,ifMatch},tx)=>{
  const {mealId,subjectId}=request.params as {mealId:string;subjectId:string};const {pair,now}=await lockConnection(tx,auth.userId,subjectId,[mealId]);
  const {rows:[meal]}=await tx.client.query<MealRow>(`SELECT * FROM meals WHERE id=$1`,[mealId]);if(!meal)throw new DomainError('NOT_FOUND','Meal not found.');assertWindow(meal,now);await assertRoster(tx.client,mealId,[auth.userId,subjectId]);
  const data=await selectPair(tx,pair,auth.userId,subjectId,mealId,(request.body as {selected:boolean}).selected,ifMatch,now);return {data,version:data.version,resourceId:pair.id};
 },(auth,{request})=>replayAllowed(auth.userId,(request.params as {subjectId:string}).subjectId,'selectReconnect',request.headers['idempotency-key']));
 defineWrite(app,deps,'revokeConnection',async({request,auth,ifMatch},tx)=>{
  const {subjectId}=request.params as {subjectId:string};const {pair,now}=await lockConnection(tx,auth.userId,subjectId);const before=await connectionState(tx.client,pair,auth.userId,subjectId);if(ifMatch!==before.version)throw new DomainError('VERSION_CONFLICT','Your connection changed.',{currentVersion:before.version});await clearPairConsents(tx,pair,now);const data=await connectionState(tx.client,pair,auth.userId,subjectId);return {data,version:data.version,resourceId:pair.id};
 },(auth,{request})=>replayAllowed(auth.userId,(request.params as {subjectId:string}).subjectId,'revokeConnection',request.headers['idempotency-key']));
 for(const [operation,blocked] of [['block',true],['unblock',false]] as const)defineWrite(app,deps,operation,async({request,auth,ifMatch},tx)=>{const {subjectId}=request.params as {subjectId:string};const {pair,now}=await lockConnection(tx,auth.userId,subjectId);const data=await setBlock(tx,pair,auth.userId,subjectId,blocked,ifMatch,now);return {data,version:data.version,resourceId:pair.id};},(auth,{request})=>replayAllowed(auth.userId,(request.params as {subjectId:string}).subjectId,operation,request.headers['idempotency-key']));
 defineRoute(app,deps,'getDirect',async({request,auth})=>{
  const {subjectId}=request.params as {subjectId:string};const users=[auth!.userId,subjectId].sort();
  const {rows:[pair]}=await deps.pool.query<PairRow>(`SELECT * FROM user_pairs WHERE low_user=$1 AND high_user=$2`,users);if(!pair)throw new DomainError('NOT_FOUND','Conversation not found.');
  const {rows:[conversation]}=await deps.pool.query(`SELECT c.* FROM conversations c WHERE pair_id=$1 AND EXISTS(SELECT 1 FROM membership_intervals i WHERE i.conversation_id=c.id AND i.user_id=$2)`,[pair.id,auth!.userId]);if(!conversation)throw new DomainError('NOT_FOUND','Conversation not found.');
  let canSend=true;try{await assertDirectAuthorized(deps.pool,pair.id,auth!.userId);}catch(error){if(!(error instanceof DomainError))throw error;canSend=false;}
  return {data:{id:conversation.id,version:String(conversation.version),kind:'DIRECT',mealId:null,title:(await publicProfile(deps.pool,subjectId)).displayName,canSend,dissolved:false,head:String(conversation.head)},version:String(conversation.version)};
 });
}
