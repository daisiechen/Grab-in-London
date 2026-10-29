import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { ApiError } from '@fancy/client';
import { LANGUAGES, LIFE_STATUSES } from '@fancy/contracts';
import { ArrowRightIcon, ChevronRightIcon } from '@radix-ui/react-icons';
import { useApi } from '../../api/ApiProvider.tsx';
import { useSignedIn } from '../../api/session.tsx';
import { useQuery } from '../../api/useQuery.ts';
import { Intent } from '../../api/webApi.ts';
import type { Meal, MealDetail } from '../../api/types.ts';
import { clearDraft, loadDraft, saveDraft } from '../../lib/drafts.ts';
import { focusInboxOn } from '../../lib/inboxFocus.ts';
import { Avatar, Field, FormMessage, Loading, Notice, Primary, PrimaryLink, StateBlock, TitleBar } from '../../ui/components.tsx';
import { useToast } from '../../ui/toast.tsx';
import { useDocumentMeta } from '../../seo/useDocumentMeta.ts';
import { mealPath } from '../../seo/meal-seo.ts';
import { useActionGate } from '../auth/gate.ts';
import { VenuePhoto } from '../venues/VenuePhoto.tsx';
import { mealKey } from '../meals/MealDetailPage.tsx';
import { mealActionMessage } from '../meals/messages.ts';
import { cardBudgetLabel, cardWhenLabel, seatsLabel, venueName } from '../meals/present.ts';

export const INTRO_MIN = 20;
export const INTRO_MAX = 300;

/** One-row meal summary linking back to the meal (iOS MealSummary). */
export function MealSummary({ meal }: { meal: Meal }) {
  return (
    <Link to={mealPath(meal)} className="sum" style={{ display: 'flex', gap: 12, alignItems: 'center' }} aria-label={`View ${meal.title}`}>
      <VenuePhoto venueRef={meal.venue.venueRef} placeId={meal.venue.placeId} label={meal.venue.name}>
        {({ image }) => <span style={{ width: 56, height: 56, flex: 'none', display: 'block' }} className="summary-photo">{image}</span>}
      </VenuePhoto>
      <span style={{ flex: 1, minWidth: 0 }}>
        <b style={{ fontSize: 13, display: 'block' }}>{meal.title}</b>
        <span className="muted" style={{ display: 'block' }}>{`${cardWhenLabel(meal.startsAt)} · ${venueName(meal)}`}</span>
        <span className="muted" style={{ display: 'block' }}>{`${cardBudgetLabel(meal)} per person · ${seatsLabel(meal)}`}</span>
      </span>
      <ChevronRightIcon width={16} height={16} aria-hidden="true" />
    </Link>
  );
}

/**
 * Request a seat (iOS ApplyScreen, T09). The introduction is a draft that survives sign-in and the
 * profile gate (this tab only); it is only sent when the member presses Send. Asking holds no seat.
 */
export function ApplyPage() {
  const { mealId = '' } = useParams();
  return <ApplicationEditor key={mealId} mealId={mealId} />;
}

