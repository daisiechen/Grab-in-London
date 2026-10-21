import { describe, expect, it } from 'vitest';
import { DEFAULT_RETURN, safeReturnTo, signInPath } from './returnTo.ts';
import { budgetRange, formatPence, isLondonTransitionDate, longDate, zonedLabel } from './format.ts';
import { clearAllPrivateState, clearDraft, loadDraft, saveDraft } from './drafts.ts';

describe('safeReturnTo', () => {
  it.each(['/meals/abc/apply', '/discover?dates=2026-10-23', '/profile/edit'])('keeps allow-listed %s', (t) => {
    expect(safeReturnTo(t)).toBe(t);
  });
  it.each(['//evil.example', 'https://evil.example/meals', '/\\evil', '/admin', '/meals/../admin', 'javascript:alert(1)', '', null])(
    'rejects %s', (t) => { expect(safeReturnTo(t)).toBe(DEFAULT_RETURN); });
  it('encodes the target into the sign-in path', () => {
    expect(signInPath('/meals/1/apply')).toBe('/sign-in?returnTo=%2Fmeals%2F1%2Fapply');
    expect(signInPath('//evil')).toBe('/sign-in?returnTo=%2Fdiscover');
  });
});

describe('format', () => {
  it('formats pence as GBP like the prototype', () => {
    expect(formatPence(2500)).toBe('£25');
    expect(formatPence(2550)).toBe('£25.50');
    expect(budgetRange(2500, 4000)).toBe('£25–40');
    expect(budgetRange(3000, 3000)).toBe('£30');
  });
  it('renders London calendar dates without the device time zone', () => {
    expect(longDate('2026-10-23')).toBe('Fri 23 Oct');
  });
  it('labels BST/GMT only on clock-change days', () => {
    expect(isLondonTransitionDate('2026-10-25')).toBe(true);
    expect(isLondonTransitionDate('2026-03-29')).toBe(true);
    expect(isLondonTransitionDate('2026-10-24')).toBe(false);
    expect(zonedLabel({ localDate: '2026-10-25', localTime: '01:30', utcOffsetMinutes: 0 })).toBe('Sun 25 Oct · 01:30 GMT London time');
    expect(zonedLabel({ localDate: '2026-10-23', localTime: '19:30', utcOffsetMinutes: 60 })).toBe('Fri 23 Oct · 19:30 London time');
  });
});

describe('drafts', () => {
  it('round-trips and clears all private state', () => {
    saveDraft('apply:m1', { intro: 'hi' });
    saveDraft('create', { title: 't' });
    expect(loadDraft<{ intro: string }>('apply:m1')?.intro).toBe('hi');
    clearDraft('apply:m1');
    expect(loadDraft('apply:m1')).toBeNull();
    sessionStorage.setItem('unrelated', 'keep');
    clearAllPrivateState();
    expect(loadDraft('create')).toBeNull();
    expect(sessionStorage.getItem('unrelated')).toBe('keep');
  });
});
