import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router';
import type { ApiClient, ResponseOf } from '@fancy/client';
import { useApi } from '../../api/ApiProvider.tsx';
import { useSession } from '../../api/session.tsx';
import { useQuery } from '../../api/useQuery.ts';
import { Intent } from '../../api/webApi.ts';
import { errorMessage } from '../../api/errors.ts';
import { signInPath } from '../../lib/returnTo.ts';
import { FormError, Loading, PageHeader, Primary } from '../../ui/components.tsx';

type Notification = ResponseOf<'listNotifications'>['data'][number];
const labels: Record<string, string> = {
  meal_cancelled: 'Your meal was cancelled.',
  application_approved: 'Your request was approved.',
  application_declined: 'Your request was declined.',
  application_expired: 'Your request has expired.',
  deletion_received: 'Your deletion request was received.',
  deletion_completed: 'Your deletion request is complete.',
};

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

export function NotificationsPage() {
  const { state } = useSession();
  const { api } = useApi();
  const userId = state.status === 'signed-in' ? state.session.user.id : null;
  const query = useQuery(userId ? `notifications:${userId}` : null, readNotifications);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const active = useRef(false), inFlight = useRef(false);
  const intents = useMemo(() => new Map<string, Intent>(), [api, userId]);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, [userId]);
  if (state.status === 'loading') return <Loading />;
  if (state.status === 'guest') return <Navigate to={signInPath('/inbox/notifications')} replace />;

  const markRead = async (item: Notification) => {
    if (inFlight.current || item.readAt) return;
    inFlight.current = true; setBusy(item.id); setError('');
    let intent = intents.get(item.id);
    if (!intent) { intent = new Intent(api.retry); intents.set(item.id, intent); }
    try {
      const result = await intent.run({ notificationId: item.id }, key => api.client.call('markRead', { params: { notificationId: item.id }, idempotencyKey: key }));
      if (active.current && query.data) query.setData(query.data.map(row => row.id === item.id ? result.data : row));
    } catch (e) { if (active.current) setError(errorMessage(e)); }
    finally { inFlight.current = false; if (active.current) setBusy(null); }
  };
  return <><PageHeader title="Notifications" backTo="/inbox" /><div className="body-pad">
    <h1>Notifications</h1>
    {query.error ? <><FormError>{errorMessage(query.error)}</FormError><Primary secondary disabled={query.loading} onClick={() => void query.reload()}>Try again</Primary></> : null}
    {!query.data && !query.error && <Loading />}
    {query.data?.length === 0 && <p>No notifications yet.</p>}
    <FormError>{error}</FormError>
    {query.data?.map(item => <article className="inbox-progress-card" key={item.id}>
      <h2>{labels[item.template] ?? 'You have an update.'}</h2>
      <p><time dateTime={item.createdAt}>{new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/London' }).format(new Date(item.createdAt)) + ' London time'}</time> · {item.readAt ? 'Read' : 'Unread'}</p>
      {item.mealId && <Link className="text-action" to={`/meals/${item.mealId}`}>View meal</Link>}
      {!item.readAt && <Primary secondary disabled={busy !== null} onClick={() => void markRead(item)}>{busy === item.id ? 'Saving…' : 'Mark as read'}</Primary>}
    </article>)}
  </div></>;
}
