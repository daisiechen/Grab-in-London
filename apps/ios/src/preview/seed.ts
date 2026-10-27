/**
 * Preview seed, transcribed from the approved demo (demo/src/domain.ts, readiness.ts and the data in
 * demo/src/Prototype.tsx). Demo labels are mapped to contract dictionary codes; demo deposits,
 * payments, refunds and in-app reservations are dropped (PRD r07: hosts book outside Fancy, guests
 * pay the restaurant). Demo "booking: CONFIRMED" becomes the host's self-reported declaration;
 * demo "booking: PENDING" means the host has not reported a booking yet.
 */
import type { CuisineCode, DietaryCode, InterestCode, LanguageCode, LifeStatusCode, MoodCode } from '@fancy/contracts';

/** Demo clock (demo/src/readiness.ts DEMO_NOW): Tue 20 Oct 2026, 10:00 London. */
export const PREVIEW_NOW = Date.parse('2026-10-20T09:00:00.000Z');
/** Policy version the server accepts for age/community confirmation (apps/api CONSENT_VERSION). */
export const PREVIEW_CONSENT_VERSION = '2026-10-21';

const uuid = (prefix: string, n: number) => `${prefix}-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const PREFIX = {
  user: '10000000',
  venue: '20000000',
  meal: '30000000',
  application: '40000000',
  conversation: '50000000',
  message: '60000000',
  misc: '70000000',
} as const;
export const seedId = (kind: keyof typeof PREFIX, n: number) => uuid(PREFIX[kind], n);

/** Stable ids for the demo's people, restaurants and meals (useful for deep links and tests). */
export const PREVIEW_IDS = {
  users: { alex: seedId('user', 1), maya: seedId('user', 2), leo: seedId('user', 3), emma: seedId('user', 4) },
  meals: {
    supper: seedId('meal', 1),
    ramen: seedId('meal', 2),
    tapas: seedId('meal', 3),
    duo: seedId('meal', 4),
    sohoSaturday: seedId('meal', 5),
    pastSupper: seedId('meal', 6),
  },
  venues: { littleTable: seedId('venue', 1), noodleHouse: seedId('venue', 2), casaEvening: seedId('venue', 3), gardenKitchen: seedId('venue', 4) },
} as const;

export type PersonKey = keyof typeof PREVIEW_IDS.users;

/** Photos are the demo's assets (demo/public/images/<key>.png); the UI maps the key to a bundled image. */
export const PREVIEW_IMAGE_PREFIX = 'preview://images/';
export const previewImageUrl = (key: string) => `${PREVIEW_IMAGE_PREFIX}${key}.png`;
/** `preview://images/maya.png` → `maya`; null for anything else. */
export function previewImageKey(url: string | null | undefined): string | null {
  if (!url || !url.startsWith(PREVIEW_IMAGE_PREFIX)) return null;
  return url.slice(PREVIEW_IMAGE_PREFIX.length).replace(/\.png$/, '') || null;
}

export interface SeedPerson {
  key: PersonKey;
  displayName: string;
  image: string;
  bio: string;
  languages: LanguageCode[];
  lifeStatus: LifeStatusCode;
  interests: InterestCode[];
  work: string;
}

/**
 * demo members. Interests outside the contract dictionary map to the nearest code
 * (Leo: Architecture → DESIGN, Jazz → MUSIC). Alex uses Leo's photo exactly as in the demo.
 */
export const SEED_PEOPLE: readonly SeedPerson[] = [
  {
    key: 'alex', displayName: 'Alex', image: 'leo', work: 'Creative strategist', languages: ['en'], lifeStatus: 'NEW_TO_LONDON',
    interests: ['FOOD', 'PHOTOGRAPHY', 'TRAVEL'],
    bio: 'I moved to London recently and would love to meet people beyond my work bubble. Good food and easy conversation are my kind of evening.',
  },
  {
    key: 'maya', displayName: 'Maya', image: 'maya', work: 'Product designer', languages: ['en', 'hi'], lifeStatus: 'MAKING_LONDON_HOME',
    interests: ['FOOD', 'DESIGN', 'BOOKS'],
    bio: 'Finding my way around London, one little restaurant at a time. I love conversations that wander, independent bookshops and sharing the last dessert.',
  },
  {
    key: 'leo', displayName: 'Leo', image: 'leo', work: 'Architect', languages: ['en', 'fr'], lifeStatus: 'LIVING_AND_WORKING',
    interests: ['DESIGN', 'MUSIC', 'COOKING'],
    bio: 'Usually sketching buildings or looking for somewhere good to eat. Always happy to meet people outside my usual circle.',
  },
  {
    key: 'emma', displayName: 'Emma', image: 'emma', work: 'Researcher', languages: ['en', 'es'], lifeStatus: 'NEW_TO_LONDON',
    interests: ['CINEMA', 'WALKING', 'TRAVEL'],
    bio: 'Recently moved here and making room for new friends. I enjoy films, long walks and a very unhurried dinner.',
  },
];

