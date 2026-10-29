import { FORM_ERROR_MESSAGES, formErrorProperties } from './form-errors.ts';
import { emptyDraft, updateDraft, validateStep, type CreateDraft, type Step } from '../features/create/model.ts';

const TODAY = '2026-10-21';
const VENUE = { venueRef: '2c1b0a9f-8e7d-4c6b-9a5f-4e3d2c1b0a9f', placeId: 'place-1', name: 'Dishoom', address: '7 Boundary St', attribution: 'Google' };

function complete(): CreateDraft {
  let d = emptyDraft('7f0e1d2c-3b4a-4596-8877-665544332211');
  d = updateDraft(d, { venue: VENUE, date: '2026-10-25', time: '19:00', capacity: 4, minimum: 3 });
  d = updateDraft(d, { title: 'Sunday dinner', description: 'A relaxed dinner with new faces.', mood: 'EASY_CONVERSATION', languages: ['en'] });
  d = updateDraft(d, { budgetMin: '20', budgetMax: '35', bookingDeclarationConfirmed: true });
  return updateDraft(d, { reviewConfirmed: true });
}

/** One draft per client check, run through the real validateStep so the copy can't drift from the mapping. */
const CASES: [Partial<CreateDraft>, Step, string, string, string][] = [
  [{ venue: null }, 0, 'arrange', 'venue', 'required'],
  [{ time: null }, 0, 'arrange', 'time', 'required'],
  [{ date: '2026-10-20' }, 0, 'arrange', 'date', 'out_of_range'],
  [{ capacity: 7 }, 0, 'arrange', 'capacity', 'out_of_range'],
  [{ minimum: 5 }, 0, 'arrange', 'minimum', 'out_of_range'],
  [{ closeTime: null }, 0, 'arrange', 'closeTime', 'required'],
  [{ closeTime: '18:45' }, 0, 'arrange', 'closeTime', 'out_of_range'],
  [{ title: 'Four' }, 1, 'introduce', 'title', 'invalid'],
  [{ description: 'Too short' }, 1, 'introduce', 'description', 'invalid'],
  [{ mood: null }, 1, 'introduce', 'mood', 'required'],
  [{ languages: [] }, 1, 'introduce', 'languages', 'required'],
  [{ budgetMin: '40', budgetMax: '30' }, 2, 'costs', 'budgetMax', 'invalid'],
  [{ bookingDeclarationConfirmed: false }, 2, 'costs', 'bookingConfirmed', 'required'],
  [{ reviewConfirmed: false }, 3, 'review', 'reviewConfirmed', 'required'],
];

describe('form_error mapping follows the messages validateStep actually shows', () => {
  it.each(CASES)('%j at step %i → %s.%s %s', (patch, step, stepName, field, errorCode) => {
    const message = validateStep({ ...complete(), ...patch }, step, TODAY, 'create');
    expect(message).not.toBeNull();
    expect(formErrorProperties('attempt', message!)).toEqual({ attemptId: 'attempt', step: stepName, field, errorCode });
  });

  it('maps exactly the messages validateStep returns, with no stale copy left over', () => {
    const shown = CASES.map(([patch, step]) => validateStep({ ...complete(), ...patch }, step, TODAY, 'create'));
    expect(new Set(shown)).toEqual(new Set(FORM_ERROR_MESSAGES));
  });
});
