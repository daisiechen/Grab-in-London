import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router';
import { ApiError } from '@fancy/client';
import { ArrowRightIcon, ChatBubbleIcon, CheckIcon, ChevronRightIcon, ClockIcon, Cross2Icon, LockClosedIcon, PersonIcon } from '@radix-ui/react-icons';
import { useApi } from '../../api/ApiProvider.tsx';
import { useSession } from '../../api/session.tsx';
import { useQuery } from '../../api/useQuery.ts';
import { Intent } from '../../api/webApi.ts';
import type { Application, Meal, MealDetail } from '../../api/types.ts';
import { focusInboxOn } from '../../lib/inboxFocus.ts';
import { signInPath } from '../../lib/returnTo.ts';
import { FormMessage, Loading, Notice, Pill, Primary, PrimaryLink, StateBlock, TextAction, TitleBar } from '../../ui/components.tsx';
import { ConfirmSheet } from '../../ui/ConfirmSheet.tsx';
import { useToast } from '../../ui/toast.tsx';
import { useDocumentMeta } from '../../seo/useDocumentMeta.ts';
import { mealPath } from '../../seo/meal-seo.ts';
import { mealKey } from '../meals/MealDetailPage.tsx';
import { mealActionMessage } from '../meals/messages.ts';
import { applicationLabels, bookingLabel, cardBudgetLabel, cardWhenLabel, venueName } from '../meals/present.ts';

type State = Application['state'];
type Tone = 'done' | 'current' | 'todo' | 'stopped';
type Step = { label: string; tone: Tone; icon: 'check' | 'person' | 'lock' | 'cross' | 'clock' };

/** Sent → Host reviewing → outcome (iOS applicationSteps). */
export function applicationSteps(state: State): [Step, Step, Step] {
  const sent: Step = { label: 'Sent', tone: 'done', icon: 'check' };
  if (state === 'PENDING') return [sent, { label: 'Host reviewing', tone: 'current', icon: 'person' }, { label: 'Seat confirmed', tone: 'todo', icon: 'lock' }];
  const reviewed: Step = { label: 'Host reviewing', tone: 'done', icon: 'check' };
  switch (state) {
    case 'CONFIRMED': return [sent, reviewed, { label: 'Seat confirmed', tone: 'done', icon: 'check' }];
    case 'DECLINED': return [sent, reviewed, { label: 'Declined', tone: 'stopped', icon: 'cross' }];
    case 'EXPIRED': return [sent, { label: 'Host reviewing', tone: 'todo', icon: 'person' }, { label: 'Expired', tone: 'stopped', icon: 'clock' }];
    case 'WITHDRAWN': return [sent, { label: 'Host reviewing', tone: 'todo', icon: 'person' }, { label: 'Withdrawn', tone: 'stopped', icon: 'cross' }];
    default: return [sent, reviewed, { label: 'Cancelled', tone: 'stopped', icon: 'cross' }];
  }
}

const COPY: Record<State, { title: string; next: (host: string) => string }> = {
  PENDING: { title: 'Your hello is on its way.', next: (host) => `${host} will review your introduction with your profile. We’ll let you know when there’s an update. If there’s a seat for you, the group chat for this table opens.` },
  CONFIRMED: { title: 'You’re at the table.', next: () => 'Your seat is confirmed and the group chat is open. Say hello, and check the time and place before you go.' },
  DECLINED: { title: 'Another table awaits.', next: (host) => `${host} couldn’t offer you a seat this time. It isn’t personal — tables are small. There are other meals to discover.` },
  EXPIRED: { title: 'Applications have closed.', next: () => 'This request closed before the host replied. You can discover another meal.' },
  WITHDRAWN: { title: 'Your request is withdrawn.', next: () => 'Your host no longer sees this request. You can apply again while applications are open.' },
  CANCELLED: { title: 'Your participation is cancelled.', next: () => 'Your seat was released. You can discover another meal.' },
};
export const STATUS_POLL_MS = 15_000;
const ICONS = { check: CheckIcon, person: PersonIcon, lock: LockClosedIcon, cross: Cross2Icon, clock: ClockIcon };

function Track({ steps }: { steps: [Step, Step, Step] }) {
  return (
    <div className="track" role="img" aria-label={`Application progress: ${steps.map((s) => `${s.label}${s.tone === 'done' ? ', done' : s.tone === 'current' ? ', in progress' : ''}`).join('; ')}`}>
      {[1, 2].map((i) => <span key={i} className={`bar${steps[i]!.tone === 'done' || steps[i]!.tone === 'current' ? ' on' : ''}`} style={{ left: `${(i * 2 - 1) * (100 / 6)}%` }} />)}
      {steps.map((s) => { const Icon = ICONS[s.icon]; return <div key={s.label} className={`step ${s.tone}`}><span className="dot"><Icon width={12} height={12} /></span><span>{s.label}</span></div>; })}
    </div>
  );
}

