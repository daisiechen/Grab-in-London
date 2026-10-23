import { useAssistantEditor, useAssistantEditorRevision } from '../assistant/index.ts';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ApiError } from '@fancy/client';
import { LANGUAGES, LIFE_STATUSES } from '@fancy/contracts';
import { ArrowRightIcon, ChatBubbleIcon, LockClosedIcon, PersonIcon } from '@radix-ui/react-icons';
import { useApi } from '../../api/ApiProvider.tsx';
import { useSignedIn } from '../../api/session.tsx';
import { useQuery } from '../../api/useQuery.ts';
import { Intent } from '../../api/webApi.ts';
import { errorMessage } from '../../api/errors.ts';
import type { Application, MealDetail } from '../../api/types.ts';
import { clearDraft, loadDraft, onPrivateStateClear, saveDraft } from '../../lib/drafts.ts';
import { longDate } from '../../lib/format.ts';
import { Avatar, Field, FormError, Loading, PageHeader, Primary, PrimaryLink, TextAction } from '../../ui/components.tsx';
import { ConfirmSheet } from '../../ui/ConfirmSheet.tsx';
import { useToast } from '../../ui/toast.tsx';
import { profileGatePath, useActionGate } from '../auth/gate.ts';
import { applicationLabels } from '../meals/present.ts';

const STATUS_COPY: Record<Application['state'], { title: string; prose: (host: string) => string }> = {
  PENDING: { title: 'Your hello is on its way.', prose: (h) => `${h} will review your introduction. We’ll let you know when there’s an update.` },
  CONFIRMED: { title: 'You’re at the table.', prose: () => 'Everything you need for your meal is in one place.' },
  DECLINED: { title: 'Another table awaits.', prose: () => 'This request is closed. You can discover another meal.' },
  WITHDRAWN: { title: 'Your request is withdrawn.', prose: () => 'This request is closed. You can discover another meal.' },
  EXPIRED: { title: 'Applications have closed.', prose: () => 'This request is closed. You can discover another meal.' },
  CANCELLED: { title: 'Your participation is cancelled.', prose: () => 'This request is closed. You can discover another meal.' },
};

/**
 * Apply / application status (T09). The introduction is a draft that survives sign-in and the
 * profile gate; it is only sent when the user presses Send. Pending requests hold no seat.
 * Withdraw (pending) and leave (confirmed, before start) are confirmed, versioned actions.
 */