export interface SeedVenue {
  venueRef: string;
  placeId: string;
  name: string;
  address: string;
  areaCode: string;
  lat: number;
  lng: number;
  note: string;
}

/** demo restaurants (fictional) placed at their demo neighbourhoods. */
export const SEED_VENUES: readonly SeedVenue[] = [
  { venueRef: PREVIEW_IDS.venues.littleTable, placeId: 'preview-place-little-table', name: 'The Little Table', address: 'Soho, London', areaCode: 'soho', lat: 51.5136, lng: -0.134, note: 'Sharing plates · vegetarian options' },
  { venueRef: PREVIEW_IDS.venues.noodleHouse, placeId: 'preview-place-noodle-house', name: 'Noodle House', address: 'Fitzrovia, London', areaCode: 'fitzrovia', lat: 51.5195, lng: -0.1376, note: 'Ramen · cosy counter seats' },
  { venueRef: PREVIEW_IDS.venues.casaEvening, placeId: 'preview-place-casa-evening', name: 'Casa Evening', address: 'Covent Garden, London', areaCode: 'covent-garden', lat: 51.5117, lng: -0.124, note: 'Small plates · lively atmosphere' },
  { venueRef: PREVIEW_IDS.venues.gardenKitchen, placeId: 'preview-place-garden-kitchen', name: 'The Garden Kitchen', address: 'St James’s, London', areaCode: 'st-james', lat: 51.5066, lng: -0.1365, note: 'Relaxed lunches · plant-friendly' },
];

export interface SeedMeal {
  id: string;
  title: string;
  venueRef: string;
  localDate: string;
  localTime: string;
  capacity: number;
  minimum: number;
  budgetMinPence: number;
  budgetMaxPence: number;
  languages: LanguageCode[];
  mood: MoodCode;
  description: string;
  host: PersonKey;
  /** Confirmed guests besides the host (demo `members` minus host). */
  guests: PersonKey[];
  cuisineCode: CuisineCode | null;
  dietaryCodes: DietaryCode[] | null;
  /** Host's self-reported external booking (count = planned table size), or null when not yet reported. */
  bookingReported: boolean;
}

const SUPPER_DESCRIPTION = 'A relaxed Friday dinner with a few new faces. No agenda, no pitches — just sharing plates and stories about life in London. Come as you are; you don’t need to know anyone.';

/**
 * demo initialMeals + pastMeal. Minimum follows the demo default (2 for a table for two, else 3);
 * applications close 60 minutes before the start (demo closesAt). Demo "tapas" shows 4 confirmed
 * but lists only three members; the roster here is the three named members.
 */
