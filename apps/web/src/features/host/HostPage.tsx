import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ApiError } from '@fancy/client';
import { BOOKING_DECLARATION_STATUSES, HOST_CANCEL_REASONS } from '@fancy/contracts';
import { ChatBubbleIcon, CheckIcon, InfoCircledIcon } from '@radix-ui/react-icons';
import { useApi } from '../../api/ApiProvider.tsx';
import { useQuery } from '../../api/useQuery.ts';
import { Intent } from '../../api/webApi.ts';
import { errorMessage } from '../../api/errors.ts';
import type { Application, MealDetail } from '../../api/types.ts';
import { Avatar, ChoiceGroup, FormError, Loading, Notice, PageHeader, Primary, PrimaryLink } from '../../ui/components.tsx';
import { ConfirmSheet } from '../../ui/ConfirmSheet.tsx';
import { useToast } from '../../ui/toast.tsx';
import { applicationLabels, bookingStatus } from '../meals/present.ts';

type DeclarationStatus = (typeof BOOKING_DECLARATION_STATUSES)[number];
type CancelReason = (typeof HOST_CANCEL_REASONS)[number];

const DECLARATION_LABELS: Record<DeclarationStatus, string> = {
  REPORTED_CONFIRMED: 'Booked with the restaurant',
  NEEDS_UPDATE: 'Booking needs updating',
  FAILED: 'Booking failed',
  CANCELLED: 'Booking cancelled',
};
const REASON_LABELS: Record<CancelReason, string> = { host: 'My plans changed', booking: 'Restaurant arrangements', other: 'Other' };

interface Applications { items: Application[]; nextCursor: string | null }

/**
 * Host guest list (T10). Approve/decline use Application.version; the server decides seats
 * atomically (last seat, deadline, cancellation) and the UI refreshes on any 409 rather than
 * retrying a changed decision. Booking status is the host's own report (P-01, external only).
 */
