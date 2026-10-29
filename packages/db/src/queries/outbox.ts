import type { PoolClient } from 'pg';

/** In-app notification written in the business transaction; duplicates by (event, recipient) are ignored. */
export async function insertNotification(
  tx: PoolClient,
  n: { eventId: string; recipientId: string; template: string; refs?: Record<string, string> },
): Promise<boolean> {
  const { rowCount } = await tx.query(
    `INSERT INTO notifications (event_id, recipient_id, template, refs) VALUES ($1, $2, $3, $4)
     ON CONFLICT (event_id, recipient_id, channel) DO NOTHING`,
    [n.eventId, n.recipientId, n.template, JSON.stringify(n.refs ?? {})],
  );
  return rowCount === 1;
}

/** Asynchronous side effect (email, or the ETHAN moderation push). Payload must be an allowlisted reference set, never message bodies. */
export async function enqueueOutbox(
  tx: PoolClient,
  o: { eventId: string; recipientId: string | null; channel: 'EMAIL' | 'ETHAN'; template: string; payload?: Record<string, string> },
): Promise<boolean> {
  const { rowCount } = await tx.query(
    `INSERT INTO outbox (event_id, recipient_id, channel, template, payload) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT ON CONSTRAINT outbox_event_recipient_channel_key DO NOTHING`,
    [o.eventId, o.recipientId, o.channel, o.template, JSON.stringify(o.payload ?? {})],
  );
  return rowCount === 1;
}

export type ActorKind = 'USER' | 'SYSTEM' | 'SUPPORT';

const FORBIDDEN_AUDIT_KEYS = /^(otp|code|token|password|secret|body|message|email|refreshToken|accessToken)$/i;

/** Append an audit row. Keys that could carry credentials or private text are refused outright. */
export async function appendAudit(
  tx: PoolClient,
  a: { actorKind: ActorKind; actorId: string | null; action: string; aggregateType: string; aggregateId?: string | null; requestId?: string; reason?: string; payload?: Record<string, string | number | boolean | null> },
): Promise<void> {
  for (const key of Object.keys(a.payload ?? {})) {
    if (FORBIDDEN_AUDIT_KEYS.test(key)) throw new Error(`audit payload key "${key}" is not allowed`);
  }
  await tx.query(
    `INSERT INTO audit_events (actor_kind, actor_id, action, aggregate_type, aggregate_id, request_id, reason, payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [a.actorKind, a.actorId, a.action, a.aggregateType, a.aggregateId ?? null, a.requestId ?? null, a.reason ?? null, JSON.stringify(a.payload ?? {})],
  );
}

/** Append a business fact; the caller allocates aggregate_seq under the aggregate's row lock. */
export async function appendBusinessEvent(
  tx: PoolClient,
  e: { aggregateType: string; aggregateId: string; aggregateSeq: bigint | string; kind: string; effectiveAt: Date; actorKind: ActorKind; actorId: string | null; revision?: bigint | string | null; payload?: Record<string, unknown> },
): Promise<string> {
  const { rows } = await tx.query<{ id: string }>(
    `INSERT INTO business_events (aggregate_type, aggregate_id, aggregate_seq, kind, effective_at, actor_kind, actor_id, revision, payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [e.aggregateType, e.aggregateId, String(e.aggregateSeq), e.kind, e.effectiveAt, e.actorKind, e.actorId, e.revision == null ? null : String(e.revision), JSON.stringify(e.payload ?? {})],
  );
  return rows[0]!.id;
}