export const SEED_MEALS: readonly SeedMeal[] = [
  {
    id: PREVIEW_IDS.meals.supper, title: 'An easy Friday supper', venueRef: PREVIEW_IDS.venues.littleTable, localDate: '2026-10-23', localTime: '19:00',
    capacity: 4, minimum: 3, budgetMinPence: 2500, budgetMaxPence: 3500, languages: ['en'], mood: 'EASY_CONVERSATION', description: SUPPER_DESCRIPTION,
    host: 'maya', guests: ['leo', 'emma'], cuisineCode: 'EUROPEAN', dietaryCodes: ['VEGETARIAN_OPTIONS'], bookingReported: false,
  },
  {
    id: PREVIEW_IDS.meals.ramen, title: 'Ramen & new faces', venueRef: PREVIEW_IDS.venues.noodleHouse, localDate: '2026-10-23', localTime: '18:30',
    capacity: 5, minimum: 3, budgetMinPence: 2000, budgetMaxPence: 3000, languages: ['en'], mood: 'FOOD_DISCOVERIES',
    description: 'A cosy bowl of ramen and a catch-up with people you haven’t met yet. Everyone is welcome, especially if this is your first meal.',
    host: 'leo', guests: ['emma', 'maya'], cuisineCode: 'JAPANESE', dietaryCodes: null, bookingReported: true,
  },
  {
    id: PREVIEW_IDS.meals.tapas, title: 'Small plates, big stories', venueRef: PREVIEW_IDS.venues.casaEvening, localDate: '2026-10-24', localTime: '19:30',
    capacity: 6, minimum: 3, budgetMinPence: 3500, budgetMaxPence: 3500, languages: ['en'], mood: 'TRAVEL_CULTURE',
    description: 'A fixed sharing menu and stories from everywhere. Bring your curiosity and your appetite. Vegetarian options are available.',
    host: 'emma', guests: ['maya', 'leo'], cuisineCode: 'SPANISH', dietaryCodes: ['VEGETARIAN_OPTIONS'], bookingReported: false,
  },
  {
    id: PREVIEW_IDS.meals.duo, title: 'Lunch with someone new', venueRef: PREVIEW_IDS.venues.gardenKitchen, localDate: '2026-10-24', localTime: '12:30',
    capacity: 2, minimum: 2, budgetMinPence: 2000, budgetMaxPence: 3000, languages: ['en'], mood: 'EASY_CONVERSATION',
    description: 'A friendly lunch for two. A little space to get to know someone new over a good meal. This is a friendship-first table.',
    host: 'maya', guests: [], cuisineCode: 'EUROPEAN', dietaryCodes: ['VEGETARIAN_OPTIONS'], bookingReported: true,
  },
  {
    id: PREVIEW_IDS.meals.sohoSaturday, title: 'A Saturday table in Soho', venueRef: PREVIEW_IDS.venues.littleTable, localDate: '2026-10-24', localTime: '18:30',
    capacity: 5, minimum: 3, budgetMinPence: 2500, budgetMaxPence: 3500, languages: ['en'], mood: 'EASY_CONVERSATION',
    description: 'A relaxed Saturday supper with new London friends. Share a few plates and trade your favourite neighbourhood discoveries.',
    host: 'maya', guests: ['emma'], cuisineCode: 'EUROPEAN', dietaryCodes: ['VEGETARIAN_OPTIONS'], bookingReported: true,
  },
  {
    id: PREVIEW_IDS.meals.pastSupper, title: 'A little supper club', venueRef: PREVIEW_IDS.venues.littleTable, localDate: '2026-10-15', localTime: '19:00',
    capacity: 4, minimum: 3, budgetMinPence: 2500, budgetMaxPence: 3500, languages: ['en'], mood: 'EASY_CONVERSATION', description: SUPPER_DESCRIPTION,
    host: 'maya', guests: ['emma', 'alex'], cuisineCode: 'EUROPEAN', dietaryCodes: ['VEGETARIAN_OPTIONS'], bookingReported: true,
  },
];

/** demo group-chat lines (Prototype.tsx chat screen). */
export const HOST_GREETING = 'Hi everyone! Looking forward to meeting you. Shall we meet outside five minutes before?';
export const EMMA_REPLY = 'Sounds lovely! This is my first meal here. 😊';
/** demo direct-chat opener once a reconnect is mutual. */
export const DIRECT_OPENER = 'Lovely meeting you! Shall we find another table soon?';
/** demo host "Requests" card: Emma's request on a meal Alex hosts. */
export const EMMA_REQUEST = 'I’d love to join! I’ve just moved here and a relaxed dinner sounds like a lovely way to meet people.';
/** Mutual references between Maya and Emma from the past supper, so their public profiles show one. */
export const SEED_REFERENCES = [
  { author: 'emma', subject: 'maya', body: 'Maya made the whole table feel at ease. A wonderful host with great restaurant taste.' },
  { author: 'maya', subject: 'emma', body: 'Emma brought brilliant film recommendations and such warm energy. Hope to share a table again.' },
] as const satisfies ReadonlyArray<{ author: PersonKey; subject: PersonKey; body: string }>;
