import { useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { ApiError, newIntentKey } from '@fancy/client';
import { HOST_CANCEL_REASONS } from '@fancy/contracts';
import { ChatBubbleIcon, CheckIcon, ChevronDownIcon, ChevronRightIcon, ChevronUpIcon, Pencil1Icon } from '@radix-ui/react-icons';
import { useApi } from '../../api/ApiProvider.tsx';
import { useSession } from '../../api/session.tsx';
import { useQuery } from '../../api/useQuery.ts';
import { errorMessage } from '../../api/errors.ts';
import type { Application, Meal, MealDetail } from '../../api/types.ts';
import { longDate } from '../../lib/london.ts';
import { signInPath } from '../../lib/returnTo.ts';
import { mealPath } from '../../seo/meal-seo.ts';
import { useDocumentMeta } from '../../seo/useDocumentMeta.ts';
import { Avatar, ChoiceGroup, FormMessage, Loading, Notice, Primary, PrimaryLink, TextAction, TitleBar } from '../../ui/components.tsx';
import { Sheet } from '../../ui/Sheet.tsx';
import { editBlockedReason } from '../create/model.ts';
import { mealActionMessage } from '../meals/messages.ts';
import { bookingLabel, cardWhenLabel, closesLabel, venueName } from '../meals/present.ts';

type CancelReason = (typeof HOST_CANCEL_REASONS)[number];
type BookingStatus = 'REPORTED_CONFIRMED' | 'NEEDS_UPDATE' | 'FAILED' | 'CANCELLED';
type Person = Meal['members'][number];

const CANCEL_LABELS: Record<CancelReason, string> = { host: 'I can’t make it', booking: 'The restaurant booking fell through', other: 'Something else' };
const BOOKING_LABELS: ReadonlyArray<readonly [BookingStatus, string]> = [
  ['REPORTED_CONFIRMED', 'Booked'],
  ['NEEDS_UPDATE', 'Needs an update'],
  ['FAILED', 'Booking failed'],
  ['CANCELLED', 'Booking cancelled'],
];
const STATE_LABELS: Record<Application['state'], string> = { PENDING: 'Pending', CONFIRMED: 'Confirmed', DECLINED: 'Declined', WITHDRAWN: 'Withdrawn', EXPIRED: 'Expired', CANCELLED: 'Cancelled' };

/** One-line context under an applicant's name: work and hometown when shared, else the bio. */
const personLine = (p: Person) => [p.background?.work, p.background?.hometown ? `From ${p.background.hometown}` : null].filter(Boolean).join(' · ') || p.bio || '';

/**
 * “Your guest list” (iOS HostScreen, T10): requests with atomic approve/decline (If-Match), the
 * people at the table, the host's external booking self-report, the arrangement lock and
 * cancellation. Business rejections refresh the page instead of replaying a changed decision.
 */
export function HostPage() {
  const { mealId = '' } = useParams();
  const { state } = useSession();
  const { api, cache } = useApi();
  useDocumentMeta({ title: 'Your guest list · Fancy', robots: 'noindex, nofollow' });
  const signedIn = state.status === 'signed-in';
  const detail = useQuery<MealDetail>(signedIn ? `meal:${mealId}:host` : null, async (c) => (await c.call('getMeal', { params: { mealId } })).data);
  const apps = useQuery<Application[]>(signedIn ? `applications:${mealId}` : null, async (c) => {
    const rows: Application[] = [];
    let cursor: string | null = null;
    for (let n = 0; n < 20; n++) {
      const res: { data: Application[]; page: { nextCursor: string | null } } = await c.call('listApplications', { params: { mealId }, query: { limit: 100, ...(cursor ? { cursor } : {}) } });
      rows.push(...res.data);
      cursor = res.page.nextCursor;
      if (!cursor) break;
    }
    return rows;
  });
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'info' } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  // Declining is final for that request, so it is confirmed first (approving is not).
  const [declineTarget, setDeclining] = useState<Application | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [reason, setReason] = useState<CancelReason | null>(null);
  const [booking, setBooking] = useState<BookingStatus | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const keys = useRef(new Map<string, string>());
  const keyFor = (intent: string) => {
    if (!keys.current.has(intent)) keys.current.set(intent, newIntentKey());
    return keys.current.get(intent)!;
  };
  const now = useMemo(() => Date.now(), [detail.data]);

  if (state.status === 'guest') return <Navigate to={signInPath(`/meals/${mealId}/host`)} replace />;

  const refresh = async () => {
    cache.delete('myMeals');
    cache.delete(`meal:${mealId}`);
    await Promise.all([detail.reload(), apps.reload()]);
  };

  const run = async (intent: string, op: (key: string) => Promise<unknown>, success: string) => {
    setBusy(intent);
    setMessage(null);
    try {
      await op(keyFor(intent));
      keys.current.delete(intent);
      setMessage({ text: success, tone: 'info' });
      return true;
    } catch (e) {
      // Business rejections (full, deadline, stale version) are final for this intent: refresh instead of replaying.
      if (e instanceof ApiError && e.kind !== 'network' && !e.retryable) keys.current.delete(intent);
      setMessage({ text: e instanceof ApiError ? mealActionMessage(e) : errorMessage(e), tone: 'error' });
      return false;
    } finally {
      setBusy(null);
      await refresh();
    }
  };

  if (!detail.data) {
    return (
      <div className="scroll">
        <TitleBar title="Your guest list" back={`/meals/${mealId}`} />
        {detail.error ? (
          <>
            <FormMessage message={errorMessage(detail.error)} />
            <div className="mt8"><Primary secondary onClick={() => void detail.reload()}>Try again</Primary></div>
          </>
        ) : <Loading label="Loading your guest list…" />}
      </div>
    );
  }
  const { meal, conversationId } = detail.data;
  const actions = new Set(meal.allowedActions);
  const cancelled = meal.status === 'CANCELLED';
  const recruiting = meal.status === 'OPEN' && actions.has('REVIEW_APPLICATIONS');
  const full = meal.confirmedCount >= meal.capacity;
  const pending = (apps.data ?? []).filter((a) => a.state === 'PENDING');
  // Confirmed guests already appear under “At the table”; only other outcomes are listed again.
  const earlier = (apps.data ?? []).filter((a) => a.state !== 'PENDING' && a.state !== 'CONFIRMED');
  const members = meal.members.length ? meal.members : [meal.host];
  const declaration = meal.bookingDeclaration;
  const editable = editBlockedReason(meal, now) === null;
  const showChat = !!conversationId && actions.has('OPEN_GROUP');

  const decide = (a: Application, decision: 'APPROVE' | 'DECLINE') =>
    run(`${decision}:${a.id}:${a.version}`, (key) => api.client.call('decideApplication', { params: { applicationId: a.id }, body: { decision }, idempotencyKey: key, ifMatch: a.version }),
      decision === 'APPROVE' ? `${a.applicant?.displayName ?? 'Guest'} has a seat.` : 'Request declined.');

  const bookingCount = count ?? Math.max(1, meal.confirmedCount);
  const saveBooking = () => {
    if (!booking) return;
    const intent = `booking:${booking}:${bookingCount}:${meal.version}`;
    void run(intent, (key) => api.client.call('declareBooking', { params: { mealId }, body: { status: booking, count: bookingCount }, idempotencyKey: key, ifMatch: meal.version }), 'Reservation status updated.')
      .then((ok) => { if (ok) { setBookingOpen(false); setBooking(null); setCount(null); } });
  };
  const cancel = () => {
    if (!reason) return;
    void run(`cancel:${meal.version}`, (key) => api.client.call('cancelMeal', { params: { mealId }, body: { reason }, idempotencyKey: key, ifMatch: meal.version }), 'Meal cancelled.')
      .then((ok) => { if (ok) setCancelOpen(false); });
  };

  return (
    <div className={`scroll${showChat ? ' has-footer' : ''}`}>
      <TitleBar title={meal.title} subtitle={`${cardWhenLabel(meal.startsAt)} · London time · ${venueName(meal)}`} back={mealPath(meal)}
        right={<Link className="link" to={mealPath(meal)}>View meal</Link>} />
      <div className="seats" role="img" aria-label={`${meal.confirmedCount} of ${meal.capacity} seats confirmed, minimum ${meal.minimum}`}>
        <div className="seats-head"><b>{`${meal.confirmedCount} of ${meal.capacity} confirmed`}</b><span>{`You’re hosting · minimum ${meal.minimum}`}</span></div>
        <div className="seats-bar">
          <span className="fill" style={{ width: `${Math.min(100, (meal.confirmedCount / meal.capacity) * 100)}%` }} />
          <span className="min" style={{ left: `${Math.min(100, (meal.minimum / meal.capacity) * 100)}%` }} />
        </div>
      </div>
      {cancelled ? <Notice role="status">This meal is cancelled. Please cancel or adjust the restaurant reservation yourself. Your group chat stays open.</Notice> : null}
      <FormMessage message={message?.text ?? null} tone={message?.tone ?? 'error'} />

      <div className="hgrid">
        <section aria-labelledby="h-requests">
          <h2 id="h-requests">{`Requests · ${pending.length}`}</h2>
          {apps.error ? (
            <>
              <FormMessage message={errorMessage(apps.error)} />
              <TextAction className="inline" onClick={() => void apps.reload()}>Try again</TextAction>
            </>
          ) : null}
          {!apps.data && !apps.error ? <Loading label="Loading requests…" /> : null}
          {apps.data && pending.length === 0 ? <p className="body">{recruiting ? 'No requests waiting. New requests appear here.' : 'No requests waiting.'}</p> : null}
          {pending.map((a) => {
            const name = a.applicant?.displayName ?? 'Member';
            return (
              <article className="request" key={a.id} aria-label={`Request from ${name}`}>
                <div className="request-who">
                  {a.applicant ? (
                    <Link to={`/profiles/${a.applicant.id}`} className="request-link" aria-label={`View ${name}’s profile`}>
                      <Avatar name={name} url={a.applicant.avatarUrl} size={44} />
                      <span className="mid"><b>{name}</b>{personLine(a.applicant) ? <span>{personLine(a.applicant)}</span> : null}</span>
                      <ChevronRightIcon aria-hidden="true" />
                    </Link>
                  ) : <span className="mid"><b>{name}</b></span>}
                </div>
                {a.message ? <p className="quote">{`“${a.message}”`}</p> : null}
                <div className="two">
                  <Primary secondary aria-label={`Decline ${name}`} busy={busy === `DECLINE:${a.id}:${a.version}`} disabled={busy !== null || !recruiting} onClick={() => setDeclining(a)}>Decline</Primary>
                  <Primary aria-label={`Approve ${name}`} busy={busy === `APPROVE:${a.id}:${a.version}`} disabled={busy !== null || !recruiting || full} onClick={() => void decide(a, 'APPROVE')}>Approve <CheckIcon aria-hidden="true" /></Primary>
                </div>
              </article>
            );
          })}
          {pending.length ? <p className="muted">{full ? 'Your table is full, so new approvals aren’t possible.' : 'Pending requests don’t take a seat. Approving confirms a seat straight away.'}</p> : null}
          {!recruiting && !cancelled && pending.length ? <p className="muted">Applications have closed, so requests can’t be decided any more.</p> : null}

          <h2>At the table</h2>
          <ul className="people-list">
            {members.map((p) => (
              <li key={p.id}>
                <Link to={`/profiles/${p.id}`} aria-label={p.id === meal.host.id ? `You, the host, ${p.displayName}` : `View ${p.displayName}’s profile`}>
                  <Avatar name={p.displayName} url={p.avatarUrl} size={34} />
                  <span className="nm">{p.displayName}</span>
                  {p.id === meal.host.id ? <span className="hosttag">Host</span> : null}
                </Link>
              </li>
            ))}
          </ul>
          {earlier.length ? (
            <div className="earlier">
              <p className="muted">Earlier requests</p>
              {earlier.map((a) => <p key={a.id} className="body">{`${a.applicant?.displayName ?? 'Member'} · ${STATE_LABELS[a.state]}`}</p>)}
            </div>
          ) : null}
        </section>

        <section aria-labelledby="h-booking">
          <h2 id="h-booking">Restaurant reservation</h2>
          <div className="status-row">
            <span className={`pill${declaration?.status === 'REPORTED_CONFIRMED' && !declaration.stale ? ' good' : ''}`}>{bookingLabel(meal)}</span>
            {declaration ? <span className="muted">{`For ${declaration.declaredCount} ${declaration.declaredCount === 1 ? 'person' : 'people'} · reported ${longDate(declaration.reportedAt.slice(0, 10))}`}</span> : null}
          </div>
          {declaration?.stale && !cancelled ? (
            <p className="muted">{`Your table changed since you reported this booking: ${meal.capacity} seats, ${meal.confirmedCount} confirmed including you. Check with the restaurant and update your reservation.`}</p>
          ) : null}
          <p className="muted">You book with the restaurant yourself; guests see this as reported by you. Everyone pays their own share at the restaurant.</p>
          {actions.has('DECLARE_BOOKING') ? (
            <>
              <button type="button" className={`expander${bookingOpen ? ' open' : ''}`} aria-expanded={bookingOpen} aria-controls={bookingOpen ? 'reservation-form' : undefined} onClick={() => setBookingOpen(!bookingOpen)}>
                <Pencil1Icon aria-hidden="true" /><span>Update reservation</span>{bookingOpen ? <ChevronUpIcon aria-hidden="true" /> : <ChevronDownIcon aria-hidden="true" />}
              </button>
              {bookingOpen ? (
                <div className="xpanel" id="reservation-form">
                  <ChoiceGroup<BookingStatus> label="Reservation status" options={BOOKING_LABELS} value={booking} onChange={setBooking} />
                  <ChoiceGroup<string> label="People booked, including you" options={Array.from({ length: meal.capacity }, (_, i) => [String(i + 1), String(i + 1)] as const)} value={String(bookingCount)} onChange={(v) => setCount(Number(v))} />
                  <Primary busy={busy?.startsWith('booking:') ?? false} disabled={!booking || busy !== null} onClick={saveBooking}>Save reservation status</Primary>
                </div>
              ) : null}
            </>
          ) : null}

          <h2>Meal arrangements</h2>
          <p className="muted">
            {meal.arrangementLocked
              ? 'The restaurant, time, budget and group size are locked after the first approval. To change them, cancel and create a new meal.'
              : 'Nobody is approved yet. Once you approve the first guest, the restaurant, time, budget and group size are locked.'}
          </p>
          <p className="muted">{`Applications close ${closesLabel(meal.closesAt)} London time. Minimum ${meal.minimum} people, including you.`}</p>
          {editable ? (
            <Link className="expander" to={`/meals/${mealId}/edit`}>
              <Pencil1Icon aria-hidden="true" /><span>Edit meal</span><ChevronRightIcon aria-hidden="true" />
            </Link>
          ) : null}
          {actions.has('POST_MEAL') ? <div className="mt8"><PrimaryLink secondary to={`/post-meal/${mealId}`}>After the meal</PrimaryLink></div> : null}
          {actions.has('CANCEL') ? <TextAction danger className="inline mt8" onClick={() => { setReason(null); setCancelOpen(true); }}>Cancel meal for everyone</TextAction> : null}
        </section>
      </div>

      {showChat ? (
        <div className="footer"><PrimaryLink to={`/chat/${conversationId}`}><ChatBubbleIcon aria-hidden="true" /> Open group chat</PrimaryLink></div>
      ) : null}

      <Sheet open={declineTarget !== null} onOpenChange={(o) => { if (!o) setDeclining(null); }} title={`Decline ${declineTarget?.applicant?.displayName ?? 'this request'}?`}>
        <p className="body">They’ll be told their request wasn’t accepted this time. This can’t be undone, and they can’t request this meal again.</p>
        <Primary secondary onClick={() => setDeclining(null)}>Keep the request</Primary>
        <TextAction danger disabled={busy !== null} onClick={() => { const a = declineTarget; if (a) void decide(a, 'DECLINE').then(() => setDeclining(null)); }}>Decline request</TextAction>
      </Sheet>
      <Sheet open={cancelOpen} onOpenChange={setCancelOpen} title="Cancel this meal?">
        <p className="body">{`Cancel ${meal.title} for everyone. Pending requests close and members are notified. Your group chat stays open. You must cancel the restaurant reservation yourself.`}</p>
        <ChoiceGroup<CancelReason> label="Reason for cancelling" options={HOST_CANCEL_REASONS.map((r) => [r, CANCEL_LABELS[r]] as const)} value={reason} onChange={setReason} />
        <Primary secondary onClick={() => setCancelOpen(false)}>Keep the meal</Primary>
        <TextAction danger disabled={!reason || busy !== null} onClick={cancel}>Cancel meal for everyone</TextAction>
      </Sheet>
    </div>
  );
}
