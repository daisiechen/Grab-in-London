interface Page<T> {
  data: T[];
  page: { hasMore: boolean; nextCursor: string | null };
}

/** Own lists must not lose older requests/conversations at the first server page boundary. */
export async function allPages<T>(fetchPage: (cursor: string | null) => Promise<Page<T>>): Promise<T[]> {
  const items: T[] = [];
  const seen = new Set<string>();
  let cursor: string | null = null;
  for (;;) {
    const response = await fetchPage(cursor);
    items.push(...response.data);
    if (!response.page.hasMore) return items;
    const next = response.page.nextCursor;
    if (!next || seen.has(next)) throw new Error('Pagination did not advance');
    seen.add(next);
    cursor = next;
  }
}
