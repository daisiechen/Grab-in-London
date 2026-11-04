import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createFetchStub, ok, page } from '../../test/fetchStub.ts';
import { renderApp } from '../../test/render.tsx';
import { fakePollerDeps } from '../../test/fakePoller.ts';
import { HOST_ID, MEAL_ID, USER_ID, meal, publicProfile, session } from '../../test/fixtures.ts';

const CONV = '14141414-1414-4141-8141-141414141414';
const MSG = '00000000-0000-4000-8000-000000000011';
const conversation = { id: CONV, version: '3', kind: 'GROUP', mealId: MEAL_ID, title: 'Friday dinner & new faces', canSend: true, dissolved: false, head: '12' };
const message = (id: string, seq: string, body: string, sender = publicProfile(HOST_ID, 'Maya Chen')) => ({ id, seq, sender, body, createdAt: '2026-10-21T11:00:00.000Z', redacted: false });

describe('report a chat message (iOS message reporting)', () => {
  it('offers Report message only on other members’ messages, carries the excerpt in memory and hides it after the receipt', async () => {
    const f = fakePollerDeps();
    const stub = createFetchStub({
      getSession: () => ok(session()),
      inbox: () => page([{ conversation, lastMessage: null, unreadCount: 0 }]),
      getMeal: () => ok({ meal: meal(), myApplication: null, conversationId: CONV }),
      readMessages: () => page([message(MSG, '11', 'An unwelcome comment'), message('00000000-0000-4000-8000-000000000012', '12', 'My own note', publicProfile(USER_ID, 'Sam Rivera'))]),
      markConversationRead: () => ({ status: 204 }),
      createReport: () => ok({ id: '18181818-1818-4181-8181-181818181818', receipt: 'FR-MSG01', status: 'RECEIVED', targetType: 'MESSAGE', publicOutcome: null, createdAt: '2026-10-21T12:00:00.000Z' }, 201),
    });
    renderApp(stub.fetch, `/chat/${CONV}`, { pollerDeps: f.deps });
    expect(await screen.findByText('An unwelcome comment')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^Message options/ })).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Message options for Maya Chen’s message' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Message options' })).getByRole('button', { name: /Report message/ }));
    expect(await screen.findByRole('heading', { name: 'Report this message' })).toBeTruthy();
    expect(screen.getByText('“An unwelcome comment”')).toBeTruthy();
    expect(window.location.search).not.toContain('unwelcome');
    await userEvent.click(screen.getByLabelText('Harassment or hate'));
    await userEvent.type(screen.getByLabelText(/What would you like us to know/), 'Rude remark in the group.');
    await userEvent.click(screen.getByRole('button', { name: 'Submit report' }));
    expect(await screen.findByText(/The message is now hidden for you/)).toBeTruthy();
    expect(stub.callsTo('createReport')[0]!.body).toEqual({ targetType: 'MESSAGE', targetId: MSG, reason: 'harassment', details: 'Rude remark in the group.' });
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(await screen.findByText('You reported this message')).toBeTruthy();
    expect(screen.queryByText('An unwelcome comment')).toBeNull();
    expect(screen.queryAllByRole('button', { name: /^Message options/ })).toHaveLength(0);
  });
});

describe('blocked members', () => {
  it('lists blocked members and unblocks after confirmation with the block version', async () => {
    const stub = createFetchStub({
      getSession: () => ok(session()),
      listBlocks: () => page([{ profile: publicProfile(HOST_ID, 'Maya Chen'), version: '4', blockedAt: '2026-10-20T10:00:00.000Z' }]),
      unblock: () => ok({ subjectId: HOST_ID, blocked: false, version: '5' }),
    });
    renderApp(stub.fetch, '/blocked-members');
    expect(await screen.findByRole('link', { name: 'Open Maya Chen’s profile' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Unblock Maya Chen' }));
    const dialog = await screen.findByRole('dialog', { name: 'Unblock Maya Chen?' });
    expect(stub.callsTo('unblock')).toHaveLength(0);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Unblock' }));
    await waitFor(() => expect(stub.callsTo('unblock')).toHaveLength(1));
    expect(stub.callsTo('unblock')[0]!.headers['if-match']).toBe('"4"');
    expect(await screen.findByText(/is unblocked/)).toBeTruthy();
  });
});
