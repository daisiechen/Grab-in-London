import type { FastifyInstance } from 'fastify';
import { DomainError, InvariantError } from '../common/errors.ts';
import { lockActiveActor } from '../common/actor.ts';
import { withTransaction } from '../common/transaction.ts';
import { defineRoute, defineWrite } from '../http/routes.ts';
import type { AppDeps } from '../http/context.ts';
import { conversation } from '../conversations/routes.ts';

export function registerNotificationSettingsRoutes(app: FastifyInstance, deps: AppDeps): void {
 defineRoute(app,deps,'getConversationNotificationSettings',async ({request,auth})=>withTransaction(deps.pool,async tx=>{
  const {conversationId}=request.params as {conversationId:string};
  await lockActiveActor(tx,auth!.userId);
  await tx.locks.lock('conversations',[conversationId],'share');
  const c=await conversation(tx.client,conversationId,auth!.userId);
  if(c.kind!=='GROUP')throw new DomainError('FORBIDDEN','This is not a group.');
  await conversation(tx.client,conversationId,auth!.userId,true);
  const {rows:[setting]}=await tx.client.query<{muted:boolean;version:string}>(`SELECT muted,version FROM conversation_notification_settings WHERE conversation_id=$1 AND user_id=$2`,[conversationId,auth!.userId]);
  return {data:setting??{muted:false,version:'0'},version:setting?.version??'0'};
 }));
 defineWrite(app,deps,'putConversationNotificationSettings',async ({request,auth,ifMatch},tx)=>{
  const {conversationId}=request.params as {conversationId:string};
  const {muted}=request.body as {muted:boolean};
  await lockActiveActor(tx,auth.userId);
  await tx.locks.lock('conversations',[conversationId],'update');
  const c=await conversation(tx.client,conversationId,auth.userId);
  if(c.kind!=='GROUP')throw new DomainError('FORBIDDEN','This is not a group.');
  await conversation(tx.client,conversationId,auth.userId,true);
  const {rows:[current]}=await tx.client.query<{version:string}>(`SELECT version FROM conversation_notification_settings WHERE conversation_id=$1 AND user_id=$2`,[conversationId,auth.userId]);
  if((current?.version??'0')!==ifMatch)throw new DomainError('VERSION_CONFLICT','This notification setting changed.',{currentVersion:current?.version??'0'});
  const {rows:[setting]}=await tx.client.query<{muted:boolean;version:string}>(`INSERT INTO conversation_notification_settings(conversation_id,user_id,muted) VALUES($1,$2,$3) ON CONFLICT(conversation_id,user_id) DO UPDATE SET muted=EXCLUDED.muted,version=conversation_notification_settings.version+1 RETURNING muted,version`,[conversationId,auth.userId,muted]);
  if(!setting)throw new InvariantError('Notification setting write returned no row.');
  return {data:setting,version:setting.version,resourceId:conversationId};
 },async (auth,{request})=>{
  const {conversationId}=request.params as {conversationId:string};
  const {rows:[row]}=await deps.pool.query<{allowed:boolean}>(`SELECT EXISTS(SELECT 1 FROM conversations c JOIN membership_intervals i ON i.conversation_id=c.id WHERE c.id=$1 AND c.kind='GROUP' AND c.dissolved_at IS NULL AND i.user_id=$2 AND i.leave_seq IS NULL) AS allowed`,[conversationId,auth.userId]);
  return row?.allowed??false;
 });
}
