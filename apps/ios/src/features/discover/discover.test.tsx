import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { DiscoverScreen } from './DiscoverScreen.tsx';
import { createTestApp, renderApp } from '../../test/render.tsx';
import { mockRouter, resetRouter } from '../../test/router.ts';
import { networkDown, page } from '../../test/mock-fetch.ts';
import { MEAL_ID, meal } from '../../test/fixtures.ts';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot use ESM imports
jest.mock('expo-router', () => require('../../test/router.ts').expoRouterMock);

beforeEach(resetRouter);

describe('DiscoverScreen (QA-DISCOVERY-001..003)', () => {
  it('the city chip opens an in-place menu with London selected', async () => {
    const app = createTestApp();
    app.mock.on('GET', '/v1/meals', page([meal()]));
    await renderApp(app, <DiscoverScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'City: London' }));
    expect(screen.getByTestId('city-menu')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'London' })).toBeSelected();
    await fireEvent.press(screen.getByRole('radio', { name: 'London' }));
    expect(screen.queryByTestId('city-menu')).toBeNull();
  });

  it('lists public meals for guests and opens detail', async () => {
    const app = createTestApp();
    app.mock.on('GET', '/v1/meals', page([meal()]));
    await renderApp(app, <DiscoverScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: /Sunday dinner/ }));
    expect(mockRouter.push).toHaveBeenCalledWith(`/meals/${MEAL_ID}`);
    expect(app.mock.calls[0]?.headers.authorization).toBeUndefined();
  });

  it('date sheet edits a draft: closing discards, Show meals applies; empty result offers Clear filters', async () => {
    const app = createTestApp();
    app.mock.on('GET', '/v1/meals', (c) => page(c.query.get('dates') ? [] : [meal()]));
    await renderApp(app, <DiscoverScreen />);
    await screen.findByText('Sunday dinner');

    await fireEvent.press(screen.getByRole('button', { name: 'Filter by date' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Sat 24 Oct' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(app.mock.callsTo('GET','/v1/meals')).toHaveLength(1);
    expect(app.mock.callsTo('GET',`/v1/venues/${meal().venue.venueRef}/photo`)).toHaveLength(1);

    await fireEvent.press(screen.getByRole('button', { name: 'Filter by date' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Sat 24 Oct' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Tue 27 Oct' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Show meals' }));
    expect(await screen.findByText('No tables match just yet')).toBeOnTheScreen();
    expect(app.mock.callsTo('GET','/v1/meals')[1]?.query.get('dates')).toBe('2026-10-24,2026-10-27');

    await fireEvent.press(screen.getByRole('button', { name: 'Clear filters' }));
    expect(await screen.findByText('Sunday dinner')).toBeOnTheScreen();
    expect(app.mock.callsTo('GET','/v1/meals')[2]?.query.get('dates')).toBeNull();
  });

  it('the map preview lists the selected area first, then other areas under More nearby', async () => {
    const app = createTestApp();
    const at = (id: string, title: string, areaCode: string) => meal({ id, title, areaCode, venue: { ...meal().venue, areaCode } });
    app.mock.on('GET', '/v1/meals', page([at('11111111-1111-4111-8111-000000000001', 'Soho supper', 'soho'), at('11111111-1111-4111-8111-000000000002', 'Fitzrovia ramen', 'fitzrovia')]));
    await renderApp(app, <DiscoverScreen />);
    expect(await screen.findByText('Soho supper')).toBeOnTheScreen();
    expect(screen.getByText('Fitzrovia ramen')).toBeOnTheScreen();
    expect(screen.getByText('MORE NEARBY')).toBeOnTheScreen();
    expect(screen.getByTestId('map-preview-list')).toBeOnTheScreen();
  });

  it('View all switches to the list, focused on the selected area, with a way back to every area', async () => {
    const app = createTestApp();
    const at = (id: string, title: string, areaCode: string) => meal({ id, title, areaCode, venue: { ...meal().venue, areaCode } });
    app.mock.on('GET', '/v1/meals', page([at('11111111-1111-4111-8111-000000000001', 'Soho supper', 'soho'), at('11111111-1111-4111-8111-000000000002', 'Fitzrovia ramen', 'fitzrovia')]));
    await renderApp(app, <DiscoverScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: /View all 1 meal in Soho as a list/ }));
    expect(screen.getByTestId('discover-list')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Meals in Soho' })).toBeOnTheScreen();
    expect(screen.getByText('Soho supper')).toBeOnTheScreen();
    expect(screen.queryByText('Fitzrovia ramen')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Show all areas' }));
    expect(screen.getByText('Fitzrovia ramen')).toBeOnTheScreen();
  });

  it('past London dates are not selectable', async () => {
    const app = createTestApp();
    app.mock.on('GET', '/v1/meals', page([]));
    await renderApp(app, <DiscoverScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Filter by date' }));
    expect(screen.getByRole('checkbox', { name: 'Tue 20 Oct' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Wed 21 Oct' })).not.toBeDisabled();
  });

  it('offline shows an error with retry, not an empty result', async () => {
    const app = createTestApp();
    app.mock.on('GET', '/v1/meals', networkDown, 1);
    app.mock.on('GET', '/v1/meals', page([meal()]));
    await renderApp(app, <DiscoverScreen />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/offline/);
    expect(screen.queryByText('No tables match just yet')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.getByText('Sunday dinner')).toBeOnTheScreen());
  });
});
