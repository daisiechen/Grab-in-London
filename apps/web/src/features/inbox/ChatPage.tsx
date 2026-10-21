import { useAssistantEditor, useAssistantEditorRevision } from '../assistant/index.ts';
import { useRenderedEvent } from '../../api/telemetry.tsx';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { ApiError, newIntentKey, withRetry } from '@fancy/client';
import { CalendarIcon, ChevronLeftIcon, GearIcon, LockClosedIcon, PaperPlaneIcon } from '@radix-ui/react-icons';
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
import { Avatar, FormError, Loading, Notice, PageHeader, Primary, PrimaryLink, TextAction } from '../../ui/components.tsx';
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
  const [mode, setMode] = useState<Mode>('LIVE');
  const [olderCursor, setOlderCursor] = useState<string | null>(null);
  const [text, setText] = useState(() => loadDraft<{ text: string }>(`message:${conversationId}`)?.text ?? '');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [sheet, setSheet] = useState<'' | 'settings' | 'leave' | 'dissolve'>('');
  const [sheetError, setSheetError] = useState('');
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
  const editorVersion = useAssistantEditorRevision(text);
  useAssistantEditor(conversation?.kind === 'GROUP' && conversation.canSend && !conversation.dissolved && mode === 'LIVE' && !sending ? { kind: 'GROUP',targetId:conversationId,version:editorVersion,text,apply:(candidate)=>{if(candidate.text!==null){setText(candidate.text);pending.current=null;setError('');}} } : null);

  const absorb = useCallback((list: readonly Message[], scanned?: string) => {
    setHasRead(true);
    after.current = maxSeq(after.current, scanned, ...list.map((m) => m.seq));
    if (list.length) setMessages((cur) => mergeMessages(cur, list));
    const rendered = maxSeq(scanned,...list.map(message=>message.seq));
    if(rendered)setRenderedThrough(previous=>maxSeq(previous,rendered));
  }, []);

  const toHistory = useCallback(async () => {
    if (historyOnly.current) return;
    historyOnly.current = true;
    poller.current?.stop();
    setMode('HISTORY');
    try {
      const res = await api.client.call('readMessages', { params: { conversationId }, query: { mode: 'HISTORY' } });
      absorb(res.data, res.page.scannedThroughSeq);
      if (!loadedFirst.current) { loadedFirst.current = true; setOlderCursor(res.page.nextCursor); }
    } catch {
      /* the archive itself may be unavailable; already-shown authorised messages stay */
    }
  }, [absorb, api, conversationId]);

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
        absorb(res.data, res.page.scannedThroughSeq);
        if (!loadedFirst.current) { loadedFirst.current = true; setOlderCursor(res.page.nextCursor); }
        return 'continue';
      } catch (e) {
        if (e instanceof ApiError && e.status === 403) { void toHistory(); return 'stop'; }
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
  if (state.status === 'guest') return <div className="body-pad"><PrimaryLink to={signInPath(`/inbox/${conversationId}`)}>Sign in to see your messages</PrimaryLink></div>;
  if (conversation === undefined) return error ? <div className="body-pad"><FormError>{error}</FormError></div> : <Loading />;
  if (conversation === null) {
    return (
      <>
        <PageHeader title="Inbox" backTo="/inbox" />
        <div className="body-pad empty">
          <LockClosedIcon />
          <h2>Your chat opens after confirmation</h2>
          <p>Continue from your meal to meet the people at your table.</p>
          <PrimaryLink to="/inbox">Back to Inbox</PrimaryLink>
        </div>
      </>
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

  let lastDay = '';
  return (
    <>
      <header className="page-header">
        <Link to="/inbox" aria-label="Back"><ChevronLeftIcon /></Link>
        <strong>{conversation.title}</strong>
        {conversation.kind === 'GROUP' ? <button type="button" aria-label="Group settings" onClick={() => setSheet('settings')}><GearIcon /></button> : <span />}
      </header>
      <div className="body-pad chat-body">
        {meal && (
          <div className="chat-pinned">
            <CalendarIcon />
            <div>
              <strong>{longDate(meal.startsAt.localDate)} · {meal.startsAt.localTime}</strong>
              <p>{meal.venue.available ? meal.venue.name : 'Restaurant information temporarily unavailable'}</p>
            </div>
          </div>
        )}
        {!canSend && (
          <Notice icon={<LockClosedIcon />} role="status">
            {conversation.kind === 'DIRECT'
              ? 'Your previous messages are read-only. A new mutual connection is needed to send messages.'
              : 'You left this group or the host dissolved it. Your earlier messages remain read-only. No new group messages will be delivered.'}
          </Notice>
        )}
        {olderCursor && <TextAction onClick={() => void loadOlder()}>Load earlier messages</TextAction>}
        {!messages.length && <p className="chat-date">{canSend ? 'SAY HELLO' : 'NO MESSAGES'}</p>}
        {messages.map((m) => {
          const day = londonDay(m.createdAt);
          const sep = day !== lastDay ? <p className="chat-date">{longDate(day).toUpperCase()}</p> : null;
          lastDay = day;
          const own = m.sender.id === me?.id;
          return (
            <div key={m.id}>
              {sep}
              <div className={`chat-message${own ? ' own' : ''}${m.redacted ? ' redacted' : ''}`}>
                {!own && <Link to={`/profiles/${m.sender.id}`} aria-label={m.sender.displayName}><Avatar name={m.sender.displayName} url={m.sender.avatarUrl} size={30} /></Link>}
                <div>
                  <small>{own ? 'You' : m.sender.displayName} · {londonTime(m.createdAt)}</small>
                  <p>{m.redacted ? 'This message was removed.' : m.body}</p>
                </div>
              </div>
            </div>
          );
        })}
        <FormError>{error}</FormError>
      </div>
      {canSend ? (
        <form noValidate className="composer" onSubmit={(e) => void send(e)}>
          <label className="sr-only" htmlFor="composer">Message</label>
          <textarea className="resize-none" id="composer" rows={1} maxLength={2000} value={text} placeholder="Write a message…"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }} />
          <button type="submit" disabled={sending || !text.trim()} aria-label="Send message"><PaperPlaneIcon /></button>
        </form>
      ) : text ? (
        <div className="body-pad"><p className="muted">Unsent text: {text}</p><TextAction onClick={() => setText('')}>Discard unsent text</TextAction></div>
      ) : null}

      <Sheet open={sheet === 'settings'} onOpenChange={(o) => !o && setSheet('')} title="Group settings">
        <p className="muted">Group membership is separate from your meal participation.</p>
        {meal && <PrimaryLink secondary to={`/meals/${meal.id}`}>View meal</PrimaryLink>}
        {canSend && (isHost
          ? <Primary secondary onClick={() => setSheet('dissolve')}>Dissolve group</Primary>
          : <Primary secondary onClick={() => setSheet('leave')}>Leave group</Primary>)}
        {!canSend && <p className="notice">This group is read-only. Your earlier messages remain available.</p>}
      </Sheet>
      <ConfirmSheet open={sheet === 'leave'} onOpenChange={(o) => !o && setSheet('')} title="Leave this group?" confirmLabel="Leave group" error={sheetError} onConfirm={() => void leaveOrDissolve('leave')}>
        <p>You will stop receiving and sending new group messages. Your earlier messages remain available. Your meal participation does not change.</p>
      </ConfirmSheet>
      <ConfirmSheet open={sheet === 'dissolve'} onOpenChange={(o) => !o && setSheet('')} title="Dissolve this group?" confirmLabel="Dissolve group" error={sheetError} onConfirm={() => void leaveOrDissolve('dissolve')}>
        <p>Everyone will lose the ability to send new messages. Earlier messages remain available. This does not cancel the meal or change attendance.</p>
      </ConfirmSheet>
    </>
  );
}
