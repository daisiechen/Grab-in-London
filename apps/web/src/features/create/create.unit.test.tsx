import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createFetchStub,fail,ok,page,type RecordedCall } from '../../test/fetchStub.ts';
import { renderApp } from '../../test/render.tsx';
import { MEAL_ID, VENUE_REF, meal, session } from '../../test/fixtures.ts';
import { loadDraft, saveDraft } from '../../lib/drafts.ts';
import { defaultClose, newDraft, poundsToPence, timeFieldOf, toCreateBody, validateStep, type MealDraft } from './model.ts';
import { editPatch } from './EditMealPage.tsx';

const venue = { venueRef: VENUE_REF, placeId: 'p-1', available: true, name: 'Dishoom', address: '22 Kingly St, London', location: null, areaCode: 'soho', attributions: [], displayExpiresAt: null };

const complete = (over: Partial<MealDraft> = {}): MealDraft => ({
  ...newDraft(), venue, capacity: 4, minimum: 3, date: '2026-10-25', time: '01:30', closeDate: '2026-10-24', closeTime: '22:00',
  title: 'Late supper club', description: 'A relaxed late dinner for night owls and new faces.', mood: 'EASY_CONVERSATION',
  languages: ['en'], budgetMin: '25', budgetMax: '40', bookingConfirmed: true, reviewConfirmed: false, ...over,
});

function createStub(createMeal: (call: RecordedCall) => ReturnType<typeof ok>) {
  return createFetchStub({
    getSession: () => ok(session()),
    createMeal,
    getMeal: () => ok({ meal: meal(), myApplication: null, conversationId: null }),
  });
}

async function toReview() {
  for (let i = 0; i < 3; i++) await userEvent.click(await screen.findByRole('button', { name: /Continue/ }));
  await screen.findByRole('heading', { name: 'Ready to bring people together?' });
}

