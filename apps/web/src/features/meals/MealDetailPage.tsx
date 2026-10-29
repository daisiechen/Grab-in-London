import { useMemo, useState, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router';
import { ApiError } from '@fancy/client';
import { ArrowRightIcon, CalendarIcon, ClockIcon, ExclamationTriangleIcon, ExternalLinkIcon, FileTextIcon, PersonIcon, Share2Icon } from '@radix-ui/react-icons';
import { useRenderedEvent } from '../../api/telemetry.tsx';
import { useSignedIn } from '../../api/session.tsx';
import { useApi } from '../../api/ApiProvider.tsx';
import { useQuery } from '../../api/useQuery.ts';
import { Intent } from '../../api/webApi.ts';
import type { Meal, MealDetail } from '../../api/types.ts';
import { longDate } from '../../lib/format.ts';
import { Avatar, FormMessage, LinkRow, Notice, Primary, PrimaryLink, StateBlock, Tag, TextAction, TitleBar } from '../../ui/components.tsx';
import { ConfirmSheet } from '../../ui/ConfirmSheet.tsx';
import { useDocumentMeta } from '../../seo/useDocumentMeta.ts';
import { mealDescription, mealIndexable, mealPath, mealSlug, mealTitle } from '../../seo/meal-seo.ts';
import { Unavailable } from '../../app/NotFound.tsx';
import { useActionGate } from '../auth/gate.ts';
import { VenuePhoto } from '../venues/VenuePhoto.tsx';
import { ShareSheet } from './ShareSheet.tsx';
import { mealActionMessage } from './messages.ts';
import {
  applicationLabels, areaName, areaPlace, bookingLabel, cancelReasonLabel, cardBudgetLabel, closesLabel, cuisineLabel, dietaryLabel, googleMapsUrl,
  languagesLabel, mealPeople, moodLabel, seatsLabel, tableKind, venueName,
} from './present.ts';

export const mealKey = (id: string, viewer: string) => `meal:${id}:${viewer}`;

function Fact({ icon, strong, small }: { icon: ReactNode; strong: string; small: string }) {
  return <div className="fact">{icon}<div><b>{strong}</b><span>{small}</span></div></div>;
}

function Facts({ meal }: { meal: Meal }) {
  return (
    <div className="facts">
      <Fact icon={<CalendarIcon width={15} height={15} aria-hidden="true" />} strong={longDate(meal.startsAt.localDate)} small={`${meal.startsAt.localTime} · London time`} />
      <Fact icon={<PersonIcon width={15} height={15} aria-hidden="true" />} strong={seatsLabel(meal)} small={`${meal.minimum}–${meal.capacity} people incl. host`} />
      <Fact icon={<span className="glyph" aria-hidden="true">£</span>} strong={cardBudgetLabel(meal)} small="Per person · pay at the restaurant" />
      <Fact icon={<ClockIcon width={15} height={15} aria-hidden="true" />} strong={`Closes ${closesLabel(meal.closesAt)}`} small="Applications" />
    </div>
  );
}

/**
 * Public meal page (iOS MealDetailScreen, spec §5): guests see the public projection; signed-in
 * members also see their own progress and the actions the server's allowedActions hint at (the
 * server re-validates every write). Canonical URL `/meals/{id}/{slug}`; other forms redirect.
 */
export function MealDetailPage() {
  const { mealId = '', slug } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const signedIn = useSignedIn();
  const { api } = useApi();
  const gate = useActionGate();
  const q = useQuery<MealDetail>(mealKey(mealId, signedIn?.user.id ?? 'guest'), async (c) => (await c.call('getMeal', { params: { mealId } })).data);
  const [confirm, setConfirm] = useState<'' | 'withdraw' | 'leave'>('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [share, setShare] = useState(false);
  const intents = useMemo(() => ({ withdraw: new Intent(api.retry), leave: new Intent(api.retry) }), [api]);
  useRenderedEvent('detail_view', { mealId }, !!q.data);
  const meal = q.data?.meal;
  const area = meal ? areaName(meal.areaCode) : '';
  useDocumentMeta(meal ? {
    title: mealTitle(meal, area), description: mealDescription(meal, area), canonical: mealPath(meal),
    robots: mealIndexable(meal, Date.now()) ? 'index' : 'noindex',
  } : null);

  if (!q.data || !meal) {
    if (q.error instanceof ApiError && (q.error.code === 'NOT_FOUND' || q.error.status === 404 || q.error.status === 403)) return <Unavailable />;
    return (
      <div className="scroll">
        <TitleBar title={q.error ? 'The table' : <span className="sk" style={{ height: 24, width: 220 }} />} />
        {q.error ? (
          <StateBlock title="We couldn’t load this table." action={<Primary onClick={() => void q.reload()}>Try again</Primary>}>Check your connection and try again.</StateBlock>
        ) : (
          <div role="status" aria-busy="true"><span className="vh">Loading meal</span><span className="sk" style={{ height: 110, margin: '10px 0' }} /><span className="sk" style={{ height: 60 }} /></div>
        )}
      </div>
    );
  }
  // One canonical address: a missing or out-of-date title fragment is replaced in place.
  const canonicalSlug = mealSlug(meal.title);
  if (meal.id === mealId && (slug ?? '') !== canonicalSlug) return <Navigate to={mealPath(meal) + location.search} replace state={location.state} />;

  const { myApplication, conversationId } = q.data;
  const now = Date.now();
  const can = (a: Meal['allowedActions'][number]) => meal.allowedActions.includes(a);
  const isHost = signedIn?.user.id === meal.host.id || can('REVIEW_APPLICATIONS') || can('DECLARE_BOOKING') || can('CANCEL');
  const open = meal.status === 'OPEN' && Date.parse(meal.closesAt.instant) > now && Date.parse(meal.startsAt.instant) > now;
  const full = meal.confirmedCount >= meal.capacity;
  const confirmed = myApplication?.state === 'CONFIRMED';
  const guestCanRequest = !signedIn && open && !full;
  const hostName = meal.host.displayName;
  const booking = bookingLabel(meal);
  const people = mealPeople(meal);

  const act = async (kind: 'withdraw' | 'leave') => {
    setBusy(true);
    setMessage(null);
    try {
      if (kind === 'withdraw' && myApplication) {
        await intents.withdraw.run({ id: myApplication.id, v: myApplication.version }, (key) => api.client.call('withdrawApplication', { params: { applicationId: myApplication.id }, idempotencyKey: key, ifMatch: myApplication.version }));
      } else if (kind === 'leave') {
        await intents.leave.run({ id: meal.id, v: meal.version }, (key) => api.client.call('leaveMeal', { params: { mealId: meal.id }, idempotencyKey: key, ifMatch: meal.version }));
      }
      setConfirm('');
    } catch (e) {
      setMessage(e instanceof ApiError ? mealActionMessage(e) : 'Something went wrong. Please try again.');
      setConfirm('');
    } finally {
      setBusy(false);
      await q.reload();
    }
  };

  const findAnother = (primary = true) => primary
    ? <PrimaryLink to="/discover">Find another table <ArrowRightIcon aria-hidden="true" /></PrimaryLink>
    : <Link className="textact" to="/discover">Find another table</Link>;
  let hint: string | null = null;
  let action: ReactNode = null;
  if (meal.status === 'CANCELLED') action = findAnother();
  else if (isHost) action = <PrimaryLink to={`/meals/${meal.id}/host`}>Manage applications <ArrowRightIcon aria-hidden="true" /></PrimaryLink>;
  else if (confirmed && can('OPEN_GROUP') && conversationId) { hint = 'You’re at the table'; action = <PrimaryLink to={`/chat/${conversationId}`}>Open group chat <ArrowRightIcon aria-hidden="true" /></PrimaryLink>; }
  else if (myApplication?.state === 'PENDING') { hint = `Request sent · ${hostName} is reviewing`; action = <PrimaryLink secondary to={`/meals/${meal.id}/status`}>View your request <ArrowRightIcon aria-hidden="true" /></PrimaryLink>; }
  else if (myApplication && (myApplication.state === 'DECLINED' || myApplication.state === 'EXPIRED') && !can('APPLY')) { hint = myApplication.state === 'DECLINED' ? `${hostName} couldn’t offer a seat this time` : 'Your request expired'; action = findAnother(); }
  else if (can('APPLY') || guestCanRequest) {
    hint = signedIn ? null : `Free to ask · ${hostName} reviews every request`;
    action = <Primary onClick={() => { if (gate.check(`/meals/${meal.id}/apply`)) navigate(`/meals/${meal.id}/apply`); }}>{myApplication ? 'Apply again' : 'Apply to join'} <ArrowRightIcon aria-hidden="true" /></Primary>;
  } else if (!open && !confirmed) { hint = `Applications closed on ${closesLabel(meal.closesAt)}`; action = <><Primary disabled>Applications closed</Primary>{findAnother(false)}</>; }
  else if (full && !confirmed) { hint = 'Every seat is taken'; action = <><Primary disabled>This table is full</Primary>{findAnother(false)}</>; }

  const footer = action ? <div className="footer">{hint && <p className="hint">{hint}</p>}{action}</div> : null;

  return (
    <div className={`scroll${footer ? ' has-footer' : ''}`}>
      <TitleBar
        title={meal.title}
        subtitle={`${area} · ${tableKind(meal.capacity)}`}
        right={<button type="button" className="disc" aria-label="Share this meal" onClick={() => setShare(true)}><Share2Icon width={16} height={16} aria-hidden="true" /></button>}
      />
      {meal.status === 'CANCELLED' && (
        <Notice tone="warn" role="status">{`${meal.cancelReason ? cancelReasonLabel[meal.cancelReason] : 'This meal was cancelled.'} Nothing is due, and existing members can still chat in Inbox.`}</Notice>
      )}
      {myApplication && !isHost ? <p className="progress-line">{applicationLabels[myApplication.state]}</p> : null}
      <div className="dgrid">
        <div className="dmain">
          <div className="main-facts"><Facts meal={meal} /></div>

          <h2>Who’s coming</h2>
          <div className="people">
            {people.map((p) => (
              <Link key={p.id} className="person" to={`/profiles/${p.id}`} aria-label={p.id === meal.host.id ? `Your host, ${p.displayName}` : `View ${p.displayName}’s profile`}>
                <Avatar name={p.displayName} url={p.avatarUrl} size={46} />
                <span>{p.displayName}</span>
                {p.id === meal.host.id && <span className="hosttag">Host</span>}
              </Link>
            ))}
            {!full && meal.status !== 'CANCELLED' && (
              <div className="person"><span className="open-seat" aria-hidden="true"><PersonIcon width={18} height={18} /></span><span style={{ color: 'var(--muted)' }}>{isHost || confirmed ? 'Open seat' : 'Your seat?'}</span></div>
            )}
          </div>

          <h2>A little about this meal</h2>
          <p className="prose">{meal.description}</p>
          <div className="tags" style={{ margin: '10px 0' }}><Tag>{moodLabel(meal.mood)}</Tag><Tag>{languagesLabel(meal.languages)}</Tag></div>
          <p className="muted">{`Cuisine: ${cuisineLabel(meal)} · Dietary options: ${dietaryLabel(meal)}. Host-reported · not an allergy guarantee.`}</p>

          <h2>The restaurant</h2>
          <VenuePhoto venueRef={meal.venue.venueRef} placeId={meal.venue.placeId} label={meal.venue.name}>
            {({ image, attribution }) => (
              <>
                <div className="venuebox">
                  {image}
                  <div style={{ minWidth: 0 }}>
                    <b>{venueName(meal)}</b>
                    <p className="addr">{meal.venue.available && meal.venue.address ? meal.venue.address : areaPlace(meal.areaCode)}</p>
                    <span className={`pill${booking === 'Restaurant booked' ? ' good' : ''}`}>{booking}</span>
                  </div>
                </div>
                {attribution}
              </>
            )}
          </VenuePhoto>
          {meal.venue.available && (
            <a className="link underline" style={{ marginTop: 8 }} href={googleMapsUrl(meal.venue)} target="_blank" rel="noopener noreferrer">
              Open in Google Maps <ExternalLinkIcon width={12} height={12} aria-hidden="true" /><span className="vh"> (opens in a new tab)</span>
            </a>
          )}
          <p className="muted">Reservation reported by the host; not verified by Fancy.</p>
          {meal.venue.attributions.map((a, i) => <p className="muted" key={i}>{a.text}</p>)}

          <Notice>No payment is due on Fancy. Everyone pays their own share at the restaurant.</Notice>

          <FormMessage message={message} />
          <div className="actions">
            {isHost && can('EDIT') && <PrimaryLink secondary to={`/meals/${meal.id}/edit`}>Edit meal</PrimaryLink>}
            {isHost && conversationId && <PrimaryLink secondary to={`/chat/${conversationId}`}>Open group chat</PrimaryLink>}
            {can('POST_MEAL') && <PrimaryLink secondary to={`/post-meal/${meal.id}`}>After the meal</PrimaryLink>}
            {can('WITHDRAW') && myApplication && <TextAction danger onClick={() => setConfirm('withdraw')}>Withdraw request</TextAction>}
            {can('LEAVE') && <TextAction danger onClick={() => setConfirm('leave')}>Cancel my place</TextAction>}
          </div>
          <div style={{ marginTop: 12 }}>
            <LinkRow first icon={<FileTextIcon width={14} height={14} />} label="Cancellation terms" to="/cancellation-terms" />
            {!isHost && <LinkRow icon={<ExclamationTriangleIcon width={14} height={14} />} label="Report this meal" to={`/report?targetType=MEAL&targetId=${meal.id}`} />}
          </div>
        </div>
        <aside aria-label="Your seat">
          <div className="aside-facts"><Facts meal={meal} /></div>
          {footer}
        </aside>
      </div>

      <ShareSheet open={share} onOpenChange={setShare} meal={meal} />
      <ConfirmSheet open={confirm === 'withdraw'} onOpenChange={(o) => !o && setConfirm('')} title="Withdraw your request?" keepLabel="Keep my request" confirmLabel="Withdraw request" busy={busy} onConfirm={() => void act('withdraw')}>
        Your host won’t see this request any more. You can apply again while applications are open.
      </ConfirmSheet>
      <ConfirmSheet open={confirm === 'leave'} onOpenChange={(o) => !o && setConfirm('')} title="Cancel your place?" keepLabel="Keep my place" confirmLabel="Cancel my place" busy={busy} onConfirm={() => void act('leave')}>
        Your seat is released for someone else. You stay in the group chat unless you leave it separately.
      </ConfirmSheet>
    </div>
  );
}
