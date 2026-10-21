/**
 * Conversation sequence and membership interval kernel (T30). Every boundary (JOIN, LEAVE,
 * DISSOLVE, MESSAGE) takes the next seq under the conversation row lock, so seq order is commit
 * order and readers never skip an uncommitted lower seq. Group access is granted/revoked in the
 * same transaction as the seat change that causes it — never via the outbox.
 */
import type { Tx } from '../common/transaction.ts';
import { DomainError } from '../common/errors.ts';
import { registerLockTable } from '../common/locks.ts';

registerLockTable('conversations', 'conversation');

export type ConversationKind = 'GROUP' | 'DIRECT';
export type BoundaryKind = 'JOIN' | 'LEAVE' | 'DISSOLVE' | 'MESSAGE';

export interface Interval {
  joinSeq: bigint;
  leaveSeq: bigint | null;
}

interface ConversationRow {
  id: string;
  kind: ConversationKind;
  head: string;
  dissolved_at: Date | null;
  version: string;
}

async function lockConversation(tx: Tx, conversationId: string): Promise<ConversationRow> {
  const [row] = await tx.locks.lock<ConversationRow & { id: string }>('conversations', [conversationId], 'update', 'id, kind, head, dissolved_at, version');
  if (!row) throw new DomainError('NOT_FOUND', 'Conversation not found.');
  return row;
}

async function allocate(tx: Tx, conversationId: string, kind: BoundaryKind, actorId: string | null, effectiveAt: Date): Promise<bigint> {
  const { rows } = await tx.client.query<{ head: string }>(
    `UPDATE conversations SET head = head + 1, version = version + CASE WHEN $2 = 'MESSAGE' THEN 0 ELSE 1 END
      WHERE id = $1 RETURNING head`,
    [conversationId, kind],
  );
  const seq = BigInt(rows[0]!.head);
  await tx.client.query(
    `INSERT INTO conversation_events (conversation_id, seq, kind, actor_id, effective_at) VALUES ($1, $2, $3, $4, $5)`,
    [conversationId, String(seq), kind, actorId, effectiveAt],
  );
  return seq;
}

async function openInterval(tx: Tx, conversationId: string, userId: string): Promise<{ id: string; join_seq: string } | null> {
  const { rows } = await tx.client.query<{ id: string; join_seq: string }>(
    `SELECT id, join_seq FROM membership_intervals WHERE conversation_id = $1 AND user_id = $2 AND leave_seq IS NULL`,
    [conversationId, userId],
  );
  return rows[0] ?? null;
}

/**
 * Creates the meal's group with the host already joined (seq 1). Called by publishMeal in the
 * same transaction; a new conversation row needs no lock.
 */
export async function createGroupConversation(tx: Tx, o: { mealId: string; hostId: string; effectiveAt: Date }): Promise<{ conversationId: string; joinSeq: bigint }> {
  const { rows } = await tx.client.query<{ id: string }>(`INSERT INTO conversations (kind, meal_id) VALUES ('GROUP', $1) RETURNING id`, [o.mealId]);
  const conversationId = rows[0]!.id;
  const joinSeq = await allocate(tx, conversationId, 'JOIN', o.hostId, o.effectiveAt);
  await tx.client.query(`INSERT INTO membership_intervals (conversation_id, user_id, join_seq) VALUES ($1, $2, $3)`, [conversationId, o.hostId, String(joinSeq)]);
  return { conversationId, joinSeq };
}

/** Opens a membership interval; an already-open member is a no-op (no duplicate JOIN). */
export async function joinConversation(tx: Tx, conversationId: string, userId: string, effectiveAt: Date): Promise<{ joinSeq: bigint; created: boolean }> {
  const conversation = await lockConversation(tx, conversationId);
  if (conversation.dissolved_at) throw new DomainError('STATE_CONFLICT', 'This group has been dissolved.');
  const open = await openInterval(tx, conversationId, userId);
  if (open) return { joinSeq: BigInt(open.join_seq), created: false };
  const joinSeq = await allocate(tx, conversationId, 'JOIN', userId, effectiveAt);
  await tx.client.query(`INSERT INTO membership_intervals (conversation_id, user_id, join_seq) VALUES ($1, $2, $3)`, [conversationId, userId, String(joinSeq)]);
  return { joinSeq, created: true };
}