export function ApplyPage() {
  const { mealId = '' } = useParams();
  return <ApplicationEditorPage key={mealId} mealId={mealId} />;
}
function ApplicationEditorPage({ mealId }: { mealId: string }) {
  const { api, cache } = useApi();
  const session = useSignedIn();
  const gate = useActionGate();
  const notify = useToast();
  const draftKey = `apply:${mealId}` as const;
  const q = useQuery<MealDetail>(`meal:${mealId}:${session?.user.id ?? 'guest'}`, async (c) => (await c.call('getMeal', { params: { mealId } })).data);
  const [intro, setIntro] = useState(() => loadDraft<{ intro: string }>(draftKey)?.intro ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<'' | 'withdraw' | 'leave'>('');
  const [composeAgain, setComposeAgain] = useState(false);
  const intent = useMemo(() => new Intent(api.retry), [api]);
  const scope = useRef(0);
  useEffect(() => {
    const reset = () => { scope.current++; };
    const unsubscribe = onPrivateStateClear(reset);
    return () => { unsubscribe(); reset(); };
  }, []);

  useEffect(() => { if (intro) saveDraft(draftKey, { intro }); else clearDraft(draftKey); }, [draftKey, intro]);
  const editorVersion = useAssistantEditorRevision(intro);
  const editorAvailable = q.data && !busy && (!q.data.myApplication || composeAgain) && (q.data.meal.allowedActions.includes('APPLY') || (!session && q.data.meal.status === 'OPEN'));
  useAssistantEditor(editorAvailable ? { kind: 'APPLICATION', targetId: mealId, version: editorVersion, text: intro, apply: (candidate) => { if(candidate.text!==null){ setIntro(candidate.text); setError(''); } } } : null);

  if (!q.data) return q.error ? <><PageHeader title="Request a seat" backTo={`/meals/${mealId}`} /><div className="body-pad"><FormError>{errorMessage(q.error)}</FormError></div></> : <Loading />;
  const { meal, myApplication } = q.data;
  const actions = new Set(meal.allowedActions);
  const here = `/meals/${mealId}/apply`;
  const showStatus = myApplication && !composeAgain;
  const afterWrite = async () => {
    cache.delete('myMeals');
    cache.delete('inbox');
    await q.reload();
  };

  const send = async () => {
    const message = intro.trim();
    if (message.length < 20 || message.length > 300) {
      setError('Write an introduction of 20–300 characters.');
      return;
    }
    if (!gate.check(here)) return;
    const generation = scope.current;
    setBusy(true);
    setError('');
    try {
      const body = { message };
      await intent.run(body, (key) => {
        if (generation !== scope.current) throw new Error('Application scope ended');
        return api.client.call('applyMeal', { params: { mealId }, body, idempotencyKey: key });
      });
      if (generation !== scope.current) return;
      clearDraft(draftKey);
      setIntro('');
      setComposeAgain(false);
      notify('Request sent.');
      await afterWrite();
    } catch (e) {
      if (generation !== scope.current) {
        // The triggering 401 still owns sign-in recovery. Old-account replies are
        // converted to STATE_CONFLICT by WebApi and cannot enter this branch.
        if (e instanceof ApiError && e.status === 401) gate.handle(e, here);
        return;
      }
      if (gate.handle(e, here)) return;
      setError(errorMessage(e));
      if (e instanceof ApiError && e.kind === 'conflict') await q.reload();
    } finally {
      if (generation === scope.current) setBusy(false);
    }
  };

  const confirmAction = async () => {
    if (!myApplication) return;
    const generation = scope.current;
    setBusy(true);
    setError('');
    try {
      if (sheet === 'withdraw') {
        await intent.run({ w: myApplication.id, v: myApplication.version }, (key) => {
          if (generation !== scope.current) throw new Error('Application scope ended');
          return api.client.call('withdrawApplication', { params: { applicationId: myApplication.id }, ifMatch: myApplication.version, idempotencyKey: key });
        });
        if (generation !== scope.current) return;
        notify('Request withdrawn.');
      } else {
        await intent.run({ l: meal.id, v: meal.version }, (key) => {
          if (generation !== scope.current) throw new Error('Application scope ended');
          return api.client.call('leaveMeal', { params: { mealId: meal.id }, ifMatch: meal.version, idempotencyKey: key });
        });
        if (generation !== scope.current) return;
        notify('Your place is cancelled. Your group chat stays open.');
      }
      setSheet('');
      await afterWrite();
    } catch (e) {
      if (generation !== scope.current) return;
      setError(errorMessage(e));
      if (e instanceof ApiError && e.kind === 'conflict') await q.reload();
    } finally {
      if (generation === scope.current) setBusy(false);
    }
  };

  const mealSummary = (
    <div className="small-meal">
      <div>
        <strong>{meal.title}</strong>
        <p>{longDate(meal.startsAt.localDate)} · {meal.startsAt.localTime}</p>
        <small>{meal.confirmedCount} of {meal.capacity} confirmed</small>
      </div>
    </div>
  );

  if (showStatus) {
    const copy = STATUS_COPY[myApplication.state];
    return (
      <>
        <PageHeader title="Your application" backTo={`/meals/${mealId}`} />
        <div className="body-pad">
          <div className="state-illustration"><PersonIcon /></div>
          <h1>{copy.title}</h1>
          <p className="prose">{copy.prose(meal.host.displayName)}</p>
          <div className="summary-box">
            <strong>{meal.title}</strong>
            <p>{longDate(meal.startsAt.localDate)} · {meal.startsAt.localTime}</p>
            <span className="status-tag">{applicationLabels[myApplication.state]}</span>
          </div>
          <PrimaryLink secondary to="/inbox">Track in Inbox <ChatBubbleIcon /></PrimaryLink>
          {actions.has('WITHDRAW') && myApplication.state === 'PENDING' && <TextAction onClick={() => setSheet('withdraw')}>Withdraw request</TextAction>}
          {actions.has('LEAVE') && myApplication.state === 'CONFIRMED' && <TextAction danger onClick={() => setSheet('leave')}>Cancel your place</TextAction>}
          {actions.has('APPLY') && <Primary onClick={() => setComposeAgain(true)}>Apply again <ArrowRightIcon /></Primary>}
          {!sheet && <FormError>{error}</FormError>}
        </div>
        <ConfirmSheet open={sheet === 'withdraw'} onOpenChange={(o) => !o && setSheet('')} title="Withdraw your request?"
          confirmLabel="Withdraw request" onConfirm={() => void confirmAction()} busy={busy} error={error}>
          <p>Your host will no longer see this request. You can apply again while applications are open.</p>
        </ConfirmSheet>
        <ConfirmSheet open={sheet === 'leave'} onOpenChange={(o) => !o && setSheet('')} title="Cancel your place?"
          confirmLabel="Cancel my place" onConfirm={() => void confirmAction()} busy={busy} error={error}>
          <p className="prose">Your seat at <strong>{meal.title}</strong> will be released. Your group chat stays open unless you leave it or the host dissolves it.</p>
          <p className="muted">No in-app payment to refund. Let the host know if your plans change.</p>
        </ConfirmSheet>
      </>
    );
  }

  const me = session?.user;
  const canApply = actions.has('APPLY') || (!session && meal.status === 'OPEN');
  return (
    <>
      <PageHeader title="Request a seat" backTo={`/meals/${mealId}`} />
      <div className="body-pad">
        <span className="eyebrow">A GOOD MEAL STARTS WITH HELLO</span>
        <h1>Pull up a chair.</h1>
        <p className="prose">Tell {meal.host.displayName} a little about yourself and why you’d like to join.</p>
        {mealSummary}
        <Field label="Your introduction" hint={`20–300 characters. Your host will see this with your profile. ${intro.length}/300`}>
          {(p) => <textarea {...p} rows={5} maxLength={300} value={intro} onChange={(e) => { setIntro(e.target.value); setError(''); }} />}
        </Field>
        {me && (
          <div className="host-line">
            <Avatar name={me.displayName} size={42} />
            <div>
              <strong>{me.displayName ?? 'Your profile'}</strong>
              <p>{[me.lifeStatus ? LIFE_STATUSES[me.lifeStatus] : '', me.languages.map((l) => LANGUAGES[l]).join(' & ')].filter(Boolean).join(' · ')}</p>
            </div>
            <Link className="text-action" to={profileGatePath(here)}>Edit</Link>
          </div>
        )}
        {me && !me.profileGate.profileComplete && <div className="notice">Complete your profile before applying.</div>}
        <div className="notice"><LockClosedIcon /><span>Applying doesn’t reserve a seat or charge you. Your host reviews each request.</span></div>
        <FormError>{error}</FormError>
        {canApply
          ? <Primary disabled={busy} onClick={() => void send()}>Send request <ArrowRightIcon /></Primary>
          : <p className="muted" role="status">This meal isn’t taking requests right now.</p>}
      </div>
    </>
  );
}
