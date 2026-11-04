import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { UIManager } from 'react-native';
import { CREATE_DRAFT_KEY, CreateStepScreen } from './CreateStepScreen.tsx';
import { emptyDraft, updateDraft, type CreateDraft } from './model.ts';
import { PICKER_REGION } from './VenueMap.tsx';
import { ILLUSTRATED_BOUNDS, regionBounds } from '../discover/map-region.ts';
import { createTestApp, renderApp, signIn } from '../../test/render.tsx';
import { mockRouter, resetRouter } from '../../test/router.ts';
import { ok, page, type RecordedCall } from '../../test/mock-fetch.ts';
import { me } from '../../test/fixtures.ts';
import { layout } from './reveal-test-utils.ts';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot use ESM imports
jest.mock('expo-router', () => require('../../test/router.ts').expoRouterMock);

const VENUE_REF = '2c1b0a9f-8e7d-4c6b-9a5f-4e3d2c1b0a9f';
const PLACES = [
  { placeId: 'little-table', name: 'The Little Table', address: 'Soho, London', location: { lat: 51.5136, lng: -0.134 }, photoRefs: [], attributions: [] },
  { placeId: 'noodle-house', name: 'Noodle House', address: 'Fitzrovia, London', location: { lat: 51.5195, lng: -0.1376 }, photoRefs: [], attributions: [] },
  { placeId: 'casa-evening', name: 'Casa Evening', address: 'Covent Garden, London', location: { lat: 51.5117, lng: -0.124 }, photoRefs: [], attributions: [] },
];
const confirmed = (placeId: string, name: string) => ok({ venueRef: VENUE_REF, placeId, available: true, name, address: 'London', location: null, areaCode: 'soho', attributions: [], displayExpiresAt: null });

/** Mimics the API: filters by the optional name and, when given, the four map bounds. */
function venuesByQuery(call: RecordedCall) {
  const q = call.query.get('q')?.toLowerCase();
  const [n, s, e, w] = ['north', 'south', 'east', 'west'].map((k) => Number(call.query.get(k)));
  return page(PLACES.filter((p) => (!q || p.name.toLowerCase().includes(q)) && p.location.lat <= n! && p.location.lat >= s! && p.location.lng <= e! && p.location.lng >= w!));
}

const boundsOf = (call: RecordedCall | undefined) => Object.fromEntries(['north', 'south', 'east', 'west'].map((k) => [k, Number(call?.query.get(k))]));

/** Everything on Arrange except the restaurant. */
function draftWithoutVenue(): CreateDraft {
  const d = updateDraft(emptyDraft('7f0e1d2c-3b4a-4596-8877-665544332211'), { date: '2026-10-25', time: '19:00' });
  return updateDraft(d, { closeDate: '2026-10-25', closeTime: '18:00', closeEdited: true });
}

