import { normalizeHostDeclarations, type CuisineCode, type DietaryCode, type LanguageCode, type MoodCode } from '@fancy/contracts';
import type { RequestOf, TimeChoice } from '@fancy/client';
import { compareWall, minusMinutes, wallMinutesBetween } from '../../lib/london.ts';

export type CreateBody = RequestOf<'createMeal'>['body'];

export interface VenueChoice {
  venueRef: string;
  placeId: string;
  name: string;
  address: string;
  attribution: string;
}

/** Host draft kept in memory across the four steps and the sign-in detour; cleared on publish/logout. */
export interface CreateDraft {
  attemptId: string;
  venue: VenueChoice | null;
  date: string | null;
  time: string | null;
  capacity: number;
  minimum: number;
  closeDate: string | null;
  closeTime: string | null;
  /** True once the host edited the deadline; otherwise it follows start − 60 min. */
  closeEdited: boolean;
  title: string;
  description: string;
  mood: MoodCode | null;
  languages: LanguageCode[];
  cuisineCode: CuisineCode | null;
  dietaryCodes: DietaryCode[];
  budgetMin: string;
  budgetMax: string;
  bookingDeclarationConfirmed: boolean;
  reviewConfirmed: boolean;
  /** Offsets chosen by the host after TIME_AMBIGUOUS (BST/GMT); dropped whenever that time changes. */
  startOffset: number | null;
  closeOffset: number | null;
}

export const emptyDraft = (attemptId: string): CreateDraft => ({
  attemptId,
  venue: null,
  date: null,
  time: null,
  capacity: 4,
  minimum: 2,
  closeDate: null,
  closeTime: null,
  closeEdited: false,
  title: '',
  description: '',
  mood: null,
  languages: [],
  cuisineCode: null,
  dietaryCodes: [],
  budgetMin: '',
  budgetMax: '',
  bookingDeclarationConfirmed: false,
  reviewConfirmed: false,
  startOffset: null,
  closeOffset: null,
});

/**
 * Applies an edit and its dependent invalidations (UX contract: schedule changes invalidate
 * incompatible choices and the external attestation; review confirmation never survives edits).
 */
export function updateDraft(draft: CreateDraft, patch: Partial<CreateDraft>): CreateDraft {
  const next: CreateDraft = { ...draft, ...patch };
  const scheduleChanged = ('date' in patch && patch.date !== draft.date) || ('time' in patch && patch.time !== draft.time);
  const venueChanged = 'venue' in patch && patch.venue?.venueRef !== draft.venue?.venueRef;
  if (scheduleChanged) next.startOffset = null;
  if (('closeDate' in patch && patch.closeDate !== draft.closeDate) || ('closeTime' in patch && patch.closeTime !== draft.closeTime)) next.closeOffset = null;
  if (scheduleChanged && !next.closeEdited && next.date && next.time) {
    const d = minusMinutes(next.date, next.time, 60);
    next.closeDate = d.date;
    next.closeTime = d.time;
    next.closeOffset = null;
  }
  if (scheduleChanged || venueChanged || 'capacity' in patch) next.bookingDeclarationConfirmed = 'bookingDeclarationConfirmed' in patch ? Boolean(patch.bookingDeclarationConfirmed) : false;
  if (next.minimum > next.capacity) next.minimum = next.capacity;
  if (!('reviewConfirmed' in patch)) next.reviewConfirmed = false;
  return next;
}

export type Step = 0 | 1 | 2 | 3;
export const STEPS = ['Arrange', 'Introduce', 'Costs', 'Review'] as const;

const BUDGET_FORMAT = /^\d{1,5}(\.\d{1,2})?$/;
const poundsToPence = (value: string): number | null => {
  const v = value.trim();
  if (!BUDGET_FORMAT.test(v)) return null;
  const pence = Math.round(Number(v) * 100);
  return pence > 0 ? pence : null;
};

const amountIssue = (value: string): string | null => {
  const v = value.trim();
  if (!v) return null;
  if (!BUDGET_FORMAT.test(v)) return 'Use pounds only, like 20 or 22.50.';
  return poundsToPence(v) === null ? 'Enter an amount above £0.' : null;
};

/**
 * Inline Costs errors shown while typing: a malformed or zero amount under its own field, and
 * “To” below “From” under To. Empty fields are not an error until Continue.
 */
export function budgetIssues(draft: Pick<CreateDraft, 'budgetMin' | 'budgetMax'>): { min: string | null; max: string | null } {
  const min = amountIssue(draft.budgetMin);
  const max = amountIssue(draft.budgetMax);
  if (min || max) return { min, max };
  const lo = poundsToPence(draft.budgetMin);
  const hi = poundsToPence(draft.budgetMax);
  return { min: null, max: lo !== null && hi !== null && lo > hi ? `Must be at least £${draft.budgetMin.trim()}, the “From” amount.` : null };
}

const minutesOf = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
/** A deadline slot later than 30 minutes before the meal (same London date); the server re-validates. */
export function deadlineTooLate(d: Pick<CreateDraft, 'date' | 'time' | 'closeDate'>, slot: string): boolean {
  if (!d.date || !d.time || !d.closeDate) return false;
  if (d.closeDate > d.date) return true;
  return d.closeDate === d.date && minutesOf(slot) > minutesOf(d.time) - 30;
}

