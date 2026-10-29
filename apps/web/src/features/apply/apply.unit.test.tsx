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
    expect((await screen.findByRole('alert')).textContent).toBe('Write at least 20 characters so Maya Chen can get to know you.');
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
    expect(await screen.findByRole('button', { name: /Continue with email/ })).toBeTruthy();
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
    expect((await screen.findByRole('alert')).textContent).toMatch(/can’t accept another request from you/);
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
    expect(await screen.findByRole('heading', { name: 'Your hello is on its way.' })).toBeTruthy();
    expect(screen.getByRole('img', { name: /Application progress: Sent, done; Host reviewing, in progress/ })).toBeTruthy();
    await userEvent.click(await screen.findByRole('button', { name: 'Withdraw request' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Withdraw request' }));
    expect(await screen.findByRole('heading', { name: 'Your request is withdrawn.' })).toBeTruthy();
    const call = s.callsTo('withdrawApplication')[0]!;
    expect(call.params.applicationId).toBe(APPLICATION_ID);
    expect(call.headers['if-match']).toBe('"4"');
    expect(screen.getByRole('link', { name: /Apply again/ }).getAttribute('href')).toBe(`/meals/${MEAL_ID}/apply`);
  });

  it('a confirmed guest’s status opens the group chat and the meal page offers Cancel my place (meal version)', async () => {
    const s = stub({ myApplication: app('CONFIRMED', '5'), allowed: ['LEAVE', 'OPEN_GROUP'] });
    s.on('getMeal', () => ok({ meal: meal({ allowedActions: ['LEAVE', 'OPEN_GROUP'] }), myApplication: app('CONFIRMED', '5'), conversationId: '13131313-1313-4131-8131-131313131313' }));
    renderApp(s.fetch, `/meals/${MEAL_ID}/status`);
    expect(await screen.findByRole('heading', { name: 'You’re at the table.' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Open group chat/ }).getAttribute('href')).toBe('/chat/13131313-1313-4131-8131-131313131313');
    await userEvent.click(screen.getByRole('link', { name: 'View Friday dinner & new faces' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel my place' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/You stay in the group chat/)).toBeTruthy();
    expect(dialog.textContent).not.toMatch(/refund|payment/i);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel my place' }));
    await waitFor(() => expect(s.callsTo('leaveMeal')).toHaveLength(1));
    expect(s.callsTo('leaveMeal')[0]!.headers['if-match']).toBe('"7"');
  });
});
