import type { Pool, PoolClient } from 'pg';
import { avatarUrl } from '../profiles/avatar.ts';
import type { FastifyInstance } from 'fastify';
import { DomainError } from '../common/errors.ts';
import { lockActiveActor } from '../common/actor.ts';
import { withTransaction } from '../common/transaction.ts';
import { encodeCursor, decodeCursor } from '../common/cursor.ts';
import { defineRoute, defineWrite } from '../http/routes.ts';
import type { AppDeps } from '../http/context.ts';
import { allocateMessageSeq, dissolveConversation, leaveConversation } from '../membership/intervals.ts';
import { assertDirectAuthorized, directLockPlan } from '../connections/service.ts';
import { londonTime } from '../meals/time.ts';
import { applicationDto } from '../meals/read.ts';

interface ConversationRow { id: string; kind: 'GROUP' | 'DIRECT'; meal_id: string | null; pair_id: string | null; version: string; head: string; dissolved_at: Date | null; title: string | null; host_id: string | null; avatar_name: string | null; avatar_image_id: string | null }
async function conversation(db: Pool | PoolClient, id: string, userId: string, live = false): Promise<ConversationRow> {
  const { rows: [row] } = await db.query<ConversationRow>(`SELECT c.*,CASE WHEN c.kind='DIRECT' THEN
      CASE WHEN peer.status='ACTIVE' THEN COALESCE(profile.display_name,'Fancy member') ELSE 'Deleted member' END
      ELSE m.title END AS title,m.host_id,
      CASE WHEN c.kind='DIRECT' THEN CASE WHEN peer.status='ACTIVE' THEN COALESCE(profile.display_name,'Fancy member') END
      WHEN host.status='ACTIVE' THEN COALESCE(host_profile.display_name,'Fancy member') END AS avatar_name,
      CASE WHEN c.kind='DIRECT' THEN CASE WHEN peer.status='ACTIVE' AND profile.moderation_hidden_at IS NULL THEN profile.avatar_image_id END WHEN host.status='ACTIVE' AND host_profile.moderation_hidden_at IS NULL THEN host_profile.avatar_image_id END AS avatar_image_id
    FROM conversations c LEFT JOIN meals m ON m.id=c.meal_id
    LEFT JOIN users host ON host.id=m.host_id LEFT JOIN profiles host_profile ON host_profile.user_id=host.id
    LEFT JOIN user_pairs pair ON c.kind='DIRECT' AND pair.id=c.pair_id AND $2 IN(pair.low_user,pair.high_user)
    LEFT JOIN users peer ON peer.id=CASE WHEN pair.low_user=$2 THEN pair.high_user WHEN pair.high_user=$2 THEN pair.low_user END
    LEFT JOIN profiles profile ON profile.user_id=peer.id AND peer.status='ACTIVE'
    WHERE c.id = $1 AND EXISTS (SELECT 1 FROM membership_intervals i WHERE i.conversation_id = c.id AND i.user_id = $2)`, [id, userId]);
  if (!row) throw new DomainError('NOT_FOUND', 'Conversation not found.');
  if (live) {
    const { rows } = await db.query(`SELECT 1 FROM membership_intervals WHERE conversation_id = $1 AND user_id = $2 AND leave_seq IS NULL`, [id, userId]);
    if (row.dissolved_at || !rows.length) throw new DomainError('FORBIDDEN', 'This conversation is read-only.');
    if (row.kind === 'DIRECT') await assertDirectAuthorized(db, row.pair_id!, userId);
  }
  return row;
}
const dto = (c: ConversationRow, canSend: boolean) => ({ id: c.id, version: c.version, kind: c.kind, mealId: c.meal_id, title: c.title ?? 'Conversation', canSend, dissolved: !!c.dissolved_at, head: c.head,
  avatar: c.avatar_name ? { displayName: c.avatar_name.slice(0, 40), avatarUrl: avatarUrl(c.avatar_image_id) } : null });
const visible = `EXISTS (SELECT 1 FROM membership_intervals i WHERE i.conversation_id = msg.conversation_id AND i.user_id = $2 AND i.join_seq < msg.seq AND (i.leave_seq IS NULL OR msg.seq < i.leave_seq))`;
/**
 * Message projection for one viewer. A sender who is no longer ACTIVE (deleted or suspended) is masked
 * entirely; a moderation limit masks the text for everyone; a message or member the viewer reported is
 * masked for that viewer only (moderation policy).
 */
