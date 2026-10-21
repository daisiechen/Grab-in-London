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

    await fireEvent.press(screen.getByRole('button', { name: 'Any date' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Sat 24 Oct' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(app.mock.calls).toHaveLength(1);

    await fireEvent.press(screen.getByRole('button', { name: 'Any date' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Sat 24 Oct' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Tue 27 Oct' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Show meals' }));
    expect(await screen.findByText('No tables match just yet')).toBeOnTheScreen();
    expect(app.mock.calls[1]?.query.get('dates')).toBe('2026-10-24,2026-10-27');

    await fireEvent.press(screen.getByRole('button', { name: 'Clear filters' }));
    expect(await screen.findByText('Sunday dinner')).toBeOnTheScreen();
    expect(app.mock.calls[2]?.query.get('dates')).toBeNull();
  });

  it('past London dates are not selectable', async () => {
    const app = createTestApp();
    app.mock.on('GET', '/v1/meals', page([]));
    await renderApp(app, <DiscoverScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Any date' }));
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
