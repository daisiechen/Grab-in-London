import { describe, expect, it } from 'vitest';
import { calculateMetrics, type AttendanceRevision, type Facts, type Filters, type Meal } from './metrics.ts';

/**
 * PATCH-006 P10 / A09 fixed-input hand calculation for attendance coverage.
 * Rule (admin PRD §attendance): per (user, meal) take the latest valid self report and host report;
 * self wins, host fills only a missing self, neither → unknown. A disagreement keeps the self value
 * and counts as recorded. Coverage = recorded / ended roster; unknown stays in the denominator only.
 */
const asOf = '2026-10-20T12:00:00.000Z';
const filters: Filters = { from: null, to: null, areas: [], languages: [], budgetBands: [], sizes: [], sources: [], segments: [], budgetUpToPence: null };
const START = '2026-10-10T12:00:00Z';
const END = '2026-10-10T14:00:00Z';
const meal = (id: string, start = START, extra: Partial<Meal> = {}): Meal => ({ id, host_id: 'h', starts_at: start, closes_at: new Date(Date.parse(start) - 3600000).toISOString(),
  scheduled_end_at: new Date(Date.parse(start) + 7200000).toISOString(), minimum: 2, capacity: 8, budget_max_pence: 3000, languages: ['en'], area_code: 'soho', status: 'COMPLETED', cancel_reason: null, created_at: '2026-09-01T00:00:00Z', ...extra });
const seat = (meal_id: string, user_id: string, seq: number) => ({ meal_id, seq: String(seq), user_id, type: user_id === 'h' ? 'HOST_CONFIRMED' : 'GUEST_CONFIRMED', effective_at: '2026-10-01T00:00:00Z', application_id: null });
const report = (subject_id: string, source: 'SELF' | 'HOST', value: 'present' | 'absent', created_at = '2026-10-10T15:00:00Z', version = '1', actor_id = source === 'SELF' ? subject_id : 'h', meal_id = 'm1'): AttendanceRevision =>
  ({ meal_id, subject_id, source, value, version, created_at, actor_id });

function facts(attendance: AttendanceRevision[], meals: Meal[] = [meal('m1')]): Facts {
  const guests = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6'];
  return { users: ['h', ...guests].map((id) => ({ id, created_at: '2026-09-01T00:00:00Z' })), meals,
    applications: [], experiences: [], surveys: [], events: [], attendance,
    seats: meals.flatMap((m) => ['h', ...guests].map((u, i) => seat(m.id, u, i + 1))) };
}
const statusOf = (r: ReturnType<typeof calculateMetrics>, userId: string) => r.rows.attendance!.find((row) => row.attributes.userId === userId)!.attributes;

describe('A09 coverage: self first, host fills gaps, unknown excluded from the numerator', () => {
  it('matches the hand calculation 5 / 7', () => {
    const result = calculateMetrics(facts([
      report('h', 'SELF', 'present'),                       // h: self present
      report('g1', 'SELF', 'present'), report('g1', 'HOST', 'absent'), // g1: conflict → self present, difference
      report('g2', 'HOST', 'absent'),                      // g2: host fills → absent
      report('g3', 'SELF', 'absent'),                      // g3: self absent
      // g4: no report → unknown
      report('g5', 'SELF', 'present', '2026-10-18T15:00:00Z'), report('g5', 'HOST', 'present'), // g5: self after 7-day window ignored → host present
      report('g6', 'SELF', 'present', '2026-10-10T15:00:00Z', '1', 'g1'), // g6: "self" filed by someone else → ignored → unknown
    ]), filters, asOf);
    // Hand count: recorded h,g1,g2,g3,g5 = 5; ended roster h,g1..g6 = 7.
    expect(result.metrics.coverage).toEqual({ numerator: 5, denominator: 7 });
    expect(statusOf(result, 'g1')).toMatchObject({ attendanceStatus: 'present', source: 'SELF', sourceDifference: true });
    expect(statusOf(result, 'g2')).toMatchObject({ attendanceStatus: 'absent', source: 'HOST', sourceDifference: false });
    expect(statusOf(result, 'g4')).toMatchObject({ attendanceStatus: 'unknown', source: null });
    expect(statusOf(result, 'g5')).toMatchObject({ attendanceStatus: 'present', source: 'HOST' });
    expect(statusOf(result, 'g6')).toMatchObject({ attendanceStatus: 'unknown', source: null });
    expect(result.rows.attendance!.filter((r) => r.inNumerator).map((r) => r.attributes.userId).sort()).toEqual(['g1', 'g2', 'g3', 'g5', 'h']);
    expect(result.rows.attendance!.every((r) => r.inDenominator)).toBe(true);
  });

  it('the latest self revision wins over an earlier one, and still over a host value', () => {
    const result = calculateMetrics(facts([
      report('g1', 'SELF', 'present', '2026-10-10T15:00:00Z', '1'), report('g1', 'SELF', 'absent', '2026-10-11T15:00:00Z', '2'), report('g1', 'HOST', 'present'),
    ]), filters, asOf);
    expect(statusOf(result, 'g1')).toMatchObject({ attendanceStatus: 'absent', source: 'SELF', sourceDifference: true });
    expect(result.metrics.coverage).toEqual({ numerator: 1, denominator: 7 });
  });

  it('a zero denominator stays 0/0 (shown as —), never 0 %', () => {
    const notEnded = calculateMetrics(facts([], [meal('m1', '2026-10-21T12:00:00Z', { status: 'OPEN' })]), filters, asOf);
    expect(notEnded.metrics.coverage).toEqual({ numerator: 0, denominator: 0 });
    const cancelled = calculateMetrics(facts([report('g1', 'SELF', 'present')], [meal('m1', START, { status: 'CANCELLED', cancel_reason: 'insufficient' })]), filters, asOf);
    expect(cancelled.metrics.coverage).toEqual({ numerator: 0, denominator: 0 });
  });

  it('host reports are only accepted from the meal host and inside the 7-day window', () => {
    const result = calculateMetrics(facts([
      report('g1', 'HOST', 'present', '2026-10-10T15:00:00Z', '1', 'g2'), // not the host
      report('g2', 'HOST', 'present', '2026-10-10T13:00:00Z'),           // before scheduled end
      report('g3', 'HOST', 'present', END),                                // exactly at end: inside [end, end+7d)
    ]), filters, asOf);
    expect(statusOf(result, 'g1').attendanceStatus).toBe('unknown');
    expect(statusOf(result, 'g2').attendanceStatus).toBe('unknown');
    expect(statusOf(result, 'g3').attendanceStatus).toBe('present');
    expect(result.metrics.coverage).toEqual({ numerator: 1, denominator: 7 });
  });
});
