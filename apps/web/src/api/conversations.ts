import type { ApiClient, ResponseOf } from '@fancy/client';

export type InboxItem = ResponseOf<'inbox'>['data'][number];
export type Conversation = NonNullable<InboxItem['conversation']>;
export type Message = ResponseOf<'readMessages'>['data'][number];

/**
 * CONTRACT GAP (reported): there is no GET /conversations/:id, so a conversation's metadata
 * (title, version, canSend, dissolved) is found through the user's own inbox pages.
 */
export async function findConversation(client: ApiClient, conversationId: string, maxPages = 5): Promise<Conversation | null> {
  let cursor: string | undefined;
  for (let i = 0; i < maxPages; i++) {
    const res = await client.call('inbox', { query: cursor ? { cursor } : {} });
    const hit = res.data.find((item) => item.conversation?.id === conversationId)?.conversation;
    if (hit) return hit;
    if (!res.page.nextCursor) return null;
    cursor = res.page.nextCursor;
  }
  return null;
}

const seqOf = (m: Pick<Message, 'seq'>) => BigInt(m.seq);

/** Merge by id and order by the server's conversation sequence (string decimal, compared as bigint). */
export function mergeMessages(current: readonly Message[], incoming: readonly Message[]): Message[] {
  const byId = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => (seqOf(a) < seqOf(b) ? -1 : seqOf(a) > seqOf(b) ? 1 : 0));
}

export function maxSeq(...values: Array<string | null | undefined>): string | null {
  let best: bigint | null = null;
  for (const v of values) if (v != null && (best === null || BigInt(v) > best)) best = BigInt(v);
  return best === null ? null : best.toString();
}
