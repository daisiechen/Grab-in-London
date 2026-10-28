import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { CREATE_DRAFT_KEY, EditStepScreen, editBaseKey, editDraftKey, startMealEdit } from './CreateStepScreen.tsx';
import { draftFromMeal, emptyDraft, toEditBody, updateDraft, type CreateDraft } from './model.ts';
import { createTestApp, renderApp, signIn, type TestApp } from '../../test/render.tsx';
import { mockRouter, resetRouter, routeParams } from '../../test/router.ts';
import { fail, ok } from '../../test/mock-fetch.ts';
import { CONVERSATION_ID, MEAL_ID, meal, me } from '../../test/fixtures.ts';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot use ESM imports
jest.mock('expo-router', () => { const m = require('../../test/router.ts'); m.mockRouter.dismissTo = jest.fn(); return m.expoRouterMock; });

const dismissTo = (mockRouter as unknown as { dismissTo: jest.Mock }).dismissTo;
const MEAL_PATH = `/v1/meals/${MEAL_ID}`;
const HOST_PATH = `/meals/${MEAL_ID}/host`;
const VENUE_REF = '2c1b0a9f-8e7d-4c6b-9a5f-4e3d2c1b0a9f';
const editableMeal = (overrides: Parameters<typeof meal>[0] = {}) => meal({ allowedActions: ['REVIEW_APPLICATIONS', 'CANCEL', 'DECLARE_BOOKING', 'EDIT'], ...overrides });

beforeEach(() => {
  resetRouter();
  routeParams.current = { mealId: MEAL_ID };
});
afterEach(() => jest.restoreAllMocks());

async function setup(m = editableMeal()) {
  const app = createTestApp();
  await signIn(app, me());
  app.mock.on('GET', MEAL_PATH, ok({ meal: m, myApplication: null, conversationId: CONVERSATION_ID }));
  app.mock.on('GET', `/v1/venues/${VENUE_REF}/photo`, ok({ placeId: 'place-1', photo: null }));
  return app;
}

/** Seeds the edit draft as the guest list does, then applies host changes. */
function seedEdit(app: TestApp, patch: Partial<CreateDraft> = {}, m = editableMeal()) {
  startMealEdit(app.services.drafts, m);
  const key = editDraftKey(MEAL_ID);
  app.services.drafts.set(key, updateDraft(app.services.drafts.get<CreateDraft>(key)!, patch));
}

describe('Edit meal model', () => {
  it('prefills every arrangement field from the meal', () => {
    const d = draftFromMeal(editableMeal({ budgetMinPence: 2250, dietaryCodes: ['VEGAN'] }));
    expect(d).toMatchObject({
      venue: { venueRef: VENUE_REF, name: 'Dishoom', address: '7 Boundary St, London' },
      date: '2026-10-25', time: '19:00', closeDate: '2026-10-25', closeTime: '18:00', closeEdited: false,
      capacity: 4, minimum: 2, title: 'Sunday dinner', budgetMin: '22.50', budgetMax: '35', mood: 'EASY_CONVERSATION', languages: ['en'], dietaryCodes: ['VEGAN'],
    });
  });

  it('sends only the changed fields and nothing when unchanged', () => {
    const base = editableMeal();
    expect(toEditBody(draftFromMeal(base), base)).toBeNull();
    const changed = updateDraft(draftFromMeal(base), { time: '20:00', budgetMax: '40' });
    // The deadline still followed start − 60, so it moves with the new time (as in Create).
    expect(toEditBody(changed, base)).toEqual({
      start: { localDate: '2026-10-25', localTime: '20:00', timeZone: 'Europe/London' },
      close: { localDate: '2026-10-25', localTime: '19:00', timeZone: 'Europe/London' },
      budgetMaxPence: 4000,
    });
  });
});

