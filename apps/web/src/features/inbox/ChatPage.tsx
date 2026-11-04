import { useRenderedEvent } from '../../api/telemetry.tsx';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiError, newIntentKey, withRetry } from '@fancy/client';
import { ArrowRightIcon, CalendarIcon, ChatBubbleIcon, ChevronRightIcon, DotsHorizontalIcon, ExclamationTriangleIcon, GearIcon, HeartIcon, LockClosedIcon, PaperPlaneIcon } from '@radix-ui/react-icons';
import { useApi } from '../../api/ApiProvider.tsx';
import { useSession } from '../../api/session.tsx';
import { Intent } from '../../api/webApi.ts';
import { errorMessage } from '../../api/errors.ts';
import { findConversation, maxSeq, mergeMessages, type Conversation, type Message } from '../../api/conversations.ts';
import type { MealDetail } from '../../api/types.ts';
import { clearDraft, loadDraft, saveDraft } from '../../lib/drafts.ts';
import { longDate } from '../../lib/format.ts';
import { LivePoller, type TickResult } from '../../lib/poller.ts';
import { usePollerDeps } from '../../lib/pollerContext.tsx';
import { signInPath } from '../../lib/returnTo.ts';
import { Avatar, BackDisc, FormMessage, Loading, Notice, Primary, PrimaryLink, StateBlock, TextAction, TitleBar } from '../../ui/components.tsx';
import { useDocumentMeta } from '../../seo/useDocumentMeta.ts';
import { mealPath } from '../../seo/meal-seo.ts';
import { bookingLabel, mealPeople, venueName } from '../meals/present.ts';
import { messageReportRoute, rememberMessageSubject, reportedMessages } from '../reports/messageReports.ts';
import { ConfirmSheet } from '../../ui/ConfirmSheet.tsx';
import { Sheet } from '../../ui/Sheet.tsx';
import { useToast } from '../../ui/toast.tsx';

type Mode = 'LIVE' | 'HISTORY';
const londonDay = (instant: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date(instant));
const londonTime = (instant: string) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit' }).format(new Date(instant));

/**
 * Group/direct chat (T12). LIVE: incremental 2 s foreground polling with afterSeq; hidden tab
 * pauses; failures back off; resume re-checks the session first. A 403 stops sending and
 * switches to HISTORY (the server's authorised intervals only); 401 is handled globally.
 * Messages live in component state only, never in the shared cache or storage; unsent text
 * is kept as a draft and re-sent with the same clientMessageId only if unchanged.
 */