function ApplicationEditor({ mealId }: { mealId: string }) {
  const { api, cache } = useApi();
  const session = useSignedIn();
  const gate = useActionGate();
  const navigate = useNavigate();
  const notify = useToast();
  const draftKey = `apply:${mealId}` as const;
  const q = useQuery<MealDetail>(mealKey(mealId, session?.user.id ?? 'guest'), async (c) => (await c.call('getMeal', { params: { mealId } })).data);
  const [intro, setIntro] = useState(() => loadDraft<{ intro: string }>(draftKey)?.intro ?? '');
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [busy, setBusy] = useState(false);
  const intent = useMemo(() => new Intent(api.retry), [api]);
  useDocumentMeta({ title: 'Request a seat · Fancy', robots: 'noindex, nofollow' });
  useEffect(() => { if (intro) saveDraft(draftKey, { intro }); else clearDraft(draftKey); }, [draftKey, intro]);

  if (!q.data) {
    return (
      <div className="scroll">
        <TitleBar title="Pull up a chair." back={`/meals/${mealId}`} />
        {q.error ? <StateBlock title="We couldn’t load this table." action={<Primary onClick={() => void q.reload()}>Try again</Primary>}>{q.error instanceof ApiError ? mealActionMessage(q.error) : 'Please try again.'}</StateBlock> : <Loading label="Loading meal" />}
      </div>
    );
  }
  const { meal, myApplication } = q.data;
  const here = `/meals/${mealId}/apply`;
  const alreadyIn = myApplication?.state === 'PENDING' || myApplication?.state === 'CONFIRMED';
  if (alreadyIn && !busy) return <Navigate to={`/meals/${mealId}/status`} replace />;
  const canApply = meal.allowedActions.includes('APPLY') || (!session && meal.status === 'OPEN');
  const length = intro.trim().length;
  const me = session?.user;

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const message = intro.trim();
    if (message.length < INTRO_MIN || message.length > INTRO_MAX) { setFieldError(`Write at least 20 characters so ${meal.host.displayName} can get to know you.`); return; }
    if (!gate.check(here)) return;
    setBusy(true);
    setError('');
    try {
      const body = { message };
      await intent.run(body, (key) => api.client.call('applyMeal', { params: { mealId }, body, idempotencyKey: key }));
      clearDraft(draftKey);
      cache.delete('myMeals');
      cache.delete('inbox');
      focusInboxOn(mealId);
      notify(`Request sent to ${meal.host.displayName}`);
      await q.reload();
      navigate(`/meals/${mealId}/status`, { replace: true });
    } catch (e) {
      if (gate.handle(e, here)) return;
      setError(e instanceof ApiError ? mealActionMessage(e) : 'Something went wrong. Please try again.');
      if (e instanceof ApiError && e.kind === 'conflict') await q.reload();
    } finally {
      setBusy(false);
    }
  };

  const about = me ? [me.lifeStatus ? LIFE_STATUSES[me.lifeStatus] : null, me.languages.map((c) => (c === 'zh' ? 'Mandarin' : LANGUAGES[c])).join(' & ') || null].filter(Boolean).join(' · ') : '';
  return (
    <form className="scroll has-footer" onSubmit={(e) => void send(e)} noValidate>
      <TitleBar title="Pull up a chair." subtitle={`${meal.title} · ${cardWhenLabel(meal.startsAt)}`} back={mealPath(meal)} />
      <p className="prose">{`Tell ${meal.host.displayName} a little about yourself and why you’d like to join.`}</p>
      <MealSummary meal={meal} />
      <Field label="Your introduction" required strong error={fieldError || null} hint={`20–300 characters. ${meal.host.displayName} will see this with your profile.`} counter={`${length}/${INTRO_MAX}`}>
        {(p) => <textarea {...p} className="textarea" rows={5} maxLength={INTRO_MAX} placeholder="I’m new to London and would love to meet people over a relaxed meal." value={intro}
          onChange={(e) => { setIntro(e.target.value); setError(''); const n = e.target.value.trim().length; if (n >= INTRO_MIN && n <= INTRO_MAX) setFieldError(''); }} />}
      </Field>
      {me && (
        <div style={{ display: 'flex', gap: 11, alignItems: 'center', margin: '14px 0' }}>
          <Avatar name={me.displayName} url={me.avatarUrl} size={38} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <b style={{ fontSize: 14, display: 'block' }}>{me.displayName ?? 'Your profile'}</b>
            {about && <span className="muted">{about}</span>}
          </div>
          <Link className="link" to="/profile-edit">Edit profile</Link>
        </div>
      )}
      {me && !me.profileGate.profileComplete
        ? <Notice>Complete your profile before applying.</Notice>
        : <Notice>{`Asking is free and holds no seat. If ${meal.host.displayName} says yes, your seat is confirmed and the group chat opens. Everyone pays their own share at the restaurant.`}</Notice>}
      <div className="footer">
        <FormMessage message={error} />
        {canApply
          ? <Primary type="submit" busy={busy}>Send request <ArrowRightIcon aria-hidden="true" /></Primary>
          : <><p className="hint" role="status">This meal isn’t taking requests right now.</p><PrimaryLink to="/discover">Find another table</PrimaryLink></>}
      </div>
    </form>
  );
}
