import { newIntentKey, type TimeChoice } from '@fancy/client';
import { normalizeHostDeclarations, type CuisineCode, type DietaryCode, type LanguageCode, type MoodCode } from '@fancy/contracts';
import type { CreateMealBody, Meal, TimeInput, Venue } from '../../api/types.ts';
import type { RequestOf } from '@fancy/client';
import { compareWall, longDate, minusMinutes, wallMinutesBetween } from '../../lib/london.ts';
import { MEAL_TERMS_VERSION } from '../auth/consentVersions.ts';

/*
 * Create / edit meal model, the same rules as apps/ios/src/features/create/model.ts. The web
 * keeps the draft in sessionStorage across the sign-in detour (lib/drafts.ts strips the
 * provider display data); the server re-validates everything.
 */

export type EditBody = RequestOf<'editMeal'>['body'];
/** Create publishes a new meal; edit changes an existing one (no booking/review attestations). */
export type FlowKind = 'create' | 'edit';

export interface MealDraft {
  attemptId: string;
  venue: Venue | null;
  capacity: number;
  minimum: number;
  date: string;
  time: string;
  closeDate: string;
  closeTime: string;
  /** True once the host chose the deadline; otherwise it follows start − 60 min. */
  closeEdited?: boolean;
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
  /** Edit only: the meal version this draft was prefilled from (diff base and If-Match). */
  baseVersion?: string;
}

export const newDraft = (): MealDraft => ({
  attemptId: newIntentKey(), venue: null, capacity: 4, minimum: 2, date: '', time: '', closeDate: '', closeTime: '', closeEdited: false,
  startOffset: null, closeOffset: null, title: '', description: '', mood: null, languages: [], cuisineCode: null, dietaryCodes: [],
  budgetMin: '', budgetMax: '', bookingConfirmed: false, reviewConfirmed: false,
});

export type Step = 0 | 1 | 2 | 3;
export const STEPS = ['Arrange', 'Introduce', 'Costs', 'Review'] as const;
/** r07 table size, including the host. */
export const MIN_PEOPLE = 2;
export const MAX_PEOPLE = 6;

/** Provider display refreshes do not change the selected restaurant's verified identity. */
export const sameVenue = (a: Venue | null | undefined, b: Venue | null | undefined) =>
  !!a && !!b && (a.placeId && b.placeId ? a.placeId === b.placeId : a.venueRef === b.venueRef);

/**
 * Applies an edit and its dependent invalidations (iOS updateDraft): a new meal time drops its
 * BST/GMT choice and moves an untouched deadline to start − 60; a different verified restaurant
 * clears the meeting time (PRD FR05); restaurant, size or time changes need a new booking tick;
 * the review tick never survives an edit. A same-place display refresh changes nothing.
 */
export function updateDraft(d: MealDraft, patch: Partial<MealDraft>): MealDraft {
  const next: MealDraft = { ...d, ...patch };
  const venueKeys = Object.keys(patch);
  const displayRefresh = venueKeys.length > 0 && venueKeys.every((k) => k === 'venue') && sameVenue(d.venue, patch.venue);
  if (displayRefresh) return next;
  const venueChanged = 'venue' in patch && !sameVenue(d.venue, patch.venue ?? null);
  if (venueChanged && d.venue) { next.time = ''; next.startOffset = null; next.closeOffset = null; }
  const scheduleChanged = ('date' in patch && patch.date !== d.date) || ('time' in patch && patch.time !== d.time);
  if (scheduleChanged) next.startOffset = null;
  if (('closeDate' in patch && patch.closeDate !== d.closeDate) || ('closeTime' in patch && patch.closeTime !== d.closeTime)) next.closeOffset = null;
  if (scheduleChanged && !next.closeEdited && next.date && next.time) {
    const close = minusMinutes(next.date, next.time, 60);
    next.closeDate = close.date;
    next.closeTime = close.time;
    next.closeOffset = null;
  }
  if ((scheduleChanged || venueChanged || ('capacity' in patch && patch.capacity !== d.capacity)) && !('bookingConfirmed' in patch)) next.bookingConfirmed = false;
  if (next.minimum > next.capacity) next.minimum = next.capacity;
  if (!('reviewConfirmed' in patch)) next.reviewConfirmed = false;
  return next;
}

