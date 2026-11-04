import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createFetchStub, fail, ok, page } from '../../test/fetchStub.ts';
import { renderApp } from '../../test/render.tsx';
import { HOST_ID, MEAL_ID, meal, publicProfile } from '../../test/fixtures.ts';

const other = meal({ id: '99999999-9999-4999-8999-999999999999', title: 'Brunch in Covent Garden', areaCode: 'covent-garden' });
const stubFor = () => createFetchStub({
  getSession: () => fail(401, 'AUTH_REQUIRED'),
  discoverMeals: () => page([meal(), other]),
  getMeal: () => ok({ meal: meal(), myApplication: null, conversationId: null }),
  getPublicProfile: () => ok({ profile: publicProfile(HOST_ID, 'Maya Chen'), reviews: [], nextReviewCursor: null }),
  getVenuePhoto: () => ok({ placeId: 'place-1', photo: null }),
});

describe('back navigation (history first, safe fallback)', () => {
  it('returns from meal and host profile to Discover with the same filters and selected area', async () => {
    const stub = stubFor();
    renderApp(stub.fetch, '/discover?languages=en&area=soho');
    await userEvent.click(await screen.findByRole('link', { name: 'Open Friday dinner & new faces' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Friday dinner & new faces' })).toBeTruthy();
    await userEvent.click(screen.getByRole('link', { name: 'Your host, Maya Chen' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Maya Chen' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Friday dinner & new faces' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('heading', { name: 'Fancy a bite?' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'More filters, 1 active' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Soho: 1 meal' }).getAttribute('aria-pressed')).toBe('true');
    expect(stub.callsTo('discoverMeals').at(-1)!.url.searchParams.get('languages')).toBe('en');
  });

  it('a shared link opened directly goes Back to Discover, not off the site', async () => {
    renderApp(stubFor().fetch, `/meals/${MEAL_ID}/friday-dinner-and-new-faces`);
    await screen.findByRole('heading', { level: 1, name: 'Friday dinner & new faces' });
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Fancy a bite?' })).toBeTruthy());
  });
});
