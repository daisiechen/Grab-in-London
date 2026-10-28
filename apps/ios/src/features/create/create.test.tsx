import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { CREATE_DRAFT_KEY, CreateStepScreen } from './CreateStepScreen.tsx';
import { emptyDraft, updateDraft, type CreateDraft } from './model.ts';
import { createTestApp, renderApp, signIn } from '../../test/render.tsx';
import { mockRouter, resetRouter } from '../../test/router.ts';
import { fail, ok, page } from '../../test/mock-fetch.ts';
import { MEAL_ID, meal, me } from '../../test/fixtures.ts';
import { layout, mockContentGeometry } from './reveal-test-utils.ts';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot use ESM imports
jest.mock('expo-router', () => require('../../test/router.ts').expoRouterMock);

beforeEach(resetRouter);

async function createSignedIn() { const app = createTestApp(); await signIn(app, me()); return app; }
afterEach(() => jest.restoreAllMocks());

const VENUE_REF = '2c1b0a9f-8e7d-4c6b-9a5f-4e3d2c1b0a9f';
const venueResponse = { venueRef: VENUE_REF, placeId: 'place-1', available: true, name: 'Dishoom', address: '7 Boundary St', location: null, areaCode: 'shoreditch', attributions: [{ provider: 'google', text: 'Google' }], displayExpiresAt: null };

function readyDraft(): CreateDraft {
  let d = emptyDraft('7f0e1d2c-3b4a-4596-8877-665544332211');
  d = updateDraft(d, { venue: { venueRef: VENUE_REF, placeId: 'place-1', name: 'Dishoom', address: '7 Boundary St', attribution: 'Google' }, date: '2026-10-25', time: '01:30' });
  d = updateDraft(d, { closeDate: '2026-10-24', closeTime: '22:00', closeEdited: true });
  d = updateDraft(d, { title: 'Late supper', description: 'A relaxed late supper with new faces.', mood: 'FOOD_DISCOVERIES', languages: ['en'] });
  return updateDraft(d, { budgetMin: '20', budgetMax: '30', bookingDeclarationConfirmed: true });
}

it('shows the selected restaurant photo and authors on Review without publishing',async()=>{
 const app=createTestApp();await signIn(app,me());const draft=readyDraft();app.services.drafts.set(CREATE_DRAFT_KEY,draft);
 app.mock.on('GET',`/v1/venues/${draft.venue!.venueRef}/photo`,ok({placeId:draft.venue!.placeId,photo:{uri:'https://photos.example.invalid/review',source:'Google Maps',authorAttributions:[{displayName:'Review Author',uri:null}]}}));
 await renderApp(app,<CreateStepScreen step={3}/>);
 expect(await screen.findByLabelText('Photo of Dishoom')).toBeOnTheScreen();expect(screen.getByText('Review Author')).toBeOnTheScreen();expect(app.mock.callsTo('POST','/v1/meals')).toHaveLength(0);
});

describe('Create Costs completed reservation declaration (F55)', () => {
  it('requires the host to confirm an already booked named table before continuing', async () => {
    const app = createTestApp(); await signIn(app, me());
    app.services.drafts.set(CREATE_DRAFT_KEY, { ...readyDraft(), bookingDeclarationConfirmed: false });
    await renderApp(app, <CreateStepScreen step={2} />);
    const declaration = screen.getByRole('checkbox', { name: 'I have already booked a table at Dishoom for 4 people on Sun 25 Oct at 01:30 (Europe/London). This is my confirmation, not verification by Fancy.' });
    expect(declaration).not.toBeChecked();
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Confirm that you have already booked the table with the restaurant.');
    await fireEvent.press(declaration);
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/create/review');
    expect(app.mock.callsTo('POST', '/v1/meals')).toHaveLength(0);
  });

  it.each<Partial<CreateDraft>>([
    { venue: { venueRef: '9c1b0a9f-8e7d-4c6b-9a5f-4e3d2c1b0a9f', placeId: 'place-2', name: 'Another restaurant', address: 'Another address', attribution: 'Google' } },
    { date: '2026-10-26' }, { time: '19:00' }, { capacity: 5 },
  ])('requires fresh personal confirmation after reservation details change: %j', async (patch) => {
    const app = createTestApp(); await signIn(app, me());
    app.services.drafts.set(CREATE_DRAFT_KEY, readyDraft());
    await renderApp(app, <CreateStepScreen step={2} />);
    expect(screen.getByRole('checkbox', { name: /I have already booked/ })).toBeChecked();
    await act(async () => { app.services.drafts.set(CREATE_DRAFT_KEY, updateDraft(readyDraft(), patch)); });
    const declaration = screen.getByRole('checkbox', { name: /I have already booked/ });
    expect(declaration).not.toBeChecked();
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(mockRouter.push).not.toHaveBeenCalled();
    await fireEvent.press(declaration);
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/create/review');
  });
});