export function ChatPage() {
  const { conversationId = '' } = useParams();
  return <ConversationPage key={conversationId} conversationId={conversationId} />;
}
function ConversationPage({ conversationId }: { conversationId: string }) {
  const { api, cache } = useApi();
  const { state, refresh } = useSession();
  const notify = useToast();
  const pollerDeps = usePollerDeps();
  const me = state.status === 'signed-in' ? state.session.user : null;

  const [conversation, setConversation] = useState<Conversation | null | undefined>(undefined);
  const [meal, setMeal] = useState<MealDetail['meal'] | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasRead,setHasRead]=useState(false);
  const [readError,setReadError]=useState('');
  const [readingHistory,setReadingHistory]=useState(false);
  const historyReadInFlight=useRef(false);
  const [mode, setMode] = useState<Mode>('LIVE');
  const [olderCursor, setOlderCursor] = useState<string | null>(null);
  const [text, setText] = useState(() => loadDraft<{ text: string }>(`message:${conversationId}`)?.text ?? '');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [sheet, setSheet] = useState<'' | 'settings' | 'leave' | 'dissolve'>('');
  const [sheetError, setSheetError] = useState('');
  const [actionsFor, setActionsFor] = useState<Message | null>(null);
  const navigate = useNavigate();
  useDocumentMeta({ title: 'Chat · Fancy', robots: 'noindex, nofollow' });
  const after = useRef<string | null>(null);
  const loadedFirst = useRef(false);
  const pending = useRef<{ id: string; body: string } | null>(null);
  const poller = useRef<LivePoller | null>(null);
  // Monotonic for this mounted conversation. A different route gets a fresh keyed instance.
  const historyOnly = useRef(false);
  const intent = useRef(new Intent(api.retry));
  const [renderedThrough,setRenderedThrough] = useState<string|null>(null);
  const acknowledged = useRef('0');
  const [visible,setVisible] = useState(document.visibilityState !== 'hidden');
  useRenderedEvent('chat_opened',{conversationId},!!conversation&&conversation.kind==='GROUP'&&hasRead);
  useEffect(()=>{const changed=()=>setVisible(document.visibilityState !== 'hidden');document.addEventListener('visibilitychange',changed);return()=>document.removeEventListener('visibilitychange',changed);},[]);

  const absorb = useCallback((list: readonly Message[], scanned?: string) => {
    setHasRead(true);
    after.current = maxSeq(after.current, scanned, ...list.map((m) => m.seq));
    if (list.length) setMessages((cur) => mergeMessages(cur, list));
    const rendered = maxSeq(scanned,...list.map(message=>message.seq));
    if(rendered)setRenderedThrough(previous=>maxSeq(previous,rendered));
  }, []);

  const readHistory = useCallback(async () => {
    if(historyReadInFlight.current)return;
    historyReadInFlight.current=true;setReadingHistory(true);setReadError('');
    try {
      const res=await api.client.call('readMessages',{params:{conversationId},query:{mode:'HISTORY'}});
      absorb(res.data,res.page.scannedThroughSeq);
      if(!loadedFirst.current){loadedFirst.current=true;setOlderCursor(res.page.nextCursor);}
    }catch(e){setReadError('Couldn’t load messages. '+errorMessage(e));}
    finally{historyReadInFlight.current=false;setReadingHistory(false);}
  },[absorb,api,conversationId]);
  const toHistory = useCallback(async () => {
    if(historyOnly.current)return;
    historyOnly.current=true;poller.current?.stop();setMode('HISTORY');
    await readHistory();
  },[readHistory]);

  // Effects run after this batch is committed to the DOM. No acknowledgement while hidden,
  // and a failed write is never optimistically reflected or automatically retried.
  useEffect(()=>{if(!me||!visible||!renderedThrough||BigInt(renderedThrough)<=BigInt(acknowledged.current))return;acknowledged.current=renderedThrough;void api.client.call('markConversationRead',{params:{conversationId},body:{throughSeq:renderedThrough}}).then(()=>cache.delete('inbox')).catch(()=>{});},[api,cache,conversationId,me,renderedThrough,visible]);

  // Conversation metadata (+ meal for the pinned card / host role).
  useEffect(() => {
    if (!me) return;
    let alive = true;
    void (async () => {
      try {
        const conv = await findConversation(api.client, conversationId);
        if (!alive || historyOnly.current) return;
        setConversation(conv);
        if (conv?.mealId) {
          const res = await api.client.call('getMeal', { params: { mealId: conv.mealId } }).catch(() => null);
          if (alive && !historyOnly.current && res) setMeal(res.data.meal);
        }
      } catch (e) {
        if (alive && !historyOnly.current) { setConversation(null); setError(errorMessage(e)); }
      }
    })();
    return () => { alive = false; };
  }, [api, conversationId, me]);

  // LIVE polling while we may send; otherwise read the HISTORY archive once.
  useEffect(() => {
    if (!conversation || historyOnly.current) return;
    if (!conversation.canSend || conversation.dissolved) {
      void toHistory();
      return;
    }
    const tick = async (): Promise<TickResult> => {
      try {
        const res = await api.client.call('readMessages', {
          params: { conversationId },
          query: { mode: 'LIVE', ...(after.current ? { afterSeq: after.current } : {}) },
        });
        if (historyOnly.current) return 'stop';
        setReadError('');
        absorb(res.data, res.page.scannedThroughSeq);
        if (!loadedFirst.current) { loadedFirst.current = true; setOlderCursor(res.page.nextCursor); }
        return 'continue';
      } catch (e) {
        if(historyOnly.current)return 'stop';
        if (e instanceof ApiError && e.status === 403) { void toHistory(); return 'stop'; }
        setReadError('Couldn’t load messages. '+errorMessage(e)+(e instanceof ApiError&&(e.status===401||e.status===404)?'':' Retrying automatically.'));
        if (e instanceof ApiError && (e.status === 401 || e.status === 404)) return 'stop';
        throw e;
      }
    };
    const p = new LivePoller(tick, pollerDeps(), async () => (await refresh()).status === 'signed-in');
    poller.current = p;
    p.start();
    return () => p.stop();
  }, [absorb, api, conversation, conversationId, pollerDeps, refresh, toHistory]);

  useEffect(() => {
    if (text) saveDraft(`message:${conversationId}`, { text }); else clearDraft(`message:${conversationId}`);
  }, [conversationId, text]);

  if (state.status === 'loading') return <Loading />;
  if (state.status === 'guest') return <div className="scroll"><TitleBar title="Chat" back="/inbox" /><StateBlock icon={<ChatBubbleIcon width={30} height={30} aria-hidden="true" />} title="Please sign in again to see this conversation." action={<PrimaryLink to={signInPath(`/chat/${conversationId}`)}>Sign in</PrimaryLink>} /></div>;
  if (conversation === undefined) return error ? <div className="scroll"><TitleBar title="Chat" back="/inbox" /><FormMessage message={error} /></div> : <Loading label="Loading conversation" />;
  if (conversation === null) {
    return (
      <div className="scroll">
        <TitleBar title="Chat" back="/inbox" />
        <StateBlock icon={<LockClosedIcon width={28} height={28} aria-hidden="true" />} title="This chat opens when you have a seat." action={<PrimaryLink to="/inbox">Back to Inbox</PrimaryLink>}>
          Only confirmed members of a table can read and send messages.
        </StateBlock>
      </div>
    );
  }

  const canSend = mode === 'LIVE' && conversation.canSend && !conversation.dissolved;
  const isHost = !!meal && meal.host.id === me?.id;

  const send = async (event?: FormEvent) => {
    event?.preventDefault();
    const body = text.trim();
    if (!body || sending || historyOnly.current || !canSend) return;
    if (body.length > 2000) { setError('Messages can be up to 2,000 characters.'); return; }
    if (!pending.current || pending.current.body !== body) pending.current = { id: newIntentKey(), body };
    const clientMessageId = pending.current.id;
    setSending(true);
    setError('');
    try {
      const res = await withRetry(() => api.client.call('sendMessage', { params: { conversationId }, body: { body, clientMessageId } }), api.retry);
      absorb([res.data]);
      pending.current = null;
      setText('');
    } catch (e) {
      if (!(e instanceof ApiError) || !e.retryable) pending.current = null;
      if (e instanceof ApiError && e.status === 403) {
        void toHistory();
        setError('You can no longer send messages here. Your text is kept below.');
      } else {
        setError(errorMessage(e));
      }
    } finally {
      setSending(false);
    }
  };

  const loadOlder = async () => {
    if (!olderCursor) return;
    try {
      const res = await api.client.call('readMessages', { params: { conversationId }, query: { mode: historyOnly.current ? 'HISTORY' : mode, cursor: olderCursor } });
      setMessages((cur) => mergeMessages(cur, res.data));
      setOlderCursor(res.page.nextCursor);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const leaveOrDissolve = async (kind: 'leave' | 'dissolve') => {
    setSheetError('');
    try {
      const op = kind === 'leave' ? 'leaveGroup' : 'dissolveGroup';
      const res = await intent.current.run({ op, v: conversation.version }, (key) =>
        api.client.call(op, { params: { conversationId }, body: { confirm: true }, ifMatch: conversation.version, idempotencyKey: key }));
      setConversation(res.data);
      if (!res.data.canSend || res.data.dissolved) void toHistory();
      setSheet('');
      notify(kind === 'leave' ? 'You left the group. Your meal participation is unchanged.' : 'Group dissolved. Earlier messages remain available.');
    } catch (e) {
      setSheetError(errorMessage(e));
    }
  };

  const reported = reportedMessages(cache);
  const people = meal ? mealPeople(meal) : [];
  const openReport = (m: Message) => {
    setActionsFor(null);
    rememberMessageSubject(cache, m.id, { senderName: m.sender.displayName, excerpt: m.body });
    navigate(messageReportRoute(m.id));
  };
  const today = londonDay(new Date().toISOString());
  const dayLabel = (day: string) => (day === today ? 'TODAY' : longDate(day).toUpperCase());
  let lastDay = '';
  return (
    <div className="chat">
      <div className="chat-head">
        <BackDisc fallback="/inbox" />
        <div className="t">
          <h1>{conversation.title}</h1>
          <p>{meal ? `${people.length} ${people.length === 1 ? 'person' : 'people'} · ${longDate(meal.startsAt.localDate)}, ${meal.startsAt.localTime}` : conversation.kind === 'DIRECT' ? 'Personal conversation' : 'Meal group'}</p>
        </div>
        {conversation.kind === 'GROUP' && <button type="button" className="disc" aria-label="Group settings" onClick={() => setSheet('settings')}><GearIcon width={17} height={17} aria-hidden="true" /></button>}
      </div>
      <div className="chat-scroll" aria-live="polite" aria-relevant="additions">
        {meal ? (
          <Link className="chat-pinned" to={mealPath(meal)} aria-label={`View meal: ${longDate(meal.startsAt.localDate)} at ${meal.startsAt.localTime}, ${venueName(meal)}, ${bookingLabel(meal)}`}>
            <CalendarIcon aria-hidden="true" />
            <span><strong>{`${longDate(meal.startsAt.localDate)} · ${meal.startsAt.localTime}`}</strong><span className="muted">{`${venueName(meal)} · ${bookingLabel(meal)} · Pay at the restaurant`}</span></span>
            <ChevronRightIcon aria-hidden="true" />
          </Link>
        ) : conversation.kind === 'DIRECT' ? (
          <div className="chat-pinned"><HeartIcon aria-hidden="true" /><span><strong>You both want to meet again</strong><span className="muted">Start a conversation or find another table together.</span></span></div>
        ) : null}
        {!canSend && (
          <Notice icon={<LockClosedIcon />} role="status">
            {conversation.kind === 'DIRECT'
              ? 'Your previous messages are read-only. A new mutual connection is needed to send messages.'
              : 'You left this group or the host dissolved it. Your earlier messages remain read-only. No new group messages will be delivered.'}
          </Notice>
        )}
        {olderCursor && <TextAction onClick={() => void loadOlder()}>Load earlier messages</TextAction>}
        {!hasRead && !readError && <p className="muted" role="status">Loading messages…</p>}
        <FormMessage message={readError} />
        {historyOnly.current && readError && <TextAction disabled={readingHistory} onClick={() => void readHistory()}>Retry loading messages</TextAction>}
        {hasRead && !readError && !messages.length && <p className="chat-day">{canSend ? 'No messages yet. Say a little hello!' : 'No earlier messages.'}</p>}
        {messages.map((m) => {
          const day = londonDay(m.createdAt);
          const sep = day !== lastDay ? <p className="chat-day">{dayLabel(day)}</p> : null;
          lastDay = day;
          const own = m.sender.id === me?.id;
          const hiddenByMe = reported.has(m.id);
          const body = hiddenByMe ? 'You reported this message' : m.redacted ? 'Message removed' : m.body;
          // Only another member's visible message can be reported; never your own, a removed or an already reported one.
          const reportable = !own && !m.redacted && !hiddenByMe;
          return (
            <div key={m.id}>
              {sep}
              <div className={`msg-row${own ? ' own' : ''}`} onContextMenu={reportable ? (e) => { e.preventDefault(); setActionsFor(m); } : undefined}>
                {!own && <Link className="avatar-link" to={`/profiles/${m.sender.id}`} aria-label={`View ${m.sender.displayName}’s profile`}><Avatar name={m.sender.displayName} url={m.sender.avatarUrl} size={30} /></Link>}
                <div className="msg-copy">
                  {!own && conversation.kind === 'GROUP' && <Link className="msg-sender" to={`/profiles/${m.sender.id}`}>{m.sender.displayName}</Link>}
                  <p className={`bubble${own ? ' mine' : ''}${m.redacted || hiddenByMe ? ' redacted' : ''}`}><span className="vh">{own ? 'You' : m.sender.displayName}: </span>{body}</p>
                  <span className="msg-time">{londonTime(m.createdAt)}</span>
                </div>
                {reportable && <button type="button" className="msg-more" aria-label={`Message options for ${m.sender.displayName}’s message`} onClick={() => setActionsFor(m)}><DotsHorizontalIcon aria-hidden="true" /></button>}
              </div>
            </div>
          );
        })}
        <FormMessage message={error} />
      </div>
      {canSend ? (
        <form noValidate className="chatbar" onSubmit={(e) => void send(e)}>
          <label className="vh" htmlFor="composer">Message</label>
          <textarea className="input" id="composer" rows={1} maxLength={2000} value={text} placeholder="Say a little hello…"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }} />
          <button type="submit" className="send" disabled={sending || !text.trim()} aria-label="Send message"><PaperPlaneIcon aria-hidden="true" /></button>
        </form>
      ) : (
        <div className="chatbar readonly">
          <p className="muted" style={{ display: 'flex', gap: 6, alignItems: 'center' }}><LockClosedIcon aria-hidden="true" /> History is read-only.</p>
          {text && <><p className="muted">Unsent text: {text}</p><TextAction onClick={() => setText('')}>Discard unsent text</TextAction></>}
        </div>
      )}

      <Sheet open={actionsFor !== null} onOpenChange={(o) => !o && setActionsFor(null)} title="Message options">
        {actionsFor && <p className="quote side" style={{ marginBottom: 12 }}>{`${actionsFor.sender.displayName}: “${actionsFor.body.slice(0, 140)}”`}</p>}
        <Primary secondary onClick={() => actionsFor && openReport(actionsFor)}><ExclamationTriangleIcon aria-hidden="true" /> Report message</Primary>
        <TextAction onClick={() => setActionsFor(null)}>Cancel</TextAction>
      </Sheet>
      <Sheet open={sheet === 'settings'} onOpenChange={(o) => !o && setSheet('')} title="Group settings">
        <p className="body"><strong>{conversation.title}</strong></p>
        {meal && <PrimaryLink secondary to={mealPath(meal)}>View meal <ArrowRightIcon aria-hidden="true" /></PrimaryLink>}
        {people.length > 0 && (
          <>
            <h2 style={{ marginTop: 16 }}>At this table <span className="seg-count">{people.length}</span></h2>
            {people.map((p) => (
              <Link key={p.id} className="irow" to={`/profiles/${p.id}`} aria-label={`View ${p.displayName}’s profile`}>
                <Avatar name={p.displayName} url={p.avatarUrl} size={40} />
                <span className="mid"><b>{p.displayName}</b><span>{`${p.id === meal?.host.id ? 'Host' : 'Guest'}${p.id === me?.id ? ' · You' : ''}`}</span></span>
              </Link>
            ))}
          </>
        )}
        {canSend ? (
          <>
            <h2 style={{ marginTop: 16 }}>Your membership</h2>
            <p className="muted" style={{ marginBottom: 10 }}>Group membership is separate from your meal participation.</p>
            {isHost && meal && <PrimaryLink secondary to={`/meals/${meal.id}/host`}>Manage meal &amp; applications</PrimaryLink>}
            {isHost ? <Primary secondary className="mt8" onClick={() => setSheet('dissolve')}>Dissolve group</Primary> : <Primary secondary onClick={() => setSheet('leave')}>Leave group</Primary>}
          </>
        ) : <Notice icon={<LockClosedIcon />}>This group is read-only. Your earlier messages remain available.</Notice>}
      </Sheet>
      <ConfirmSheet open={sheet === 'leave'} onOpenChange={(o) => !o && setSheet('')} title="Leave this group?" keepLabel="Stay in the group" confirmLabel="Leave group" error={sheetError} onConfirm={() => void leaveOrDissolve('leave')}>
        You will stop receiving and sending new group messages. Your earlier messages remain available. Your meal participation does not change.
      </ConfirmSheet>
      <ConfirmSheet open={sheet === 'dissolve'} onOpenChange={(o) => !o && setSheet('')} title="Dissolve this group?" keepLabel="Keep the group" confirmLabel="Dissolve group" error={sheetError} onConfirm={() => void leaveOrDissolve('dissolve')}>
        Everyone will lose the ability to send new messages. Earlier messages remain available. This does not cancel the meal or change attendance.
      </ConfirmSheet>
    </div>
  );
}
