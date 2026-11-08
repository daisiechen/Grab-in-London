/**
 * Return context now lives in the URL and browser history (filters, view and area are query
 * parameters; Back uses history), so nothing private or unvalidated travels in navigation state.
 */
import { expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createFetchStub, fail, ok, page } from '../../test/fetchStub.ts';
import { renderApp } from '../../test/render.tsx';
import { MEAL_ID, meal, publicProfile } from '../../test/fixtures.ts';

const stub = () => createFetchStub({
  getSession: () => fail(401, 'AUTH_REQUIRED'),
  discoverMeals: () => page([meal()]),
  getMeal: () => ok({ meal: meal(), myApplication: null, conversationId: null }),
  getPublicProfile: () => ok({ profile: publicProfile(), reviews: [], nextReviewCursor: null }),
  getVenuePhoto: () => ok({ placeId: 'place-1', photo: null }),
});

it('keeps list view and filters in the address, so Back returns to the same list', async () => {
  const s = stub();
  renderApp(s.fetch, '/discover?view=list&tableSizes=4');
  await userEvent.click(await screen.findByRole('link', { name: 'Open Friday dinner & new faces' }));
  await screen.findByRole('heading', { level: 1, name: 'Friday dinner & new faces' });
  await userEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(await screen.findByRole('heading', { name: 'A seat for you' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'List view' }).getAttribute('aria-pressed')).toBe('true');
  expect(s.callsTo('discoverMeals').at(-1)!.url.searchParams.get('tableSizes')).toBe('4');
});

it.each(['https://outside.invalid', '//outside.invalid', '/settings/deletion'])('ignores navigation state from elsewhere (%s): a direct visit goes Back to Discover', async (backTo) => {
  const s = stub();
  const { unmount } = renderApp(s.fetch, `/meals/${MEAL_ID}/friday-dinner-and-new-faces`);
  window.history.replaceState({ usr: { backTo } }, '');
  await screen.findByRole('heading', { level: 1, name: 'Friday dinner & new faces' });
  await userEvent.click(screen.getByRole('button', { name: 'Back' }));
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Fancy a bite?' })).toBeTruthy());
  unmount();
});