describe('Create Arrange (S10, QA-CREATE-001)', () => {
  it('keeps only transient search display when confirmation returns a durable ID without provider display fields',async()=>{
    const app=createTestApp();await signIn(app,me());
    app.mock.on('GET','/v1/venues',page([{placeId:'place-1',name:'Dishoom',address:'7 Boundary St',location:null,photoRefs:[],attributions:[{provider:'google',text:'Google'}]}]));
    app.mock.on('POST','/v1/venues/confirm',ok({...venueResponse,name:null,address:null,location:null,attributions:[]}));
    await renderApp(app,<CreateStepScreen step={0}/>);
    await fireEvent.changeText(screen.getByLabelText('Search restaurants'),'dishoom');
    await fireEvent.press(screen.getByRole('button',{name:'Search'}));
    await fireEvent.press(await screen.findByRole('button',{name:'Dishoom, 7 Boundary St'}));
    await fireEvent.press(screen.getByRole('button',{name:'Use this restaurant'}));
    expect(await screen.findByLabelText('Selected restaurant Dishoom')).toBeOnTheScreen();
    expect(app.services.drafts.get<CreateDraft>(CREATE_DRAFT_KEY)?.venue).toMatchObject({venueRef:VENUE_REF,name:'Dishoom',address:'7 Boundary St'});
    expect(app.mock.callsTo('POST','/v1/venues/confirm')[0]?.body).toEqual({placeId:'place-1'});
  });
  it('searches venues, confirms one server-side and blocks Continue until the step is valid', async () => {
    const app = createTestApp();
    await signIn(app, me());
    app.mock.on('GET', '/v1/venues', page([{ placeId: 'place-1', name: 'Dishoom', address: '7 Boundary St', photoRefs: [], attributions: [{ provider: 'google', text: 'Google' }] }]));
    app.mock.on('POST', '/v1/venues/confirm', ok(venueResponse));
    await renderApp(app, <CreateStepScreen step={0} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a restaurant.');

    await fireEvent.changeText(screen.getByLabelText('Search restaurants'), 'dishoom');
    await fireEvent.press(screen.getByRole('button', { name: 'Search' }));
    // A search result is only a preview: nothing is confirmed until “Use this restaurant”.
    await fireEvent.press(await screen.findByRole('button', { name: 'Dishoom, 7 Boundary St' }));
    expect(app.mock.callsTo('POST', '/v1/venues/confirm')).toHaveLength(0);
    await fireEvent.press(screen.getByRole('button', { name: 'Use this restaurant' }));
    expect(await screen.findByLabelText('Selected restaurant Dishoom')).toBeOnTheScreen();
    expect(app.mock.callsTo('POST', '/v1/venues/confirm')[0]?.body).toEqual({ placeId: 'place-1' });

    // Date and time pickers open inline under their triggers; choosing a date opens the time grid.
    expect(screen.queryByRole('radio', { name: 'Sun 25 Oct' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Date: Choose a date' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Sun 25 Oct' }));
    await fireEvent.press(screen.getByRole('radio', { name: '19:00' }));
    expect(screen.getByRole('button', { name: 'Date: Sun 25 Oct' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Time: 19:00' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Deadline time: 18:00' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/create/introduce');
    const saved = app.services.drafts.get<CreateDraft>(CREATE_DRAFT_KEY);
    expect(saved).toMatchObject({ date: '2026-10-25', time: '19:00', closeDate: '2026-10-25', closeTime: '18:00', venue: { venueRef: VENUE_REF } });
  });
});

describe('Create Review publish (S10, QA-TIME-004..007, QA-CREATE-002)', () => {
  it('ambiguous autumn time → explicit GMT choice → resubmits with the offset and a new intent key', async () => {
    const app = createTestApp();
    await signIn(app, me());
    app.services.drafts.set(CREATE_DRAFT_KEY, readyDraft());
    app.mock.on('POST', '/v1/meals', fail(422, 'TIME_AMBIGUOUS', {
      fieldErrors: { start: 'ambiguous' },
      choices: [{ utcOffsetMinutes: 60, label: 'BST', instant: '2026-10-25T00:30:00Z' }, { utcOffsetMinutes: 0, label: 'GMT', instant: '2026-10-25T01:30:00Z' }],
    }), 1);
    app.mock.on('POST', '/v1/meals', ok(meal(), 201));
    await renderApp(app, <CreateStepScreen step={3} />);
    expect(screen.getByText('I have already booked a table at Dishoom for 4 people on Sun 25 Oct at 01:30 (Europe/London). This is my confirmation, not verification by Fancy.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Publish meal' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Confirm you’ve reviewed the details before publishing.');
    expect(app.mock.callsTo('POST', '/v1/meals')).toHaveLength(0);

    await fireEvent.press(screen.getByRole('checkbox', { name: 'I’ve reviewed the details guests will see.' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Publish meal' }));
    expect(await screen.findByText(/01:30 happens twice/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Publish with this time' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('radio', { name: 'GMT · after the clocks go back' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Publish with this time' }));

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith(`/meals/${MEAL_ID}`));
    const [first, second] = app.mock.callsTo('POST', '/v1/meals');
    expect(first?.body).toMatchObject({ start: { localDate: '2026-10-25', localTime: '01:30', timeZone: 'Europe/London' }, bookingMode: 'EXTERNAL_PAY_AT_VENUE', bookingDeclarationConfirmed: true, reviewConfirmed: true });
    expect((first?.body as { start: object }).start).not.toHaveProperty('utcOffsetMinutes');
    expect(second?.body).toMatchObject({ start: { utcOffsetMinutes: 0 } });
    expect(first?.headers['idempotency-key']).not.toBe(second?.headers['idempotency-key']);
    expect(app.services.drafts.get(CREATE_DRAFT_KEY)).toBeUndefined();
  });

  it('a nonexistent spring time is an error with a way back to Arrange; nothing is shifted', async () => {
    const app = createTestApp();
    await signIn(app, me());
    app.services.drafts.set(CREATE_DRAFT_KEY, { ...readyDraft(), date: '2027-03-28', time: '01:30', closeDate: '2027-03-27', reviewConfirmed: true });
    app.mock.on('POST', '/v1/meals', fail(422, 'TIME_NONEXISTENT', { fieldErrors: { start: 'nonexistent' } }));
    await renderApp(app, <CreateStepScreen step={3} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Publish meal' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/doesn’t exist in London on that date/);
    await fireEvent.press(screen.getByRole('button', { name: 'Change the meal time' }));
    expect(mockRouter.navigate).toHaveBeenCalledWith('/create');
    expect(app.mock.callsTo('POST', '/v1/meals')).toHaveLength(1);
    expect(app.services.drafts.get<CreateDraft>(CREATE_DRAFT_KEY)?.time).toBe('01:30');
  });

  it('a network failure keeps the draft and the retry reuses the same Idempotency-Key', async () => {
    const app = createTestApp();
    await signIn(app, me());
    app.services.drafts.set(CREATE_DRAFT_KEY, { ...readyDraft(), reviewConfirmed: true });
    app.mock.on('POST', '/v1/meals', () => { throw new TypeError('Network request failed'); }, 1);
    app.mock.on('POST', '/v1/meals', ok(meal(), 201));
    await renderApp(app, <CreateStepScreen step={3} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Publish meal' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn’t confirm this with Fancy/);
    await fireEvent.press(screen.getByRole('button', { name: 'Publish meal' }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith(`/meals/${MEAL_ID}`));
    const keys = app.mock.callsTo('POST', '/v1/meals').map((c) => c.headers['idempotency-key']);
    expect(keys[0]).toBe(keys[1]);
  });

  it('logout clears the create draft', async () => {
    const app = createTestApp();
    await signIn(app, me());
    app.services.drafts.set(CREATE_DRAFT_KEY, readyDraft());
    app.mock.on('POST', '/v1/auth/logout', { status: 204 });
    await app.services.session.logout();
    expect(app.services.drafts.get(CREATE_DRAFT_KEY)).toBeUndefined();
  });
});

describe('Create layout and steps (demo create-flow, r07 costs)', () => {
  it('the step indicator revisits completed steps only', async () => {
    const app = createTestApp(); await signIn(app, me());
    app.services.drafts.set(CREATE_DRAFT_KEY, readyDraft());
    await renderApp(app, <CreateStepScreen step={2} />);
    expect(screen.getByLabelText('Step 3 of 4')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Review' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Arrange, completed' }));
    expect(mockRouter.navigate).toHaveBeenCalledWith('/create');
    await fireEvent.press(screen.getByRole('button', { name: 'Introduce, completed' }));
    expect(mockRouter.navigate).toHaveBeenCalledWith('/create/introduce');
  });

  it('Costs offers only pay-at-the-restaurant with an expected spend; no deposit, menu payment or refund', async () => {
    const app = createTestApp(); await signIn(app, me());
    app.services.drafts.set(CREATE_DRAFT_KEY, { ...readyDraft(), budgetMin: '', budgetMax: '' });
    await renderApp(app, <CreateStepScreen step={2} />);
    expect(screen.getByText('Everyone pays their own share at the restaurant. Nothing is collected in the app.')).toBeOnTheScreen();
    expect(screen.queryByText(/Deposit/i)).toBeNull();
    expect(screen.queryByText(/Fixed menu/i)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid budget, with the maximum at least the minimum.');
    await fireEvent.changeText(screen.getByLabelText('Budget from per person in pounds'), '20');
    await fireEvent.changeText(screen.getByLabelText('Budget to per person in pounds'), '35');
    expect(screen.getByText('£20–35')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/create/review');
  });

  it('Review links to the cancellation terms from “If plans change”', async () => {
    const app = await createSignedIn();
    app.services.drafts.set(CREATE_DRAFT_KEY, readyDraft());
    app.mock.on('GET', `/v1/venues/${VENUE_REF}/photo`, ok({ placeId: 'place-1', photo: null }));
    await renderApp(app, <CreateStepScreen step={3} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Cancellation terms' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/cancellation-terms');
    expect(app.mock.callsTo('POST', '/v1/meals')).toHaveLength(0);
  });

  it('Introduce shows live character counters', async () => {
    const app = createTestApp(); await signIn(app, me());
    await renderApp(app, <CreateStepScreen step={1} />);
    expect(screen.getByText('5–80 characters · 0/80')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Give your meal a name'), 'Late supper');
    expect(screen.getByText('5–80 characters · 11/80')).toBeOnTheScreen();
    expect(screen.getByText('20–1,000 characters · 0/1,000')).toBeOnTheScreen();
  });

  it('Review groups the details and each Edit returns to its step without publishing', async () => {
    const app = createTestApp(); await signIn(app, me());
    app.services.drafts.set(CREATE_DRAFT_KEY, readyDraft());
    app.mock.on('GET', `/v1/venues/${VENUE_REF}/photo`, ok({ placeId: 'place-1', photo: null }));
    await renderApp(app, <CreateStepScreen step={3} />);
    expect(screen.getByText('Late supper')).toBeOnTheScreen();
    expect(screen.getByText('£20–30 estimated per person')).toBeOnTheScreen();
    expect(screen.getByText('Everyone pays their own share at the restaurant')).toBeOnTheScreen();
    expect(screen.getByText('2–4 people including you · Applications close Sat 24 Oct, 22:00')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Edit place and time' }));
    expect(mockRouter.navigate).toHaveBeenCalledWith('/create');
    await fireEvent.press(screen.getByRole('button', { name: 'Edit introduction' }));
    expect(mockRouter.navigate).toHaveBeenCalledWith('/create/introduce');
    await fireEvent.press(screen.getByRole('button', { name: 'Edit costs and reservation' }));
    expect(mockRouter.navigate).toHaveBeenCalledWith('/create/costs');
    expect(app.mock.callsTo('POST', '/v1/meals')).toHaveLength(0);
  });

  it('changing the restaurant keeps the current one when a search finds nothing or is abandoned', async () => {
    const app = createTestApp(); await signIn(app, me());
    app.services.drafts.set(CREATE_DRAFT_KEY, readyDraft());
    app.mock.on('GET', `/v1/venues/${VENUE_REF}/photo`, ok({ placeId: 'place-1', photo: null }));
    app.mock.on('GET', '/v1/venues', page([]));
    await renderApp(app, <CreateStepScreen step={0} />);
    expect(screen.queryByLabelText('Search restaurants')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Change restaurant' }));
    await fireEvent.changeText(screen.getByLabelText('Search restaurants'), 'nowhere');
    await fireEvent.press(screen.getByRole('button', { name: 'Search' }));
    expect(await screen.findByText('No restaurants found. Try another name. Your current choice is kept.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Keep current restaurant' }));
    expect(screen.getByLabelText('Selected restaurant Dishoom')).toBeOnTheScreen();
    expect(app.services.drafts.get<CreateDraft>(CREATE_DRAFT_KEY)?.venue?.venueRef).toBe(VENUE_REF);
  });

  it('a previewed search result can be dismissed without confirming it', async () => {
    const app = createTestApp(); await signIn(app, me());
    app.mock.on('GET', '/v1/venues', page([{ placeId: 'place-1', name: 'Dishoom', address: '7 Boundary St', location: null, photoRefs: [], attributions: [] }]));
    await renderApp(app, <CreateStepScreen step={0} />);
    await fireEvent.changeText(screen.getByLabelText('Search restaurants'), 'dishoom');
    await fireEvent.press(screen.getByRole('button', { name: 'Search' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Dishoom, 7 Boundary St' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel selection' }));
    expect(screen.queryByRole('button', { name: 'Use this restaurant' })).toBeNull();
    expect(app.mock.callsTo('POST', '/v1/venues/confirm')).toHaveLength(0);
  });

  it('signed-out hosts are sent to sign in and come back to Create', async () => {
    const app = createTestApp(); await app.services.session.restore();
    await renderApp(app, <CreateStepScreen step={0} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/sign-in');
  });
});

describe('Create simulator walkthrough fixes (iOS 27)', () => {
  const PICKER_Y = 640;
  const PICKER_H = 300;
  const expectedY = PICKER_Y + PICKER_H + 12 - 520;

  it.each([
    ['Date: Choose a date', 'picker-date'],
    ['Time: Choose a time', 'picker-time'],
    ['Deadline date: Choose a date', 'picker-closeDate'],
    ['Deadline time: Choose a time', 'picker-closeTime'],
  ])('“%s” scrolls its in-place picker fully above the pinned footer once it opens', async (trigger, panel) => {
    const app = createTestApp(); await signIn(app, me());
    const { scrollTo } = mockContentGeometry({ y: PICKER_Y, height: PICKER_H });
    await renderApp(app, <CreateStepScreen step={0} />);
    // The scroll view's frame ends at the footer's top edge (the footer is a sibling).
    await fireEvent(screen.getByTestId('create-scroll'), 'layout', layout(520));
    await fireEvent.press(screen.getByRole('button', { name: trigger }));
    expect(scrollTo).not.toHaveBeenCalled();
    await fireEvent(screen.getByTestId(panel), 'layout', layout(PICKER_H));
    expect(scrollTo).toHaveBeenCalledWith({ y: expectedY, animated: true });
  });

  it('choosing a date opens the time grid and scrolls that into view too', async () => {
    const app = createTestApp(); await signIn(app, me());
    const { scrollTo } = mockContentGeometry({ y: PICKER_Y, height: PICKER_H });
    await renderApp(app, <CreateStepScreen step={0} />);
    await fireEvent(screen.getByTestId('create-scroll'), 'layout', layout(520));
    await fireEvent.press(screen.getByRole('button', { name: 'Date: Choose a date' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Sun 25 Oct' }));
    await fireEvent(screen.getByTestId('picker-time'), 'layout', layout(PICKER_H));
    expect(scrollTo).toHaveBeenCalledWith({ y: expectedY, animated: true });
  });

  it('tapping a restaurant result scrolls “Use this restaurant” into view; confirming is still explicit (J02)', async () => {
    const app = createTestApp(); await signIn(app, me());
    app.mock.on('GET', '/v1/venues', page([{ placeId: 'place-1', name: 'Dishoom', address: '7 Boundary St', location: null, photoRefs: [], attributions: [] }]));
    const { scrollTo } = mockContentGeometry({ y: 560, height: 90 });
    await renderApp(app, <CreateStepScreen step={0} />);
    await fireEvent(screen.getByTestId('create-scroll'), 'layout', layout(520));
    await fireEvent.changeText(screen.getByLabelText('Search restaurants'), 'dishoom');
    await fireEvent.press(screen.getByRole('button', { name: 'Search' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Dishoom, 7 Boundary St' }));
    await fireEvent(screen.getByTestId('venue-confirm'), 'layout', layout(90));
    expect(scrollTo).toHaveBeenCalledWith({ y: 560 + 90 + 12 - 520, animated: true });
    expect(screen.getByRole('button', { name: 'Use this restaurant' })).toBeOnTheScreen();
    expect(app.mock.callsTo('POST', '/v1/venues/confirm')).toHaveLength(0);
  });

  it('Costs: empty budget fields use “e.g.” placeholders, not values that look filled', async () => {
    const app = createTestApp(); await signIn(app, me());
    app.services.drafts.set(CREATE_DRAFT_KEY, { ...readyDraft(), budgetMin: '', budgetMax: '' });
    await renderApp(app, <CreateStepScreen step={2} />);
    expect(screen.getByLabelText('Budget from per person in pounds')).toHaveProp('placeholder', 'e.g. 20');
    expect(screen.getByLabelText('Budget to per person in pounds')).toHaveProp('placeholder', 'e.g. 35');
    expect(screen.getByLabelText('Budget from per person in pounds')).toHaveProp('value', '');
    expect(screen.getByText('—')).toBeOnTheScreen();
  });

  it('Costs: budget errors appear under the field as the host types, before Continue', async () => {
    const app = createTestApp(); await signIn(app, me());
    app.services.drafts.set(CREATE_DRAFT_KEY, { ...readyDraft(), budgetMin: '', budgetMax: '' });
    await renderApp(app, <CreateStepScreen step={2} />);
    await fireEvent.changeText(screen.getByLabelText('Budget from per person in pounds'), '40');
    expect(screen.queryByText(/Must be at least/)).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('Budget to per person in pounds'), '30');
    expect(screen.getByText('Must be at least £40, the “From” amount.')).toBeOnTheScreen();
    // The estimate never echoes an invalid range such as “£40–30”.
    expect(screen.queryByText('£40–30')).toBeNull();
    expect(screen.getByText('—')).toBeOnTheScreen();
    expect(screen.queryByRole('alert')).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('Budget to per person in pounds'), '45');
    expect(screen.queryByText(/Must be at least/)).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('Budget from per person in pounds'), '0');
    expect(screen.getByText('Enter an amount above £0.')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Budget from per person in pounds'), '20.555');
    expect(screen.getByText('Use pounds only, like 20 or 22.50.')).toBeOnTheScreen();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('Costs: the booking declaration is marked as required before any Continue', async () => {
    const app = createTestApp(); await signIn(app, me());
    app.services.drafts.set(CREATE_DRAFT_KEY, { ...readyDraft(), bookingDeclarationConfirmed: false });
    await renderApp(app, <CreateStepScreen step={2} />);
    expect(screen.getByLabelText('Required to continue')).toHaveTextContent('Required');
    expect(screen.getByText(/Tick to confirm before you continue\./)).toBeOnTheScreen();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('Review: the required “reviewed” checkbox is pinned with Publish, outside the scrolling details', async () => {
    const app = createTestApp(); await signIn(app, me());
    app.services.drafts.set(CREATE_DRAFT_KEY, readyDraft());
    app.mock.on('GET', `/v1/venues/${VENUE_REF}/photo`, ok({ placeId: 'place-1', photo: null }));
    await renderApp(app, <CreateStepScreen step={3} />);
    expect(screen.getByRole('checkbox', { name: 'I’ve reviewed the details guests will see.' })).toBeOnTheScreen();
    expect(within(screen.getByTestId('create-scroll')).queryByRole('checkbox')).toBeNull();
    expect(within(screen.getByTestId('create-scroll')).queryByRole('button', { name: 'Publish meal' })).toBeNull();
  });

  it('Review: undeclared cuisine and dietary read “Not provided” as guests see them (P-05)', async () => {
    const app = createTestApp(); await signIn(app, me());
    app.services.drafts.set(CREATE_DRAFT_KEY, readyDraft());
    app.mock.on('GET', `/v1/venues/${VENUE_REF}/photo`, ok({ placeId: 'place-1', photo: null }));
    const view = await renderApp(app, <CreateStepScreen step={3} />);
    expect(screen.getByText('Cuisine: Not provided · Dietary options: Not provided. Host-reported · not an allergy guarantee.')).toBeOnTheScreen();
    await view.unmount();
    app.services.drafts.set(CREATE_DRAFT_KEY, { ...readyDraft(), cuisineCode: 'SPANISH', dietaryCodes: [] });
    await renderApp(app, <CreateStepScreen step={3} />);
    expect(screen.getByText('Cuisine: Spanish · Dietary options: Not provided. Host-reported · not an allergy guarantee.')).toBeOnTheScreen();
  });
});
