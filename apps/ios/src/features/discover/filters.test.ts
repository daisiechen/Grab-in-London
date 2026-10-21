import { activeFilterCount, emptyFilters, toQuery } from './filters.ts';

describe('discover query (API §6, QA-DISCOVERY-002)', () => {
  it('Any = no parameter', () => {
    expect(toQuery(emptyFilters())).toEqual({});
    expect(activeFilterCount(emptyFilters())).toBe(0);
  });
  it('dates OR as a sorted unique comma list, ANDed with other dimensions', () => {
    const q = toQuery({ ...emptyFilters(), dates: ['2026-10-27', '2026-10-25', '2026-10-27'], tableSizes: [4, 2], languages: ['zh', 'en'], timeOfDay: 'dinner', budgetMaxPence: 3000, keyword: '  ramen ' }, 'cur');
    expect(q).toEqual({ dates: '2026-10-25,2026-10-27', tableSizes: '2,4', languages: 'en,zh', timeOfDay: 'dinner', budgetMaxPence: 3000, keyword: 'ramen', cursor: 'cur' });
  });
});
