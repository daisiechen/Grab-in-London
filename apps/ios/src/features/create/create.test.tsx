import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { CREATE_DRAFT_KEY, CreateStepScreen } from './CreateStepScreen.tsx';
import { emptyDraft, updateDraft, type CreateDraft } from './model.ts';
import { createTestApp, renderApp, signIn } from '../../test/render.tsx';
import { mockRouter, resetRouter } from '../../test/router.ts';
import { fail, ok, page } from '../../test/mock-fetch.ts';
import { MEAL_ID, meal, me } from '../../test/fixtures.ts';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot use ESM imports
jest.mock('expo-router', () => require('../../test/router.ts').expoRouterMock);

beforeEach(resetRouter);

const VENUE_REF = '2c1b0a9f-8e7d-4c6b-9a5f-4e3d2c1b0a9f';
const venueResponse = { venueRef: VENUE_REF, placeId: 'place-1', available: true, name: 'Dishoom', address: '7 Boundary St', location: null, areaCode: 'shoreditch', attributions: [{ provider: 'google', text: 'Google' }], displayExpiresAt: null };

function readyDraft(): CreateDraft {
  let d = emptyDraft('7f0e1d2c-3b4a-4596-8877-665544332211');
  d = updateDraft(d, { venue: { venueRef: VENUE_REF, placeId: 'place-1', name: 'Dishoom', address: '7 Boundary St', attribution: 'Google' }, date: '2026-10-25', time: '01:30' });
  d = updateDraft(d, { closeDate: '2026-10-24', closeTime: '22:00', closeEdited: true });
  d = updateDraft(d, { title: 'Late supper', description: 'A relaxed late supper with new faces.', mood: 'FOOD_DISCOVERIES', languages: ['en'] });
  return updateDraft(d, { budgetMin: '20', budgetMax: '30', bookingDeclarationConfirmed: true });
}

describe('Create Arrange (S10, QA-CREATE-001)', () => {
  it('keeps only transient search display when confirmation returns a durable ID without provider display fields',async()=>{
    const app=createTestApp();await signIn(app,me());
    app.mock.on('GET','/v1/venues',page([{placeId:'place-1',name:'Dishoom',address:'7 Boundary St',location:null,photoRefs:[],attributions:[{provider:'google',text:'Google'}]}]));
    app.mock.on('POST','/v1/venues/confirm',ok({...venueResponse,name:null,address:null,location:null,attributions:[]}));
    await renderApp(app,<CreateStepScreen step={0}/>);
    await fireEvent.changeText(screen.getByLabelText('Search restaurants'),'dishoom');
    await fireEvent.press(screen.getByRole('button',{name:'Search'}));
    await fireEvent.press(await screen.findByRole('button',{name:'Choose Dishoom'}));
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
    await fireEvent.press(await screen.findByRole('button', { name: 'Choose Dishoom' }));
    expect(await screen.findByLabelText('Selected restaurant Dishoom')).toBeOnTheScreen();
    expect(app.mock.callsTo('POST', '/v1/venues/confirm')[0]?.body).toEqual({ placeId: 'place-1' });

    await fireEvent.press(screen.getAllByRole('radio', { name: 'Sun 25 Oct' })[0]!);
    await fireEvent.press(screen.getAllByRole('radio', { name: '19:00' })[0]!);
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

    await fireEvent.press(screen.getByRole('button', { name: 'Publish meal' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Confirm you’ve reviewed the details before publishing.');
    expect(app.mock.callsTo('POST', '/v1/meals')).toHaveLength(0);

    await fireEvent.press(screen.getByRole('checkbox', { name: /I’ve reviewed these details/ }));
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
