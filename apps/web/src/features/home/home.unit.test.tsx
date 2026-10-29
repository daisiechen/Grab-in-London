import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { createFetchStub, fail, ok, page } from '../../test/fetchStub.ts';
import { renderApp } from '../../test/render.tsx';
import { MEAL_ID, meal, session } from '../../test/fixtures.ts';

describe('homepage (F3, D3)', () => {
  it('shows signed-out visitors the value proposition, this week’s tables and the footer', async () => {
    const stub = createFetchStub({ getSession: () => fail(401, 'AUTH_REQUIRED'), discoverMeals: () => page([meal()]), getVenuePhoto: () => ok({ placeId: 'place-1', photo: null }) });
    renderApp(stub.fetch, '/');
    expect(screen.getByRole('heading', { level: 1, name: 'Meet new people over a meal.' })).toBeTruthy();
    expect((await screen.findByRole('link', { name: 'Open Friday dinner & new faces' })).getAttribute('href')).toBe(`/meals/${MEAL_ID}/friday-dinner-and-new-faces`);
    expect(screen.getByRole('link', { name: /Find a table/ }).getAttribute('href')).toBe('/discover');
    expect(screen.getByRole('navigation', { name: 'Site' })).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Main navigation', hidden: false })).toBeTruthy();
    expect(document.title).toBe('Fancy · Meet new people over a meal in London');
    expect(document.body.textContent).not.toMatch(/App Store|Download on/);
  });

  it('sends signed-in members straight to Discover', async () => {
    const stub = createFetchStub({ getSession: () => ok(session()), discoverMeals: () => page([]) });
    renderApp(stub.fetch, '/');
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Fancy a bite?' })).toBeTruthy());
  });

  it('keeps the homepage usable when this week’s tables fail to load', async () => {
    const stub = createFetchStub({ getSession: () => fail(401, 'AUTH_REQUIRED'), discoverMeals: () => fail(503, 'PROVIDER_UNAVAILABLE') });
    renderApp(stub.fetch, '/');
    expect(await screen.findByText(/We couldn’t load this week’s tables/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open Discover' })).toBeTruthy();
  });
});
