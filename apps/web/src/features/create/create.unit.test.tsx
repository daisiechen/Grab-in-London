import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createFetchStub, fail, ok, page, type RecordedCall } from '../../test/fetchStub.ts';
import { renderApp } from '../../test/render.tsx';
import { MEAL_ID, VENUE_REF, meal, session } from '../../test/fixtures.ts';
import { loadDraft, saveDraft } from '../../lib/drafts.ts';
import { addDays, londonToday } from '../../lib/london.ts';
import type { Meal } from '../../api/types.ts';
import {
  budgetIssues, deadlineTooLate, draftFromMeal, editBlockedReason, newDraft, poundsToPence, timeFieldOf, timeResolution, toCreateBody, toEditBody, updateDraft, validateStep, type MealDraft,
} from './model.ts';

const venue = { venueRef: VENUE_REF, placeId: 'p-1', available: true, name: 'Dishoom', address: '22 Kingly St, London', location: null, areaCode: 'soho', attributions: [], displayExpiresAt: null };
const TODAY = londonToday();
const DAY = addDays(TODAY, 10);
const EVE = addDays(TODAY, 9);

const complete = (over: Partial<MealDraft> = {}): MealDraft => ({
  ...newDraft(), venue, capacity: 4, minimum: 3, date: DAY, time: '01:30', closeDate: EVE, closeTime: '22:00', closeEdited: true,
  title: 'Late supper club', description: 'A relaxed late dinner for night owls and new faces.', mood: 'EASY_CONVERSATION',
  languages: ['en'], budgetMin: '25', budgetMax: '40', bookingConfirmed: true, reviewConfirmed: false, ...over,
});
/** A meal the host can still edit: open, deadline in the future, nobody approved yet. */
const editable = (over: Record<string, unknown> = {}) => meal({
  allowedActions: ['EDIT', 'CANCEL'],
  startsAt: { instant: `${DAY}T18:30:00.000Z`, localDate: DAY, localTime: '19:30', timeZone: 'Europe/London', utcOffsetMinutes: 60 },
  closesAt: { instant: `${DAY}T17:30:00.000Z`, localDate: DAY, localTime: '18:30', timeZone: 'Europe/London', utcOffsetMinutes: 60 },
  ...over,
});

function createStub(createMeal: (call: RecordedCall) => ReturnType<typeof ok>) {
  return createFetchStub({
    getSession: () => ok(session()),
    createMeal,
    getMeal: () => ok({ meal: meal(), myApplication: null, conversationId: null }),
  });
}

async function toReview() {
  for (const heading of ['Good company starts here.', 'Keep things clear.', 'Ready to bring people together?']) {
    await userEvent.click(await screen.findByRole('button', { name: /Continue/ }));
    await screen.findByRole('heading', { name: heading });
  }
}

