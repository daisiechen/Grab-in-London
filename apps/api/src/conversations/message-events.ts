import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { MentionInput } from '@fancy/contracts';
import { DomainError } from '../common/errors.ts';

/** Validate against Unicode code points without trimming away submitted offset positions. */
export function validateMentionPositions(body: string, mentions: readonly MentionInput[]): void {
 const points = Array.from(body);
 if (!body.trim() || points.length > 2000 || mentions.length > 100) throw new DomainError('VALIDATION_FAILED', 'Use 1–2000 characters and at most 100 mentions.');
 let end = 0;
 for (const entity of [...mentions].sort((a,b) => a.start-b.start || a.end-b.end)) {
  if (!Number.isSafeInteger(entity.start) || !Number.isSafeInteger(entity.end) || entity.start < end || entity.end <= entity.start || entity.end > points.length) throw new DomainError('VALIDATION_FAILED', 'Mention positions must be valid, non-overlapping code-point ranges.');
  const marker = points.slice(entity.start,entity.end).join('');
  if (entity.kind === 'everyone' ? marker !== '@everyone' : !marker.startsWith('@') || marker.length < 2) throw new DomainError('VALIDATION_FAILED', 'Mention positions must cover the displayed marker.');
  end = entity.end;
 }
}
export async function storedMentions(db: Pool | PoolClient, messageId: string): Promise<MentionInput[]> {
 const { rows } = await db.query<{kind:'user'|'everyone';user_id:string|null;start_offset:number;end_offset:number}>(`SELECT kind,user_id,start_offset,end_offset FROM message_mentions WHERE message_id=$1 ORDER BY ordinal`,[messageId]);
 return rows.map(r => r.kind === 'user' ? {kind:'user',userId:r.user_id!,start:r.start_offset,end:r.end_offset} : {kind:'everyone',start:r.start_offset,end:r.end_offset});
}
export function droppedMentions(input: readonly MentionInput[], effective: readonly MentionInput[]): string[] {
 const retained = new Set(effective.filter(e => e.kind === 'user').map(e => e.userId));
 return [...new Set(input.filter(e => e.kind === 'user' && !retained.has(e.userId)).map(e => (e as Extract<MentionInput,{kind:'user'}>).userId))].sort();
}
/** Caller holds the conversation UPDATE lock; persistence and notifications share the message tx. */
export async function enqueueMessageEvents(db: PoolClient, input: {messageId:string;conversationId:string;senderId:string;createdAt:Date;mentions:readonly MentionInput[]}): Promise<void> {
 const { rows: [conversation] } = await db.query(`SELECT kind,authorization_epoch FROM conversations WHERE id=$1`,[input.conversationId]);
 if (conversation.kind !== 'GROUP') return;
 const { rows: members } = await db.query<{id:string;user_id:string}>(`SELECT i.id,i.user_id FROM membership_intervals i JOIN users u ON u.id=i.user_id AND u.status='ACTIVE' WHERE i.conversation_id=$1 AND i.leave_seq IS NULL AND i.user_id<>$2 ORDER BY i.user_id`,[input.conversationId,input.senderId]);
 const everyone = input.mentions.some(e => e.kind === 'everyone');
 const named = new Set(input.mentions.filter(e => e.kind === 'user').map(e => e.userId));
 for (const member of members) {
  const eventId = randomUUID(), mention = everyone || named.has(member.user_id);
  let notificationId: string | null = null;
  if (mention) {
   const { rows: [notice] } = await db.query(`INSERT INTO notifications(event_id,recipient_id,template,refs,created_at) SELECT $1,$2,'group_mention',jsonb_build_object('conversationId',conversation_id,'messageId',id,'messageSeq',seq::text),$4 FROM messages WHERE id=$3 RETURNING id`,[eventId,member.user_id,input.messageId,input.createdAt]);
   notificationId = notice.id;
  }
  await db.query(`INSERT INTO message_notification_recipients(event_id,message_id,conversation_id,recipient_id,membership_epoch,group_epoch,template,notification_id,created_at,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$9::timestamptz+interval '1 hour')`,[eventId,input.messageId,input.conversationId,member.user_id,member.id,conversation.authorization_epoch,mention?'group_mention':'group_message',notificationId,input.createdAt]);
 }
}
