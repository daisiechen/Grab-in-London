import { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ArrowRightIcon, BellIcon, ChatBubbleIcon, CheckIcon, ClockIcon, HeartIcon, LockClosedIcon, PersonIcon } from '@radix-ui/react-icons';
import { useSession } from '../../api/session.tsx';
import { useQuery } from '../../api/useQuery.ts';
import { errorMessage } from '../../api/errors.ts';
import type { InboxItem } from '../../api/conversations.ts';
import { readInbox } from '../../api/conversations.ts';
import { signInPath } from '../../lib/returnTo.ts';
import { clearInboxFocus, peekInboxFocus } from '../../lib/inboxFocus.ts';
import { zonedLabel } from '../../lib/format.ts';
import { Avatar, Notice, PageHeader, Pill, Primary, PrimaryLink, StateBlock } from '../../ui/components.tsx';
import { useDocumentMeta } from '../../seo/useDocumentMeta.ts';
import { applicationLabels } from '../meals/present.ts';

type Tab = 'chats' | 'applications';
type AppState = NonNullable<InboxItem['application']>['state'];
interface InboxData { items: InboxItem[] }

const STATUS: Record<AppState, { tag: string; body: (host: string) => string }> = {
  PENDING: { tag: 'Waiting for host approval', body: (host) => `${host} will review your introduction. A pending request doesn’t hold a seat, and you haven’t joined the group yet.` },
  CONFIRMED: { tag: 'Seat confirmed', body: () => 'Your seat is confirmed. This group chat isn’t available to you any more.' },
  DECLINED: { tag: 'Application declined', body: () => 'The host couldn’t offer you a seat this time. Find another table that fits your evening.' },
  WITHDRAWN: { tag: 'Application withdrawn', body: () => 'You withdrew this request.' },
  EXPIRED: { tag: 'Application expired', body: () => 'Applications for this meal have closed.' },
  CANCELLED: { tag: 'Participation cancelled', body: () => 'You’re no longer attending this meal.' },
};

function ChatRow({ item }: { item: InboxItem }) {
  const c = item.conversation!;
  const archived = c.dissolved || !c.canSend;
  const unread = item.unreadCount > 0;
  return (
    <Link className={`irow${unread ? ' unread' : ''}`} to={`/chat/${c.id}`} aria-label={`${c.title}${unread ? `, ${item.unreadCount} unread` : ''}`}>
      <span style={{ position: 'relative', display: 'inline-flex' }}>
        {c.avatar ? <Avatar name={c.avatar.displayName} url={c.avatar.avatarUrl} size={46} /> : (
          <span className="av" style={{ width: 46, height: 46, background: 'var(--surface)' }}>{c.kind === 'DIRECT' ? <HeartIcon /> : <ChatBubbleIcon />}</span>
        )}
        {c.avatar && c.kind === 'GROUP' && <span className="group-mark" aria-hidden="true"><ChatBubbleIcon width={10} height={10} /></span>}
      </span>
      <span className="mid">
        <b>{c.title}</b>
        <span>{item.lastMessage ? item.lastMessage.preview : 'No messages yet'}</span>
        <span className="muted">{archived ? 'Archived · Read-only' : c.kind === 'GROUP' ? 'Meal group' : 'You both want to meet again'}</span>
      </span>
      {unread ? <span className="count-badge" aria-label={`${item.unreadCount} unread`}>{item.unreadCount > 99 ? '99+' : item.unreadCount}</span> : <ArrowRightIcon aria-hidden="true" />}
    </Link>
  );
}

function ApplicationCard({ item }: { item: InboxItem }) {
  const a = item.application!;
  const m = item.applicationMeal;
  const host = m?.hostDisplayName ?? 'Your host';
  const approved = a.state === 'CONFIRMED';
  const status = STATUS[a.state];
  return (
    <article className="summary" aria-label={m ? `${m.title}, ${applicationLabels[a.state]}` : applicationLabels[a.state]} style={{ gap: 8 }}>
      {m && (
        <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Avatar name={host} size={40} />
          <span style={{ minWidth: 0 }}>
            <strong style={{ display: 'block' }}>{m.title}</strong>
            <span className="muted" style={{ display: 'block' }}>{zonedLabel(m.startsAt)}</span>
            <span className="muted" style={{ display: 'block' }}>{`Hosted by ${host}`}</span>
          </span>
        </span>
      )}
      <span className="mini-track" role="img" aria-label={approved ? 'Applied; host approved; group chat' : 'Applied; awaiting host approval; then group chat'}>
        <span className="on"><CheckIcon aria-hidden="true" />Applied</span>
        <span className={approved ? 'on' : ''}>{approved ? <CheckIcon aria-hidden="true" /> : <PersonIcon aria-hidden="true" />}Host approval</span>
        <span><LockClosedIcon aria-hidden="true" />Group chat</span>
      </span>
      <span><Pill tone={approved ? 'good' : ''}>{status.tag}</Pill></span>
      <span className="body" style={{ margin: 0 }}>{status.body(host)}</span>
      <Link className="link" to={`/meals/${a.mealId}/status`}>View application</Link>
    </article>
  );
}

/**
 * Inbox (iOS InboxScreen, T12): meal groups and personal conversations, plus application next
 * steps. Only the server's authorised lastMessage preview is shown. After applying, the Inbox lands
 * on that meal (its chat once seated, else the Applications tab).
 */
