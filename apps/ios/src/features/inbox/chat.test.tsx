import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { ChatScreen, mergeMessages } from './ChatScreen.tsx';
import { InboxScreen, conversationKey } from './InboxScreen.tsx';
import { createTestApp, renderApp, signIn } from '../../test/render.tsx';
import { mockRouter, resetRouter, routeParams } from '../../test/router.ts';
import { fail, ok, page } from '../../test/mock-fetch.ts';
import { CONVERSATION_ID, MEAL_ID, USER_ID, application, meal, me, publicProfile } from '../../test/fixtures.ts';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot use ESM imports
jest.mock('expo-router', () => require('../../test/router.ts').expoRouterMock);

const MSG_PATH = `/v1/conversations/${CONVERSATION_ID}/messages`;
const conversation = (o: object = {}) => ({ id: CONVERSATION_ID, version: '4', kind: 'GROUP' as const, mealId: MEAL_ID, title: 'Sunday dinner', canSend: true, dissolved: false, head: '12', ...o });
const message = (seq: string, body = `hello ${seq}`) => ({ id: `00000000-0000-4000-8000-0000000000${seq.padStart(2, '0')}`, seq, sender: publicProfile(), body, createdAt: '2026-10-21T10:00:00Z', redacted: false });

let appStateListener: ((s: AppStateStatus) => void) | null = null;
beforeEach(() => {
  Object.defineProperty(AppState,'currentState',{value:'active',writable:true,configurable:true});
  resetRouter();
  routeParams.current = { conversationId: CONVERSATION_ID };
  appStateListener = null;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    appStateListener = listener as (s: AppStateStatus) => void;
    return { remove: () => { appStateListener = null; } } as ReturnType<typeof AppState.addEventListener>;
  });
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('InboxScreen', () => {
  it('separates chats from pending applications and keeps pending requests visible', async () => {
    const app = createTestApp();
    await signIn(app, me());
    app.mock.on('GET', '/v1/inbox', page([
      { conversation: conversation(), lastMessage: { seq: '12', preview: 'See you there', createdAt: '2026-10-21T10:00:00Z' }, unreadCount: 2 },
      { lastMessage: null, unreadCount: 0, application: application(),applicationMeal:{title:'Pending dinner table',startsAt:{instant:'2026-10-23T17:00:00Z',localDate:'2026-10-23',localTime:'18:00',timeZone:'Europe/London',utcOffsetMinutes:60},hostDisplayName:'Maya Chen'} },
    ]));
    await renderApp(app, <InboxScreen />);
    expect(await screen.findByRole('button', { name: 'Sunday dinner, 2 unread' })).toBeOnTheScreen();
    expect(screen.getByText('Seat confirmed · Meal group')).toBeOnTheScreen();
    expect(screen.getByText('2')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('tab', { name: 'Applications · 1' }));
    expect(screen.getByRole('tab', { name: 'Applications · 1' })).toBeSelected();
    expect(screen.getByText('Pending dinner table')).toBeOnTheScreen();
    expect(screen.getByText(/18:00 BST.*London/)).toBeOnTheScreen();
    expect(screen.getByText('Waiting for host approval')).toBeOnTheScreen();
    expect(screen.getByText(/^Maya Chen will review your introduction\. A pending request doesn’t hold a seat/)).toBeOnTheScreen();
    expect(screen.getByLabelText('Applied; awaiting host approval; then group chat')).toBeOnTheScreen();
    expect(screen.queryByText(/payment|Pay £|deposit/i)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: /Pending dinner table,.*hosted by Maya Chen, Application pending/ }));
    expect(mockRouter.push).toHaveBeenCalledWith(`/meals/${MEAL_ID}`);
    expect(app.services.cache.get(conversationKey(CONVERSATION_ID))).toMatchObject({ title: 'Sunday dinner' });
  });
});

