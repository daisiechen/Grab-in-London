import { describe, expect, it } from 'vitest';
import { checkDates, effectiveDates, emptyFilters, parseSearch, queryKey, rangeEnding, toQuery, toSearch } from './filters.ts';

describe('URL filter codec', () => {
  it('round-trips canonical keys, language and snapshot', () => {
    const search = '?from=2026-09-01&to=2026-09-30&areas=soho,camden&sources=user&segments=existing,new&languages=zh,en&sizes=7%2B,2&budgetBands=unknown,0-20&lang=en&snapshot=11111111-1111-4111-8111-111111111111';
    const state = parseSearch(search);
    expect(state.lang).toBe('en');
    expect(state.snapshotId).toBe('11111111-1111-4111-8111-111111111111');
    expect(state.filters).toEqual({
      from: '2026-09-01', to: '2026-09-30', areas: ['camden', 'soho'], sources: ['user'], segments: ['new', 'existing'],
      languages: ['en', 'zh'], sizes: ['2', '7+'], budgetBands: ['0-20', 'unknown'],
    });
    expect(parseSearch(toSearch(state))).toEqual(state);
  });

  it('accepts prototype legacy links (start/end, "all", single values, old labels)', () => {
    const state = parseSearch('?start=2026-09-21&end=2026-10-18&area=all&source=assisted&segment=existing&language=中文 / English&size=group&budget=30');
    expect(state.filters.from).toBe('2026-09-21');
    expect(state.filters.areas).toEqual([]);
    expect(state.filters.sources).toEqual(['assisted']);
    expect(state.filters.segments).toEqual(['existing']);
    expect(state.filters.languages).toEqual(['zh']);
    expect(state.filters.sizes).toEqual(['3', '4', '5', '6']);
    expect(state.filters.budgetBands).toEqual(['0-20', '20-30']);
    expect(parseSearch('?language=English').filters.languages).toEqual(['en']);
    expect(parseSearch('?size=duo').filters.sizes).toEqual(['2']);
    expect(parseSearch('?area=Soho,Kings Cross,bad!').filters.areas).toEqual(['kings-cross', 'soho']);
  });

  it('drops unknown values and invalid or reversed dates', () => {
    const state = parseSearch('?from=2026-10-05&to=2026-10-01&languages=fr,en&sizes=1,9&budgetBands=25&segments=old&snapshot=nope&lang=de');
    expect(state.filters.from).toBe('');
    expect(state.filters.to).toBe('');
    expect(state.filters.languages).toEqual(['en']);
    expect(state.filters.sizes).toEqual([]);
    expect(state.filters.budgetBands).toEqual([]);
    expect(state.filters.segments).toEqual([]);
    expect(state.snapshotId).toBeNull();
    expect(state.lang).toBe('zh');
    expect(parseSearch('?from=2026-02-30&to=2026-03-01').filters.from).toBe('');
  });

  it('serialises only non-empty sets', () => {
    expect(toSearch({ filters: emptyFilters(), lang: 'zh', snapshotId: null })).toBe('?lang=zh');
  });
});

describe('dates against the snapshot', () => {
  it('validates missing, reversed and after-snapshot ranges', () => {
    expect(checkDates('', '2026-10-01', '2026-10-18')).toBe('missing');
    expect(checkDates('2026-10-02', '2026-10-01', '2026-10-18')).toBe('reversed');
    expect(checkDates('2026-10-01', '2026-10-19', '2026-10-18')).toBe('after_snapshot');
    expect(checkDates('2026-10-01', '2026-10-18', '2026-10-18')).toBe('ok');
  });

  it('defaults to 28 inclusive days ending at the snapshot day', () => {
    expect(effectiveDates(emptyFilters(), '2026-10-18')).toEqual({ from: '2026-09-21', to: '2026-10-18' });
    expect(rangeEnding('2026-10-18', 7)).toEqual({ from: '2026-10-12', to: '2026-10-18' });
    // URL dates beyond an older snapshot fall back to that snapshot's default range.
    expect(effectiveDates({ ...emptyFilters(), from: '2026-10-01', to: '2026-10-20' }, '2026-10-18')).toEqual({ from: '2026-09-21', to: '2026-10-18' });
  });
});

describe('contract query', () => {
  it('builds a canonical, order-independent query with comma sets', () => {
    const a = toQuery({ ...emptyFilters(), areas: ['soho', 'camden'], sizes: ['7+', '2'], segments: ['existing', 'new'], languages: ['zh'] }, '2026-10-18');
    expect(a).toEqual({ from: '2026-09-21', to: '2026-10-18', areas: 'camden,soho', sizes: '2,7+', segments: 'new,existing', languages: 'zh' });
    const b = toQuery({ ...emptyFilters(), languages: ['zh'], segments: ['new', 'existing'], sizes: ['2', '7+'], areas: ['camden', 'soho'] }, '2026-10-18');
    expect(queryKey(b)).toBe(queryKey(a));
    expect(toQuery(emptyFilters(), '2026-10-18')).toEqual({ from: '2026-09-21', to: '2026-10-18' });
  });
});