const BUDGET_FORMAT = /^\d{1,5}(\.\d{1,2})?$/;
/** "25", "25.5", "25.50" → pence, without floating-point money maths; null unless above £0. */
export function poundsToPence(text: string): number | null {
  const v = text.trim();
  if (!BUDGET_FORMAT.test(v)) return null;
  const [whole, frac = ''] = v.split('.');
  const pence = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  return pence > 0 ? pence : null;
}
export const penceToPounds = (p: number) => (p % 100 === 0 ? String(p / 100) : (p / 100).toFixed(2));

const amountIssue = (value: string): string | null => {
  const v = value.trim();
  if (!v) return null;
  if (!BUDGET_FORMAT.test(v)) return 'Use pounds only, like 20 or 22.50.';
  return poundsToPence(v) === null ? 'Enter an amount above £0.' : null;
};

/** Inline Costs errors while typing (iOS budgetIssues); empty fields wait for Continue. */
export function budgetIssues(d: Pick<MealDraft, 'budgetMin' | 'budgetMax'>): { min: string | null; max: string | null } {
  const min = amountIssue(d.budgetMin);
  const max = amountIssue(d.budgetMax);
  if (min || max) return { min, max };
  const lo = poundsToPence(d.budgetMin);
  const hi = poundsToPence(d.budgetMax);
  return { min: null, max: lo !== null && hi !== null && lo > hi ? `Must be at least £${d.budgetMin.trim()}, the “From” amount.` : null };
}

/** The estimate shown to the host; an invalid range is never echoed. */
export function budgetText(d: Pick<MealDraft, 'budgetMin' | 'budgetMax'>): string {
  const [min, max] = [d.budgetMin.trim(), d.budgetMax.trim()];
  const issues = budgetIssues(d);
  if ((!min && !max) || issues.min || issues.max) return '—';
  return min && min === max ? `£${min}` : `£${min || '–'}–${max || '–'}`;
}

const minutesOf = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
/** A deadline slot later than 30 minutes before the meal (same London date); the server re-validates. */
export function deadlineTooLate(d: Pick<MealDraft, 'date' | 'time' | 'closeDate'>, slot: string): boolean {
  if (!d.date || !d.time || !d.closeDate) return false;
  if (d.closeDate > d.date) return true;
  return d.closeDate === d.date && minutesOf(slot) > minutesOf(d.time) - 30;
}

/** Client checks mirror the API; edit skips the create-only attestations. Null when the step is complete. */
export function validateStep(d: MealDraft, step: Step, todayLondon: string, kind: FlowKind = 'create'): string | null {
  if (step === 0) {
    if (!d.venue) return 'Choose a restaurant.';
    if (!d.venue.available) return 'This restaurant can’t be verified right now. Choose another.';
    if (!d.date || !d.time) return 'Choose a date and time.';
    if (d.date < todayLondon) return 'Choose a date from today onwards.';
    if (d.capacity < MIN_PEOPLE || d.capacity > MAX_PEOPLE) return 'Choose 2–6 people, including you.';
    if (d.minimum < MIN_PEOPLE || d.minimum > d.capacity) return 'The minimum must be between 2 and the table size.';
    if (!d.closeDate || !d.closeTime) return 'Choose when applications close.';
    const start = { date: d.date, time: d.time };
    const close = { date: d.closeDate, time: d.closeTime };
    if (compareWall(close, start) >= 0 || wallMinutesBetween(close, start) < 30) return 'Applications must close at least 30 minutes before the meal.';
    return null;
  }
  if (step === 1) {
    const title = d.title.trim().length;
    const description = d.description.trim().length;
    if (title < 5 || title > 80) return 'Give your meal a title of 5–80 characters.';
    if (description < 20 || description > 1000) return 'Tell guests about your meal in 20–1,000 characters.';
    if (!d.mood) return 'Choose an atmosphere.';
    if (d.languages.length < 1) return 'Choose a conversation language.';
    return null;
  }
  if (step === 2) {
    const min = poundsToPence(d.budgetMin);
    const max = poundsToPence(d.budgetMax);
    if (min === null || max === null || min > max) return 'Enter a valid budget, with the maximum at least the minimum.';
    if (kind === 'create' && !d.bookingConfirmed) return 'Confirm that you have already booked the table with the restaurant.';
    return null;
  }
  if (kind === 'create' && !d.reviewConfirmed) return 'Confirm you’ve reviewed the details before publishing.';
  for (const s of [0, 1, 2] as const) {
    const issue = validateStep(d, s, todayLondon, kind);
    if (issue) return issue;
  }
  return null;
}

