import { newIntentKey } from '@fancy/client';
import type { CuisineCode, DietaryCode, LanguageCode, MoodCode } from '@fancy/contracts';
import type { CreateMealBody, Meal, TimeInput, Venue } from '../../api/types.ts';
import { MEAL_TERMS_VERSION } from '../auth/consentVersions.ts';

/** Create-meal draft (kept in sessionStorage across the sign-in/profile detour). */
export interface MealDraft {
  attemptId: string;
  venue: Venue | null;
  capacity: number;
  minimum: number;
  date: string;
  time: string;
  closeDate: string;
  closeTime: string;
  /** Offsets are only set after the server reported TIME_AMBIGUOUS and the host chose BST/GMT. */
  startOffset: number | null;
  closeOffset: number | null;
  title: string;
  description: string;
  mood: MoodCode | null;
  languages: LanguageCode[];
  cuisineCode: CuisineCode | null;
  dietaryCodes: DietaryCode[];
  budgetMin: string;
  budgetMax: string;
  bookingConfirmed: boolean;
  reviewConfirmed: boolean;
}

export const newDraft = (): MealDraft => ({
  attemptId: newIntentKey(), venue: null, capacity: 4, minimum: 3, date: '', time: '', closeDate: '', closeTime: '',
  startOffset: null, closeOffset: null, title: '', description: '', mood: null, languages: ['en'], cuisineCode: null, dietaryCodes: [],
  budgetMin: '', budgetMax: '', bookingConfirmed: false, reviewConfirmed: false,
});

/** 48 half-hour planned meeting times, as the prototype (opening hours are checked with the restaurant). */
export const HALF_HOUR_SLOTS = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);

const wallMinutes = (date: string, time: string): number | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{2}):(\d{2})$/.exec(time);
  if (!m || !t) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(t[1]), Number(t[2])) / 60000;
};

/**
 * Default deadline = 60 minutes earlier on the London wall clock. This is only a suggestion;
 * across a clock change the real gap differs and the server's strict TimeInput check decides.
 */
export function defaultClose(date: string, time: string): { closeDate: string; closeTime: string } | null {
  const mins = wallMinutes(date, time);
  if (mins === null) return null;
  const iso = new Date((mins - 60) * 60000).toISOString();
  return { closeDate: iso.slice(0, 10), closeTime: iso.slice(11, 16) };
}

/** "25", "25.5", "25.50" → pence, without floating-point money maths. */
export function poundsToPence(text: string): number | null {
  const m = /^\s*(\d{1,4})(?:\.(\d{1,2}))?\s*$/.exec(text);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
}

export const penceToPounds = (p: number) => (p % 100 === 0 ? String(p / 100) : (p / 100).toFixed(2));

export type Step = 0 | 1 | 2 | 3;

export function validateStep(d: MealDraft, step: Step): string {
  if (step === 0) {
    if (!d.venue) return 'Choose a restaurant from search results.';
    if (!d.venue.available) return 'This restaurant’s details can’t be verified right now. Choose another restaurant.';
    if (d.minimum < 2 || d.minimum > d.capacity) return 'The minimum can’t be more than the table size.';
    if (!d.date) return 'Choose a date.';
    if (!HALF_HOUR_SLOTS.includes(d.time)) return 'Choose a planned time in half-hour steps.';
    const start = wallMinutes(d.date, d.time);
    const close = wallMinutes(d.closeDate, d.closeTime);
    if (close === null || start === null) return 'Choose when applications close.';
    if (start - close < 30) return 'Applications must close at least 30 minutes before the meal.';
    return '';
  }
  if (step === 1) {
    const title = d.title.trim().length;
    const desc = d.description.trim().length;
    if (title < 5 || title > 80) return 'Give your meal a name of 5–80 characters.';
    if (desc < 20 || desc > 1000) return 'Describe your meal in 20–1,000 characters.';
    if (!d.mood) return 'Choose an atmosphere.';
    if (!d.languages.length) return 'Choose at least one conversation language.';
    return '';
  }
  if (step === 2) {
    const min = poundsToPence(d.budgetMin);
    const max = poundsToPence(d.budgetMax);
    if (min === null || max === null || min <= 0) return 'Enter an estimated spend per person in pounds.';
    if (max < min) return 'The upper budget can’t be lower than the starting budget.';
    if (!d.bookingConfirmed) return 'Confirm your restaurant reservation to continue.';
    return '';
  }
  if (!d.reviewConfirmed) return 'Confirm you’ve checked the arrangements and the cancellation terms.';
  return '';
}

export const timeInput = (date: string, time: string, offset: number | null): TimeInput => ({
  localDate: date, localTime: time, timeZone: 'Europe/London', ...(offset !== null ? { utcOffsetMinutes: offset } : {}),
});

/** Request body. The two confirmations are literal `true` and only exist after the host ticked them. */
export function toCreateBody(d: MealDraft): CreateMealBody | null {
  const min = poundsToPence(d.budgetMin);
  const max = poundsToPence(d.budgetMax);
  if (!d.venue || !d.mood || min === null || max === null || !d.bookingConfirmed || !d.reviewConfirmed) return null;
  return {
    venueRef: d.venue.venueRef,
    title: d.title.trim(),
    description: d.description.trim(),
    start: timeInput(d.date, d.time, d.startOffset),
    close: timeInput(d.closeDate, d.closeTime, d.closeOffset),
    minimum: d.minimum,
    capacity: d.capacity,
    budgetMinPence: min,
    budgetMaxPence: max,
    languages: d.languages,
    mood: d.mood,
    cuisineCode: d.cuisineCode,
    dietaryCodes: d.dietaryCodes.length ? d.dietaryCodes : null,
    bookingMode: 'EXTERNAL_PAY_AT_VENUE',
    attemptId: d.attemptId,
    bookingDeclarationConfirmed: true,
    reviewConfirmed: true,
    termsVersion: MEAL_TERMS_VERSION,
  };
}

/** Which TimeInput an ambiguity/nonexistence error refers to (field error key names `close`, else start). */
export function timeFieldOf(fieldErrors: Record<string, string> | undefined): 'start' | 'close' {
  return Object.keys(fieldErrors ?? {}).some((k) => /close/i.test(k)) ? 'close' : 'start';
}

/** Draft prefilled from an existing meal for editing. */
export function draftFromMeal(meal: Meal): MealDraft {
  return {
    ...newDraft(),
    venue: meal.venue, capacity: meal.capacity, minimum: meal.minimum,
    date: meal.startsAt.localDate, time: meal.startsAt.localTime, closeDate: meal.closesAt.localDate, closeTime: meal.closesAt.localTime,
    startOffset: meal.startsAt.utcOffsetMinutes, closeOffset: meal.closesAt.utcOffsetMinutes,
    title: meal.title, description: meal.description, mood: meal.mood, languages: [...meal.languages],
    cuisineCode: meal.cuisineCode, dietaryCodes: [...(meal.dietaryCodes ?? [])],
    budgetMin: penceToPounds(meal.budgetMinPence), budgetMax: penceToPounds(meal.budgetMaxPence),
    bookingConfirmed: true, reviewConfirmed: true,
  };
}
