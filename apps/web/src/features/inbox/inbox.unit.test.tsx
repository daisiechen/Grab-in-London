import { describe, expect, it } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createFetchStub, fail, ok, page, type Handler } from '../../test/fetchStub.ts';
import { renderApp, testApi } from '../../test/render.tsx';
import { fakePollerDeps } from '../../test/fakePoller.ts';
import { APPLICATION_ID, HOST_ID, MEAL_ID, USER_ID, meal, publicProfile, session } from '../../test/fixtures.ts';
import { mergeMessages, maxSeq, readInbox, findConversation } from '../../api/conversations.ts';

const CONV = '14141414-1414-4141-8141-141414141414';
const conversation = (over: Record<string, unknown> = {}) => ({ id: CONV, version: '3', kind: 'GROUP', mealId: MEAL_ID, title: 'Friday dinner & new faces', canSend: true, dissolved: false, head: '12', ...over });
const msg = (seq: string, body: string, sender = publicProfile(HOST_ID, 'Maya Chen'), id?: string) => ({
  id: id ?? `00000000-0000-4000-8000-${seq.padStart(12, '0')}`, seq, sender, body, createdAt: '2026-10-21T11:00:00.000Z', redacted: false,
});

function chatStub(readMessages: Handler, over: Record<string, unknown> = {}, extra: Partial<Record<string, Handler>> = {}) {
  return createFetchStub({
    getSession: () => ok(session()),
    inbox: () => page([{ conversation: conversation(over), lastMessage: null, unreadCount: 0 }]),
    getMeal: () => ok({ meal: meal(), myApplication: null, conversationId: CONV }),
    readMessages,
    ...extra,
  });
}

describe('message helpers', () => {
  it('finds older conversation metadata after five inbox pages', async () => {
    const s=createFetchStub({inbox:({url})=>{
      const index=Number(url.searchParams.get('cursor')??0);
      return index===5 ? page([{conversation:conversation(),lastMessage:null,unreadCount:0}]) : page([],String(index+1));
    }});
    expect((await findConversation(testApi(s.fetch).client,CONV))?.id).toBe(CONV);
    expect(s.callsTo('inbox')).toHaveLength(6);
  });
  it('fails closed instead of hanging or treating an incomplete inbox as complete', async () => {
    const s=createFetchStub({inbox:()=>page([], 'repeated')});
    await expect(readInbox(testApi(s.fetch).client)).rejects.toThrow('Pagination did not advance');
    expect(s.callsTo('inbox')).toHaveLength(2);
  });

  it('orders by bigint seq and de-duplicates by id', () => {
    const merged = mergeMessages([msg('10', 'b'), msg('9', 'a')], [msg('10', 'b'), msg('100', 'c')]);
    expect(merged.map((m) => m.seq)).toEqual(['9', '10', '100']);
    expect(maxSeq('9', '100', null, '20')).toBe('100');
  });
});