async function openPicker() {
  const app = createTestApp();
  await signIn(app, me());
  app.services.drafts.set(CREATE_DRAFT_KEY, draftWithoutVenue());
  app.mock.on('GET', '/v1/venues', venuesByQuery);
  await renderApp(app, <CreateStepScreen step={0} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Choose a restaurant on the map' }));
  return app;
}

beforeEach(resetRouter);
afterEach(() => { delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY; jest.restoreAllMocks(); });

describe('Create restaurant picker: map dropdown (owner review 2026-10-28)', () => {
  it('opens in place and lists the map area’s restaurants without typing anything', async () => {
    const app = await openPicker();
    expect(screen.getByRole('button', { name: 'Choose a restaurant on the map' })).toHaveProp('accessibilityState', expect.objectContaining({ expanded: true }));
    expect(await screen.findByRole('button', { name: 'The Little Table, Soho, London' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Noodle House, Fitzrovia, London' })).toBeOnTheScreen();
    expect(screen.getByText('3 restaurants in this map area · tap a pin or a name to preview')).toBeOnTheScreen();
    const [call] = app.mock.callsTo('GET', '/v1/venues');
    // Without a Google key the illustrated map can't pan: it searches everything the artwork shows.
    expect(boundsOf(call)).toEqual(ILLUSTRATED_BOUNDS);
    expect(call?.query.has('q')).toBe(false);
    expect(app.mock.callsTo('POST', '/v1/venues/confirm')).toHaveLength(0);
  });

  it('typing a name narrows the list within the same map area', async () => {
    const app = await openPicker();
    await screen.findByRole('button', { name: 'Casa Evening, Covent Garden, London' });
    await fireEvent.changeText(screen.getByLabelText('Filter restaurants by name'), 'noodle');
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Casa Evening, Covent Garden, London' })).toBeNull());
    expect(screen.getByRole('button', { name: 'Noodle House, Fitzrovia, London' })).toBeOnTheScreen();
    const last = app.mock.callsTo('GET', '/v1/venues').at(-1);
    expect(last?.query.get('q')).toBe('noodle');
    expect(boundsOf(last)).toEqual(ILLUSTRATED_BOUNDS);
    await fireEvent.press(screen.getByRole('button', { name: 'Clear name filter' }));
    expect(await screen.findByRole('button', { name: 'Casa Evening, Covent Garden, London' })).toBeOnTheScreen();
  });

  it('tapping a row previews it; “Use this restaurant” confirms it and Continue then works', async () => {
    const app = await openPicker();
    app.mock.on('POST', '/v1/venues/confirm', confirmed('noodle-house', 'Noodle House'));
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a restaurant.');
    await fireEvent.press(await screen.findByRole('button', { name: 'Noodle House, Fitzrovia, London' }));
    expect(app.mock.callsTo('POST', '/v1/venues/confirm')).toHaveLength(0);
    await fireEvent.press(screen.getByRole('button', { name: 'Use this restaurant' }));
    expect(await screen.findByLabelText('Selected restaurant Noodle House')).toBeOnTheScreen();
    expect(app.mock.callsTo('POST', '/v1/venues/confirm')[0]?.body).toEqual({ placeId: 'noodle-house' });
    expect(screen.queryByTestId('venue-map')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/create/introduce');
    expect(app.services.drafts.get<CreateDraft>(CREATE_DRAFT_KEY)?.venue).toMatchObject({ venueRef: VENUE_REF, placeId: 'noodle-house' });
  });

  it('the illustrated map pins the restaurants it shows; a pin previews the matching numbered row', async () => {
    const app = await openPicker();
    app.mock.on('POST', '/v1/venues/confirm', confirmed('little-table', 'The Little Table'));
    await screen.findByRole('button', { name: 'The Little Table, Soho, London' });
    await fireEvent(screen.getByTestId('venue-map-illustrated'), 'layout', layout(200, 358));
    await fireEvent.press(screen.getByRole('button', { name: '1. The Little Table on the map' }));
    expect(screen.getByRole('button', { name: 'The Little Table, Soho, London' })).toHaveProp('accessibilityState', expect.objectContaining({ selected: true }));
    expect(within(screen.getByTestId('venue-confirm')).getByRole('button', { name: 'Use this restaurant' })).toBeOnTheScreen();
    expect(app.mock.callsTo('POST', '/v1/venues/confirm')).toHaveLength(0);
    await fireEvent.press(screen.getByRole('button', { name: 'Use this restaurant' }));
    expect(await screen.findByLabelText('Selected restaurant The Little Table')).toBeOnTheScreen();
  });

  it('with Google Maps: loads the visible region, reloads when the map moves, and a pin previews', async () => {
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY = 'test-key';
    jest.spyOn(UIManager, 'getViewManagerConfig').mockReturnValue({} as never);
    const app = await openPicker();
    app.mock.on('POST', '/v1/venues/confirm', confirmed('casa-evening', 'Casa Evening'));
    await screen.findByRole('button', { name: 'Casa Evening, Covent Garden, London' });
    expect(screen.getByTestId('native-map')).toBeOnTheScreen();
    expect(boundsOf(app.mock.callsTo('GET', '/v1/venues')[0])).toEqual(regionBounds(PICKER_REGION));

    // Pan east, away from Soho and Fitzrovia: the list follows the new bounds.
    const east = { latitude: 51.512, longitude: -0.12, latitudeDelta: 0.01, longitudeDelta: 0.012 };
    await fireEvent(screen.getByTestId('native-map'), 'regionChangeComplete', east);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'The Little Table, Soho, London' })).toBeNull());
    expect(boundsOf(app.mock.callsTo('GET', '/v1/venues').at(-1))).toEqual(regionBounds(east));
    expect(screen.getByText('1 restaurant in this map area · tap a pin or a name to preview')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('venue-pin-casa-evening'));
    expect(screen.getByTestId('venue-confirm')).toBeOnTheScreen();
    expect(app.mock.callsTo('POST', '/v1/venues/confirm')).toHaveLength(0);
    await fireEvent.press(screen.getByRole('button', { name: 'Use this restaurant' }));
    expect(await screen.findByLabelText('Selected restaurant Casa Evening')).toBeOnTheScreen();
    expect(app.mock.callsTo('POST', '/v1/venues/confirm')[0]?.body).toEqual({ placeId: 'casa-evening' });
  });

  it('the same region reported twice does not search again', async () => {
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY = 'test-key';
    jest.spyOn(UIManager, 'getViewManagerConfig').mockReturnValue({} as never);
    const app = await openPicker();
    await screen.findByRole('button', { name: 'Casa Evening, Covent Garden, London' });
    await fireEvent(screen.getByTestId('native-map'), 'regionChangeComplete', PICKER_REGION);
    await new Promise((r) => setTimeout(r, 450));
    expect(app.mock.callsTo('GET', '/v1/venues')).toHaveLength(1);
  });

  it('explains a failed load and keeps the dropdown usable', async () => {
    const app = createTestApp();
    await signIn(app, me());
    app.mock.on('GET', '/v1/venues', () => { throw new TypeError('Network request failed'); });
    await renderApp(app, <CreateStepScreen step={0} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Choose a restaurant on the map' }));
    expect(await screen.findByText('We couldn’t load restaurants. Check your connection and try again.')).toBeOnTheScreen();
    expect(screen.getByLabelText('Filter restaurants by name')).toBeOnTheScreen();
  });
});