/** The first incomplete step (for Publish/Save from Review), or null. */
export function firstIncompleteStep(d: MealDraft, todayLondon: string, kind: FlowKind): Step | null {
  for (const s of [0, 1, 2] as const) if (validateStep(d, s, todayLondon, kind)) return s;
  return null;
}

export const timeInput = (date: string, time: string, offset: number | null): TimeInput => ({
  localDate: date, localTime: time, timeZone: 'Europe/London', ...(offset !== null ? { utcOffsetMinutes: offset } : {}),
});

/** Request body. The two confirmations are literal `true` and only exist after the host ticked them. */
export function toCreateBody(d: MealDraft): CreateMealBody | null {
  const min = poundsToPence(d.budgetMin);
  const max = poundsToPence(d.budgetMax);
  if (!d.venue || !d.mood || min === null || max === null || !d.bookingConfirmed || !d.reviewConfirmed) return null;
  const declarations = normalizeHostDeclarations({ cuisineCode: d.cuisineCode, dietaryCodes: d.dietaryCodes });
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
    languages: [...d.languages],
    mood: d.mood,
    cuisineCode: declarations.cuisineCode,
    dietaryCodes: declarations.dietaryCodes,
    bookingMode: 'EXTERNAL_PAY_AT_VENUE',
    attemptId: d.attemptId,
    bookingDeclarationConfirmed: true,
    reviewConfirmed: true,
    termsVersion: MEAL_TERMS_VERSION,
  };
}

/** Edit prefill: the meal as the host last published it, in the same draft shape as Create. */
export function draftFromMeal(meal: Meal): MealDraft {
  const follows = minusMinutes(meal.startsAt.localDate, meal.startsAt.localTime, 60);
  return {
    ...newDraft(),
    attemptId: meal.id,
    venue: meal.venue, capacity: meal.capacity, minimum: meal.minimum,
    date: meal.startsAt.localDate, time: meal.startsAt.localTime, closeDate: meal.closesAt.localDate, closeTime: meal.closesAt.localTime,
    // A deadline that still sits at start − 60 keeps following the meal time, as in Create.
    closeEdited: follows.date !== meal.closesAt.localDate || follows.time !== meal.closesAt.localTime,
    title: meal.title, description: meal.description, mood: meal.mood, languages: [...meal.languages],
    cuisineCode: meal.cuisineCode, dietaryCodes: [...(meal.dietaryCodes ?? [])],
    budgetMin: penceToPounds(meal.budgetMinPence), budgetMax: penceToPounds(meal.budgetMaxPence),
    // Edit never asks for the create attestations; the booking already reported stays on the meal.
    bookingConfirmed: true,
    baseVersion: meal.version,
  };
}

const sameSet = <T extends string>(a: readonly T[] | null, b: readonly T[] | null) => [...(a ?? [])].sort().join(',') === [...(b ?? [])].sort().join(',');

/** Edit PATCH body with only the fields that differ from `base`; null when nothing changed. */
export function toEditBody(d: MealDraft, base: Meal): EditBody | null {
  const min = poundsToPence(d.budgetMin);
  const max = poundsToPence(d.budgetMax);
  if (!d.venue || !d.mood || min === null || max === null) return null;
  const body: EditBody = {};
  const declarations = normalizeHostDeclarations({ cuisineCode: d.cuisineCode, dietaryCodes: d.dietaryCodes });
  if (d.venue.venueRef !== base.venue.venueRef) body.venueRef = d.venue.venueRef;
  if (d.title.trim() !== base.title) body.title = d.title.trim();
  if (d.description.trim() !== base.description) body.description = d.description.trim();
  if (d.date !== base.startsAt.localDate || d.time !== base.startsAt.localTime || (d.startOffset !== null && d.startOffset !== base.startsAt.utcOffsetMinutes))
    body.start = timeInput(d.date, d.time, d.startOffset);
  if (d.closeDate !== base.closesAt.localDate || d.closeTime !== base.closesAt.localTime || (d.closeOffset !== null && d.closeOffset !== base.closesAt.utcOffsetMinutes))
    body.close = timeInput(d.closeDate, d.closeTime, d.closeOffset);
  if (d.minimum !== base.minimum) body.minimum = d.minimum;
  if (d.capacity !== base.capacity) body.capacity = d.capacity;
  if (min !== base.budgetMinPence) body.budgetMinPence = min;
  if (max !== base.budgetMaxPence) body.budgetMaxPence = max;
  if (!sameSet(d.languages, base.languages)) body.languages = [...d.languages];
  if (d.mood !== base.mood) body.mood = d.mood;
  if (declarations.cuisineCode !== base.cuisineCode) body.cuisineCode = declarations.cuisineCode;
  if (!sameSet(declarations.dietaryCodes, base.dietaryCodes)) body.dietaryCodes = declarations.dietaryCodes;
  return Object.keys(body).length ? body : null;
}

