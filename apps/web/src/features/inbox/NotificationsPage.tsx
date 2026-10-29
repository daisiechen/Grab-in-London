import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, Navigate } from 'react-router';
import type { ApiClient, ResponseOf } from '@fancy/client';
import { BellIcon, CalendarIcon, CheckCircledIcon, ClockIcon, CrossCircledIcon, PersonIcon, TrashIcon } from '@radix-ui/react-icons';
import { useApi } from '../../api/ApiProvider.tsx';
import { useSession } from '../../api/session.tsx';
import { useQuery } from '../../api/useQuery.ts';
import { Intent } from '../../api/webApi.ts';
import { errorMessage } from '../../api/errors.ts';
import { signInPath } from '../../lib/returnTo.ts';
import { FormMessage, Loading, Primary, StateBlock, TextAction, TitleBar } from '../../ui/components.tsx';
import { useDocumentMeta } from '../../seo/useDocumentMeta.ts';

type Notification = ResponseOf<'listNotifications'>['data'][number];

/** Same labels and icons as iOS NotificationsScreen. */
const LABELS: Record<string, string> = {
  deletion_received: 'Account deletion requested', deletion_completed: 'Account deletion completed', meal_cancelled: 'Meal cancelled',
  application_submitted: 'New request to join', application_withdrawn: 'Request withdrawn', guest_left: 'Guest left the meal',
  application_expired: 'Request expired', booking_updated: 'Booking updated', application_approved: 'Request approved', application_declined: 'Request declined',
};
const ICONS: Record<string, ReactNode> = {
  meal_cancelled: <CrossCircledIcon />, application_submitted: <PersonIcon />, application_withdrawn: <PersonIcon />, guest_left: <PersonIcon />,
  application_expired: <ClockIcon />, booking_updated: <CalendarIcon />, application_approved: <CheckCircledIcon />, application_declined: <CrossCircledIcon />,
  deletion_received: <TrashIcon />, deletion_completed: <TrashIcon />,
};
const WHEN = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
/** London wall time, e.g. “Wed 21 Oct, 11:00”. */
export const when = (instant: string) => WHEN.format(new Date(instant));

/** All pages, de-duplicated by id; a cursor that doesn't advance is an error, never a loop. */
export async function readNotifications(client: ApiClient): Promise<Notification[]> {
  const items = new Map<string, Notification>();
  const seen = new Set<string>();
  let cursor: string | undefined;
  for (;;) {
    const result = await client.call('listNotifications', { query: cursor ? { cursor } : {} });
    for (const item of result.data) items.set(item.id, item);
    if (!result.page.hasMore) return [...items.values()];
    if (!result.page.nextCursor || seen.has(result.page.nextCursor)) throw new Error('Pagination did not advance');
    seen.add(result.page.nextCursor);
    cursor = result.page.nextCursor;
  }
}

/** Notifications (iOS NotificationsScreen): requests, approvals and meal changes; messages stay in chats. */
export function NotificationsPage() {
  const { state } = useSession();
  const { api, cache } = useApi();
  const userId = state.status === 'signed-in' ? state.session.user.id : null;
  useDocumentMeta({ title: 'Notifications · Fancy', robots: 'noindex, nofollow' });
  const query = useQuery(userId ? `notifications:${userId}` : null, readNotifications);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const active = useRef(false), inFlight = useRef(false);
  const intents = useMemo(() => new Map<string, Intent>(), [api, userId]);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, [userId]);
  if (state.status === 'loading') return <Loading />;
  if (state.status === 'guest') return <Navigate to={signInPath('/notifications')} replace />;

  const markRead = async (item: Notification) => {
    if (inFlight.current || item.readAt) return;
    inFlight.current = true; setBusy(item.id); setError('');
    let intent = intents.get(item.id);
    if (!intent) { intent = new Intent(api.retry); intents.set(item.id, intent); }
    try {
      const result = await intent.run({ notificationId: item.id }, (key) => api.client.call('markRead', { params: { notificationId: item.id }, idempotencyKey: key }));
      cache.delete('notifications:unread');
      if (active.current && query.data) query.setData(query.data.map((row) => (row.id === item.id ? result.data : row)));
    } catch (e) { if (active.current) setError(`Couldn’t mark this notification as read. ${errorMessage(e)}`); }
    finally { inFlight.current = false; if (active.current) setBusy(null); }
  };
  const target = (n: Notification) => (n.conversationId ? `/chat/${n.conversationId}` : n.mealId ? `/meals/${n.mealId}` : null);

  return (
    <div className="scroll">
      <TitleBar title="Notifications" subtitle="Updates about your requests and tables." back="/inbox" />
      {query.error ? <><FormMessage message={errorMessage(query.error)} /><Primary secondary disabled={query.loading} onClick={() => void query.reload()}>Retry loading notifications</Primary></> : null}
      {!query.data && !query.error && <p className="muted" role="status">Loading notifications…</p>}
      {query.data?.length === 0 && <StateBlock icon={<BellIcon width={30} height={30} aria-hidden="true" />} title="No notifications yet.">Requests, approvals and changes to your meals will show up here. Messages stay in your chats.</StateBlock>}
      <FormMessage message={error} />
      <ul className="nlist">
        {query.data?.map((n) => {
          const unread = !n.readAt;
          const label = LABELS[n.template] ?? 'You have an update.';
          const to = target(n);
          const inner = (
            <>
              <span className={`ci${unread ? ' on' : ''}`} aria-hidden="true">{ICONS[n.template] ?? <BellIcon />}</span>
              <span className="mid"><b className={unread ? 'strong' : ''}>{label}</b><time dateTime={n.createdAt}>{when(n.createdAt)}</time></span>
              {unread && <span className="dot-unread" aria-hidden="true" />}
            </>
          );
          return (
            <li key={n.id} className="nrow">
              {to ? <Link className="nmain" to={to} aria-label={`${label}, ${when(n.createdAt)}${unread ? ', unread' : ''}`} onClick={() => { if (unread) void markRead(n); }}>{inner}</Link>
                : <div className="nmain" aria-label={`${label}, ${when(n.createdAt)}${unread ? ', unread' : ''}`} role="group">{inner}</div>}
              {unread && <TextAction className="inline nmark" disabled={busy !== null} onClick={() => void markRead(n)}>{busy === n.id ? 'Saving…' : 'Mark as read'}</TextAction>}
            </li>
          );
        })}
      </ul>
      <p className="muted" style={{ marginTop: 12 }}>Important updates are also sent to your email. Messages stay in your chats.</p>
    </div>
  );
}