describe('Edit meal flow', () => {
  it('prefills the steps from getMeal under its own draft key, leaving the create draft alone', async () => {
    const app = await setup();
    const createDraft = updateDraft(emptyDraft('7f0e1d2c-3b4a-4596-8877-665544332211'), { title: 'My unpublished meal' });
    app.services.drafts.set(CREATE_DRAFT_KEY, createDraft);
    await renderApp(app, <EditStepScreen step={0} />);
    expect(await screen.findByLabelText('Selected restaurant Dishoom')).toBeOnTheScreen();
    expect(screen.getByText('Change the place and time.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Date: Sun 25 Oct' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Time: 19:00' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: '6 people' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(mockRouter.push).toHaveBeenCalledWith(`/meals/${MEAL_ID}/edit/introduce`);
    expect(app.services.drafts.get<CreateDraft>(editDraftKey(MEAL_ID))).toMatchObject({ capacity: 6, title: 'Sunday dinner' });
    expect(app.services.drafts.get<{ version: string }>(editBaseKey(MEAL_ID))?.version).toBe('7');
    expect(app.services.drafts.get(CREATE_DRAFT_KEY)).toBe(createDraft);
  });

  it('Costs needs no new reservation tick when editing', async () => {
    const app = await setup();
    seedEdit(app);
    await renderApp(app, <EditStepScreen step={2} />);
    expect(screen.queryByRole('checkbox', { name: /I have already booked/ })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(mockRouter.push).toHaveBeenCalledWith(`/meals/${MEAL_ID}/edit/review`);
  });

  it('saves only the changed fields with If-Match, refreshes the meal and returns to the guest list', async () => {
    const app = await setup();
    seedEdit(app, { title: 'Sunday supper', capacity: 5 });
    const saved = editableMeal({ title: 'Sunday supper', capacity: 5, version: '8' });
    app.mock.on('PATCH', MEAL_PATH, ok(saved));
    await renderApp(app, <EditStepScreen step={3} />);
    expect(await screen.findByText('If you change the restaurant, time or group size, update your booking with the restaurant yourself.')).toBeOnTheScreen();
    expect(screen.queryByRole('checkbox', { name: 'I’ve reviewed the details guests will see.' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Publish meal' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(dismissTo).toHaveBeenCalledWith(HOST_PATH));
    const [call] = app.mock.callsTo('PATCH', MEAL_PATH);
    expect(call?.body).toEqual({ title: 'Sunday supper', capacity: 5 });
    expect(call?.headers['if-match']).toBe('"7"');
    expect(call?.headers['idempotency-key']).toBeTruthy();
    expect(app.services.cache.get<{ meal: { version: string } }>(`meal:${MEAL_ID}`)?.meal.version).toBe('8');
  });

  it('does not send an empty edit', async () => {
    const app = await setup();
    seedEdit(app);
    await renderApp(app, <EditStepScreen step={3} />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Save changes' }));
    expect(screen.getByRole('alert')).toHaveTextContent('You haven’t changed anything yet.');
    expect(app.mock.callsTo('PATCH', MEAL_PATH)).toHaveLength(0);
  });

  it('a network failure keeps the draft and the retry reuses the same Idempotency-Key', async () => {
    const app = await setup();
    seedEdit(app, { title: 'Sunday supper' });
    app.mock.on('PATCH', MEAL_PATH, () => { throw new TypeError('Network request failed'); }, 1);
    app.mock.on('PATCH', MEAL_PATH, ok(editableMeal({ version: '8' })));
    await renderApp(app, <EditStepScreen step={3} />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn’t confirm this with Fancy/);
    await fireEvent.press(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(dismissTo).toHaveBeenCalledWith(HOST_PATH));
    const keys = app.mock.callsTo('PATCH', MEAL_PATH).map((c) => c.headers['idempotency-key']);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

  it('ARRANGEMENT_LOCKED explains the lock, stops saving and offers the way back', async () => {
    const app = await setup();
    seedEdit(app, { title: 'Sunday supper' });
    app.mock.on('PATCH', MEAL_PATH, fail(409, 'ARRANGEMENT_LOCKED'));
    await renderApp(app, <EditStepScreen step={3} />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('A guest has been approved, so the restaurant, time, budget and group size are locked. Your changes weren’t saved.');
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Back to your guest list' }));
    expect(dismissTo).toHaveBeenCalledWith(HOST_PATH);
    expect(app.mock.callsTo('PATCH', MEAL_PATH)).toHaveLength(1);
  });

  it('a nonexistent spring time reuses the DST message with a way back to Arrange', async () => {
    const app = await setup();
    seedEdit(app, { date: '2027-03-28', time: '01:30', closeDate: '2027-03-27', closeTime: '22:00', closeEdited: true });
    app.mock.on('PATCH', MEAL_PATH, fail(422, 'TIME_NONEXISTENT', { fieldErrors: { start: 'nonexistent' } }));
    await renderApp(app, <EditStepScreen step={3} />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/doesn’t exist in London on that date/);
    await fireEvent.press(screen.getByRole('button', { name: 'Change the meal time' }));
    expect(mockRouter.navigate).toHaveBeenCalledWith(`/meals/${MEAL_ID}/edit`);
  });

  it('a locked meal opened directly shows why it can’t be edited instead of the form', async () => {
    const app = await setup(meal({ arrangementLocked: true, allowedActions: ['REVIEW_APPLICATIONS', 'CANCEL'] }));
    await renderApp(app, <EditStepScreen step={0} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/locked/);
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Back to your guest list' }));
    expect(dismissTo).toHaveBeenCalledWith(HOST_PATH);
    expect(app.services.drafts.get(editDraftKey(MEAL_ID))).toBeUndefined();
  });

  it('shows the cancellation terms link on the edit Review too', async () => {
    const app = await setup();
    seedEdit(app);
    await renderApp(app, <EditStepScreen step={3} />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Cancellation terms' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/cancellation-terms');
  });

  it('a newer meal version restarts the edit from the server copy; the same version resumes it', async () => {
    const app = await setup();
    await act(async () => seedEdit(app, { title: 'Unsaved change' }));
    startMealEdit(app.services.drafts, editableMeal());
    expect(app.services.drafts.get<CreateDraft>(editDraftKey(MEAL_ID))?.title).toBe('Unsaved change');
    startMealEdit(app.services.drafts, editableMeal({ version: '8', title: 'Server title' }));
    expect(app.services.drafts.get<CreateDraft>(editDraftKey(MEAL_ID))?.title).toBe('Server title');
  });
});
