import { fireEvent, screen } from '@testing-library/react-native';
import { InboxScreen } from './InboxScreen.tsx';
import { createTestApp, renderApp, signIn } from '../../test/render.tsx';
import { mockRouter, resetRouter } from '../../test/router.ts';
import { page } from '../../test/mock-fetch.ts';
import { CONVERSATION_ID, MEAL_ID, application, me } from '../../test/fixtures.ts';
import { clearReturnTo, peekReturnTo } from '../auth/intent.ts';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot use ESM imports
jest.mock('expo-router', () => require('../../test/router.ts').expoRouterMock);

const DIRECT_ID = '00000000-0000-4000-8000-0000000000d1';
const conversation = (o: object = {}) => ({ id: CONVERSATION_ID, version: '1', kind: 'GROUP' as const, mealId: MEAL_ID, title: 'Sunday dinner', canSend: true, dissolved: false, head: '3', ...o });
const applicationMeal = { title: 'Pending dinner table', startsAt: { instant: '2026-10-23T17:00:00Z', localDate: '2026-10-23', localTime: '18:00', timeZone: 'Europe/London' as const, utcOffsetMinutes: 60 }, hostDisplayName: 'Maya Chen' };

beforeEach(() => { resetRouter(); clearReturnTo(); });

describe('InboxScreen (demo inbox)', () => {
  it('chat rows show the host (group) or the other member (direct) as an avatar, falling back to an icon', async () => {
    const app = createTestApp();
    await signIn(app, me());
    app.mock.on('GET', '/v1/inbox', page([
      { conversation: conversation({ avatar: { displayName: 'Maya', avatarUrl: null } }), lastMessage: null, unreadCount: 0 },
      { conversation: conversation({ id: '99999999-9999-4999-8999-999999999999', kind: 'DIRECT', mealId: null, title: 'Deleted member', avatar: null }), lastMessage: null, unreadCount: 0 },
    ]));
    await renderApp(app, <InboxScreen />);
    expect(await screen.findByText('M')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Deleted member' })).toBeOnTheScreen();
  });

  it('signed out: demo heading and sign-in that returns to Inbox', async () => {
    const app = createTestApp();
    await renderApp(app, <InboxScreen />);
    expect(screen.getByRole('header', { name: 'A little hello.' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(peekReturnTo()).toBe('/inbox');
  });

  it('empty chats and applications use the demo empty states; Notifications stays reachable', async () => {
    const app = createTestApp();
    await signIn(app, me());
    app.mock.on('GET', '/v1/inbox', page([]));
    await renderApp(app, <InboxScreen />);
    expect(await screen.findByText('Your next hello starts here.')).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Chats · 0' })).toBeSelected();
    expect(screen.getByText('No unsolicited private messages. Connect after a shared meal, when you both want to.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Find a meal' }));
    expect(mockRouter.navigate).toHaveBeenCalledWith('/');
    await fireEvent.press(screen.getByRole('tab', { name: 'Applications · 0' }));
    expect(screen.getByText('No pending applications.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Notifications' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/notifications');
  });

  it('groups meal chats and personal conversations with unread, archived and preview states', async () => {
    const app = createTestApp();
    await signIn(app, me());
    app.mock.on('GET', '/v1/inbox', page([
      { conversation: conversation(), lastMessage: { seq: '3', preview: 'See you at 7', createdAt: '2026-10-21T09:00:00Z' }, unreadCount: 3 },
      { conversation: conversation({ id: '00000000-0000-4000-8000-0000000000a2', title: 'A little supper club', canSend: false, dissolved: true }), lastMessage: null, unreadCount: 0 },
      { conversation: conversation({ id: DIRECT_ID, kind: 'DIRECT', mealId: null, title: 'Emma' }), lastMessage: { seq: '1', preview: 'Lovely meeting you!', createdAt: '2026-10-21T09:00:00Z' }, unreadCount: 0 },
    ]));
    await renderApp(app, <InboxScreen />);
    expect(await screen.findByRole('header', { name: 'Your meal groups' })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Personal conversations' })).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Chats · 3' })).toBeOnTheScreen();
    expect(screen.getByText('See you at 7')).toBeOnTheScreen();
    expect(screen.getAllByText('3')).toHaveLength(2); // Chats tab count and the unread badge
    expect(screen.getByText('No messages yet')).toBeOnTheScreen();
    expect(screen.getByText('Archived · Read-only')).toBeOnTheScreen();
    expect(screen.getByText('You both want to meet again')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Sunday dinner, 3 unread' }));
    expect(mockRouter.push).toHaveBeenCalledWith(`/chat/${CONVERSATION_ID}`);
    await fireEvent.press(screen.getByRole('button', { name: 'Emma' }));
    expect(mockRouter.push).toHaveBeenCalledWith(`/chat/${DIRECT_ID}`);
  });

  it('pending application: heading changes, chats show the locked hint, card shows the three-step track', async () => {
    const app = createTestApp();
    await signIn(app, me());
    app.mock.on('GET', '/v1/inbox', page([
      { lastMessage: null, unreadCount: 0, application: application(), applicationMeal },
      { lastMessage: null, unreadCount: 0, application: application({ id: '00000000-0000-4000-8000-0000000000b2', state: 'DECLINED' }), applicationMeal: { ...applicationMeal, title: 'Declined table' } },
    ]));
    await renderApp(app, <InboxScreen />);
    expect(await screen.findByRole('header', { name: 'Your table is taking shape.' })).toBeOnTheScreen();
    expect(screen.getByText('No open groups yet. Your group chat opens once the host approves your request.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('tab', { name: 'Applications · 2' }));
    expect(screen.getByText('You’ve applied. Your group chat opens once the host approves your request.')).toBeOnTheScreen();
    expect(screen.getAllByText('Applied')).toHaveLength(2);
    expect(screen.getAllByText('Host approval')).toHaveLength(2);
    expect(screen.getAllByText('Group chat')).toHaveLength(2);
    expect(screen.getByText('Waiting for host approval')).toBeOnTheScreen();
    expect(screen.getByText('Application declined')).toBeOnTheScreen();
    expect(screen.queryByText(/payment|Pay £|deposit|refund/i)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: /^Pending dinner table, .*Application pending$/ }));
    expect(mockRouter.push).toHaveBeenCalledWith(`/meals/${MEAL_ID}`);
  });
});
