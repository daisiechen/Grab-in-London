import { LONDON_AREA_NAMES } from '@fancy/client';
import { CUISINES, DIETARY, LANGUAGES, MOODS } from '@fancy/contracts';
import type { Application, Meal } from '../../api/types.ts';

/** Area codes come from the API's verified London area dataset; its names display as published, other codes title-cased. */
export function areaName(code: string): string {
  if (!code || code === 'unknown') return 'London';
  if (Object.hasOwn(LONDON_AREA_NAMES, code)) return LONDON_AREA_NAMES[code]!;
  return code.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export const moodLabel = (m: Meal['mood']) => MOODS[m];
export const languagesLabel = (codes: readonly Meal['languages'][number][]) => codes.map((c) => LANGUAGES[c]).join(' & ');

/** P-05: host-declared and optional; unknown renders as “Not provided”, never as a guarantee. */
export const cuisineLabel = (meal: Pick<Meal, 'cuisineCode'>) => (meal.cuisineCode ? CUISINES[meal.cuisineCode] : 'Not provided');
export const dietaryLabel = (meal: Pick<Meal, 'dietaryCodes'>) => (meal.dietaryCodes?.length ? meal.dietaryCodes.map((d) => DIETARY[d]).join(', ') : 'Not provided');

export const tableKind = (capacity: number) => (capacity === 2 ? 'A TABLE FOR TWO' : 'A SMALL TABLE');

export const applicationLabels: Record<Application['state'], string> = {
  PENDING: 'Application pending',
  CONFIRMED: 'Your seat is confirmed',
  DECLINED: 'Application declined',
  WITHDRAWN: 'Application withdrawn',
  EXPIRED: 'Application expired',
  CANCELLED: 'Participation cancelled',
};

/** External booking only (P-01: pay at venue); the status is the host's report, never app verification. */
export function bookingStatus(meal: Pick<Meal, 'bookingDeclaration' | 'status'>): { label: string; tone: '' | 'good' | 'warn' } {
  const d = meal.bookingDeclaration;
  if (!d) return { label: 'Host hasn’t reported a booking yet', tone: '' };
  if (d.status === 'REPORTED_CONFIRMED') return d.stale ? { label: 'Host to update reservation', tone: 'warn' } : { label: 'Restaurant booked', tone: 'good' };
  if (d.status === 'NEEDS_UPDATE') return { label: 'Host to update reservation', tone: 'warn' };
  if (d.status === 'FAILED') return { label: 'Booking needs attention', tone: 'warn' };
  return { label: 'Reservation cancelled', tone: 'warn' };
}

export const cancelReasonLabel: Record<NonNullable<Meal['cancelReason']>, string> = {
  host: 'The host cancelled this meal.',
  booking: 'Cancelled because of the restaurant booking.',
  other: 'The host cancelled this meal.',
  insufficient: 'Cancelled because not enough people joined before applications closed.',
};

export const googleMapsUrl = (venue: Meal['venue']) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.name ?? 'Restaurant')}&query_place_id=${encodeURIComponent(venue.placeId)}`;

export const monogram = (name: string | null) => (name?.trim()?.[0] ?? '·').toUpperCase();
