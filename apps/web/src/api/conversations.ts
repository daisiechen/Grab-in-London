import type { ApiClient, ResponseOf } from '@fancy/client';

export type InboxItem = ResponseOf<'inbox'>['data'][number];
export type Conversation = NonNullable<InboxItem['conversation']>;
export type Message = ResponseOf<'readMessages'>['data'][number];

/**
 * CONTRACT GAP (reported): there is no GET /conversations/:id, so a conversation's metadata
 * (title, version, canSend, dissolved) is found through the user's own inbox pages.
 */
export async function readInbox(client: ApiClient): Promise<InboxItem[]> {
  const items: InboxItem[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined;
  for (;;) {
    const res = await client.call('inbox', { query: cursor ? { cursor } : {} });
    items.push(...res.data);
    if (!res.page.hasMore) return items;
    if (!res.page.nextCursor || seen.has(res.page.nextCursor)) throw new Error('Pagination did not advance');
    seen.add(res.page.nextCursor);
    cursor = res.page.nextCursor;
  }
}

export async function findConversation(client: ApiClient, conversationId: string): Promise<Conversation | null> {
  return (await readInbox(client)).find(item => item.conversation?.id === conversationId)?.conversation ?? null;
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