async function messageDto(db: Pool | PoolClient, id: string, viewerId: string) {
  const { rows: [r] } = await db.query(`SELECT msg.*, u.status, p.display_name, p.avatar_image_id, p.bio, p.languages, p.interests,
      p.moderation_hidden_at IS NOT NULL AS profile_limited,
      EXISTS(SELECT 1 FROM reports rp WHERE rp.reporter_id = $2 AND ((rp.target_type = 'MESSAGE' AND rp.target_id = msg.id) OR (rp.target_type = 'USER' AND rp.target_id = msg.sender_id))) AS reported_by_viewer,
      EXISTS(SELECT 1 FROM reports rp WHERE rp.reporter_id = $2 AND rp.target_type = 'USER' AND rp.target_id = msg.sender_id) AS sender_reported_by_viewer
    FROM messages msg JOIN users u ON u.id = msg.sender_id LEFT JOIN profiles p ON p.user_id = u.id WHERE msg.id = $1`, [id, viewerId]);
  const senderMasked = r.status !== 'ACTIVE';
  const redacted = r.redacted || senderMasked || r.moderation_hidden_at !== null || r.reported_by_viewer;
  const profileHidden = senderMasked || r.profile_limited || r.sender_reported_by_viewer;
  return { id: r.id, seq: r.seq, body: redacted ? '[Message unavailable]' : r.body, redacted, createdAt: r.created_at.toISOString(), sender: { id: r.sender_id, displayName: senderMasked ? 'Former member' : r.display_name ?? 'Member', avatarUrl: profileHidden ? null : avatarUrl(r.avatar_image_id), bio: profileHidden ? null : r.bio, languages: senderMasked ? [] : r.languages ?? [], interests: senderMasked ? [] : r.interests ?? [] } };
}
export function registerConversationRoutes(app: FastifyInstance, deps: AppDeps) {
  defineRoute(app,deps,'markConversationRead',async({request,auth})=>{
    const {conversationId}=request.params as {conversationId:string};
    const {throughSeq}=request.body as {throughSeq:string};
    await withTransaction(deps.pool,async(tx)=>{
      await lockActiveActor(tx,auth!.userId);
      await tx.locks.lock('conversations',[conversationId],'share');
      const c=await conversation(tx.client,conversationId,auth!.userId);
      if(BigInt(throughSeq)>BigInt(c.head))throw new DomainError('VALIDATION_FAILED','That message position is not available.');
      await tx.client.query(`INSERT INTO conversation_reads(conversation_id,user_id,through_seq) VALUES($1,$2,$3) ON CONFLICT(conversation_id,user_id) DO UPDATE SET through_seq=greatest(conversation_reads.through_seq,EXCLUDED.through_seq)`,[conversationId,auth!.userId,throughSeq]);
    });return{status:204};
  });
  defineRoute(app, deps, 'inbox', async ({ request, auth }) => {
    const q = request.query as { cursor?: string; limit?: number };
    const { rows: [privacy] } = await deps.pool.query(`SELECT epoch FROM privacy_control WHERE id = 1`);
    const scope = { actor: auth!.userId, resource: 'inbox', filterHash: 'all', epoch: String(privacy.epoch) };
    let boundary: [string, string, string] | null = null;
    if (q.cursor) {
      try {
        const parsed = JSON.parse(decodeCursor(deps.config.sessionSecret, scope, q.cursor));
        if (!Array.isArray(parsed) || parsed.length !== 3 || typeof parsed[0] !== 'string' || !Number.isFinite(Date.parse(parsed[0])) || !/^[0-9a-f-]{36}$/.test(parsed[1]) || !['conversation','application'].includes(parsed[2])) throw new Error();
        boundary = parsed as [string, string, string];
      } catch { throw new DomainError('VALIDATION_FAILED', 'Invalid inbox page.'); }
    }
    const limit = q.limit ?? 20;
    // Conversations sort by the latest event this member can see (their join, a message, a leave),
    // applications by creation: a newly joined or busy chat rises to the top.
    const { rows } = await deps.pool.query<{id:string;kind:string;cursor_created_at:string}>(`WITH items AS (
      SELECT c.id,'conversation'::text AS kind,activity.at AS created_at FROM conversations c
        CROSS JOIN LATERAL (SELECT max(e.effective_at) AS at FROM conversation_events e JOIN membership_intervals i ON i.conversation_id=e.conversation_id AND i.user_id=$1
          WHERE e.conversation_id=c.id AND e.seq>=i.join_seq AND (i.leave_seq IS NULL OR e.seq<=i.leave_seq)) activity
        WHERE activity.at IS NOT NULL
      UNION ALL SELECT a.id,'application'::text,a.created_at FROM applications a WHERE a.user_id=$1 AND NOT EXISTS(SELECT 1 FROM conversations c JOIN membership_intervals i ON i.conversation_id=c.id AND i.user_id=$1 WHERE c.meal_id=a.meal_id)
      ) SELECT id,kind,created_at::text AS cursor_created_at FROM items
      WHERE ($2::timestamptz IS NULL OR (created_at,id,kind)<($2::timestamptz,$3::uuid,$4::text)) ORDER BY created_at DESC,id DESC,kind DESC LIMIT $5`, [auth!.userId, boundary?.[0] ?? null, boundary?.[1] ?? null, boundary?.[2] ?? null, limit + 1]);
    const page = rows.slice(0, limit);
    const data = await Promise.all(page.map(async (item) => {
      if(item.kind==='application'){
        const {rows:[application]}=await deps.pool.query(`SELECT * FROM applications WHERE id=$1 AND user_id=$2`,[item.id,auth!.userId]);
        const {rows:[meal]}=await deps.pool.query(`SELECT m.title,m.starts_at,u.status,p.display_name FROM meals m JOIN users u ON u.id=m.host_id LEFT JOIN profiles p ON p.user_id=u.id WHERE m.id=$1`,[application.meal_id]);
        const applicationMeal={title:meal.status==='ACTIVE'?meal.title:'Meal unavailable',startsAt:londonTime(meal.starts_at),hostDisplayName:meal.status==='ACTIVE'?(meal.display_name??'Fancy member'):'Deleted member'};
        return {application:await applicationDto(deps.pool,application,true),applicationMeal,lastMessage:null,unreadCount:0};
      }
      const c=await conversation(deps.pool,item.id,auth!.userId);
      const {rows:[current]}=await deps.pool.query(`SELECT EXISTS(SELECT 1 FROM membership_intervals WHERE conversation_id=$1 AND user_id=$2 AND leave_seq IS NULL) AS active`,[c.id,auth!.userId]);
      const { rows: [last] } = await deps.pool.query(`SELECT msg.id FROM messages msg WHERE msg.conversation_id=$1 AND ${visible} ORDER BY msg.seq DESC LIMIT 1`, [c.id, auth!.userId]);
      const { rows: [count] } = await deps.pool.query(`SELECT count(*)::int AS n FROM messages msg WHERE msg.conversation_id=$1 AND msg.sender_id<>$2 AND ${visible} AND msg.seq>COALESCE((SELECT through_seq FROM conversation_reads WHERE conversation_id=$1 AND user_id=$2),0)`, [c.id, auth!.userId]);
      const message = last ? await messageDto(deps.pool, last.id, auth!.userId) : null;
      let canSend = Boolean(current.active) && !c.dissolved_at;
      if (canSend && c.kind === 'DIRECT') { try { await assertDirectAuthorized(deps.pool,c.pair_id!,auth!.userId); } catch(error) { if (!(error instanceof DomainError)) throw error; canSend=false; } }
      return { conversation: dto(c, canSend), lastMessage: message ? { seq: message.seq, preview: message.body.slice(0,200), createdAt: message.createdAt } : null, unreadCount: count.n };
    }));
    const last = page.at(-1);
    return { data, page: { hasMore: rows.length > limit, nextCursor: rows.length > limit && last ? encodeCursor(deps.config.sessionSecret, scope, JSON.stringify([last.cursor_created_at,last.id,last.kind])) : null } };
  });
  defineRoute(app, deps, 'sendMessage', async ({ request, auth }) => {
    const { conversationId } = request.params as { conversationId: string };
    const input = request.body as { body: string; clientMessageId: string };
    const body = input.body.trim();
    if (!body || body.length > 2000) throw new DomainError('VALIDATION_FAILED', 'Use 1–2000 characters.');
    return withTransaction(deps.pool, async (tx) => {
      const hint = await conversation(tx.client, conversationId, auth!.userId);
      if (hint.kind === 'DIRECT') {
        const plan = await directLockPlan(tx.client, hint.pair_id!);
        const users = await tx.locks.lock<{ id: string; status: string }>('users',plan.userIds,'update','id,status');
        if (users.some(u => u.status !== 'ACTIVE')) throw new DomainError('CONNECTION_NOT_AUTHORIZED','This conversation is read-only.');
        await tx.locks.lock('meals',plan.mealIds,'share');
        await tx.locks.lock('user_pairs',[hint.pair_id!],'update');
      } else await lockActiveActor(tx, auth!.userId, 'update');
      await tx.locks.lock('conversations', [conversationId], 'update');
      await conversation(tx.client, conversationId, auth!.userId, true);
      const { rows: [duplicate] } = await tx.client.query(`SELECT id, body, conversation_id FROM messages WHERE sender_id = $1 AND client_message_id = $2`, [auth!.userId, input.clientMessageId]);
      if (duplicate) {
        if (duplicate.body !== body || duplicate.conversation_id !== conversationId) throw new DomainError('IDEMPOTENCY_CONFLICT', 'This message id was already used.');
        return { data: await messageDto(tx.client, duplicate.id, auth!.userId) };
      }
      const now = await tx.effectiveNow();
      const seq = await allocateMessageSeq(tx, conversationId, auth!.userId, now);
      const { rows: [row] } = await tx.client.query(`INSERT INTO messages (conversation_id,seq,sender_id,client_message_id,body,created_at) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`, [conversationId, String(seq), auth!.userId, input.clientMessageId, body, now]);
      return { data: await messageDto(tx.client, row.id, auth!.userId) };
    });
  });
  defineRoute(app, deps, 'readMessages', async ({ request, auth }) => {
    const { conversationId } = request.params as { conversationId: string };
    const q = request.query as { mode: 'HISTORY' | 'LIVE'; afterSeq?: string; cursor?: string; limit?: number };
    const c = await conversation(deps.pool, conversationId, auth!.userId, q.mode === 'LIVE');
    const { rows: [epoch] } = await deps.pool.query(`SELECT count(*)::text || ':' || COALESCE(max(leave_seq)::text,'open') AS value FROM membership_intervals WHERE conversation_id = $1 AND user_id = $2`, [conversationId, auth!.userId]);
    const scope = { actor: auth!.userId, resource: `messages:${conversationId}`, filterHash: q.mode, epoch: `${epoch.value}:${c.dissolved_at?.toISOString() ?? 'active'}` };
    const key = q.cursor ? decodeCursor(deps.config.sessionSecret, scope, q.cursor) : q.mode === 'LIVE' ? q.afterSeq ?? '0' : String(BigInt(c.head) + 1n);
    if (!/^\d{1,19}$/.test(key)) throw new DomainError('VALIDATION_FAILED', 'Invalid message position.');
    const limit = q.limit ?? 20;
    const { rows } = await deps.pool.query<{ id: string; seq: string }>(`SELECT msg.id, msg.seq FROM messages msg WHERE msg.conversation_id = $1 AND ${visible}
      AND msg.seq ${q.mode === 'LIVE' ? '>' : '<'} $3 AND msg.seq <= $4 ORDER BY msg.seq ${q.mode === 'LIVE' ? 'ASC' : 'DESC'} LIMIT $5`, [conversationId, auth!.userId, key, c.head, limit + 1]);
    const hasMore = rows.length > limit; const page = rows.slice(0, limit); const last = page.at(-1)?.seq ?? key;
    const data = await Promise.all(page.map((r) => messageDto(deps.pool, r.id, auth!.userId)));
    return { data, page: { hasMore, nextCursor: hasMore ? encodeCursor(deps.config.sessionSecret, scope, last) : null, scannedThroughSeq: q.mode === 'LIVE' && hasMore ? last : c.head } };
  });
  for (const op of ['leaveGroup', 'dissolveGroup'] as const) defineWrite(app, deps, op, async ({ request, auth, ifMatch }, tx) => {
    const { conversationId } = request.params as { conversationId: string };
    await lockActiveActor(tx, auth.userId);
    await tx.locks.lock('conversations', [conversationId], 'update');
    const c = await conversation(tx.client, conversationId, auth.userId);
    if (c.kind !== 'GROUP') throw new DomainError('FORBIDDEN', 'This is not a group.');
    if (c.version !== ifMatch) throw new DomainError('VERSION_CONFLICT', 'This conversation changed.', { currentVersion: c.version });
    if (op === 'dissolveGroup' && c.host_id !== auth.userId) throw new DomainError('FORBIDDEN', 'Only the host can dissolve the group.');
    const now = await tx.effectiveNow();
    if (op === 'leaveGroup') await leaveConversation(tx, conversationId, auth.userId, now);
    else await dissolveConversation(tx, conversationId, auth.userId, now);
    const updated = await conversation(tx.client, conversationId, auth.userId);
    return { data: dto(updated, false), version: updated.version, resourceId: conversationId };
  });
}