/** Client checks mirror the API (lengths, 2–6, min ≤ capacity, deadline ≤ T−30); the server re-validates. */
export function validateStep(draft: CreateDraft, step: Step, todayLondon: string): string | null {
  if (step === 0) {
    if (!draft.venue) return 'Choose a restaurant.';
    if (!draft.date || !draft.time) return 'Choose a date and time.';
    if (draft.date < todayLondon) return 'Choose a date from today onwards.';
    if (draft.capacity < 2 || draft.capacity > 6) return 'Choose 2–6 people, including you.';
    if (draft.minimum < 2 || draft.minimum > draft.capacity) return 'The minimum must be between 2 and the table size.';
    if (!draft.closeDate || !draft.closeTime) return 'Choose when applications close.';
    const start = { date: draft.date, time: draft.time };
    const close = { date: draft.closeDate, time: draft.closeTime };
    if (compareWall(close, start) >= 0 || wallMinutesBetween(close, start) < 30) return 'Applications must close at least 30 minutes before the meal.';
    return null;
  }
  if (step === 1) {
    const title = draft.title.trim().length;
    const description = draft.description.trim().length;
    if (title < 5 || title > 80) return 'Give your meal a title of 5–80 characters.';
    if (description < 20 || description > 1000) return 'Tell guests about your meal in 20–1,000 characters.';
    if (!draft.mood) return 'Choose an atmosphere.';
    if (draft.languages.length < 1) return 'Choose a conversation language.';
    return null;
  }
  if (step === 2) {
    const min = poundsToPence(draft.budgetMin);
    const max = poundsToPence(draft.budgetMax);
    if (min === null || max === null || min > max) return 'Enter a valid budget, with the maximum at least the minimum.';
    if (!draft.bookingDeclarationConfirmed) return 'Confirm that you have already booked the table with the restaurant.';
    return null;
  }
  if (!draft.reviewConfirmed) return 'Confirm you’ve reviewed the details before publishing.';
  for (const s of [0, 1, 2] as const) {
    const issue = validateStep(draft, s, todayLondon);
    if (issue) return issue;
  }
  return null;
}

export function toCreateBody(draft: CreateDraft, termsVersion: string): CreateBody {
  if (!draft.venue || !draft.date || !draft.time || !draft.closeDate || !draft.closeTime || !draft.mood) throw new Error('Draft incomplete');
  const declarations = normalizeHostDeclarations({ cuisineCode: draft.cuisineCode, dietaryCodes: draft.dietaryCodes });
  return {
    attemptId: draft.attemptId,
    venueRef: draft.venue.venueRef,
    title: draft.title.trim(),
    description: draft.description.trim(),
    start: { localDate: draft.date, localTime: draft.time, timeZone: 'Europe/London', ...(draft.startOffset !== null ? { utcOffsetMinutes: draft.startOffset } : {}) },
    close: { localDate: draft.closeDate, localTime: draft.closeTime, timeZone: 'Europe/London', ...(draft.closeOffset !== null ? { utcOffsetMinutes: draft.closeOffset } : {}) },
    minimum: draft.minimum,
    capacity: draft.capacity,
    budgetMinPence: poundsToPence(draft.budgetMin)!,
    budgetMaxPence: poundsToPence(draft.budgetMax)!,
    languages: [...draft.languages],
    mood: draft.mood,
    cuisineCode: declarations.cuisineCode,
    dietaryCodes: declarations.dietaryCodes,
    bookingMode: 'EXTERNAL_PAY_AT_VENUE',
    bookingDeclarationConfirmed: true,
    reviewConfirmed: true,
    termsVersion,
  };
}

/**
 * Which TimeInput a TIME_* error refers to. CONTRACT GAP: ErrorBody has one `choices` list and the
 * field is only identifiable through fieldErrors keys; `close`/`closesAt` → close, otherwise start.
 */
export function timeErrorTarget(fieldErrors: Record<string, string> | undefined): 'start' | 'close' {
  return Object.keys(fieldErrors ?? {}).some((k) => /close/i.test(k)) ? 'close' : 'start';
}

export type TimeResolution =
  | { kind: 'choose'; target: 'start' | 'close'; choices: TimeChoice[] }
  | { kind: 'nonexistent'; target: 'start' | 'close'; message: string }
  | { kind: 'invalidOffset'; target: 'start' | 'close'; message: string };

export function timeResolution(error: { code: string; fieldErrors?: Record<string, string> | undefined; choices?: TimeChoice[] | undefined }): TimeResolution | null {
  const target = timeErrorTarget(error.fieldErrors);
  if (error.code === 'TIME_AMBIGUOUS' && error.choices?.length) return { kind: 'choose', target, choices: error.choices };
  if (error.code === 'TIME_NONEXISTENT')
    return { kind: 'nonexistent', target, message: `That ${target === 'start' ? 'meal time' : 'deadline'} doesn’t exist in London on that date because the clocks go forward. Choose another time.` };
  if (error.code === 'INVALID_OFFSET') return { kind: 'invalidOffset', target, message: 'That time zone choice no longer matches. Choose the time again.' };
  return null;
}
