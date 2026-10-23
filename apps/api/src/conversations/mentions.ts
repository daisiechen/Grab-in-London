import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { GroupMessageInput, MentionInput } from '@fancy/contracts';
import { canonicalJson } from '../common/canonical.ts';
import { DomainError } from '../common/errors.ts';
import { lockActiveActor } from '../common/actor.ts';
import { withTransaction } from '../common/transaction.ts';
import { encodeCursor, decodeCursor } from '../common/cursor.ts';
import { defineRoute } from '../http/routes.ts';
import type { AppDeps } from '../http/context.ts';
import { allocateMessageSeq } from '../membership/intervals.ts';
import { conversation, messageDto } from './routes.ts';
import { droppedMentions, enqueueMessageEvents, storedMentions, validateMentionPositions } from './message-events.ts';

export function registerMentionRoutes(app: FastifyInstance, deps: AppDeps): void {
 defineRoute(app,deps,'sendGroupMessageV2',async ({request,auth}) => {
  const {conversationId} = request.params as {conversationId:string};
  const input = request.body as GroupMessageInput;
  validateMentionPositions(input.body,input.mentions);
  const canonicalMentions = [...input.mentions].sort((a,b) => a.start-b.start || a.end-b.end);
  const hash = createHash('sha256').update(canonicalJson({body:input.body,mentions:canonicalMentions,draftId:input.draftId??null})).digest('hex');
  return withTransaction(deps.pool,async tx => {
   await lockActiveActor(tx,auth!.userId,'update');
   await tx.locks.lock('conversations',[conversationId],'update');
   const c = await conversation(tx.client,conversationId,auth!.userId);
   if (c.kind !== 'GROUP') throw new DomainError('FORBIDDEN','Mentions are available in group conversations.');
   await conversation(tx.client,conversationId,auth!.userId,true);
   if (canonicalMentions.some(e => e.kind === 'everyone') && c.host_id !== auth!.userId) throw new DomainError('FORBIDDEN','Only the host can mention everyone.');
   const { rows: [duplicate] } = await tx.client.query(`SELECT id,conversation_id,mention_payload_hash FROM messages WHERE sender_id=$1 AND client_message_id=$2`,[auth!.userId,input.clientMessageId]);
   if (duplicate) {
    if (duplicate.conversation_id !== conversationId || duplicate.mention_payload_hash !== hash) throw new DomainError('IDEMPOTENCY_CONFLICT','This message id was already used.');
    const mentions = await storedMentions(tx.client,duplicate.id);
    return {data:{...await messageDto(tx.client,duplicate.id),mentions,warnings:{droppedMentionIds:droppedMentions(input.mentions,mentions)}}};
   }
   const { rows: candidates } = await tx.client.query<{user_id:string;display_name:string;active:boolean}>(`SELECT i.user_id,COALESCE(p.display_name,'Fancy member') AS display_name,(i.leave_seq IS NULL AND u.status='ACTIVE') AS active FROM membership_intervals i JOIN users u ON u.id=i.user_id LEFT JOIN profiles p ON p.user_id=i.user_id WHERE i.conversation_id=$1 ORDER BY i.join_seq DESC`,[conversationId]);
   const members = new Map<string,{display_name:string;active:boolean}>();
   for (const member of candidates) if (!members.has(member.user_id)) members.set(member.user_id,member);
   const effective: MentionInput[] = [];
   for (const mention of canonicalMentions) {
    if (mention.kind === 'user') {
     const target = members.get(mention.userId);
     if (!target?.active) continue;
     if (Array.from(input.body).slice(mention.start,mention.end).join('') !== '@'+target.display_name) throw new DomainError('VALIDATION_FAILED','The mention marker does not match that member.');
    }
    effective.push(mention);
   }
   const now = await tx.effectiveNow();
   const seq = await allocateMessageSeq(tx,conversationId,auth!.userId,now);
   const {rows:[message]} = await tx.client.query(`INSERT INTO messages(conversation_id,seq,sender_id,client_message_id,body,created_at,mention_payload_hash) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,[conversationId,String(seq),auth!.userId,input.clientMessageId,input.body,now,hash]);
   for (const [ordinal,entity] of effective.entries()) await tx.client.query(`INSERT INTO message_mentions(message_id,ordinal,kind,user_id,start_offset,end_offset) VALUES($1,$2,$3,$4,$5,$6)`,[message.id,ordinal,entity.kind,entity.kind==='user'?entity.userId:null,entity.start,entity.end]);
   await enqueueMessageEvents(tx.client,{messageId:message.id,conversationId,senderId:auth!.userId,createdAt:now,mentions:effective});
   return {data:{...await messageDto(tx.client,message.id),mentions:effective,warnings:{droppedMentionIds:droppedMentions(input.mentions,effective)}}};
  });
 });
 defineRoute(app,deps,'mentionCandidates',async ({request,auth}) => withTransaction(deps.pool,async tx => {
  const {conversationId} = request.params as {conversationId:string};
  const query = request.query as {q?:string;cursor?:string;limit?:number};
  await lockActiveActor(tx,auth!.userId);
  await tx.locks.lock('conversations',[conversationId],'share');
  const c = await conversation(tx.client,conversationId,auth!.userId);
  if (c.kind !== 'GROUP') throw new DomainError('FORBIDDEN','This is not a group.');
  await conversation(tx.client,conversationId,auth!.userId,true);
  const {rows:[epoch]} = await tx.client.query(`SELECT id FROM membership_intervals WHERE conversation_id=$1 AND user_id=$2 AND leave_seq IS NULL`,[conversationId,auth!.userId]);
  const scope = {actor:auth!.userId,resource:'mention-candidates:'+conversationId,filterHash:query.q??'',epoch:epoch.id+':'+c.version};
  const after = query.cursor ? decodeCursor(deps.config.sessionSecret,scope,query.cursor) : '';
  const limit = query.limit??20;
  const { rows } = await tx.client.query<{key:string;kind:'user'|'everyone';userId:string|null;displayName:string;avatarUrl:null}>(`WITH candidates AS (
   SELECT '1:'||u.id::text AS key,'user'::text AS kind,u.id AS "userId",COALESCE(p.display_name,'Fancy member') AS "displayName",NULL::text AS "avatarUrl" FROM membership_intervals i JOIN users u ON u.id=i.user_id AND u.status='ACTIVE' LEFT JOIN profiles p ON p.user_id=u.id WHERE i.conversation_id=$1 AND i.leave_seq IS NULL
   UNION ALL SELECT '0:everyone','everyone',NULL::uuid,'everyone',NULL::text WHERE $2::boolean
  ) SELECT * FROM candidates WHERE key>$3 AND strpos(lower("displayName"),lower($4))>0 ORDER BY key LIMIT $5`,[conversationId,c.host_id===auth!.userId,after,query.q??'',limit+1]);
  const page = rows.slice(0,limit), hasMore = rows.length>limit;
  return {data:page.map(({kind,userId,displayName,avatarUrl})=>({kind,userId,displayName,avatarUrl})),page:{hasMore,nextCursor:hasMore?encodeCursor(deps.config.sessionSecret,scope,page.at(-1)!.key):null}};
 }));
}
