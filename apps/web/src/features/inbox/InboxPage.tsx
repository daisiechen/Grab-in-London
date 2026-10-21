import { useState } from 'react';
import { Link } from 'react-router';
import { ArrowRightIcon, BellIcon, ChatBubbleIcon, CheckIcon, LockClosedIcon, PersonIcon } from '@radix-ui/react-icons';
import { useSession } from '../../api/session.tsx';
import { useQuery } from '../../api/useQuery.ts';
import { errorMessage } from '../../api/errors.ts';
import type { InboxItem } from '../../api/conversations.ts';
import { signInPath } from '../../lib/returnTo.ts';
import { FormError, Loading, Primary, PrimaryLink } from '../../ui/components.tsx';
import { applicationLabels } from '../meals/present.ts';

type Tab = 'chats' | 'applications';
interface InboxData { items: InboxItem[]; nextCursor: string | null }

/**
 * Inbox (T12): meal groups and personal conversations, plus application progress. Only the
 * server's authorised lastMessage preview is shown; gaps after leaving are never displayed.
 */
export function InboxPage() {
  const { state } = useSession();
  const [tab, setTab] = useState<Tab>('chats');
  const signedIn = state.status === 'signed-in';
  const q = useQuery<InboxData>(signedIn ? 'inbox' : null, async (c) => {
    const res = await c.call('inbox', {});
    return { items: res.data, nextCursor: res.page.nextCursor };
  });

  if (state.status === 'loading') return <Loading />;
  if (state.status === 'guest') {
    return (
      <div className="body-pad">
        <div className="eyebrow">BEFORE AND AFTER THE TABLE</div>
        <h1>A little hello.</h1>
        <div className="empty">
          <ChatBubbleIcon />
          <h2>Your next hello starts here.</h2>
          <p>Sign in to track your requests and chat with your table.</p>
          <PrimaryLink to={signInPath('/inbox')}>Sign in <ArrowRightIcon /></PrimaryLink>
        </div>
      </div>
    );
  }

  const items = q.data?.items ?? [];
  const groups = items.filter((i) => i.conversation?.kind === 'GROUP');
  const direct = items.filter((i) => i.conversation?.kind === 'DIRECT');
  const waiting = items.filter((i) => !i.conversation && i.application?.state === 'PENDING');
  const otherApplications = items.filter((i) => !i.conversation && i.application && i.application.state !== 'PENDING');

  const row = (item: InboxItem) => {
    const c = item.conversation!;
    const readOnly = !c.canSend || c.dissolved;
    return (
      <Link className="inbox-row" key={c.id} to={`/inbox/${c.id}`}>
        <div>
          <strong>{c.title}</strong>
          <p>{item.lastMessage?.preview ?? 'No messages yet'}</p>
          <small>{readOnly ? 'Archived · Read-only' : c.kind === 'GROUP' ? 'Seat confirmed · Meal group' : 'Personal conversation'}</small>
        </div>
        {item.unreadCount > 0 && <span className="unread" aria-label={`${item.unreadCount} unread`}>{item.unreadCount}</span>}
        <ArrowRightIcon />
      </Link>
    );
  };

  return (
    <div className="body-pad inbox-page">
      <div className="eyebrow">BEFORE AND AFTER THE TABLE</div>
      <h1>{waiting.length ? 'Your table is taking shape.' : 'A little hello.'}</h1>
      <Link className="settings-link" to="/inbox/notifications"><span><BellIcon /> Notifications</span><ArrowRightIcon /></Link>
      <div className="tabs inbox-tabs" role="tablist" aria-label="Inbox sections">
        {(['chats', 'applications'] as const).map((t) => (
          <button type="button" key={t} id={`inbox-${t}-tab`} role="tab" aria-selected={tab === t} aria-controls={`inbox-${t}-panel`} onClick={() => setTab(t)}>
            {t === 'chats' ? 'Chats' : 'Applications'}
          </button>
        ))}
      </div>
      <section role="tabpanel" id={`inbox-${tab}-panel`} aria-labelledby={`inbox-${tab}-tab`}>
        {q.error && !q.data ? <><FormError>{errorMessage(q.error)}</FormError><Primary secondary onClick={() => void q.reload()}>Try again</Primary></> : null}
        {!q.data && !q.error && <Loading />}
        {q.data && tab === 'chats' && (
          <>
            {!!groups.length && <><h2>Your meal groups <span className="pill">{groups.length}</span></h2>{groups.map(row)}</>}
            {!!direct.length && <><h2>Personal conversations</h2>{direct.map(row)}</>}
            {!groups.length && !direct.length && (
              <div className="empty">
                <ChatBubbleIcon />
                <h2>Your next hello starts here.</h2>
                <p>Apply to a meal to track your request here. Once your host approves and your seat is confirmed, your group chat will appear.</p>
                <PrimaryLink secondary to="/discover">Find a meal</PrimaryLink>
              </div>
            )}
            {!!waiting.length && !groups.length && (
              <p className="inbox-locked-hint"><LockClosedIcon /> No open groups yet. Your group chat opens once your seat is confirmed.</p>
            )}
          </>
        )}
        {q.data && tab === 'applications' && (
          <>
            {!waiting.length && !otherApplications.length && (
              <div className="empty">
                <h2>No pending applications.</h2>
                <p>Your applications will appear here while you wait for approval.</p>
                <PrimaryLink secondary to="/discover">Find a meal</PrimaryLink>
              </div>
            )}
            {!!waiting.length && (
              <>
                <h2>Applications & next steps <span className="pill">{waiting.length}</span></h2>
                <p className="muted">You’ve applied. Your group chat opens once your seat is confirmed.</p>
              </>
            )}
            {[...waiting, ...otherApplications].map((item) => {
              const a = item.application!;
              const pending = a.state === 'PENDING';
              return (
                <article className="inbox-progress-card" key={a.id} aria-label={`Application ${applicationLabels[a.state]}`}>
                  <div className="application-track" aria-label={pending ? 'Applied; awaiting host approval; then group chat' : applicationLabels[a.state]}>
                    <span className="done"><CheckIcon />Applied</span>
                    <span className={pending ? '' : 'done'}>{pending ? <PersonIcon /> : <CheckIcon />}Host decision</span>
                    <span><LockClosedIcon />Group chat</span>
                  </div>
                  <strong className="status-tag">{pending ? 'Waiting for host approval' : applicationLabels[a.state]}</strong>
                  <p>{pending ? 'Your host will review your introduction. You haven’t joined the group yet.' : 'This request is closed.'}</p>
                  <Link className="text-action" to={`/meals/${a.mealId}/apply`}>View application</Link>
                </article>
              );
            })}
          </>
        )}
      </section>
      <div className="notice"><LockClosedIcon /><span>No unsolicited private messages. Connect after a shared meal, when you both want to.</span></div>
    </div>
  );
}
