import { describe, expect, it } from 'vitest';
import { isVisible, visibleRanges, type Interval } from './intervals.ts';

const iv = (joinSeq: number, leaveSeq: number | null): Interval => ({ joinSeq: BigInt(joinSeq), leaveSeq: leaveSeq === null ? null : BigInt(leaveSeq) });

describe('interval visibility (data contract §2)', () => {
  it('excludes the JOIN and LEAVE boundary seqs themselves', () => {
    const intervals = [iv(3, 7)];
    expect([3, 4, 6, 7, 8].map((s) => isVisible(BigInt(s), intervals))).toEqual([false, true, true, false, false]);
  });

  it('unions multiple intervals and skips the gap between leave and rejoin', () => {
    const intervals = [iv(1, 4), iv(9, null)];
    expect([2, 3, 4, 5, 8, 9, 10, 99].map((s) => isVisible(BigInt(s), intervals))).toEqual([true, true, false, false, false, false, true, true]);
    expect(visibleRanges(intervals, 0n, 12n)).toEqual([[2n, 3n], [10n, 12n]]);
  });

  it('starts after the client cursor and never exceeds head', () => {
    expect(visibleRanges([iv(1, 4), iv(9, null)], 2n, 12n)).toEqual([[3n, 3n], [10n, 12n]]);
    expect(visibleRanges([iv(1, 4), iv(9, null)], 3n, 9n)).toEqual([]);
    expect(visibleRanges([iv(1, null)], 0n, 1n)).toEqual([]);
  });
});
