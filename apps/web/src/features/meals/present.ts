import { LONDON_AREA_NAMES } from '@fancy/client';
import { CUISINES, DIETARY, LANGUAGES, MOODS } from '@fancy/contracts';
import type { Application, Meal } from '../../api/types.ts';
import { budgetRange, longDate } from '../../lib/format.ts';

/*
 * Meal presentation, the same strings as apps/ios/src/features/meals/format.ts and
 * apps/ios/src/features/discover/areas.ts so both clients describe a table identically.
 */

const LABELS: Record<string, string> = { 'st-jamess': 'St James’s', 'st-james': 'St James’s', 'st-james-s': 'St James’s' };
const own = (names: Readonly<Record<string, string>>, code: string) => (Object.hasOwn(names, code) ? names[code] : undefined);

/** Area codes come from the API's verified London area dataset; its names display as published, other codes title-cased. */
export function areaName(code: string): string {
  if (!code || code === 'unknown') return 'London';
  return own(LABELS, code) ?? own(LONDON_AREA_NAMES, code) ?? code.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
/** “Soho, London”; an unmapped area is just “London”. */
export const areaPlace = (code: string) => (!code || code === 'unknown' ? 'London' : `${areaName(code)}, London`);

export const moodLabel = (m: Meal['mood']) => MOODS[m];
export const languagesLabel = (codes: readonly Meal['languages'][number][]) => codes.map((c) => (c === 'zh' ? 'Mandarin' : LANGUAGES[c])).join(' · ');

/** P-05: host-declared and optional; unknown renders as “Not provided”, never as a guarantee. */
export const cuisineLabel = (meal: Pick<Meal, 'cuisineCode'>) => (meal.cuisineCode ? CUISINES[meal.cuisineCode] : 'Not provided');
export const dietaryLabel = (meal: Pick<Meal, 'dietaryCodes'>) => (meal.dietaryCodes?.length ? meal.dietaryCodes.map((d) => DIETARY[d]).join(' · ') : 'Not provided');

export const tableKind = (capacity: number) => (capacity === 2 ? 'A table for two' : 'A small table');
export const cardWhenLabel = (t: Meal['startsAt']) => `${longDate(t.localDate)} · ${t.localTime}`;
export const cardBudgetLabel = (m: Pick<Meal, 'budgetMinPence' | 'budgetMaxPence'>) => budgetRange(m.budgetMinPence, m.budgetMaxPence);
export const seatsLabel = (m: Pick<Meal, 'confirmedCount' | 'capacity'>) => `${m.confirmedCount} of ${m.capacity} confirmed`;
export const venueName = (m: Pick<Meal, 'venue'>) => (m.venue.available && m.venue.name ? m.venue.name : 'Restaurant information temporarily unavailable');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** “23 Oct, 18:00”: the applications deadline in London wall time. */
export const closesLabel = (t: Meal['closesAt']) => {
  const [, m, d] = t.localDate.split('-').map(Number) as [number, number, number];
  return `${d} ${MONTHS[m - 1]}, ${t.localTime}`;
};

/** People on cards and in “Who’s coming”: seat holders, host first (falls back to the host alone). */
export const mealPeople = (m: Pick<Meal, 'members' | 'host'>): Meal['host'][] => (m.members.length ? m.members : [m.host]);

export const applicationLabels: Record<Application['state'], string> = {
  PENDING: 'Application pending',
  CONFIRMED: 'Your seat is confirmed',
  DECLINED: 'Application declined',
  WITHDRAWN: 'Application withdrawn',
  EXPIRED: 'Application expired',
  CANCELLED: 'Participation cancelled',
};

/** iOS bookingLabel: the host's report of an external booking, never app verification. */
export function bookingLabel(meal: Pick<Meal, 'bookingDeclaration'>): string {
  const d = meal.bookingDeclaration;
  if (!d) return 'Reservation not yet reported';
  if (d.stale || d.status === 'NEEDS_UPDATE') return 'Host to update reservation';
  if (d.status === 'REPORTED_CONFIRMED') return 'Restaurant booked';
  if (d.status === 'FAILED') return 'Booking needs attention';
  return 'Reservation cancelled';
}

export function bookingStatus(meal: Pick<Meal, 'bookingDeclaration' | 'status'>): { label: string; tone: '' | 'good' | 'warn' } {
  const label = bookingLabel(meal);
  return { label, tone: label === 'Restaurant booked' ? 'good' : label === 'Reservation not yet reported' ? '' : 'warn' };
}

export const cancelReasonLabel: Record<NonNullable<Meal['cancelReason']>, string> = {
  host: 'The host cancelled this meal.',
  booking: 'Cancelled because of the restaurant booking.',
  other: 'The host cancelled this meal.',
  insufficient: 'Cancelled because not enough people joined before applications closed.',
};

/** Google Maps search link pinned to the place (coordinates when the venue read has them). */
export function googleMapsUrl(venue: Meal['venue']): string {
  if (venue.location) return `https://www.google.com/maps/search/?api=1&query=${venue.location.lat},${venue.location.lng}&query_place_id=${encodeURIComponent(venue.placeId)}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.name ?? 'Restaurant')}&query_place_id=${encodeURIComponent(venue.placeId)}`;
}

export const monogram = (name: string | null) => (name?.trim()?.[0] ?? '·').toUpperCase();