describe('ChatScreen (S14)', () => {
  it('drops messages and compose drafts across logout and another account sign-in', async () => {
    jest.useFakeTimers();
    const app = createTestApp();
    await signIn(app, me());
    app.services.cache.set(conversationKey(CONVERSATION_ID), conversation());
    app.mock.on('GET', MSG_PATH, page([message('11', 'Private old account message')]), 1);
    app.mock.on('GET', MSG_PATH, page([]));
    app.mock.on('GET', '/v1/inbox', page([{ conversation: conversation(), lastMessage: null, unreadCount: 0 }]));
    await renderApp(app, <ChatScreen />);
    await screen.findByText('Private old account message');
    await fireEvent.changeText(screen.getByLabelText('Message'), 'Old private draft');
    await act(async () => { await app.services.session.expire(); });
    expect(screen.queryByText('Private old account message')).toBeNull();
    await act(async () => { await signIn(app, me({ id: '00000000-0000-4000-8000-000000000099' })); });
    await screen.findByLabelText('Message');
    expect(screen.queryByText('Private old account message')).toBeNull();
    expect(screen.getByLabelText('Message')).toHaveDisplayValue('');
  });

  it('polls LIVE in the foreground, pauses in the background and catches up on resume', async () => {
    jest.useFakeTimers();
    const app = createTestApp();
    await signIn(app, me());
    app.services.cache.set(conversationKey(CONVERSATION_ID), conversation());
    const replies = [page([message('11'), message('12')]), page([message('13')]), page([message('14')])];
    app.mock.on('GET', MSG_PATH, () => replies.shift() ?? page([]));
    await renderApp(app, <ChatScreen />);
    expect(await screen.findByText('hello 12')).toBeOnTheScreen();
    expect(app.mock.callsTo('GET', MSG_PATH)[0]?.query.get('mode')).toBe('LIVE');

    await act(async () => { jest.advanceTimersByTime(2000); });
    expect(await screen.findByText('hello 13')).toBeOnTheScreen();
    expect(app.mock.callsTo('GET', MSG_PATH)[1]?.query.get('afterSeq')).toBe('12');

    await act(async () => { appStateListener?.('background'); });
    const before = app.mock.callsTo('GET', MSG_PATH).length;
    await act(async () => { jest.advanceTimersByTime(10_000); });
    expect(app.mock.callsTo('GET', MSG_PATH)).toHaveLength(before);

    await act(async () => { appStateListener?.('active'); });
    expect(await screen.findByText('hello 14')).toBeOnTheScreen();
    expect(app.mock.callsTo('GET', MSG_PATH)[before]?.query.get('afterSeq')).toBe('13');
  });

  it('a failed send stays visible with Retry (same clientMessageId); there is no automatic resend', async () => {
    const app = createTestApp();
    await signIn(app, me());
    app.services.cache.set(conversationKey(CONVERSATION_ID), conversation());
    app.mock.on('GET', MSG_PATH, page([]));
    app.mock.on('POST', MSG_PATH, () => { throw new TypeError('Network request failed'); }, 1);
    app.mock.on('POST', MSG_PATH, (c) => ok({ ...message('20', (c.body as { body: string }).body) }, 201));
    await renderApp(app, <ChatScreen />);
    await fireEvent.changeText(await screen.findByLabelText('Message'), '  See you at 7!  ');
    await fireEvent.press(screen.getByRole('button', { name: 'Send message' }));
    expect(await screen.findByText('Not sent')).toBeOnTheScreen();
    expect(app.mock.callsTo('POST', MSG_PATH)).toHaveLength(1);
    await new Promise((r) => setTimeout(r, 50));
    expect(app.mock.callsTo('POST', MSG_PATH)).toHaveLength(1);

    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.queryByText('Not sent')).toBeNull());
    const posts = app.mock.callsTo('POST', MSG_PATH);
    expect(posts).toHaveLength(2);
    expect((posts[0]?.body as { clientMessageId: string }).clientMessageId).toBe((posts[1]?.body as { clientMessageId: string }).clientMessageId);
    expect(posts[0]?.body).toMatchObject({ body: 'See you at 7!' });
    expect(screen.getByText('See you at 7!')).toBeOnTheScreen();
  });

  it('403 while polling switches to read-only history and stops polling', async () => {
    jest.useFakeTimers();
    const app = createTestApp();
    await signIn(app, me());
    app.services.cache.set(conversationKey(CONVERSATION_ID), conversation());
    app.mock.on('GET', MSG_PATH, page([message('11')]), 1);
    app.mock.on('GET', MSG_PATH, fail(403, 'FORBIDDEN'));
    await renderApp(app, <ChatScreen />);
    expect(await screen.findByText('hello 11')).toBeOnTheScreen();
    await act(async () => { jest.advanceTimersByTime(2000); });
    expect(await screen.findByText(/You can no longer send messages here/)).toBeOnTheScreen();
    expect(screen.queryByLabelText('Message')).toBeNull();
    expect(screen.getByText('hello 11')).toBeOnTheScreen();
    const count = app.mock.callsTo('GET', MSG_PATH).length;
    await act(async () => { jest.advanceTimersByTime(60_000); });
    expect(app.mock.callsTo('GET', MSG_PATH)).toHaveLength(count);
  });

  it('a dissolved group loads HISTORY once and never polls', async () => {
    jest.useFakeTimers();
    const app = createTestApp();
    await signIn(app, me());
    app.services.cache.set(conversationKey(CONVERSATION_ID), conversation({ canSend: false, dissolved: true }));
    app.mock.on('GET', MSG_PATH, page([message('3')]));
    await renderApp(app, <ChatScreen />);
    expect(await screen.findByText('hello 3')).toBeOnTheScreen();
    expect(screen.getByText('History is read-only.')).toBeOnTheScreen();
    await act(async () => { jest.advanceTimersByTime(30_000); });
    expect(app.mock.callsTo('GET', MSG_PATH).map((c) => c.query.get('mode'))).toEqual(['HISTORY']);
  });

  it('leaving the group needs confirmation and sends If-Match', async () => {
    const app = createTestApp();
    await signIn(app, me());
    app.services.cache.set(conversationKey(CONVERSATION_ID), conversation());
    app.mock.on('GET', MSG_PATH, page([]));
    app.mock.on('POST', `/v1/conversations/${CONVERSATION_ID}/leave`, ok(conversation({ canSend: false, version: '5' })));
    await renderApp(app, <ChatScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Open group settings' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Leave group' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Stay in group' }));
    expect(app.mock.callsTo('POST', /leave/)).toHaveLength(0);
    await fireEvent.press(screen.getAllByRole('button', { name: 'Leave group' })[0]!);
    const buttons = screen.getAllByRole('button', { name: 'Leave group' });
    await fireEvent.press(buttons[buttons.length - 1]!);
    await waitFor(() => expect(app.mock.callsTo('POST', /leave/)).toHaveLength(1));
    expect(app.mock.callsTo('POST', /leave/)[0]).toMatchObject({ body: { confirm: true }, headers: { 'if-match': '"4"' } });
    expect(await screen.findByText(/You left the group/)).toBeOnTheScreen();
    // Back on the chat view: the composer is replaced by the read-only bar.
    expect(screen.getByText('History is read-only.')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Message')).toBeNull();
  });

  it('renders message bodies as plain text', () => {
    const merged = mergeMessages([message('2')], [message('1', '<b>hi</b>'), message('2')]);
    expect(merged.map((m) => m.seq)).toEqual(['1', '2']);
    expect(merged[0]?.body).toBe('<b>hi</b>');
  });
});