function SummaryCard({ meal, status, good }: { meal: Meal; status: string; good?: boolean }) {
  const booking = bookingLabel(meal);
  return (
    <Link to={mealPath(meal)} className="summary" aria-label={`View ${meal.title}`} style={{ textDecoration: 'none' }}>
      <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><strong>{meal.title}</strong><ChevronRightIcon width={16} height={16} aria-hidden="true" /></span>
      <span className="muted" style={{ fontSize: 12 }}>{`${cardWhenLabel(meal.startsAt)} · ${venueName(meal)}`}</span>
      <span className="muted" style={{ fontSize: 12 }}>{`Expected ${cardBudgetLabel(meal)} per person`}</span>
      <span className="tags" style={{ marginTop: 4 }}><Pill tone={good ? 'good' : ''}>{status}</Pill><Pill tone={booking === 'Restaurant booked' ? 'good' : ''}>{booking}</Pill></span>
    </Link>
  );
}

/** “Your application” (iOS ApplicationStatusScreen): progress, what happens next, withdraw with confirmation. */
export function ApplicationStatusPage() {
  const { mealId = '' } = useParams();
  const { api } = useApi();
  const { state } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const notify = useToast();
  const signedIn = state.status === 'signed-in' ? state.session : null;
  const q = useQuery<MealDetail>(signedIn ? mealKey(mealId, signedIn.user.id) : null, async (c) => (await c.call('getMeal', { params: { mealId } })).data);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const intent = useMemo(() => new Intent(api.retry), [api]);
  useDocumentMeta({ title: 'Your request · Fancy', robots: 'noindex, nofollow' });
  // While the host is reviewing, check back periodically so a decision shows up without leaving the page.
  const pending = q.data?.myApplication?.state === 'PENDING';
  const { reload } = q;
  useEffect(() => {
    if (!pending) return undefined;
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void reload(); }, STATUS_POLL_MS);
    return () => clearInterval(timer);
  }, [pending, reload]);

  if (state.status === 'guest') return <Navigate to={signInPath(location.pathname)} replace />;
  if (!q.data) {
    return (
      <div className="scroll">
        <TitleBar title="Your request" back={`/meals/${mealId}`} />
        {q.error ? <StateBlock title="We couldn’t load your request." action={<Primary onClick={() => void q.reload()}>Try again</Primary>}>{q.error instanceof ApiError ? mealActionMessage(q.error) : 'Please try again.'}</StateBlock> : <Loading label="Loading application" />}
      </div>
    );
  }
  const { meal, myApplication: app, conversationId } = q.data;
  if (!app) {
    return (
      <div className="scroll has-footer">
        <TitleBar title="No application yet." subtitle={meal.title} back={mealPath(meal)} />
        <p className="prose">You haven’t asked to join this table. Open the meal to send a request.</p>
        <SummaryCard meal={meal} status="Open table" />
        <div className="footer"><PrimaryLink secondary to={mealPath(meal)}>View the table</PrimaryLink></div>
      </div>
    );
  }
  const can = (a: Meal['allowedActions'][number]) => meal.allowedActions.includes(a);
  const copy = COPY[app.state];

  const withdraw = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await intent.run({ id: app.id, v: app.version }, (key) => api.client.call('withdrawApplication', { params: { applicationId: app.id }, idempotencyKey: key, ifMatch: app.version }));
      notify('Request withdrawn');
    } catch (e) {
      setMessage(e instanceof ApiError ? mealActionMessage(e) : 'Something went wrong. Please try again.');
    } finally {
      setConfirm(false);
      setBusy(false);
      await q.reload();
    }
  };

  let primary;
  if (app.state === 'CONFIRMED' && conversationId) primary = <PrimaryLink to={`/chat/${conversationId}`}>Open group chat <ArrowRightIcon aria-hidden="true" /></PrimaryLink>;
  else if (app.state === 'PENDING') primary = <Primary secondary onClick={() => { focusInboxOn(meal.id); navigate('/inbox'); }}><ChatBubbleIcon aria-hidden="true" /> Track in Inbox</Primary>;
  else if (can('APPLY')) primary = <PrimaryLink to={`/meals/${meal.id}/apply`}>Apply again <ArrowRightIcon aria-hidden="true" /></PrimaryLink>;
  else if (app.state === 'CONFIRMED') primary = <PrimaryLink secondary to={mealPath(meal)}>View the table</PrimaryLink>;
  else primary = <PrimaryLink to="/discover">Find another table <ArrowRightIcon aria-hidden="true" /></PrimaryLink>;

  return (
    <div className="scroll has-footer">
      <TitleBar title={copy.title} subtitle={`Your request · ${meal.title}`} back={mealPath(meal)} />
      <Track steps={applicationSteps(app.state)} />
      <SummaryCard meal={meal} status={applicationLabels[app.state]} good={app.state === 'CONFIRMED'} />
      <h2>What happens next</h2>
      <p className="prose">{copy.next(meal.host.displayName)}</p>
      {app.message && <><h2>Your introduction</h2><p className="quote side">{`“${app.message}”`}</p></>}
      {(app.state === 'PENDING' || app.state === 'CONFIRMED') && <Notice>No payment is due on Fancy. Everyone pays their own share at the restaurant.</Notice>}
      <div className="footer">
        <FormMessage message={message} />
        {primary}
        {app.state === 'PENDING' && can('WITHDRAW') && <TextAction danger onClick={() => setConfirm(true)}>Withdraw request</TextAction>}
      </div>
      <ConfirmSheet open={confirm} onOpenChange={setConfirm} title="Withdraw your request?" keepLabel="Keep my request" confirmLabel="Withdraw request" busy={busy} onConfirm={() => void withdraw()}>
        Your host won’t see this request any more. You can apply again while applications are open.
      </ConfirmSheet>
    </div>
  );
}