export function InboxPage() {
  const { state } = useSession();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'applications' ? 'applications' : 'chats';
  const setTab = (t: Tab) => setParams(t === 'chats' ? {} : { tab: t }, { replace: true });
  const signedIn = state.status === 'signed-in';
  useDocumentMeta({ title: 'Inbox · Fancy', robots: 'noindex, nofollow' });
  const q = useQuery<InboxData>(signedIn ? 'inbox' : null, async (c) => ({ items: await readInbox(c) }));
  const notices = useQuery<boolean>(signedIn ? 'notifications:unread' : null, async (c) => (await c.call('listNotifications', { query: { limit: 30 } })).data.some((n) => !n.readAt));

  useEffect(() => {
    const mealId = peekInboxFocus();
    if (!mealId || !q.data) return;
    const chat = q.data.items.find((i) => i.conversation?.mealId === mealId && i.conversation.kind === 'GROUP');
    if (chat?.conversation) { clearInboxFocus(); navigate(`/chat/${chat.conversation.id}`); return; }
    if (q.data.items.some((i) => i.application?.mealId === mealId && !i.conversation)) { clearInboxFocus(); setParams({ tab: 'applications' }, { replace: true }); }
  }, [q.data, navigate, setParams]);

  const items = q.data?.items ?? [];
  const chats = items.filter((i) => i.conversation);
  const groups = chats.filter((i) => i.conversation?.kind === 'GROUP');
  const direct = chats.filter((i) => i.conversation?.kind === 'DIRECT');
  const applications = items.filter((i) => i.application && !i.conversation);
  const waiting = applications.filter((i) => i.application?.state === 'PENDING');
  const bell = signedIn ? (
    <Link className="disc" to="/notifications" aria-label={notices.data ? 'Notifications, new updates' : 'Notifications'}>
      <BellIcon width={17} height={17} aria-hidden="true" />{notices.data && <span className="badge-dot" aria-hidden="true" />}
    </Link>
  ) : null;
  const header = <PageHeader size="tab" title={waiting.length ? 'Your table is taking shape.' : 'A little hello.'} subtitle="Before and after the table." right={bell} />;

  if (!signedIn) {
    return (
      <div className="scroll">
        {header}
        {state.status === 'guest' && (
          <StateBlock icon={<ChatBubbleIcon width={30} height={30} aria-hidden="true" />} title="Your next hello starts here." action={<PrimaryLink to={signInPath('/inbox')}>Sign in</PrimaryLink>}>
            Sign in to see your group chats and requests.
          </StateBlock>
        )}
      </div>
    );
  }

  return (
    <div className="scroll">
      {header}
      <div className="segtabs" role="tablist" aria-label="Inbox sections">
        {([['chats', 'Chats', chats.length], ['applications', 'Applications', applications.length]] as const).map(([value, label, count]) => (
          <button key={value} type="button" role="tab" id={`inbox-${value}-tab`} aria-controls={`inbox-${value}-panel`} aria-selected={tab === value} onClick={() => setTab(value)}>
            {label}{q.data && <span className="seg-count" aria-hidden="true">{count}</span>}
          </button>
        ))}
      </div>
      <section role="tabpanel" id={`inbox-${tab}-panel`} aria-labelledby={`inbox-${tab}-tab`}>
        {q.error && !q.data ? (
          <StateBlock title="We couldn’t load your inbox." action={<Primary onClick={() => void q.reload()}>Retry loading inbox</Primary>}>{errorMessage(q.error)}</StateBlock>
        ) : !q.data ? <p className="muted" role="status">Loading inbox…</p> : tab === 'chats' ? (
          chats.length === 0 ? (
            <>
              <StateBlock icon={<ChatBubbleIcon width={30} height={30} aria-hidden="true" />} title="Your next hello starts here." action={<PrimaryLink secondary to="/discover">Find a meal</PrimaryLink>}>
                Apply to a meal to track your request here. Once your host approves your request, your group chat will appear.
              </StateBlock>
              {waiting.length > 0 && <p className="muted" style={{ display: 'flex', gap: 6, justifyContent: 'center' }}><LockClosedIcon aria-hidden="true" /> No open groups yet. Your group chat opens once the host approves your request.</p>}
            </>
          ) : (
            <>
              {groups.length > 0 && <><h2>Your meal groups</h2>{groups.map((i) => <ChatRow key={i.conversation!.id} item={i} />)}</>}
              {direct.length > 0 && <><h2>Personal conversations</h2>{direct.map((i) => <ChatRow key={i.conversation!.id} item={i} />)}</>}
            </>
          )
        ) : applications.length === 0 ? (
          <StateBlock icon={<ClockIcon width={30} height={30} aria-hidden="true" />} title="No pending applications." action={<PrimaryLink secondary to="/discover">Find a meal</PrimaryLink>}>
            Your applications will appear here while you wait for approval.
          </StateBlock>
        ) : (
          <>
            <h2>Applications &amp; next steps</h2>
            <p className="body">You’ve applied. Your group chat opens once the host approves your request.</p>
            {applications.map((i, n) => <ApplicationCard key={i.application?.id ?? n} item={i} />)}
          </>
        )}
      </section>
      {q.data && <Notice icon={<LockClosedIcon width={14} height={14} aria-hidden="true" />}>No unsolicited private messages. Connect after a shared meal, when you both want to.</Notice>}
    </div>
  );
}
