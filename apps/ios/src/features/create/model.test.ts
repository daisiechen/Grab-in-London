import { emptyDraft, timeResolution, toCreateBody, updateDraft, validateStep, type CreateDraft } from './model.ts';
import { minusMinutes } from '../../lib/london.ts';

const VENUE = { venueRef: '2c1b0a9f-8e7d-4c6b-9a5f-4e3d2c1b0a9f', placeId: 'place-1', name: 'Dishoom', address: '7 Boundary St', attribution: 'Google' };
const TODAY = '2026-10-21';

function complete(): CreateDraft {
  let d = emptyDraft('7f0e1d2c-3b4a-4596-8877-665544332211');
  d = updateDraft(d, { venue: VENUE, date: '2026-10-25', time: '19:00', capacity: 4, minimum: 3 });
  d = updateDraft(d, { title: 'Sunday dinner', description: 'A relaxed dinner with new faces.', mood: 'EASY_CONVERSATION', languages: ['en'] });
  d = updateDraft(d, { budgetMin: '20', budgetMax: '35', bookingDeclarationConfirmed: true });
  return updateDraft(d, { reviewConfirmed: true });
}

describe('create draft invalidation', () => {
  it('defaults the deadline to start − 60 minutes and follows the start until edited', () => {
    let d = updateDraft(emptyDraft('a'), { date: '2026-10-25', time: '19:00' });
    expect([d.closeDate, d.closeTime]).toEqual(['2026-10-25', '18:00']);
    d = updateDraft(d, { time: '00:30' });
    expect([d.closeDate, d.closeTime]).toEqual(['2026-10-24', '23:30']);
    d = updateDraft(d, { closeTime: '20:00', closeEdited: true });
    d = updateDraft(d, { time: '21:00' });
    expect(d.closeTime).toBe('20:00');
  });

  it('schedule, venue or size changes clear the booking attestation, chosen offset and review tick', () => {
    let d = complete();
    d = updateDraft(d, { startOffset: 60, reviewConfirmed: true });
    d = updateDraft(d, { time: '20:00' });
    expect(d.bookingDeclarationConfirmed).toBe(false);
    expect(d.startOffset).toBeNull();
    expect(d.reviewConfirmed).toBe(false);
    d = updateDraft(complete(), { capacity: 2 });
    expect(d.minimum).toBe(2);
    expect(d.bookingDeclarationConfirmed).toBe(false);
  });

  it('a text edit keeps the booking attestation but always clears the review tick', () => {
    const d = updateDraft(complete(), { title: 'Sunday dinner!' });
    expect(d.bookingDeclarationConfirmed).toBe(true);
    expect(d.reviewConfirmed).toBe(false);
  });
});

describe('create validation (QA-INPUT-009..016, QA-CREATE-002/003)', () => {
  it.each([
    [{ title: 'Four' }, 1, 'Give your meal a title of 5–80 characters.'],
    [{ title: 'x'.repeat(81) }, 1, 'Give your meal a title of 5–80 characters.'],
    [{ description: 'x'.repeat(19) }, 1, 'Tell guests about your meal in 20–1,000 characters.'],
    [{ description: 'x'.repeat(1001) }, 1, 'Tell guests about your meal in 20–1,000 characters.'],
    [{ budgetMin: '40', budgetMax: '30' }, 2, 'Enter a valid budget, with the maximum at least the minimum.'],
    [{ budgetMin: '0', budgetMax: '30' }, 2, 'Enter a valid budget, with the maximum at least the minimum.'],
    [{ closeDate: '2026-10-25', closeTime: '18:45', closeEdited: true }, 0, 'Applications must close at least 30 minutes before the meal.'],
    [{ date: '2026-10-20' }, 0, 'Choose a date from today onwards.'],
  ] as const)('%j at step %i', (patch, step, message) => {
    expect(validateStep({ ...complete(), ...patch }, step, TODAY)).toBe(message);
  });

  it('accepts the boundaries 5/80 title, 20/1000 description and a deadline exactly T−30', () => {
    expect(validateStep({ ...complete(), title: 'x'.repeat(5), description: 'x'.repeat(20) }, 1, TODAY)).toBeNull();
    expect(validateStep({ ...complete(), title: 'x'.repeat(80), description: 'x'.repeat(1000) }, 1, TODAY)).toBeNull();
    expect(validateStep({ ...complete(), closeTime: '18:30' }, 0, TODAY)).toBeNull();
  });

  it('booking attestation and review must be explicitly ticked', () => {
    expect(validateStep({ ...complete(), bookingDeclarationConfirmed: false }, 2, TODAY)).toMatch(/reserve the table/);
    expect(validateStep({ ...complete(), reviewConfirmed: false }, 3, TODAY)).toMatch(/reviewed/);
  });
});

describe('createMeal body', () => {
  it('sends London wall time without offset until the host chose one; P-05 not provided = null', () => {
    const body = toCreateBody(complete(), '2026-10-21');
    expect(body).toMatchObject({
      start: { localDate: '2026-10-25', localTime: '19:00', timeZone: 'Europe/London' },
      close: { localDate: '2026-10-25', localTime: '18:00', timeZone: 'Europe/London' },
      budgetMinPence: 2000, budgetMaxPence: 3500, bookingMode: 'EXTERNAL_PAY_AT_VENUE',
      bookingDeclarationConfirmed: true, reviewConfirmed: true, cuisineCode: null, dietaryCodes: null,
    });
    expect(body.start).not.toHaveProperty('utcOffsetMinutes');
    expect(toCreateBody({ ...complete(), startOffset: 0, dietaryCodes: ['VEGAN', 'VEGETARIAN_OPTIONS'] }, 'v').start.utcOffsetMinutes).toBe(0);
    expect(toCreateBody({ ...complete(), dietaryCodes: ['VEGAN', 'VEGETARIAN_OPTIONS'] }, 'v').dietaryCodes).toEqual(['VEGETARIAN_OPTIONS', 'VEGAN']);
  });
});

describe('DST resolution (QA-TIME-004..007)', () => {
  const choices = [
    { utcOffsetMinutes: 60, label: 'BST', instant: '2026-10-25T00:30:00Z' },
    { utcOffsetMinutes: 0, label: 'GMT', instant: '2026-10-25T01:30:00Z' },
  ];
  it('ambiguous autumn time asks for an explicit BST/GMT choice', () => {
    expect(timeResolution({ code: 'TIME_AMBIGUOUS', choices })).toEqual({ kind: 'choose', target: 'start', choices });
    expect(timeResolution({ code: 'TIME_AMBIGUOUS', choices, fieldErrors: { close: 'ambiguous' } })?.target).toBe('close');
  });
  it('a nonexistent spring time is an error, never silently shifted', () => {
    expect(timeResolution({ code: 'TIME_NONEXISTENT' })).toMatchObject({ kind: 'nonexistent', target: 'start' });
  });
  it('wall-clock deadline arithmetic crosses midnight', () => {
    expect(minusMinutes('2026-03-29', '00:30', 60)).toEqual({ date: '2026-03-28', time: '23:30' });
  });
});