describe('group chat (T12)', () => {
  it('polls LIVE every 2 s with afterSeq and renders text, never HTML', async () => {
    const f = fakePollerDeps();
    let n = 0;
    const s = chatStub(() => (++n === 1
      ? { status: 200, body: { data: [msg('11', '<img src=x onerror="alert(1)">')], page: { nextCursor: null, hasMore: false, scannedThroughSeq: '11' }, meta: { requestId: 'r', serverNow: '2026-10-21T12:00:00.000Z' } } }
      : { status: 200, body: { data: [msg('13', 'See you at 7!')], page: { nextCursor: null, hasMore: false, scannedThroughSeq: '14' }, meta: { requestId: 'r', serverNow: '2026-10-21T12:00:00.000Z' } } }));
    const view = renderApp(s.fetch, `/inbox/${CONV}`, { pollerDeps: f.deps });
    expect(await screen.findByText('<img src=x onerror="alert(1)">')).toBeTruthy();
    expect(view.container.querySelector('img')).toBeNull();
    const first = s.callsTo('readMessages')[0]!.url.searchParams;
    expect(first.get('mode')).toBe('LIVE');
    expect(first.has('afterSeq')).toBe(false);
    await act(async () => { await f.advance(2000); });
    expect(await screen.findByText('See you at 7!')).toBeTruthy();
    expect(s.callsTo('readMessages')[1]!.url.searchParams.get('afterSeq')).toBe('11');
    await act(async () => { await f.advance(2000); });
    expect(s.callsTo('readMessages')[2]!.url.searchParams.get('afterSeq')).toBe('14');
  });

  it('a 403 stops LIVE polling, removes the composer and reads HISTORY', async () => {
    const f = fakePollerDeps();
    let n = 0;
    const s = chatStub((call) => {
      if (call.url.searchParams.get('mode') === 'HISTORY') return page([msg('11', 'Earlier hello')]);
      return ++n === 1 ? page([msg('11', 'Earlier hello')]) : fail(403, 'FORBIDDEN');
    });
    renderApp(s.fetch, `/inbox/${CONV}`, { pollerDeps: f.deps });
    expect(await screen.findByLabelText('Message')).toBeTruthy();
    await act(async () => { await f.advance(2000); });
    expect(await screen.findByText(/Your earlier messages remain read-only/)).toBeTruthy();
    expect(screen.queryByLabelText('Message')).toBeNull();
    expect(screen.getByText('Earlier hello')).toBeTruthy();
    const modes = s.callsTo('readMessages').map((c) => c.url.searchParams.get('mode'));
    expect(modes).toEqual(['LIVE', 'LIVE', 'HISTORY']);
    await act(async () => { await f.advance(30000); });
    expect(s.callsTo('readMessages')).toHaveLength(3);
    expect(f.pending()).toEqual([]);
  });

  it('read-only conversations never poll LIVE', async () => {
    const f = fakePollerDeps();
    const s = chatStub(() => page([msg('5', 'Archived message')]), { canSend: false, dissolved: true });
    renderApp(s.fetch, `/inbox/${CONV}`, { pollerDeps: f.deps });
    expect(await screen.findByText('Archived message')).toBeTruthy();
    expect(s.callsTo('readMessages').map((c) => c.url.searchParams.get('mode'))).toEqual(['HISTORY']);
  });

  it('retries a send with the same clientMessageId and clears the composer on success', async () => {
    const f = fakePollerDeps();
    let sends = 0;
    const s = chatStub(() => page([]), {}, {
      sendMessage: (call) => {
        if (++sends === 1) throw new TypeError('Failed to fetch');
        return ok({ ...msg('20', (call.body as { body: string }).body, publicProfile(USER_ID, 'Sam Rivera')) }, 201);
      },
    });
    renderApp(s.fetch, `/inbox/${CONV}`, { pollerDeps: f.deps });
    await userEvent.type(await screen.findByLabelText('Message'), 'Shall we meet outside?');
    await userEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect(await screen.findByText('Shall we meet outside?', { selector: 'p' })).toBeTruthy();
    const ids = s.callsTo('sendMessage').map((c) => (c.body as { clientMessageId: string }).clientMessageId);
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe(ids[1]);
    expect((screen.getByLabelText('Message') as HTMLTextAreaElement).value).toBe('');
    expect(s.callsTo('sendMessage')[0]!.body).not.toHaveProperty('sender');
  });

  it('keeps unsent text when sending is refused', async () => {
    const f = fakePollerDeps();
    const s = chatStub((call) => (call.url.searchParams.get('mode') === 'HISTORY' ? page([]) : page([])), {}, {
      sendMessage: () => fail(403, 'FORBIDDEN'),
    });
    renderApp(s.fetch, `/inbox/${CONV}`, { pollerDeps: f.deps });
    await userEvent.type(await screen.findByLabelText('Message'), 'Hello there');
    await userEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/Your text is kept/);
    expect(screen.getByText('Unsent text: Hello there')).toBeTruthy();
  });

  it('leaving the group is confirmed, uses the conversation version and ends LIVE', async () => {
    const f = fakePollerDeps();
    const s = chatStub(() => page([]), {}, { leaveGroup: () => ok(conversation({ canSend: false, version: '4' })) });
    renderApp(s.fetch, `/inbox/${CONV}`, { pollerDeps: f.deps });
    await userEvent.click(await screen.findByRole('button', { name: 'Group settings' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Leave group' }));
    const dialog = await screen.findByRole('dialog', { name: 'Leave this group?' });
    expect(within(dialog).getByText(/Your meal participation does not change/)).toBeTruthy();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Leave group' }));
    await waitFor(() => expect(s.callsTo('leaveGroup')).toHaveLength(1));
    const call = s.callsTo('leaveGroup')[0]!;
    expect(call.body).toEqual({ confirm: true });
    expect(call.headers['if-match']).toBe('"3"');
    expect(await screen.findByText(/Your earlier messages remain read-only/)).toBeTruthy();
  });
});

describe('inbox list (T12)', () => {
  it('shows conversations beyond the first server page', async () => {
    const s = createFetchStub({
      getSession: () => ok(session()),
      inbox: ({url}) => url.searchParams.get('cursor') === 'next-inbox'
        ? page([{conversation: conversation({id:'15151515-1515-4151-8151-151515151515',title:'Older dinner group'}),lastMessage:null,unreadCount:0}])
        : page([{conversation:conversation(),lastMessage:null,unreadCount:0}], 'next-inbox'),
    });
    renderApp(s.fetch, '/inbox');
    expect(await screen.findByText('Older dinner group')).toBeTruthy();
    expect(screen.getByText('Friday dinner & new faces')).toBeTruthy();
    expect(s.callsTo('inbox').map(c=>c.url.searchParams.get('cursor'))).toEqual([null,'next-inbox']);
  });
  it('separates meal groups, personal chats and application progress', async () => {
    const s = createFetchStub({
      getSession: () => ok(session()),
      inbox: () => page([
        { conversation: conversation(), lastMessage: { seq: '12', preview: 'See you soon', createdAt: '2026-10-21T11:00:00.000Z' }, unreadCount: 2 },
        { conversation: conversation({ id: '15151515-1515-4151-8151-151515151515', kind: 'DIRECT', mealId: null, title: 'Emma Hill', canSend: false }), lastMessage: null, unreadCount: 0 },
        { lastMessage: null, unreadCount: 0, application: { id: APPLICATION_ID, mealId: MEAL_ID, version: '1', round: 1, state: 'PENDING', createdAt: '2026-10-20T10:00:00.000Z' } },
      ]),
    });
    renderApp(s.fetch, '/inbox');
    expect(await screen.findByText('See you soon')).toBeTruthy();
    expect(screen.getByLabelText('2 unread')).toBeTruthy();
    expect(screen.getByText('Archived · Read-only')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Your table is taking shape.' })).toBeTruthy();
    await userEvent.click(screen.getByRole('tab', { name: 'Applications' }));
    expect(screen.getByText('Waiting for host approval')).toBeTruthy();
  });
});