export function HostPage() {
  const { mealId = '' } = useParams();
  const { api, cache } = useApi();
  const notify = useToast();
  const meal = useQuery<MealDetail>(`meal:${mealId}:host`, async (c) => (await c.call('getMeal', { params: { mealId } })).data);
  const apps = useQuery<Applications>(`applications:${mealId}`, async (c) => {
    const res = await c.call('listApplications', { params: { mealId } });
    return { items: res.data, nextCursor: res.page.nextCursor };
  });
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [declining, setDeclining] = useState<Application | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState<CancelReason>('host');
  const [declStatus, setDeclStatus] = useState<DeclarationStatus | null>(null);
  const [sheetError, setSheetError] = useState('');
  const intent = useMemo(() => new Intent(api.retry), [api]);

  if (!meal.data) return meal.error ? <div className="body-pad"><FormError>{errorMessage(meal.error)}</FormError></div> : <Loading />;
  const m = meal.data.meal;
  const actions = new Set(m.allowedActions);
  const all = apps.data?.items ?? [];
  const pending = all.filter((a) => a.state === 'PENDING');
  const confirmed = all.filter((a) => a.state === 'CONFIRMED');
  const closed = all.filter((a) => a.state !== 'PENDING' && a.state !== 'CONFIRMED');
  const booking = bookingStatus(m);

  const refresh = async () => {
    cache.delete('myMeals');
    cache.delete(`meal:${mealId}`);
    await Promise.all([meal.reload(), apps.reload()]);
  };

  const decide = async (application: Application, decision: 'APPROVE' | 'DECLINE') => {
    setBusyId(application.id);
    setError('');
    setSheetError('');
    try {
      await intent.run({ id: application.id, decision, v: application.version }, (key) =>
        api.client.call('decideApplication', { params: { applicationId: application.id }, body: { decision }, ifMatch: application.version, idempotencyKey: key }));
      notify(decision === 'APPROVE'
        ? `${application.applicant?.displayName ?? 'Your guest'} has been notified and can join the group chat.`
        : 'Request declined.');
      setDeclining(null);
      await refresh();
    } catch (e) {
      const message = errorMessage(e);
      if (decision === 'DECLINE') setSheetError(message); else setError(message);
      if (e instanceof ApiError && e.kind === 'conflict') await refresh();
    } finally {
      setBusyId(null);
    }
  };

  const declare = async () => {
    if (!declStatus) return;
    setError('');
    try {
      const body = { status: declStatus, count: Math.max(1, m.confirmedCount) };
      await intent.run({ body, v: m.version }, (key) =>
        api.client.call('declareBooking', { params: { mealId }, body, ifMatch: m.version, idempotencyKey: key }));
      notify(`Reservation status updated for ${body.count} ${body.count === 1 ? 'person' : 'people'}.`);
      setDeclStatus(null);
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
      if (e instanceof ApiError && e.kind === 'conflict') await refresh();
    }
  };

  const cancel = async () => {
    setSheetError('');
    try {
      await intent.run({ reason, v: m.version }, (key) =>
        api.client.call('cancelMeal', { params: { mealId }, body: { reason }, ifMatch: m.version, idempotencyKey: key }));
      notify('Meal cancelled. Members have been notified.');
      setCancelOpen(false);
      await refresh();
    } catch (e) {
      setSheetError(errorMessage(e));
      if (e instanceof ApiError && e.kind === 'conflict') await refresh();
    }
  };

  const applicantLine = (a: Application) => (
    <div className="host-line">
      {a.applicant ? <Link to={`/profiles/${a.applicant.id}`}><Avatar name={a.applicant.displayName} url={a.applicant.avatarUrl} size={48} /></Link> : <Avatar name="?" size={48} />}
      <div>
        <strong>{a.applicant?.displayName ?? 'Applicant'}</strong>
        <p>Round {a.round}</p>
      </div>
    </div>
  );

  return (
    <>
      <PageHeader title="Your guest list" backTo={`/meals/${mealId}`} />
      <div className="body-pad">
        <h1>A few new faces.</h1>
        <p className="prose">Review each introduction before welcoming someone to your table.</p>
        <div className="summary-box">
          <strong>{m.title}</strong>
          <p>{m.confirmedCount} of {m.capacity} confirmed · You’re hosting</p>
        </div>
        {m.status === 'CANCELLED' && <Notice role="status">This meal is cancelled. Please cancel or adjust the restaurant reservation yourself. Your group remains open.</Notice>}
        <FormError>{error}</FormError>

        <h2>Requests</h2>
        {!apps.data && !apps.error && <Loading />}
        {apps.error ? <FormError>{errorMessage(apps.error)}</FormError> : null}
        {apps.data && !pending.length && <p className="muted">No requests waiting.</p>}
        {pending.map((a) => (
          <div className="request-card" key={a.id}>
            {applicantLine(a)}
            {typeof a.message === 'string' && <p className="prose">“{a.message}”</p>}
            {actions.has('REVIEW_APPLICATIONS') ? (
              <div className="two-actions">
                <Primary secondary disabled={busyId !== null} onClick={() => { setSheetError(''); setDeclining(a); }}>Decline</Primary>
                <Primary disabled={busyId !== null} onClick={() => void decide(a, 'APPROVE')}>Approve <CheckIcon /></Primary>
              </div>
            ) : <span className="status-tag">Applications are closed</span>}
          </div>
        ))}
        <div className="notice"><InfoCircledIcon /><span>Pending requests don’t take a seat. Approving confirms a seat straight away.</span></div>

        {!!confirmed.length && (
          <>
            <h2>Confirmed guests</h2>
            {confirmed.map((a) => <div key={a.id}>{applicantLine(a)}</div>)}
          </>
        )}
        {!!closed.length && (
          <>
            <h2>Earlier requests</h2>
            {closed.map((a) => (
              <div className="host-line" key={a.id}>
                <div><strong>{a.applicant?.displayName ?? 'Applicant'}</strong><p>Round {a.round}</p></div>
                <span className="status-tag">{applicationLabels[a.state]}</span>
              </div>
            ))}
          </>
        )}
        {apps.data?.nextCursor && <p className="muted">More requests are available; refresh after reviewing these.</p>}

        <h2>Restaurant reservation</h2>
        <p><span className={`status-tag ${booking.tone}`}>{booking.label}</span></p>
        {m.bookingDeclaration?.stale && (
          <Notice>The confirmed guest count changed. Contact the restaurant and update your reservation confirmation.</Notice>
        )}
        {actions.has('DECLARE_BOOKING') && (
          <>
            <ChoiceGroup<DeclarationStatus> label={`Update for ${Math.max(1, m.confirmedCount)} confirmed people, including you`}
              options={BOOKING_DECLARATION_STATUSES.map((s) => [s, DECLARATION_LABELS[s]] as const)} value={declStatus} onChange={setDeclStatus} />
            <p className="muted">This is your report to your guests, not verification by the app.</p>
            <Primary secondary disabled={!declStatus} onClick={() => void declare()}>Update reservation status</Primary>
          </>
        )}

        <h2>Meal arrangements</h2>
        <p className="muted">{m.arrangementLocked
          ? 'The restaurant, time, budget and group size are locked after the first approval. Cancel and create a new meal to change them.'
          : 'You can edit before anyone is approved.'}</p>
        {actions.has('EDIT') && <PrimaryLink secondary to={`/meals/${mealId}/edit`}>Edit arrangements</PrimaryLink>}
        {actions.has('CANCEL') && <Primary secondary onClick={() => { setSheetError(''); setCancelOpen(true); }}>Cancel this meal</Primary>}
        {actions.has('OPEN_GROUP') && meal.data.conversationId && <PrimaryLink secondary to={`/inbox/${meal.data.conversationId}`}>Open meal group <ChatBubbleIcon /></PrimaryLink>}
        {actions.has('POST_MEAL') && <PrimaryLink secondary to={`/post-meal/${mealId}`}>Report attendance and feedback</PrimaryLink>}
      </div>

      <ConfirmSheet open={declining !== null} onOpenChange={(o) => !o && setDeclining(null)} title="Decline this request?"
        confirmLabel="Decline request" keepLabel="Keep reviewing" busy={busyId !== null} error={sheetError}
        onConfirm={() => declining && void decide(declining, 'DECLINE')}>
        <p>{declining?.applicant?.displayName ?? 'They'} won’t be able to apply to this meal again.</p>
      </ConfirmSheet>
      <ConfirmSheet open={cancelOpen} onOpenChange={setCancelOpen} title="Cancel this meal?" confirmLabel="Cancel meal for everyone" error={sheetError}
        onConfirm={() => void cancel()}>
        <p>Cancel {m.title} for everyone. Pending applications will close, and members will be notified. Your group chat stays open. You must cancel the restaurant reservation yourself.</p>
        <ChoiceGroup<CancelReason> label="Reason for cancelling" options={HOST_CANCEL_REASONS.map((r) => [r, REASON_LABELS[r]] as const)} value={reason} onChange={setReason} />
      </ConfirmSheet>
    </>
  );
}