describe('create meal model (T07)', () => {
  it.each([false,true])('returns from cancellation terms to the same Review with transient display and unchanged confirmation (%s)',async(confirmed)=>{
    const stub=createStub(()=>ok(meal(),201));stub.on('searchVenues',()=>page([{placeId:venue.placeId,name:venue.name,address:venue.address,location:null,attributions:[],areaCode:'soho'}]));stub.on('confirmVenue',()=>ok({...venue,name:null,address:null}));
    saveDraft('create',complete({venue:null,bookingConfirmed:false}));renderApp(stub.fetch,'/create');
    await userEvent.type(await screen.findByRole('searchbox',{name:'Search restaurants'}),'Dishoom');await userEvent.click(screen.getByRole('button',{name:'Search'}));
    await userEvent.click(await screen.findByRole('button',{name:/Dishoom/}));await userEvent.click(screen.getByRole('button',{name:'Use Dishoom'}));
    await userEvent.click(screen.getByRole('button',{name:/Continue/}));await userEvent.click(screen.getByRole('button',{name:/Continue/}));await userEvent.click(screen.getByRole('checkbox',{name:/I have a reservation/}));await userEvent.click(screen.getByRole('button',{name:/Continue/}));
    await screen.findByRole('heading',{name:'Ready to bring people together?'});if(confirmed)await userEvent.click(screen.getByRole('checkbox',{name:/checked the arrangements/}));await userEvent.click(screen.getByRole('link',{name:'cancellation terms'}));await screen.findByRole('heading',{name:'Cancellation terms'});
    await userEvent.click(screen.getByRole('link',{name:confirmed?'Back':'Back to review'}));expect(await screen.findByRole('heading',{name:'Ready to bring people together?'})).toBeTruthy();
    expect(screen.getByText(/Dishoom · 22 Kingly/)).toBeTruthy();expect((screen.getByRole('checkbox',{name:/checked the arrangements/}) as HTMLInputElement).checked).toBe(confirmed);expect(stub.callsTo('createMeal')).toHaveLength(0);
    expect(loadDraft<MealDraft>('create')?.venue).toMatchObject({venueRef:VENUE_REF,name:null,address:null});
  });
  it('keeps direct public terms access free of create draft initialization and create API calls',async()=>{
    const stub=createFetchStub({getSession:()=>fail(401,'AUTH_REQUIRED')});renderApp(stub.fetch,'/create/terms');
    expect(await screen.findByRole('heading',{name:'Cancellation terms'})).toBeTruthy();expect(loadDraft('create')).toBeNull();expect(stub.callsTo('createMeal')).toHaveLength(0);expect(stub.callsTo('ingestEvents')).toHaveLength(0);
  });
  it('converts pounds to integer pence without float maths', () => {
    expect(poundsToPence('25')).toBe(2500);
    expect(poundsToPence('25.5')).toBe(2550);
    expect(poundsToPence('0.07')).toBe(7);
    expect(poundsToPence('25.555')).toBeNull();
    expect(poundsToPence('-3')).toBeNull();
  });
  it('defaults the deadline to 60 minutes earlier on the wall clock, across midnight', () => {
    expect(defaultClose('2026-10-25', '00:30')).toEqual({ closeDate: '2026-10-24', closeTime: '23:30' });
  });
  it('requires the deadline at least 30 minutes before the meal', () => {
    expect(validateStep(complete({ closeDate: '2026-10-25', closeTime: '01:10' }), 0)).toMatch(/30 minutes/);
    expect(validateStep(complete(), 0)).toBe('');
  });
  it('never builds a body without both explicit confirmations', () => {
    expect(toCreateBody(complete({ reviewConfirmed: false }))).toBeNull();
    expect(toCreateBody(complete({ bookingConfirmed: false, reviewConfirmed: true }))).toBeNull();
  });
  it('maps time errors only by the exact start/close field keys', () => {
    expect(timeFieldOf({ start: 'x' })).toBe('start');
    expect(timeFieldOf({ close: 'x' })).toBe('close');
    expect(timeFieldOf({ '/close': 'x' })).toBeNull();
    expect(timeFieldOf(undefined)).toBeNull();
  });
  it('edit patch contains only changed fields', () => {
    const before = complete({ reviewConfirmed: true });
    expect(editPatch(before, { ...before, title: 'Late supper club!' })).toEqual({ title: 'Late supper club!' });
    expect(editPatch(before, before)).toBeNull();
  });
});

