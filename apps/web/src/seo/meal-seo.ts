import type { ResponseOf } from '@fancy/client';

/*
 * Shared by the browser app (document head, canonical links) and the meta server
 * (apps/web/server): no DOM or Node APIs here. Web spec §2.3 D5 and §8.
 */

type Meal = ResponseOf<'getMeal'>['data']['meal'];

export const SITE_ORIGIN = 'https://fancyabite.uk';
export const SITE_NAME = 'Fancy';
export const HOME_TITLE = 'Fancy · Meet new people over a meal in London';
export const HOME_DESCRIPTION = 'Small tables of 2–6 in London. Find a meal you like, say hello to the host, and pay for your own share at the restaurant. Adults 18+.';
export const DISCOVER_TITLE = 'Small-table meals in London this week · Fancy';
export const DISCOVER_DESCRIPTION = 'Browse small-table meals across central London by date, area and table size. Free to join; everyone pays their own share at the restaurant.';

/** Sub-routes of a meal page; a slug equal to one of them gets a suffix so links never collide. */
const RESERVED = new Set(['apply', 'status', 'host', 'edit']);
const MAX_SLUG = 60;

/**
 * Readable URL fragment from the meal title: lower case, ASCII only (accents folded, other
 * characters dropped), hyphen separated, cut at a word boundary. Empty when nothing usable is left.
 */
export function mealSlug(title: string): string {
  const ascii = title.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' and ');
  let slug = ascii.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (slug.length > MAX_SLUG) {
    const cut = slug.slice(0, MAX_SLUG + 1);
    const at = cut.lastIndexOf('-');
    slug = (at > 20 ? cut.slice(0, at) : slug.slice(0, MAX_SLUG)).replace(/-+$/, '');
  }
  return RESERVED.has(slug) ? `${slug}-meal` : slug;
}

/** Canonical meal path `/meals/{id}/{slug}` (just `/meals/{id}` when the title has no usable characters). */
export function mealPath(meal: { id: string; title: string }): string {
  const slug = mealSlug(meal.title);
  return slug ? `/meals/${meal.id}/${slug}` : `/meals/${meal.id}`;
}

const LONG_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dateLabel = (localDate: string) => {
  const [y, m, d] = localDate.split('-').map(Number) as [number, number, number];
  return `${DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${LONG_MONTHS[m - 1]}`;
};
const pounds = (pence: number) => `£${pence % 100 === 0 ? pence / 100 : (pence / 100).toFixed(2)}`;
const budget = (m: Pick<Meal, 'budgetMinPence' | 'budgetMaxPence'>) => (m.budgetMinPence === m.budgetMaxPence ? pounds(m.budgetMinPence) : `${pounds(m.budgetMinPence)}–${pounds(m.budgetMaxPence).slice(1)}`);

export function mealTitle(meal: Pick<Meal, 'title'>, area: string): string {
  return `${meal.title} · ${area} · ${SITE_NAME}`;
}

/** `Fri 30 Oct, 19:00 · The Little Table, Soho · Table for 4 · £25–35 per person, pay at the restaurant` */
export function mealDescription(meal: Pick<Meal, 'startsAt' | 'venue' | 'capacity' | 'budgetMinPence' | 'budgetMaxPence'>, area: string): string {
  const where = meal.venue.available && meal.venue.name ? `${meal.venue.name}, ${area}` : area;
  return `${dateLabel(meal.startsAt.localDate)}, ${meal.startsAt.localTime} · ${where} · Table for ${meal.capacity} · ${budget(meal)} per person, pay at the restaurant`;
}

/** Only open, not-yet-started tables with seats left are offered to search engines. */
export function mealIndexable(meal: Pick<Meal, 'status' | 'startsAt' | 'closesAt' | 'confirmedCount' | 'capacity'>, now: number): boolean {
  return meal.status === 'OPEN' && Date.parse(meal.closesAt.instant) > now && Date.parse(meal.startsAt.instant) > now && meal.confirmedCount < meal.capacity;
}

const offset = (minutes: number) => `${minutes >= 0 ? '+' : '-'}${String(Math.floor(Math.abs(minutes) / 60)).padStart(2, '0')}:${String(Math.abs(minutes) % 60).padStart(2, '0')}`;

/** schema.org Event (spec §8): organiser is Fancy, no offers, London wall time with its offset. */
export function mealJsonLd(meal: Meal, area: string, origin: string = SITE_ORIGIN): Record<string, unknown> {
  const end = new Date(meal.scheduledEndAt);
  const endLocal = new Date(end.getTime() + meal.startsAt.utcOffsetMinutes * 60_000).toISOString().slice(0, 16);
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: meal.title,
    description: meal.description.slice(0, 300),
    startDate: `${meal.startsAt.localDate}T${meal.startsAt.localTime}:00${offset(meal.startsAt.utcOffsetMinutes)}`,
    endDate: `${endLocal}:00${offset(meal.startsAt.utcOffsetMinutes)}`,
    eventStatus: meal.status === 'CANCELLED' ? 'https://schema.org/EventCancelled' : 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: {
      '@type': 'Place',
      name: meal.venue.available && meal.venue.name ? meal.venue.name : area,
      address: { '@type': 'PostalAddress', addressLocality: 'London', addressRegion: area, addressCountry: 'GB' },
    },
    organizer: { '@type': 'Organization', name: SITE_NAME, url: origin },
    isAccessibleForFree: true,
    maximumAttendeeCapacity: meal.capacity,
    url: origin + mealPath(meal),
  };
}
