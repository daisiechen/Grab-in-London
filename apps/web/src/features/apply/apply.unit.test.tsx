import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createFetchStub, fail, ok, type RecordedCall } from '../../test/fetchStub.ts';
import { renderApp } from '../../test/render.tsx';
import { APPLICATION_ID, MEAL_ID, meal, session } from '../../test/fixtures.ts';
import { loadDraft, saveDraft } from '../../lib/drafts.ts';

const INTRO = 'Hi! I moved to London recently and would love to meet new people over dinner.';
const app = (state: string, version = '2') => ({ id: APPLICATION_ID, mealId: MEAL_ID, version, round: 1, state, createdAt: '2026-10-20T10:00:00.000Z' });

function stub(opts: { myApplication?: unknown; allowed?: string[]; applyMeal?: (c: RecordedCall) => ReturnType<typeof ok>; signedIn?: boolean } = {}) {
  let my = opts.myApplication ?? null;
  return createFetchStub({
    getSession: () => (opts.signedIn === false ? fail(401, 'AUTH_REQUIRED') : ok(session())),
    getMe: () => ok(session().user),
    getMeal: () => ok({ meal: meal({ allowedActions: opts.allowed ?? ['APPLY'] }), myApplication: my, conversationId: null }),
    applyMeal: opts.applyMeal ?? (() => { my = app('PENDING', '1'); opts.allowed = ['WITHDRAW']; return ok(my, 201); }),
    withdrawApplication: () => { my = app('WITHDRAWN', '2'); opts.allowed = ['APPLY']; return ok(my); },
    leaveMeal: () => ok({ application: app('CANCELLED', '3'), meal: meal() }),
  });
}

describe('apply (T09)', () => {
  it('validates length, sends once with an Idempotency-Key and shows the pending status', async () => {
    const s = stub();
    renderApp(s.fetch, `/meals/${MEAL_ID}/apply`);
    const box = await screen.findByLabelText('Your introduction');
    await userEvent.type(box, 'Too short');
    await userEvent.click(screen.getByRole('button', { name: /Send request/ }));
    expect((await screen.findByRole('alert')).textContent).toBe('Write an introduction of 20–300 characters.');
    expect(s.callsTo('applyMeal')).toHaveLength(0);
    await userEvent.clear(box);
    await userEvent.type(box, INTRO);
    await userEvent.click(screen.getByRole('button', { name: /Send request/ }));
    expect(await screen.findByRole('heading', { name: 'Your hello is on its way.' })).toBeTruthy();
    const call = s.callsTo('applyMeal')[0]!;
    expect(call.body).toEqual({ message: INTRO });
    expect(call.headers['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/);
    expect(loadDraft(`apply:${MEAL_ID}`)).toBeNull();
  });

  it('a guest’s introduction survives the sign-in detour and is not auto-submitted', async () => {
    const s = stub({ signedIn: false });
    renderApp(s.fetch, `/meals/${MEAL_ID}/apply`);
    await userEvent.type(await screen.findByLabelText('Your introduction'), INTRO);
    await userEvent.click(screen.getByRole('button', { name: /Send request/ }));
    expect(await screen.findByRole('heading', { name: 'Let’s keep in touch.' })).toBeTruthy();
    expect(loadDraft<{ intro: string }>(`apply:${MEAL_ID}`)?.intro).toBe(INTRO);
    expect(s.callsTo('applyMeal')).toHaveLength(0);
  });

  it('restores the draft on return and still waits for the user to press Send', async () => {
    saveDraft(`apply:${MEAL_ID}`, { intro: INTRO });
    const s = stub();
    renderApp(s.fetch, `/meals/${MEAL_ID}/apply`);
    expect(((await screen.findByLabelText('Your introduction')) as HTMLTextAreaElement).value).toBe(INTRO);
    expect(s.callsTo('applyMeal')).toHaveLength(0);
  });

  it('explains a final decline and keeps the text', async () => {
    const s = stub({ applyMeal: () => fail(409, 'APPLICATION_DECLINED_FINAL') });
    renderApp(s.fetch, `/meals/${MEAL_ID}/apply`);
    await userEvent.type(await screen.findByLabelText('Your introduction'), INTRO);
    await userEvent.click(screen.getByRole('button', { name: /Send request/ }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/declined, so you can’t apply again/);
    expect((screen.getByLabelText('Your introduction') as HTMLTextAreaElement).value).toBe(INTRO);
  });

  it('a server PROFILE_INCOMPLETE sends the user through the profile gate', async () => {
    const s = stub({ applyMeal: () => fail(403, 'PROFILE_INCOMPLETE') });
    renderApp(s.fetch, `/meals/${MEAL_ID}/apply`);
    await userEvent.type(await screen.findByLabelText('Your introduction'), INTRO);
    await userEvent.click(screen.getByRole('button', { name: /Send request/ }));
    await waitFor(() => expect(s.callsTo('getMe').length).toBeGreaterThan(0));
    expect(loadDraft<{ intro: string }>(`apply:${MEAL_ID}`)?.intro).toBe(INTRO);
  });

  it('withdraws a pending request after confirmation using the application version', async () => {
    const s = stub({ myApplication: app('PENDING', '4'), allowed: ['WITHDRAW'] });
    renderApp(s.fetch, `/meals/${MEAL_ID}/apply`);
    await userEvent.click(await screen.findByRole('button', { name: 'Withdraw request' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Withdraw request' }));
    expect(await screen.findByRole('heading', { name: 'Your request is withdrawn.' })).toBeTruthy();
    const call = s.callsTo('withdrawApplication')[0]!;
    expect(call.params.applicationId).toBe(APPLICATION_ID);
    expect(call.headers['if-match']).toBe('"4"');
    expect(screen.getByRole('button', { name: /Apply again/ })).toBeTruthy();
  });

  it('a confirmed guest can cancel their place (meal version), with no refund/payment wording', async () => {
    const s = stub({ myApplication: app('CONFIRMED', '5'), allowed: ['LEAVE', 'OPEN_GROUP'] });
    renderApp(s.fetch, `/meals/${MEAL_ID}/apply`);
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel your place' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/group chat stays open/)).toBeTruthy();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel my place' }));
    await waitFor(() => expect(s.callsTo('leaveMeal')).toHaveLength(1));
    expect(s.callsTo('leaveMeal')[0]!.headers['if-match']).toBe('"7"');
  });
});