describe('create meal model (iOS model.ts semantics)', () => {
  it('converts pounds to integer pence without float maths, above £0 only', () => {
    expect(poundsToPence('25')).toBe(2500);
    expect(poundsToPence('25.5')).toBe(2550);
    expect(poundsToPence('0.07')).toBe(7);
    expect(poundsToPence('0')).toBeNull();
    expect(poundsToPence('25.555')).toBeNull();
    expect(poundsToPence('-3')).toBeNull();
  });
  it('moves an untouched deadline to an hour before the meal, across midnight, and keeps a chosen one', () => {
    const fresh = updateDraft(newDraft(), { date: DAY, time: '00:30' });
    expect({ closeDate: fresh.closeDate, closeTime: fresh.closeTime }).toEqual({ closeDate: EVE, closeTime: '23:30' });
    const chosen = updateDraft({ ...fresh, closeTime: '20:00', closeEdited: true }, { time: '02:00' });
    expect(chosen.closeTime).toBe('20:00');
  });
  it('drops the booking and review ticks when the arrangement changes, and clamps the minimum', () => {
    const d = complete({ reviewConfirmed: true, capacity: 6, minimum: 6 });
    const smaller = updateDraft(d, { capacity: 4 });
    expect(smaller).toMatchObject({ bookingConfirmed: false, reviewConfirmed: false, minimum: 4 });
    expect(updateDraft(d, { title: 'Late supper club!' })).toMatchObject({ bookingConfirmed: true, reviewConfirmed: false });
  });
  it('requires the deadline at least 30 minutes before the meal and a date from today', () => {
    expect(validateStep(complete({ closeDate: DAY, closeTime: '01:10' }), 0, TODAY)).toMatch(/30 minutes/);
    expect(validateStep(complete({ date: addDays(TODAY, -1) }), 0, TODAY)).toBe('Choose a date from today onwards.');
    expect(validateStep(complete(), 0, TODAY)).toBeNull();
  });
  it('greys out deadline slots later than 30 minutes before a same-day meal', () => {
    const d = { date: DAY, time: '19:00', closeDate: DAY };
    expect(deadlineTooLate(d, '18:30')).toBe(false);
    expect(deadlineTooLate(d, '19:00')).toBe(true);
  });
  it('explains budget problems while typing', () => {
    expect(budgetIssues({ budgetMin: '20', budgetMax: '15' }).max).toBe('Must be at least £20, the “From” amount.');
    expect(budgetIssues({ budgetMin: '£20', budgetMax: '' }).min).toBe('Use pounds only, like 20 or 22.50.');
  });
  it('never builds a body without both explicit confirmations', () => {
    expect(toCreateBody(complete({ reviewConfirmed: false }))).toBeNull();
    expect(toCreateBody(complete({ bookingConfirmed: false, reviewConfirmed: true }))).toBeNull();
  });
  it('maps time errors only by the exact start/close field keys', () => {
    expect(timeFieldOf({ start: 'x' })).toBe('start');
    expect(timeFieldOf({ close: 'x' })).toBe('close');
    expect(timeFieldOf({ '/close': 'x' })).toBeNull();
    expect(timeResolution({ code: 'TIME_NONEXISTENT', fieldErrors: { close: 'x' } })).toMatchObject({ kind: 'nonexistent', target: 'close' });
  });
  it('edit body contains only changed fields', () => {
    const base = editable() as unknown as Meal;
    const before = draftFromMeal(base);
    expect(toEditBody(before, base)).toBeNull();
    expect(toEditBody({ ...before, title: 'Friday dinner & friends' }, base)).toEqual({ title: 'Friday dinner & friends' });
  });
  it('explains why a meal can no longer be edited', () => {
    expect(editBlockedReason(editable({ arrangementLocked: true }) as unknown as Meal, Date.now())).toMatch(/locked/);
    expect(editBlockedReason(meal({ allowedActions: ['EDIT'] }) as unknown as Meal, Date.parse('2027-01-01'))).toMatch(/Applications have closed/);
    expect(editBlockedReason(editable() as unknown as Meal, Date.now())).toBeNull();
  });
});

