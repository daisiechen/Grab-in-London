import { normalizeHostDeclarations, type CuisineCode, type DietaryCode, type LanguageCode, type MoodCode } from '@fancy/contracts';
import type { RequestOf, ResponseOf, TimeChoice } from '@fancy/client';
import { compareWall, minusMinutes, wallMinutesBetween } from '../../lib/london.ts';

export type CreateBody = RequestOf<'createMeal'>['body'];
export type EditBody = RequestOf<'editMeal'>['body'];
export type EditableMeal = ResponseOf<'getMeal'>['data']['meal'];
/** Create publishes a new meal; edit changes an existing one (no booking/review attestations). */
export type FlowKind = 'create' | 'edit';

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

/** Provider display refreshes do not change the selected restaurant's verified identity (web sameVenue). */
export const sameVenue = (a: VenueChoice | null | undefined, b: VenueChoice | null | undefined): boolean =>
  !!a && !!b && (a.placeId && b.placeId ? a.placeId === b.placeId : a.venueRef === b.venueRef);

/**
 * Applies an edit and its dependent invalidations (UX contract: schedule changes invalidate
 * incompatible choices and the external attestation; review confirmation never survives edits).
 * Confirming a different restaurant clears the meal time and its BST/GMT choices (PRD FR05,
 * QA-CREATE-004; same as web updateDraft); the first pick keeps a time already chosen, and a
 * same-place display refresh changes nothing.
 */
export function updateDraft(draft: CreateDraft, patch: Partial<CreateDraft>): CreateDraft {
  const next: CreateDraft = { ...draft, ...patch };
  const keys = Object.keys(patch);
  if (keys.length > 0 && keys.every((k) => k === 'venue') && sameVenue(draft.venue, patch.venue)) return next;
  const venueChanged = 'venue' in patch && !sameVenue(draft.venue, patch.venue ?? null);
  if (venueChanged && draft.venue) {
    if (!('time' in patch)) next.time = null;
    next.startOffset = null;
    next.closeOffset = null;
  }
  const scheduleChanged = ('date' in patch && patch.date !== draft.date) || ('time' in patch && patch.time !== draft.time);
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

/**
 * Client checks mirror the API (lengths, 2–6, min ≤ capacity, deadline ≤ T−30); the server re-validates.
 * Edit skips the create-only attestations (booking declaration, review confirmation).
 */
export function validateStep(draft: CreateDraft, step: Step, todayLondon: string, kind: FlowKind = 'create'): string | null {
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
    if (kind === 'create' && !draft.bookingDeclarationConfirmed) return 'Confirm that you have already booked the table with the restaurant.';
    return null;
  }
  if (kind === 'create' && !draft.reviewConfirmed) return 'Confirm you’ve reviewed the details before publishing.';
  for (const s of [0, 1, 2] as const) {
    const issue = validateStep(draft, s, todayLondon, kind);
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

const poundsText = (pence: number) => (pence % 100 === 0 ? String(pence / 100) : (pence / 100).toFixed(2));

/** Edit prefill: the meal as the host last published it, in the same draft shape as Create. */
export function draftFromMeal(meal: EditableMeal): CreateDraft {
  const start = meal.startsAt;
  const close = meal.closesAt;
  const followsStart = minusMinutes(start.localDate, start.localTime, 60);
  return {
    ...emptyDraft(meal.id),
    venue: { venueRef: meal.venue.venueRef, placeId: meal.venue.placeId, name: meal.venue.name ?? 'Restaurant', address: meal.venue.address ?? '', attribution: meal.venue.attributions.map((a) => a.text).join(' · ') },
    date: start.localDate,
    time: start.localTime,
    capacity: meal.capacity,
    minimum: meal.minimum,
    closeDate: close.localDate,
    closeTime: close.localTime,
    // A deadline that still sits at start − 60 keeps following the meal time, as in Create.
    closeEdited: followsStart.date !== close.localDate || followsStart.time !== close.localTime,
    title: meal.title,
    description: meal.description,
    mood: meal.mood,
    languages: [...meal.languages],
    cuisineCode: meal.cuisineCode,
    dietaryCodes: [...(meal.dietaryCodes ?? [])],
    budgetMin: poundsText(meal.budgetMinPence),
    budgetMax: poundsText(meal.budgetMaxPence),
    // Edit never asks for the create attestations; the existing booking report stays on the meal.
    bookingDeclarationConfirmed: true,
  };
}

const sameSet = <T extends string>(a: readonly T[] | null, b: readonly T[] | null) => [...(a ?? [])].sort().join(',') === [...(b ?? [])].sort().join(',');

/** Edit PATCH body with only the fields that differ from `base`; null when nothing changed. */
export function toEditBody(draft: CreateDraft, base: EditableMeal): EditBody | null {
  if (!draft.venue || !draft.date || !draft.time || !draft.closeDate || !draft.closeTime || !draft.mood) throw new Error('Draft incomplete');
  const body: EditBody = {};
  const declarations = normalizeHostDeclarations({ cuisineCode: draft.cuisineCode, dietaryCodes: draft.dietaryCodes });
  if (draft.venue.venueRef !== base.venue.venueRef) body.venueRef = draft.venue.venueRef;
  if (draft.title.trim() !== base.title) body.title = draft.title.trim();
  if (draft.description.trim() !== base.description) body.description = draft.description.trim();
  if (draft.date !== base.startsAt.localDate || draft.time !== base.startsAt.localTime || draft.startOffset !== null)
    body.start = { localDate: draft.date, localTime: draft.time, timeZone: 'Europe/London', ...(draft.startOffset !== null ? { utcOffsetMinutes: draft.startOffset } : {}) };
  if (draft.closeDate !== base.closesAt.localDate || draft.closeTime !== base.closesAt.localTime || draft.closeOffset !== null)
    body.close = { localDate: draft.closeDate, localTime: draft.closeTime, timeZone: 'Europe/London', ...(draft.closeOffset !== null ? { utcOffsetMinutes: draft.closeOffset } : {}) };
  if (draft.minimum !== base.minimum) body.minimum = draft.minimum;
  if (draft.capacity !== base.capacity) body.capacity = draft.capacity;
  const min = poundsToPence(draft.budgetMin)!;
  const max = poundsToPence(draft.budgetMax)!;
  if (min !== base.budgetMinPence) body.budgetMinPence = min;
  if (max !== base.budgetMaxPence) body.budgetMaxPence = max;
  if (!sameSet(draft.languages, base.languages)) body.languages = [...draft.languages];
  if (draft.mood !== base.mood) body.mood = draft.mood;
  if (declarations.cuisineCode !== base.cuisineCode) body.cuisineCode = declarations.cuisineCode;
  if (!sameSet(declarations.dietaryCodes, base.dietaryCodes)) body.dietaryCodes = declarations.dietaryCodes;
  return Object.keys(body).length ? body : null;
}

/**
 * Why the host can’t edit (r07: only before the first approval, while OPEN and before the deadline);
 * null when editing is allowed. The server re-checks on save.
 */
export function editBlockedReason(meal: EditableMeal, now: number): string | null {
  if (meal.status === 'CANCELLED') return 'This meal was cancelled, so it can’t be edited.';
  if (meal.arrangementLocked) return 'A guest has been approved, so the restaurant, time, budget and group size are locked. To change them, cancel and create a new meal.';
  if (meal.status !== 'OPEN' || Date.parse(meal.closesAt.instant) <= now) return 'Applications have closed, so this meal can’t be edited any more.';
  if (!meal.allowedActions.includes('EDIT')) return 'Only the host can edit this meal.';
  return null;
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
