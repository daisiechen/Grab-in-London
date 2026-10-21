import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createFetchStub, fail, ok, page, type StubResponse } from '../../test/fetchStub.ts';
import { renderApp } from '../../test/render.tsx';
import { APPLICATION_ID, HOST_ID, MEAL_ID, USER_ID, meal, publicProfile, session } from '../../test/fixtures.ts';

const pendingApp = (version = '1') => ({
  id: APPLICATION_ID, mealId: MEAL_ID, version, round: 1, state: 'PENDING', createdAt: '2026-10-20T10:00:00.000Z',
  applicant: publicProfile(USER_ID, 'Emma Hill'), message: 'I’d love to join! I’ve just moved here and a relaxed dinner sounds lovely.',
});

function hostStub(decide: () => StubResponse, mealOver: Record<string, unknown> = {}) {
  let state = 'PENDING';
  return createFetchStub({
    getSession: () => ok(session({ id: HOST_ID })),
    getMeal: () => ok({ meal: meal({ allowedActions: ['REVIEW_APPLICATIONS', 'CANCEL', 'DECLARE_BOOKING', 'EDIT'], ...mealOver }), myApplication: null, conversationId: null }),
    listApplications: () => page([{ ...pendingApp(), state }]),
    decideApplication: () => { const r = decide(); if (r.status === 200) state = 'CONFIRMED'; return r; },
    cancelMeal: () => ok(meal({ status: 'CANCELLED', cancelReason: 'booking' })),
    declareBooking: () => ok(meal(), 201),
  });
}

describe('host decisions (T10)', () => {
  it('approves with Application.version and refreshes the list', async () => {
    const s = hostStub(() => ok({ application: { ...pendingApp('2'), state: 'CONFIRMED' }, mealVersion: '8', conversationId: null }));
    renderApp(s.fetch, `/meals/${MEAL_ID}/host`);
    await userEvent.click(await screen.findByRole('button', { name: /Approve/ }));
    await waitFor(() => expect(s.callsTo('decideApplication')).toHaveLength(1));
    const call = s.callsTo('decideApplication')[0]!;
    expect(call.body).toEqual({ decision: 'APPROVE' });
    expect(call.headers['if-match']).toBe('"1"');
    expect(await screen.findByRole('heading', { name: 'Confirmed guests' })).toBeTruthy();
    expect(s.callsTo('listApplications').length).toBeGreaterThanOrEqual(2);
  });

  it('on MEAL_FULL shows the reason, refreshes, and does not retry the decision', async () => {
    const s = hostStub(() => fail(409, 'MEAL_FULL'));
    renderApp(s.fetch, `/meals/${MEAL_ID}/host`);
    await userEvent.click(await screen.findByRole('button', { name: /Approve/ }));
    expect((await screen.findByRole('alert')).textContent).toBe('This table is full.');
    await waitFor(() => expect(s.callsTo('getMeal').length).toBeGreaterThanOrEqual(2));
    expect(s.callsTo('decideApplication')).toHaveLength(1);
  });

  it('declining is final and needs confirmation', async () => {
    const s = hostStub(() => ok({ application: { ...pendingApp('2'), state: 'DECLINED' }, mealVersion: '8', conversationId: null }));
    renderApp(s.fetch, `/meals/${MEAL_ID}/host`);
    await userEvent.click(await screen.findByRole('button', { name: 'Decline' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/won’t be able to apply to this meal again/)).toBeTruthy();
    expect(s.callsTo('decideApplication')).toHaveLength(0);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Decline request' }));
    await waitFor(() => expect(s.callsTo('decideApplication')[0]?.body).toEqual({ decision: 'DECLINE' }));
  });

  it('cancels the whole meal with a host reason and the meal version', async () => {
    const s = hostStub(() => ok({}));
    renderApp(s.fetch, `/meals/${MEAL_ID}/host`);
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel this meal' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/You must cancel the restaurant reservation yourself/)).toBeTruthy();
    await userEvent.click(within(dialog).getByLabelText('Restaurant arrangements'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel meal for everyone' }));
    await waitFor(() => expect(s.callsTo('cancelMeal')).toHaveLength(1));
    const call = s.callsTo('cancelMeal')[0]!;
    expect(call.body).toEqual({ reason: 'booking' });
    expect(call.headers['if-match']).toBe('"7"');
  });

  it('reports a booking status for the current confirmed count and flags stale reports', async () => {
    const s = hostStub(() => ok({}), {
      bookingDeclaration: { id: '12121212-1212-4121-8121-121212121212', revision: '1', status: 'REPORTED_CONFIRMED', declaredCount: 2, reportedAt: '2026-10-20T10:00:00.000Z', stale: true },
      confirmedCount: 3,
    });
    renderApp(s.fetch, `/meals/${MEAL_ID}/host`);
    expect(await screen.findByText(/confirmed guest count changed/)).toBeTruthy();
    await userEvent.click(screen.getByLabelText('Booked with the restaurant'));
    await userEvent.click(screen.getByRole('button', { name: 'Update reservation status' }));
    await waitFor(() => expect(s.callsTo('declareBooking')[0]?.body).toEqual({ status: 'REPORTED_CONFIRMED', count: 3 }));
  });

  it('hides decisions once the server no longer allows reviewing', async () => {
    const s = createFetchStub({
      getSession: () => ok(session({ id: HOST_ID })),
      getMeal: () => ok({ meal: meal({ allowedActions: [] }), myApplication: null, conversationId: null }),
      listApplications: () => page([pendingApp()]),
    });
    renderApp(s.fetch, `/meals/${MEAL_ID}/host`);
    expect(await screen.findByText('Applications are closed')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Approve/ })).toBeNull();
  });
});