/** Why the host can’t edit (r07: only before the first approval, while OPEN and before the deadline); null when allowed. */
export function editBlockedReason(meal: Meal, now: number): string | null {
  if (meal.status === 'CANCELLED') return 'This meal was cancelled, so it can’t be edited.';
  if (meal.arrangementLocked) return 'A guest has been approved, so the restaurant, time, budget and group size are locked. To change them, cancel and create a new meal.';
  if (meal.status !== 'OPEN' || Date.parse(meal.closesAt.instant) <= now) return 'Applications have closed, so this meal can’t be edited any more.';
  if (!meal.allowedActions.includes('EDIT')) return 'Only the host can edit this meal.';
  return null;
}

/** Save errors after which an edit can’t continue; the way out is back to the guest list. */
export const EDIT_FINAL: Record<string, string> = {
  ARRANGEMENT_LOCKED: 'A guest has been approved, so the restaurant, time, budget and group size are locked. Your changes weren’t saved.',
  DEADLINE_PASSED: 'Applications have closed, so this meal can’t be edited any more. Your changes weren’t saved.',
  MEAL_CANCELLED: 'This meal was cancelled, so it can’t be edited. Your changes weren’t saved.',
  VERSION_CONFLICT: 'This meal changed since you started editing. Go back to your guest list and start again.',
  STATE_CONFLICT: 'This meal changed since you started editing. Go back to your guest list and start again.',
  FORBIDDEN: 'Only the host can edit this meal.',
};

/**
 * Which TimeInput a TIME_AMBIGUOUS / TIME_NONEXISTENT / INVALID_OFFSET error refers to: the
 * server puts it under exactly `start` or `close`. Anything else is not guessed (null).
 */
export function timeFieldOf(fieldErrors: Record<string, string> | undefined): 'start' | 'close' | null {
  if (fieldErrors && 'start' in fieldErrors) return 'start';
  if (fieldErrors && 'close' in fieldErrors) return 'close';
  return null;
}

export type TimeResolution =
  | { kind: 'choose'; target: 'start' | 'close'; choices: TimeChoice[] }
  | { kind: 'nonexistent'; target: 'start' | 'close'; message: string }
  | { kind: 'invalidOffset'; target: 'start' | 'close'; message: string };

export function timeResolution(error: { code: string; fieldErrors?: Record<string, string> | undefined; choices?: TimeChoice[] | undefined }): TimeResolution | null {
  const target = timeFieldOf(error.fieldErrors);
  if (!target) return null;
  if (error.code === 'TIME_AMBIGUOUS' && error.choices?.length) return { kind: 'choose', target, choices: error.choices };
  if (error.code === 'TIME_NONEXISTENT')
    return { kind: 'nonexistent', target, message: `That ${target === 'start' ? 'meal time' : 'deadline'} doesn’t exist in London on that date because the clocks go forward. Choose another time.` };
  if (error.code === 'INVALID_OFFSET') return { kind: 'invalidOffset', target, message: 'That time zone choice no longer matches. Choose the time again.' };
  return null;
}

/** The host's reservation declaration, word for word as iOS. */
export function reservationDeclaration(d: Pick<MealDraft, 'venue' | 'capacity' | 'date' | 'time'>): string {
  return `I have already booked a table at ${d.venue?.name ?? 'the restaurant'} for ${d.capacity} people${d.date ? ` on ${longDate(d.date)}` : ''}${d.time ? ` at ${d.time} (Europe/London)` : ''}. This is my confirmation, not verification by Fancy.`;
}