it('acknowledges only rendered foreground progress and stops acknowledgements in background',async()=>{
 const app=createTestApp();await signIn(app,me());app.services.cache.set(conversationKey(CONVERSATION_ID),conversation());
 app.mock.on('GET',MSG_PATH,page([message('11')]));
 app.mock.on('POST',`/v1/conversations/${CONVERSATION_ID}/read`,ok({throughSeq:'11'}));
 await renderApp(app,<ChatScreen/>);await screen.findByText('hello 11');
 expect(app.mock.calls.filter(c=>c.method==='POST')).toHaveLength(1); // authentication handoff only
 await fireEvent(screen.getByTestId('chat-messages'),'viewableItemsChanged',{viewableItems:[{isViewable:true,item:message('11')}]});
 await waitFor(()=>expect(app.mock.calls.filter(c=>c.path.endsWith('/read'))).toHaveLength(1));
 await act(async()=>{appStateListener?.('background');});
 await fireEvent(screen.getByTestId('chat-messages'),'viewableItemsChanged',{viewableItems:[{isViewable:true,item:message('12')}]});
 expect(app.mock.calls.filter(c=>c.path.endsWith('/read'))).toHaveLength(1);
});

describe('ChatScreen demo layout', () => {
  it('shows own vs others bubbles with sender, London time and day separators, plus the pinned meal context', async () => {
    const app = createTestApp();
    await signIn(app, me());
    app.services.cache.set(conversationKey(CONVERSATION_ID), conversation());
    app.mock.on('GET', `/v1/meals/${MEAL_ID}`, ok({ meal: meal({ bookingDeclaration: { id: '11111111-1111-4111-8111-111111111111', revision: '1', status: 'REPORTED_CONFIRMED', declaredCount: 4, reportedAt: '2026-10-20T10:00:00Z', stale: false } }), myApplication: null, conversationId: CONVERSATION_ID }));
    app.mock.on('GET', MSG_PATH, page([
      { ...message('1', 'Shall we meet outside?'), createdAt: '2026-10-20T18:05:00Z' },
      { ...message('2', 'Sounds lovely'), sender: publicProfile(USER_ID, 'Alex'), createdAt: '2026-10-21T09:30:00Z' },
    ]));
    await renderApp(app, <ChatScreen />);
    expect(await screen.findByText('Shall we meet outside?')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Sunday dinner' })).toBeOnTheScreen();
    expect(screen.getByText('Maya')).toBeOnTheScreen();
    expect(screen.getByLabelText('Maya: Shall we meet outside?, 19:05')).toBeOnTheScreen();
    expect(screen.getByLabelText('You: Sounds lovely, 10:30')).toBeOnTheScreen();
    // Own messages show your avatar too (initial when there is no photo).
    expect(within(screen.getByLabelText('You: Sounds lovely, 10:30')).getByText('A', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByText('Alex')).toBeNull();
    expect(screen.getByText('TUE 20 OCT')).toBeOnTheScreen();
    expect(screen.getByText('TODAY')).toBeOnTheScreen();
    expect(await screen.findByText('Sun 25 Oct · 19:00')).toBeOnTheScreen();
    expect(screen.getByText('Dishoom · Restaurant booked · Pay at the restaurant')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: /^View meal: Sun 25 Oct at 19:00/ }));
    expect(mockRouter.push).toHaveBeenCalledWith(`/meals/${MEAL_ID}`);
    await fireEvent.press(screen.getByRole('button', { name: 'View Maya’s profile' }));
    expect(mockRouter.push).toHaveBeenCalledWith(`/profiles/${publicProfile().id}`);
  });

  it('group settings lists the table, opens the meal and returns to the chat without leaving', async () => {
    const app = createTestApp();
    await signIn(app, me());
    app.services.cache.set(conversationKey(CONVERSATION_ID), conversation());
    app.mock.on('GET', `/v1/meals/${MEAL_ID}`, ok({ meal: meal({ members: [publicProfile(), publicProfile(USER_ID, 'Alex')] }), myApplication: null, conversationId: CONVERSATION_ID }));
    app.mock.on('GET', MSG_PATH, page([]));
    await renderApp(app, <ChatScreen />);
    await fireEvent.changeText(await screen.findByLabelText('Message'), 'Draft kept');
    await waitFor(() => expect(app.mock.callsTo('GET', `/v1/meals/${MEAL_ID}`)).toHaveLength(1));
    await fireEvent.press(screen.getByRole('button', { name: 'Open group settings' }));
    expect(screen.getByRole('header', { name: 'Group settings' })).toBeOnTheScreen();
    expect(await screen.findByText('Host')).toBeOnTheScreen();
    expect(screen.getByText('Guest · You')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Your membership' })).toBeOnTheScreen();
    expect(screen.getByText('Group membership is separate from your meal participation.')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Message')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'View meal' }));
    expect(mockRouter.push).toHaveBeenCalledWith(`/meals/${MEAL_ID}`);
    await fireEvent.press(screen.getByRole('button', { name: 'Back to chat' }));
    expect(screen.getByLabelText('Message')).toHaveDisplayValue('Draft kept');
    expect(app.mock.callsTo('POST', /leave/)).toHaveLength(0);
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('read-only history shows the lock bar and an archive separator', async () => {
    const app = createTestApp();
    await signIn(app, me());
    app.services.cache.set(conversationKey(CONVERSATION_ID), conversation({ canSend: false }));
    app.mock.on('GET', MSG_PATH, page([{ ...message('3'), createdAt: '2026-10-15T20:00:00Z' }]));
    await renderApp(app, <ChatScreen />);
    expect(await screen.findByText('hello 3')).toBeOnTheScreen();
    expect(screen.getByText('ARCHIVE · THU 15 OCT')).toBeOnTheScreen();
    expect(screen.getByText('History is read-only.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Open group settings' }));
    expect(screen.getByText('This group is read-only. Your earlier messages remain available.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Leave group' })).toBeNull();
  });
});
