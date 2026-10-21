import { allPages } from './pages.ts';

describe('cursor traversal', () => {
  it('retains items beyond the first page without changing the query cursor context', async () => {
    const cursors: Array<string | null> = [];
    const items = await allPages(async (cursor) => {
      cursors.push(cursor);
      return cursor === null
        ? { data: ['first'], page: { hasMore: true, nextCursor: 'next' } }
        : { data: ['last'], page: { hasMore: false, nextCursor: null } };
    });
    expect(items).toEqual(['first', 'last']);
    expect(cursors).toEqual([null, 'next']);
  });

  it('rejects nonadvancing cursors instead of looping or silently truncating data', async () => {
    await expect(allPages(async () => ({ data: [], page: { hasMore: true, nextCursor: 'same' } }))).rejects.toThrow('Pagination did not advance');
  });
});