describe('create meal flow', () => {
  it('requires explicit ticks and publishes an external pay-at-venue meal, then opens it', async () => {
    const stub = createStub(() => ok(meal(), 201));
    saveDraft('create', complete({ bookingConfirmed: false }));
    renderApp(stub.fetch, '/create');
    await userEvent.click(await screen.findByRole('button', { name: /Continue/ }));
    await userEvent.click(await screen.findByRole('button', { name: /Continue/ }));
    await screen.findByRole('heading', { name: 'Keep things clear.' });
    await userEvent.click(screen.getByRole('button', { name: /Continue/ }));
    expect((await screen.findByRole('alert')).textContent).toBe('Confirm that you have already booked the table with the restaurant.');
    const booking = screen.getByRole('checkbox', { name: /I have already booked a table at the restaurant for 4 people/ }) as HTMLInputElement;
    expect(booking.checked).toBe(false);
    await userEvent.click(booking);
    expect(screen.queryByRole('alert')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /Continue/ }));
    await userEvent.click(await screen.findByRole('button', { name: /Publish meal/ }));
    expect((await screen.findByRole('alert')).textContent).toBe('Confirm you’ve reviewed the details before publishing.');
    expect(stub.callsTo('createMeal')).toHaveLength(0);

    await userEvent.click(screen.getByRole('checkbox', { name: 'I’ve reviewed the details guests will see.' }));
    await userEvent.click(screen.getByRole('button', { name: /Publish meal/ }));
    await waitFor(() => expect(stub.callsTo('createMeal')).toHaveLength(1));
    const body = stub.callsTo('createMeal')[0]!.body as Record<string, unknown>;
    expect(body).toMatchObject({
      venueRef: VENUE_REF, bookingMode: 'EXTERNAL_PAY_AT_VENUE', bookingDeclarationConfirmed: true, reviewConfirmed: true,
      budgetMinPence: 2500, budgetMaxPence: 4000, cuisineCode: null, dietaryCodes: null, minimum: 3, capacity: 4,
      start: { localDate: DAY, localTime: '01:30', timeZone: 'Europe/London' },
      close: { localDate: EVE, localTime: '22:00', timeZone: 'Europe/London' },
    });
    expect(body.start).not.toHaveProperty('utcOffsetMinutes');
    expect(body).not.toHaveProperty('deposit');
    expect(await screen.findByRole('heading', { name: 'Friday dinner & new faces' })).toBeTruthy();
    expect(loadDraft('create')).toBeNull();
  });

  it('asks BST or GMT for a repeated London time and resubmits as a new intent with that offset', async () => {
    let n = 0;
    const stub = createStub(() => (++n === 1
      ? fail(422, 'TIME_AMBIGUOUS', {
        fieldErrors: { start: 'ambiguous' },
        choices: [{ utcOffsetMinutes: 60, label: 'BST', instant: '2026-10-25T00:30:00Z' }, { utcOffsetMinutes: 0, label: 'GMT', instant: '2026-10-25T01:30:00Z' }],
      })
      : ok(meal(), 201)));
    saveDraft('create', complete());
    renderApp(stub.fetch, '/create/review');
    await userEvent.click(await screen.findByRole('checkbox', { name: /reviewed the details/ }));
    await userEvent.click(screen.getByRole('button', { name: /Publish meal/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Which time do you mean?' });
    expect(within(sheet).getByText(/01:30 happens twice/)).toBeTruthy();
    const confirm = within(sheet).getByRole('button', { name: 'Publish with this time' }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    await userEvent.click(within(sheet).getByRole('radio', { name: 'GMT · after the clocks go back' }));
    await userEvent.click(confirm);
    await waitFor(() => expect(stub.callsTo('createMeal')).toHaveLength(2));
    const [first, second] = stub.callsTo('createMeal');
    expect((second!.body as { start: { utcOffsetMinutes: number } }).start.utcOffsetMinutes).toBe(0);
    expect(second!.headers['idempotency-key']).not.toBe(first!.headers['idempotency-key']);
    expect((second!.body as { attemptId: string }).attemptId).toBe((first!.body as { attemptId: string }).attemptId);
  });

  it('applies a BST/GMT choice to the deadline when the server names `close`', async () => {
    let n = 0;
    const stub = createStub(() => (++n === 1
      ? fail(422, 'TIME_AMBIGUOUS', { fieldErrors: { close: 'ambiguous' }, choices: [{ utcOffsetMinutes: 60, label: 'BST', instant: '2026-10-25T00:30:00Z' }, { utcOffsetMinutes: 0, label: 'GMT', instant: '2026-10-25T01:30:00Z' }] })
      : ok(meal(), 201)));
    saveDraft('create', complete({ time: '03:30', closeDate: DAY, closeTime: '01:30' }));
    renderApp(stub.fetch, '/create/review');
    await userEvent.click(await screen.findByRole('checkbox', { name: /reviewed the details/ }));
    await userEvent.click(screen.getByRole('button', { name: /Publish meal/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Which time do you mean?' });
    await userEvent.click(within(sheet).getByRole('radio', { name: 'BST · before the clocks go back' }));
    await userEvent.click(within(sheet).getByRole('button', { name: 'Publish with this time' }));
    await waitFor(() => expect(stub.callsTo('createMeal')).toHaveLength(2));
    const second = stub.callsTo('createMeal')[1]!.body as { start: object; close: { utcOffsetMinutes: number } };
    expect(second.close.utcOffsetMinutes).toBe(60);
    expect(second.start).not.toHaveProperty('utcOffsetMinutes');
  });

  it('treats a nonexistent London time as an error with a way back to the time', async () => {
    const stub = createStub(() => fail(422, 'TIME_NONEXISTENT', { fieldErrors: { start: 'nonexistent' } }));
    saveDraft('create', complete());
    renderApp(stub.fetch, '/create');
    await toReview();
    await userEvent.click(screen.getByRole('checkbox', { name: /reviewed the details/ }));
    await userEvent.click(screen.getByRole('button', { name: /Publish meal/ }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/^That meal time doesn’t exist in London on that date/);
    await userEvent.click(screen.getByRole('button', { name: 'Change the meal time' }));
    expect(await screen.findByRole('heading', { name: 'A place at your table.' })).toBeTruthy();
  });

  it('moves between steps with the step row and browser history, keeping the draft', async () => {
    saveDraft('create', complete());
    const stub = createStub(() => ok(meal(), 201));
    renderApp(stub.fetch, '/create');
    await toReview();
    await userEvent.click(screen.getByRole('button', { name: 'Edit introduction' }));
    expect(await screen.findByRole('heading', { name: 'Good company starts here.' })).toBeTruthy();
    expect((screen.getByLabelText('Give your meal a name') as HTMLInputElement).value).toBe('Late supper club');
    await userEvent.click(screen.getByRole('button', { name: 'Arrange, completed' }));
    expect(await screen.findByRole('heading', { name: 'A place at your table.' })).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Costs' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('a guest is asked to sign in and the draft is kept', async () => {
    const stub = createFetchStub({ getSession: () => fail(401, 'AUTH_REQUIRED') });
    saveDraft('create', complete());
    renderApp(stub.fetch, '/create');
    expect(await screen.findByRole('heading', { name: 'Host a meal' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Continue/ }).getAttribute('href')).toBe('/sign-in?returnTo=%2Fcreate');
    expect(loadDraft<MealDraft>('create')?.title).toBe('Late supper club');
  });

  it('an incomplete profile completes it first, keeping the draft', async () => {
    const stub = createFetchStub({
      getSession: () => ok(session({ profileGate: { ageConfirmed: true, communityAccepted: true, profileComplete: false, missing: ['bio'] } })),
      getMe: () => ok(session({ bio: null, profileGate: { ageConfirmed: true, communityAccepted: true, profileComplete: false, missing: ['bio'] } }).user),
    });
    saveDraft('create', complete());
    renderApp(stub.fetch, '/create');
    await userEvent.click(await screen.findByRole('link', { name: /Continue/ }));
    expect(await screen.findByRole('heading', { name: 'A face. A little story. You.' })).toBeTruthy();
    expect(stub.callsTo('createMeal')).toHaveLength(0);
    expect(loadDraft<MealDraft>('create')?.title).toBe('Late supper club');
  });

  it('chooses the date and time from the inline pickers and fills the deadline', async () => {
    const stub = createFetchStub({ getSession: () => ok(session()) });
    saveDraft('create', { ...newDraft(), venue });
    renderApp(stub.fetch, '/create');
    await userEvent.click(await screen.findByRole('button', { name: 'Date: Choose a date' }));
    const days = screen.getAllByRole('radio').filter((r) => !(r as HTMLInputElement).disabled);
    await userEvent.click(days[days.length - 1]!);
    // After the date, the time grid opens by itself.
    await userEvent.click(await screen.findByRole('radio', { name: '19:00' }));
    await waitFor(() => expect(loadDraft<MealDraft>('create')).toMatchObject({ time: '19:00', closeTime: '18:00' }));
    expect(screen.queryByRole('radio', { name: '19:00' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Increase maximum' }));
    expect(loadDraft<MealDraft>('create')?.capacity).toBe(5);
  });
});

describe('edit meal', () => {
  it('explains the permanent lock instead of the form once arrangements are locked', async () => {
    const stub = createFetchStub({
      getSession: () => ok(session()),
      getMeal: () => ok({ meal: editable({ arrangementLocked: true, allowedActions: ['CANCEL'] }), myApplication: null, conversationId: null }),
    });
    renderApp(stub.fetch, `/meals/${MEAL_ID}/edit`);
    expect(await screen.findByText(/restaurant, time, budget and group size are locked/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to your guest list' }).getAttribute('href')).toBe(`/meals/${MEAL_ID}/host`);
    expect(screen.queryByRole('button', { name: /Save changes/ })).toBeNull();
  });

  it('PATCHes only the changed fields with If-Match and returns to the guest list', async () => {
    const stub = createFetchStub({
      getSession: () => ok(session()),
      getMeal: () => ok({ meal: editable(), myApplication: null, conversationId: null }),
      editMeal: () => ok(editable({ version: '8' })),
      listApplications: () => page([]),
    });
    renderApp(stub.fetch, `/meals/${MEAL_ID}/edit`);
    expect(await screen.findByRole('heading', { name: 'Change the place and time.' })).toBeTruthy();
    expect(screen.queryByRole('checkbox', { name: /already booked/ })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /Continue/ }));
    const title = await screen.findByLabelText('Give your meal a name');
    await userEvent.clear(title);
    await userEvent.type(title, 'Friday dinner & friends');
    await userEvent.click(screen.getByRole('button', { name: /Continue/ }));
    await screen.findByRole('heading', { name: 'Update the costs.' });
    expect(screen.queryByRole('checkbox')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /Continue/ }));
    await screen.findByRole('heading', { name: 'Ready to save your changes?' });
    await userEvent.click(screen.getByRole('button', { name: /Save changes/ }));
    await waitFor(() => expect(stub.callsTo('editMeal')).toHaveLength(1));
    const call = stub.callsTo('editMeal')[0]!;
    expect(call.body).toEqual({ title: 'Friday dinner & friends' });
    expect(call.headers['if-match']).toBe('"7"');
    await waitFor(() => expect(loadDraft(`edit:${MEAL_ID}`)).toBeNull());
  });

  it('stops after a final save error and offers the way back', async () => {
    const stub = createFetchStub({
      getSession: () => ok(session()),
      getMeal: () => ok({ meal: editable(), myApplication: null, conversationId: null }),
      editMeal: () => fail(409, 'ARRANGEMENT_LOCKED'),
    });
    saveDraft(`edit:${MEAL_ID}`, { ...draftFromMeal(editable() as unknown as Meal), title: 'Friday dinner & friends' });
    renderApp(stub.fetch, `/meals/${MEAL_ID}/edit/review`);
    await userEvent.click(await screen.findByRole('button', { name: /Save changes/ }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/Your changes weren’t saved/);
    expect((screen.getByRole('button', { name: /Save changes/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Back to your guest list' })).toBeTruthy();
  });

  it('says so when nothing changed', async () => {
    const stub = createFetchStub({ getSession: () => ok(session()), getMeal: () => ok({ meal: editable(), myApplication: null, conversationId: null }) });
    renderApp(stub.fetch, `/meals/${MEAL_ID}/edit/review`);
    await userEvent.click(await screen.findByRole('button', { name: /Save changes/ }));
    expect((await screen.findByRole('alert')).textContent).toBe('You haven’t changed anything yet.');
    expect(stub.callsTo('editMeal')).toHaveLength(0);
  });
});
