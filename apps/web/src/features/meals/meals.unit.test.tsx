import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createFetchStub, fail, ok, page } from '../../test/fetchStub.ts';
import { renderApp } from '../../test/render.tsx';
import { APPLICATION_ID, HOST_ID, MEAL_ID, USER_ID, meal, session } from '../../test/fixtures.ts';

const detail = (over: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => ok({ meal: meal(over), myApplication: null, conversationId: null, ...extra });
const application = (state: string) => ({ id: APPLICATION_ID, mealId: MEAL_ID, version: '1', round: 1, state, createdAt: '2026-10-20T10:00:00.000Z' });

describe('meal detail (T08)', () => {
  it('shows host-declared cuisine/dietary as “Not provided” when unknown, pay-at-venue only', async () => {
    const stub = createFetchStub({ getSession: () => fail(401, 'AUTH_REQUIRED'), getMeal: () => detail() });
    renderApp(stub.fetch, `/meals/${MEAL_ID}`);
    expect(await screen.findByRole('heading', { level: 1, name: 'Friday dinner & new faces' })).toBeTruthy();
    expect(screen.getAllByText('Not provided')).toHaveLength(2);
    expect(screen.getByText('No payment is due in the app. Everyone pays their own share at the restaurant.')).toBeTruthy();
    expect(screen.getByText('Host hasn’t reported a booking yet')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/deposit|Visa|card/i);
    expect(screen.getByRole('link', { name: /Request to join/ }).getAttribute('href')).toBe(`/meals/${MEAL_ID}/apply`);
  });

  it('labels declared values and a stale host booking report', async () => {
    const stub = createFetchStub({
      getSession: () => fail(401, 'AUTH_REQUIRED'),
      getMeal: () => detail({
        cuisineCode: 'JAPANESE', dietaryCodes: ['VEGETARIAN_OPTIONS', 'VEGAN'],
        bookingDeclaration: { id: '12121212-1212-4121-8121-121212121212', revision: '2', status: 'REPORTED_CONFIRMED', declaredCount: 3, reportedAt: '2026-10-20T10:00:00.000Z', stale: true },
      }),
    });
    renderApp(stub.fetch, `/meals/${MEAL_ID}`);
    expect(await screen.findByText('Japanese')).toBeTruthy();
    expect(screen.getByText('Vegetarian options, Vegan')).toBeTruthy();
    expect(screen.getByText('Host to update reservation')).toBeTruthy();
  });

  it('follows allowedActions: host sees management, not Apply', async () => {
    const stub = createFetchStub({
      getSession: () => ok(session({ id: HOST_ID })),
      getMeal: () => detail({ allowedActions: ['REVIEW_APPLICATIONS', 'EDIT', 'CANCEL', 'OPEN_GROUP'] }, { conversationId: '13131313-1313-4131-8131-131313131313' }),
    });
    renderApp(stub.fetch, `/meals/${MEAL_ID}`);
    expect(await screen.findByRole('link', { name: 'Manage guest list' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Edit arrangements' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Open meal group/ }).getAttribute('href')).toBe('/inbox/13131313-1313-4131-8131-131313131313');
    expect(screen.queryByRole('link', { name: /Request to join/ })).toBeNull();
  });

  it('shows the signed-in user’s own progress and the cancellation reason', async () => {
    const stub = createFetchStub({
      getSession: () => ok(session()),
      getMeal: () => detail({ status: 'CANCELLED', cancelReason: 'insufficient', allowedActions: [] }, { myApplication: application('EXPIRED') }),
    });
    renderApp(stub.fetch, `/meals/${MEAL_ID}`);
    expect(await screen.findByText('Application expired')).toBeTruthy();
    expect(screen.getByText(/not enough people joined/)).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Request to join/ })).toBeNull();
  });

  it('never shows provider venue data when it is unavailable', async () => {
    const stub = createFetchStub({
      getSession: () => fail(401, 'AUTH_REQUIRED'),
      getMeal: () => detail({ venue: { ...meal().venue, available: false, name: null, address: null } }),
    });
    renderApp(stub.fetch, `/meals/${MEAL_ID}`);
    expect(await screen.findByText('Restaurant information temporarily unavailable')).toBeTruthy();
    expect(screen.queryByText(/Google Maps/)).toBeNull();
  });
});

describe('my meals (T08)', () => {
  it('loads each private section and shows prototype empty states', async () => {
    const stub = createFetchStub({
      getSession: () => ok(session()),
      myMeals: (call) => (call.url.searchParams.get('section') === 'APPLICATIONS'
        ? page([{ meal: meal(), application: application('PENDING'), role: 'APPLICANT' }])
        : page([])),
    });
    renderApp(stub.fetch, '/meals');
    expect(await screen.findByText('A good meal is waiting.')).toBeTruthy();
    expect(stub.callsTo('myMeals')[0]!.url.searchParams.get('section')).toBe('UPCOMING');
    await userEvent.click(screen.getByRole('button', { name: 'Applications' }));
    expect(await screen.findByText('Application pending')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Hosting' }));
    expect(await screen.findByText('Your table starts with you.')).toBeTruthy();
    await waitFor(() => expect(stub.callsTo('myMeals').map((c) => c.url.searchParams.get('section'))).toEqual(['UPCOMING', 'APPLICATIONS', 'HOSTING']));
  });

  it('asks guests to sign in and makes no private request', async () => {
    const stub = createFetchStub({ getSession: () => fail(401, 'AUTH_REQUIRED') });
    renderApp(stub.fetch, '/meals');
    expect(await screen.findByRole('link', { name: /Sign in/ })).toBeTruthy();
    expect(stub.callsTo('myMeals')).toHaveLength(0);
  });
});

void USER_ID;
