import type {FastifyInstance} from 'fastify';
import type {AppDeps} from '../http/context.ts';
import {defineRoute,defineWrite} from '../http/routes.ts';
import {DomainError} from '../common/errors.ts';
import {assertWindow,assertRoster} from '../post-meal/attendance.ts';
import type {MealRow} from '../meals/lifecycle.ts';
import {publicProfile} from '../meals/read.ts';
import {encodeCursor,decodeCursor} from '../common/cursor.ts';
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
 // Own blocked list for Settings: only ACTIVE members (a deleted member has no profile to show or unblock).
 defineRoute(app,deps,'listBlocks',async({request,auth})=>{
  const q=request.query as {cursor?:string;limit?:number};const scope={actor:auth!.userId,resource:'blocks',filterHash:'all',epoch:'1'};
  const key=q.cursor?decodeCursor(deps.config.sessionSecret,scope,q.cursor):null;
  let boundary:[string,string]|null=null;
  if(key){try{const value=JSON.parse(key);if(!Array.isArray(value)||value.length!==2||!Number.isFinite(Date.parse(value[0]))||!/^[a-f0-9-]{36}$/.test(value[1]))throw new Error();boundary=value as [string,string];}catch{throw new DomainError('VALIDATION_FAILED','Invalid blocked-members page.');}}
  const limit=q.limit??20;
  const {rows}=await deps.pool.query<{blocked:string;created_at:Date;cursor_created_at:string;version:string}>(`SELECT b.blocked,b.created_at,b.created_at::text AS cursor_created_at,COALESCE((SELECT r.version FROM block_revisions r WHERE r.blocker=b.blocker AND r.blocked=b.blocked ORDER BY r.version DESC LIMIT 1),0)::text AS version
    FROM blocks b JOIN users u ON u.id=b.blocked AND u.status='ACTIVE' WHERE b.blocker=$1 AND ($2::timestamptz IS NULL OR (b.created_at,b.blocked)<($2::timestamptz,$3::uuid)) ORDER BY b.created_at DESC,b.blocked DESC LIMIT $4`,[auth!.userId,boundary?.[0]??null,boundary?.[1]??null,limit+1]);
  const page=rows.slice(0,limit),last=page.at(-1);
  const data=await Promise.all(page.map(async r=>({profile:await publicProfile(deps.pool,r.blocked),version:r.version,blockedAt:r.created_at.toISOString()})));
  return {data,page:{hasMore:rows.length>limit,nextCursor:rows.length>limit&&last?encodeCursor(deps.config.sessionSecret,scope,JSON.stringify([last.cursor_created_at,last.blocked])):null}};
 });
 defineRoute(app,deps,'getBlock',async({request,auth})=>{
  const {subjectId}=request.params as {subjectId:string};
  if(subjectId===auth!.userId)throw new DomainError('FORBIDDEN','Choose another member.');
  // One MVCC statement keeps own active state and revision consistent across block/unblock.
  // Only target ACTIVE existence is projected: no profile or reverse-direction choice.
  const {rows:[row]}=await deps.pool.query<{blocked:boolean;version:string}>(`SELECT EXISTS(SELECT 1 FROM blocks b WHERE b.blocker=$1 AND b.blocked=u.id) AS blocked,COALESCE((SELECT r.version FROM block_revisions r WHERE r.blocker=$1 AND r.blocked=u.id ORDER BY r.version DESC LIMIT 1),0)::text AS version FROM users u WHERE u.id=$2 AND u.status='ACTIVE'`,[auth!.userId,subjectId]);
  if(!row)throw new DomainError('NOT_FOUND','This member is unavailable.');
  return {data:{subjectId,blocked:row.blocked,version:row.version},version:row.version};
 });
 for(const [operation,blocked] of [['block',true],['unblock',false]] as const)defineWrite(app,deps,operation,async({request,auth,ifMatch},tx)=>{const {subjectId}=request.params as {subjectId:string};const {pair,now}=await lockConnection(tx,auth.userId,subjectId);const data=await setBlock(tx,pair,auth.userId,subjectId,blocked,ifMatch,now);return {data,version:data.version,resourceId:pair.id};},(auth,{request})=>replayAllowed(auth.userId,(request.params as {subjectId:string}).subjectId,operation,request.headers['idempotency-key']));
 defineRoute(app,deps,'getDirect',async({request,auth})=>{
  const {subjectId}=request.params as {subjectId:string};const users=[auth!.userId,subjectId].sort();
  const {rows:[pair]}=await deps.pool.query<PairRow>(`SELECT * FROM user_pairs WHERE low_user=$1 AND high_user=$2`,users);if(!pair)throw new DomainError('NOT_FOUND','Conversation not found.');
  const {rows:[conversation]}=await deps.pool.query(`SELECT c.* FROM conversations c WHERE pair_id=$1 AND EXISTS(SELECT 1 FROM membership_intervals i WHERE i.conversation_id=c.id AND i.user_id=$2)`,[pair.id,auth!.userId]);if(!conversation)throw new DomainError('NOT_FOUND','Conversation not found.');
  const peer=await publicProfile(deps.pool,subjectId);
  let canSend=true;try{await assertDirectAuthorized(deps.pool,pair.id,auth!.userId);}catch(error){if(!(error instanceof DomainError))throw error;canSend=false;}
  return {data:{id:conversation.id,version:String(conversation.version),kind:'DIRECT',mealId:null,title:peer.displayName,canSend,dissolved:false,head:String(conversation.head),avatar:peer.displayName==='Deleted member'?null:{displayName:peer.displayName,avatarUrl:null}},version:String(conversation.version)};
 });
}