describe('create meal flow (T07)', () => {
  it('requires explicit ticks and publishes an external pay-at-venue meal', async () => {
    const stub = createStub(() => ok(meal(), 201));
    saveDraft('create', complete({ bookingConfirmed: false }));
    renderApp(stub.fetch, '/create');
    await userEvent.click(await screen.findByRole('button', { name: /Continue/ }));
    await userEvent.click(await screen.findByRole('button', { name: /Continue/ }));
    await userEvent.click(await screen.findByRole('button', { name: /Continue/ }));
    expect((await screen.findByRole('alert')).textContent).toBe('Confirm your restaurant reservation to continue.');
    expect((screen.getByRole('checkbox', { name: /I have a reservation at the restaurant/ }) as HTMLInputElement).checked).toBe(false);
    await userEvent.click(screen.getByRole('checkbox', { name: /I have a reservation at the restaurant/ }));
    await userEvent.click(screen.getByRole('button', { name: /Continue/ }));
    await userEvent.click(await screen.findByRole('button', { name: /Publish meal/ }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/cancellation terms/);
    expect(stub.callsTo('createMeal')).toHaveLength(0);

    await userEvent.click(screen.getByRole('checkbox', { name: /checked the arrangements/ }));
    await userEvent.click(screen.getByRole('button', { name: /Publish meal/ }));
    await waitFor(() => expect(stub.callsTo('createMeal')).toHaveLength(1));
    const body = stub.callsTo('createMeal')[0]!.body as Record<string, unknown>;
    expect(body).toMatchObject({
      venueRef: VENUE_REF, bookingMode: 'EXTERNAL_PAY_AT_VENUE', bookingDeclarationConfirmed: true, reviewConfirmed: true,
      budgetMinPence: 2500, budgetMaxPence: 4000, cuisineCode: null, dietaryCodes: null, minimum: 3, capacity: 4,
      start: { localDate: '2026-10-25', localTime: '01:30', timeZone: 'Europe/London' },
      close: { localDate: '2026-10-24', localTime: '22:00', timeZone: 'Europe/London' },
    });
    expect(body.start).not.toHaveProperty('utcOffsetMinutes');
    expect(body).not.toHaveProperty('deposit');
    expect(await screen.findByRole('heading', { name: 'Friday dinner & new faces' })).toBeTruthy();
    expect(loadDraft('create')).toBeNull();
  });

  it('an unknown publish never creates a second meal: Check status uses the receipt resourceId (P05)', async () => {
    const stub = createFetchStub({
      getSession: () => ok(session()),
      createMeal: () => { throw new TypeError('response lost'); },
      getCommandReceipt: (c) => ok({ operation: c.params.operation, key: c.params.key, state: 'SUCCEEDED', retryable: false, expired: false, retryAfterSeconds: null, httpStatus: 201, errorCode: null, conflict: null, resourceId: MEAL_ID, resourceVersion: '1', currentVersion: null, completedAt: '2026-10-24T10:00:00.000Z', expiresAt: '2026-11-23T10:00:00.000Z' }),
      getMeal: () => ok({ meal: meal(), myApplication: null, conversationId: null }),
    });
    saveDraft('create', complete({ reviewConfirmed: true }));
    renderApp(stub.fetch, '/create');
    await toReview();
    await userEvent.click(screen.getByRole('button', { name: /Publish meal/ }));
    expect(await screen.findByText(/Status unknown/)).toBeTruthy();
    const keys = new Set(stub.callsTo('createMeal').map((c) => c.headers['idempotency-key']));
    expect(keys.size).toBe(1);
    expect(loadDraft('create')).not.toBeNull();
    const writes = stub.callsTo('createMeal').length;
    await userEvent.click(screen.getByRole('button', { name: 'Check status' }));
    expect(await screen.findByRole('heading', { name: 'Friday dinner & new faces' })).toBeTruthy();
    expect(stub.callsTo('getCommandReceipt')[0]!.params).toEqual({ operation: 'createMeal', key: [...keys][0] });
    expect(stub.callsTo('createMeal')).toHaveLength(writes);
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
    saveDraft('create', complete({ reviewConfirmed: false }));
    renderApp(stub.fetch, '/create');
    await toReview();
    await userEvent.click(screen.getByRole('checkbox', { name: /checked the arrangements/ }));
    await userEvent.click(screen.getByRole('button', { name: /Publish meal/ }));
    expect(await screen.findByText('Which meal time did you mean?')).toBeTruthy();
    const publish = screen.getByRole('button', { name: /Publish meal/ }) as HTMLButtonElement;
    expect(publish.disabled).toBe(true);
    await userEvent.click(screen.getByRole('radio', { name: /01:30 GMT · second time/ }));
    expect(publish.disabled).toBe(false);
    await userEvent.click(publish);
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
    saveDraft('create', complete({ date: '2026-10-25', time: '03:30', closeDate: '2026-10-25', closeTime: '01:30' }));
    renderApp(stub.fetch, '/create');
    await toReview();
    await userEvent.click(screen.getByRole('checkbox', { name: /checked the arrangements/ }));
    await userEvent.click(screen.getByRole('button', { name: /Publish meal/ }));
    expect(await screen.findByText('Which deadline did you mean?')).toBeTruthy();
    await userEvent.click(screen.getByRole('radio', { name: /01:30 BST · first time/ }));
    await userEvent.click(screen.getByRole('button', { name: /Publish meal/ }));
    await waitFor(() => expect(stub.callsTo('createMeal')).toHaveLength(2));
    const second = stub.callsTo('createMeal')[1]!.body as { start: object; close: { utcOffsetMinutes: number } };
    expect(second.close.utcOffsetMinutes).toBe(60);
    expect(second.start).not.toHaveProperty('utcOffsetMinutes');
  });

  it('treats a nonexistent London time as an error and returns to the time step', async () => {
    const stub = createStub(() => fail(422, 'TIME_NONEXISTENT', { fieldErrors: { start: 'nonexistent' } }));
    saveDraft('create', complete({ date: '2026-03-29', time: '01:30', closeDate: '2026-03-28', closeTime: '22:00' }));
    renderApp(stub.fetch, '/create');
    await toReview();
    await userEvent.click(screen.getByRole('checkbox', { name: /checked the arrangements/ }));
    await userEvent.click(screen.getByRole('button', { name: /Publish meal/ }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/^Meal time: This London time doesn’t exist/);
    expect(screen.getByRole('heading', { name: 'A place at your table.' })).toBeTruthy();
  });

  it('a guest is asked to sign in and the draft is kept', async () => {
    const stub = createFetchStub({ getSession: () => fail(401, 'AUTH_REQUIRED') });
    saveDraft('create', complete());
    renderApp(stub.fetch, '/create');
    expect(await screen.findByRole('link', { name: /Sign in to continue/ })).toBeTruthy();
    expect(loadDraft<MealDraft>('create')?.title).toBe('Late supper club');
  });

  it('an incomplete profile goes through the gate before publishing, keeping the draft', async () => {
    const stub = createFetchStub({
      getSession: () => ok(session({ profileGate: { ageConfirmed: true, communityAccepted: true, profileComplete: false, missing: ['bio'] } })),
      getMe: () => ok(session({ bio: null, profileGate: { ageConfirmed: true, communityAccepted: true, profileComplete: false, missing: ['bio'] } }).user),
    });
    saveDraft('create', complete({ reviewConfirmed: false }));
    renderApp(stub.fetch, '/create');
    await toReview();
    await userEvent.click(screen.getByRole('checkbox', { name: /checked the arrangements/ }));
    await userEvent.click(screen.getByRole('button', { name: /Publish meal/ }));
    expect(await screen.findByRole('heading', { name: 'A face. A little story. You.' })).toBeTruthy();
    expect(stub.callsTo('createMeal')).toHaveLength(0);
    expect(loadDraft<MealDraft>('create')?.title).toBe('Late supper club');
  });
});

describe('edit meal (T07)', () => {
  it('shows the permanent lock instead of the form once arrangements are locked', async () => {
    const stub = createFetchStub({
      getSession: () => ok(session()),
      getMeal: () => ok({ meal: meal({ arrangementLocked: true, allowedActions: ['CANCEL'] }), myApplication: null, conversationId: null }),
    });
    renderApp(stub.fetch, `/meals/${MEAL_ID}/edit`);
    expect(await screen.findByText(/can no longer be changed/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Save changes/ })).toBeNull();
  });

  it('PATCHes only the changed fields with If-Match', async () => {
    const stub = createFetchStub({
      getSession: () => ok(session()),
      getMeal: () => ok({ meal: meal({ allowedActions: ['EDIT'] }), myApplication: null, conversationId: null }),
      editMeal: () => ok(meal({ version: '8' })),
    });
    renderApp(stub.fetch, `/meals/${MEAL_ID}/edit`);
    const title = await screen.findByLabelText('Give your meal a name');
    await userEvent.clear(title);
    await userEvent.type(title, 'Friday dinner & friends');
    await userEvent.click(screen.getByRole('button', { name: /Save changes/ }));
    await waitFor(() => expect(stub.callsTo('editMeal')).toHaveLength(1));
    const call = stub.callsTo('editMeal')[0]!;
    expect(call.body).toEqual({ title: 'Friday dinner & friends' });
    expect(call.headers['if-match']).toBe('"7"');
  });
});