/** Closes the member's open interval; leaving twice is a no-op. Seats are not touched. */
export async function leaveConversation(tx: Tx, conversationId: string, userId: string, effectiveAt: Date): Promise<{ leaveSeq: bigint | null }> {
  const conversation = await lockConversation(tx, conversationId);
  const open = await openInterval(tx, conversationId, userId);
  if (!open || conversation.dissolved_at) return { leaveSeq: null };
  const leaveSeq = await allocate(tx, conversationId, 'LEAVE', userId, effectiveAt);
  await tx.client.query(`UPDATE membership_intervals SET leave_seq = $2 WHERE id = $1`, [open.id, String(leaveSeq)]);
  return { leaveSeq };
}

/** Host dissolves the group: one DISSOLVE seq closes every open interval; it never reopens. */
export async function dissolveConversation(tx: Tx, conversationId: string, actorId: string, effectiveAt: Date): Promise<{ dissolveSeq: bigint; alreadyDissolved: boolean }> {
  const conversation = await lockConversation(tx, conversationId);
  if (conversation.kind !== 'GROUP') throw new DomainError('FORBIDDEN', 'Only group conversations can be dissolved.');
  if (conversation.dissolved_at) {
    const { rows } = await tx.client.query<{ dissolved_seq: string }>(`SELECT dissolved_seq FROM conversations WHERE id = $1`, [conversationId]);
    return { dissolveSeq: BigInt(rows[0]!.dissolved_seq), alreadyDissolved: true };
  }
  const dissolveSeq = await allocate(tx, conversationId, 'DISSOLVE', actorId, effectiveAt);
  await tx.client.query(`UPDATE membership_intervals SET leave_seq = $2 WHERE conversation_id = $1 AND leave_seq IS NULL`, [conversationId, String(dissolveSeq)]);
  await tx.client.query(`UPDATE conversations SET dissolved_at = $2, dissolved_seq = $3 WHERE id = $1`, [conversationId, effectiveAt, String(dissolveSeq)]);
  return { dissolveSeq, alreadyDissolved: false };
}

/**
 * Allocates the seq for a new message by a current member (T12 inserts the body with it). Meal
 * cancellation or end does not stop sending; dissolution and leaving do.
 */
export async function allocateMessageSeq(tx: Tx, conversationId: string, senderId: string, effectiveAt: Date): Promise<bigint> {
  const conversation = await lockConversation(tx, conversationId);
  if (conversation.dissolved_at) throw new DomainError('FORBIDDEN', 'This group is read-only.');
  if (!(await openInterval(tx, conversationId, senderId))) throw new DomainError('FORBIDDEN', 'You are not a current member of this conversation.');
  return allocate(tx, conversationId, 'MESSAGE', senderId, effectiveAt);
}

/** All intervals ever granted to the user (history stays readable after leaving). */
export async function intervalsFor(client: Tx['client'], conversationId: string, userId: string): Promise<Interval[]> {
  const { rows } = await client.query<{ join_seq: string; leave_seq: string | null }>(
    `SELECT join_seq, leave_seq FROM membership_intervals WHERE conversation_id = $1 AND user_id = $2 ORDER BY join_seq`,
    [conversationId, userId],
  );
  return rows.map((r) => ({ joinSeq: BigInt(r.join_seq), leaveSeq: r.leave_seq === null ? null : BigInt(r.leave_seq) }));
}

/** Data contract §2: visible iff some interval has join_seq < seq and (open or seq < leave_seq). */
export const isVisible = (seq: bigint, intervals: readonly Interval[]): boolean =>
  intervals.some((i) => i.joinSeq < seq && (i.leaveSeq === null || seq < i.leaveSeq));

/**
 * Visible seq ranges (inclusive) after `afterSeq` up to `head`, skipping unauthorised gaps; the
 * caller reports scannedThroughSeq = head so clients never rescan a gap.
 */
export function visibleRanges(intervals: readonly Interval[], afterSeq: bigint, head: bigint): Array<[bigint, bigint]> {
  const ranges: Array<[bigint, bigint]> = [];
  for (const i of [...intervals].sort((a, b) => (a.joinSeq < b.joinSeq ? -1 : 1))) {
    const from = (i.joinSeq + 1n > afterSeq + 1n ? i.joinSeq + 1n : afterSeq + 1n);
    const to = i.leaveSeq === null ? head : (i.leaveSeq - 1n < head ? i.leaveSeq - 1n : head);
    if (from <= to) ranges.push([from, to]);
  }
  return ranges;
}
