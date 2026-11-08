import { CUISINES, DIETARY, LANGUAGES, MOODS } from '@fancy/contracts';
import type { ResponseOf } from '@fancy/client';
import { longDate, offsetLabel } from '../../lib/london.ts';

export type Meal = ResponseOf<'getMeal'>['data']['meal'];
export type Application = NonNullable<ResponseOf<'getMeal'>['data']['myApplication']>;

export const money = (pence: number) => `£${pence % 100 === 0 ? pence / 100 : (pence / 100).toFixed(2)}`;

export const budgetLabel = (m: Pick<Meal, 'budgetMinPence' | 'budgetMaxPence'>) =>
  m.budgetMinPence === m.budgetMaxPence ? money(m.budgetMinPence) : `${money(m.budgetMinPence)}–${money(m.budgetMaxPence)}`;

/** “Sat 25 Oct · 19:00 BST” — London wall time with its explicit offset label. */
export const whenLabel = (t: Meal['startsAt']) => `${longDate(t.localDate)} · ${t.localTime} ${offsetLabel(t.utcOffsetMinutes)}`;

/** Card form used by demo meal cards: “Fri 23 Oct · 19:00”. */
export const cardWhenLabel = (t: Meal['startsAt']) => `${longDate(t.localDate)} · ${t.localTime}`;
/** Card budget: “£25–35”, as in the demo. */
export const cardBudgetLabel = (m: Pick<Meal, 'budgetMinPence' | 'budgetMaxPence'>) =>
  m.budgetMinPence === m.budgetMaxPence ? money(m.budgetMinPence) : `${money(m.budgetMinPence)}–${money(m.budgetMaxPence).slice(1)}`;

/** P-05: host-declared only; absent = “Not provided”, never inferred. */
export const cuisineLabel = (m: Pick<Meal, 'cuisineCode'>) => (m.cuisineCode ? CUISINES[m.cuisineCode] : 'Not provided');
export const dietaryLabel = (m: Pick<Meal, 'dietaryCodes'>) => (m.dietaryCodes?.length ? m.dietaryCodes.map((c) => DIETARY[c]).join(' · ') : 'Not provided');
export const languagesLabel = (codes: readonly (keyof typeof LANGUAGES)[]) => codes.map((c) => (c === 'zh' ? 'Mandarin' : LANGUAGES[c])).join(' · ');
export const moodLabel = (m: Pick<Meal, 'mood'>) => MOODS[m.mood];
export const areaLabel = (code: string) => (code === 'unknown' ? 'London' : code.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '));
export const seatsLabel = (m: Pick<Meal, 'confirmedCount' | 'capacity'>) => `${m.confirmedCount} of ${m.capacity} confirmed`;

export const venueName = (m: Meal) => (m.venue.available && m.venue.name ? m.venue.name : 'Restaurant information temporarily unavailable');

export function bookingLabel(m: Meal): string {
  const d = m.bookingDeclaration;
  if (!d) return 'Reservation not yet reported';
  if (d.stale || d.status === 'NEEDS_UPDATE') return 'Host to update reservation';
  if (d.status === 'REPORTED_CONFIRMED') return 'Restaurant booked';
  if (d.status === 'FAILED') return 'Booking needs attention';
  return 'Reservation cancelled';
}

const APPLICATION_LABELS: Record<Application['state'], string> = {
  PENDING: 'Application pending',
  CONFIRMED: 'Your seat is confirmed',
  DECLINED: 'Application declined',
  WITHDRAWN: 'Application withdrawn',
  EXPIRED: 'Application expired',
  CANCELLED: 'Participation cancelled',
};
export const applicationLabel = (a: Application | null) => (a ? APPLICATION_LABELS[a.state] : 'Open table');

/** “23 Oct, 18:00”: applications deadline as the demo shows it (London wall time). */
export const closesLabel = (t: Meal['closesAt']) => {
  const [, m, d] = t.localDate.split('-').map(Number) as [number, number, number];
  return `${d} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]}, ${t.localTime}`;
};

/** People shown on cards and “Who’s coming”: seat holders, host first (falls back to the host alone). */
export const mealPeople = (m: Meal): Meal['host'][] => (m.members.length ? m.members : [m.host]);
