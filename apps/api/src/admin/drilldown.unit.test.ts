import { describe, expect, it } from 'vitest';
import { actualDate, sortRows } from './drilldown.ts';
import type { Row } from './metrics.ts';

const row = (rowId: string, attributes: Row['attributes']): Row => ({ rowId, inNumerator: true, inDenominator: true, attributes });
// UUID-like row ids deliberately disagree with the dates, so id order can never pass for date order.
const meals = () => [
  row('a-0001', { mealId: 'm1', startsAt: '2026-10-12T12:00:00Z', area: 'soho' }),
  row('b-0002', { mealId: 'm2', startsAt: '2026-10-15T12:00:00Z', area: 'soho' }),
  row('c-0003', { mealId: 'm3', startsAt: '2026-10-08T12:00:00Z', area: 'kings-cross' }),
  row('d-0004', { mealId: 'm4', startsAt: null, area: 'soho' }),
  row('e-0005', { mealId: 'm5', startsAt: '2026-10-17T12:00:00Z', area: 'soho' }),
];
const ids = (rows: Row[]) => rows.map((r) => r.rowId);

describe('drilldown default order is actual date, newest first (admin PRD)', () => {
  it('defaults to newest actual date first when neither sort nor order is given; undated rows last', () => {
    expect(ids(sortRows(meals(), undefined, undefined))).toEqual(['e-0005', 'b-0002', 'a-0001', 'c-0003', 'd-0004']);
  });
  it('oldest first keeps undated rows last and breaks ties by rowId', () => {
    const rows = [...meals(), row('0-tie', { mealId: 'm6', startsAt: '2026-10-12T12:00:00Z' })];
    expect(ids(sortRows(rows, undefined, 'asc'))).toEqual(['c-0003', '0-tie', 'a-0001', 'b-0002', 'e-0005', 'd-0004']);
  });
  it('an explicit sort field still applies', () => {
    expect(ids(sortRows(meals(), 'area', 'asc'))).toEqual(['c-0003', 'a-0001', 'b-0002', 'd-0004', 'e-0005']);
  });
  it('picks the record\'s own event time before the meal start', () => {
    expect(actualDate(row('x', { appliedAt: '2026-10-01T00:00:00Z', startsAt: '2026-10-20T00:00:00Z' }))).toBe('2026-10-01T00:00:00Z');
    expect(actualDate(row('x', { occurredAt: '2026-10-02T00:00:00Z', receivedAt: '2026-10-03T00:00:00Z' }))).toBe('2026-10-02T00:00:00Z');
    expect(actualDate(row('x', { userId: 'u', week: '2026-10-05' }))).toBe('2026-10-05');
    expect(actualDate(row('x', { userId: 'u' }))).toBeNull();
  });
});
