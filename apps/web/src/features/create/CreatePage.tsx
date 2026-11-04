import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { ApiError } from '@fancy/client';
import { CUISINES, DIETARY, LANGUAGES, MOODS } from '@fancy/contracts';
import { ArrowRightIcon, ChatBubbleIcon, CheckIcon, InfoCircledIcon, SewingPinFilledIcon } from '@radix-ui/react-icons';
import { useApi } from '../../api/ApiProvider.tsx';
import { useSession } from '../../api/session.tsx';
import { useTelemetry } from '../../api/telemetry.tsx';
import type { Meal, Venue } from '../../api/types.ts';
import { Intent } from '../../api/webApi.ts';
import { clearDraft, loadDraft, saveDraft, type DraftKey } from '../../lib/drafts.ts';
import { londonToday, longDate } from '../../lib/london.ts';
import { signInPath } from '../../lib/returnTo.ts';
import { mealPath } from '../../seo/meal-seo.ts';
import { useDocumentMeta } from '../../seo/useDocumentMeta.ts';
import { ChoiceGroup, FormMessage, Loading, Primary, PrimaryLink, TextAction, TitleBar } from '../../ui/components.tsx';
import { Sheet } from '../../ui/Sheet.tsx';
import { useToast } from '../../ui/toast.tsx';
import { isProfileReady, profileGatePath, useActionGate } from '../auth/gate.ts';
import { mealActionMessage } from '../meals/messages.ts';
import { VenuePhoto } from '../venues/VenuePhoto.tsx';
import { CheckRow, CreateLayout, InlineLink, Section, stepHeading } from './CreateLayout.tsx';
import { ArrangeStep, CostsStep, IntroduceStep, Pound } from './steps.tsx';
import { serverValidationMetrics, validationMetric } from './validationMetrics.ts';
import {
  EDIT_FINAL, budgetText, draftFromMeal, newDraft, reservationDeclaration, sameVenue, timeResolution, toCreateBody, toEditBody, updateDraft, validateStep,
  type MealDraft, type Step, type TimeResolution,
} from './model.ts';

/*
 * Create and Edit meal (iOS CreateStepScreen): four steps on their own URLs, so browser Back moves
 * between steps like the iOS stack. Create publishes an external pay-at-venue meal (P-01); Edit
 * saves only what changed (If-Match). London times go to the server as TimeInput; a repeated
 * wall time is answered by an explicit BST/GMT choice and a nonexistent one is an error (P-03).
 */

export type FlowMode = { kind: 'create' } | { kind: 'edit'; mealId: string; base: Meal };
const CREATE_ROUTES = ['/create', '/create/introduce', '/create/costs', '/create/review'] as const;
const stepRoutes = (mode: FlowMode): readonly string[] =>
  mode.kind === 'create' ? CREATE_ROUTES : ['', '/introduce', '/costs', '/review'].map((s) => `/meals/${mode.mealId}/edit${s}`);
export const stepOf = (pathname: string): Step => (pathname.endsWith('/introduce') ? 1 : pathname.endsWith('/costs') ? 2 : pathname.endsWith('/review') ? 3 : 0);
const draftKeyOf = (mode: FlowMode): DraftKey => (mode.kind === 'create' ? 'create' : `edit:${mode.mealId}`);
const hostRoute = (mealId: string) => `/meals/${mealId}/host`;

/** Where to go once the wizard is done; consumed by the wizard's entry page after history goes back to it. */
export const EXIT_KEY = 'wizard:exit';
const displayKey = (venueRef: string) => `venue-display:${venueRef}`;
/** create_started / create_arranged once per business attempt and telemetry generation (memory only). */
const emitted = new Set<string>();

type WizardState = { wizard?: number } | null;

/** Leaves the wizard like iOS dismissAll: back to its entry page, which is then replaced by `to`. */
export function useWizard(mode: FlowMode, step: Step) {
  const location = useLocation();
  const navigate = useNavigate();
  const { cache } = useApi();
  const depth = (location.state as WizardState)?.wizard ?? 0;
  const routes = stepRoutes(mode);
  const goTo = (s: Step) => {
    if (s === step) return;
    if (s > step) navigate(routes[s]!, { state: { wizard: depth + 1 } });
    else if (step - s <= depth) navigate(s - step);
    else navigate(routes[s]!, { replace: true, state: { wizard: Math.max(0, depth - (step - s)) } });
  };
  const exit = (to: string) => {
    if (depth > 0) { cache.set(EXIT_KEY, to); navigate(-depth); } else navigate(to, { replace: true });
  };
  return { goTo, exit };
}

/** Renders nothing while history returns to the entry page, then replaces it with the destination. */
export function PendingExit({ to }: { to: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { cache } = useApi();
  const depth = (location.state as WizardState)?.wizard ?? 0;
  useEffect(() => { if (depth === 0) { cache.delete(EXIT_KEY); navigate(to, { replace: true }); } }, [cache, depth, navigate, to]);
  return null;
}

/** Draft in sessionStorage (identity only) with the restaurant's display data kept in memory. */
function useFlowDraft(mode: FlowMode, initial: () => MealDraft): [MealDraft, (patch: Partial<MealDraft>) => void] {
  const { cache } = useApi();
  const key = draftKeyOf(mode);
  const withDisplay = (d: MealDraft): MealDraft => {
    if (!d.venue || d.venue.name) return d;
    const shown = cache.get<Venue>(displayKey(d.venue.venueRef)) ?? (mode.kind === 'edit' && sameVenue(mode.base.venue, d.venue) ? mode.base.venue : undefined);
    return shown && sameVenue(shown, d.venue) ? { ...d, venue: { ...d.venue, name: shown.name, address: shown.address, location: shown.location, attributions: shown.attributions } } : d;
  };
  const [draft, setDraft] = useState<MealDraft>(() => withDisplay(initial()));
  useEffect(() => { saveDraft(key, draft); }, [key, draft]);
  const update = (patch: Partial<MealDraft>) => {
    if (patch.venue?.name) cache.set(displayKey(patch.venue.venueRef), patch.venue);
    setDraft((d) => updateDraft(d, patch));
  };
  return [draft, update];
}

/** `/create…`: signed-in hosts with a complete profile; everyone else is sent on with a return path. */
export function CreatePage() {
  const { state } = useSession();
  const { cache } = useApi();
  const location = useLocation();
  const step = stepOf(location.pathname);
  useDocumentMeta({ title: `${stepHeading('create', step)} · Fancy`, robots: 'noindex' });
  const pending = cache.get<string>(EXIT_KEY);
  if (pending) return <PendingExit to={pending} />;
  if (state.status === 'loading') return <Loading />;
  if (state.status === 'guest' || !isProfileReady(state.session)) {
    const signedIn = state.status === 'signed-in';
    return (
      <div className="scroll">
        <TitleBar title="Host a meal" back="/discover" />
        <p className="prose">Sign in and complete your profile to host a meal. Anything you’ve started stays in this tab.</p>
        <div className="mt8"><PrimaryLink to={signedIn ? profileGatePath('/create') : signInPath('/create')}>Continue <ArrowRightIcon aria-hidden="true" /></PrimaryLink></div>
      </div>
    );
  }
  return <CreateFlow step={step} />;
}

function CreateFlow({ step }: { step: Step }) {
  const mode = useMemo<FlowMode>(() => ({ kind: 'create' }), []);
  const [draft, update] = useFlowDraft(mode, () => loadDraft<MealDraft>('create') ?? newDraft());
  const telemetry = useTelemetry();
  useEffect(() => {
    const key = `${telemetry.generation}:started:${draft.attemptId}`;
    if (telemetry.enabled && document.visibilityState === 'visible' && !emitted.has(key)) { emitted.add(key); telemetry.emit('create_started', { attemptId: draft.attemptId }); }
  }, [telemetry, draft.attemptId]);
  return <FlowStep key={step} step={step} mode={mode} draft={draft} update={update} />;
}

/** `/meals/:id/edit…` content once the meal has loaded and editing is allowed. */
export function EditFlow({ step, base }: { step: Step; base: Meal }) {
  const mode = useMemo<FlowMode>(() => ({ kind: 'edit', mealId: base.id, base }), [base]);
  const [draft, update] = useFlowDraft(mode, () => {
    const saved = loadDraft<MealDraft>(`edit:${base.id}`);
    // A newer meal version (e.g. after a save) always starts again from the server copy.
    return saved && saved.baseVersion === base.version ? saved : draftFromMeal(base);
  });
  return <FlowStep key={step} step={step} mode={mode} draft={draft} update={update} />;
}

interface FlowProps { step: Step; mode: FlowMode; draft: MealDraft; update: (patch: Partial<MealDraft>) => void }

function FlowStep({ step, mode, draft, update }: FlowProps) {
  const { goTo } = useWizard(mode, step);
  const telemetry = useTelemetry();
  const [failed, setFailed] = useState(false);
  const today = londonToday();
  const creating = mode.kind === 'create';
  if (step === 3) return <Review mode={mode} draft={draft} update={update} today={today} />;

  // After a failed Continue the message follows the draft live: it moves to the next issue or
  // disappears once the step is complete.
  const next = () => {
    const issue = validateStep(draft, step, today, mode.kind);
    if (issue) {
      if (creating) { const properties = validationMetric(draft.attemptId, step, issue); if (properties) telemetry.emit('form_error', properties); }
      setFailed(true);
      return;
    }
    if (step === 0 && creating) arranged(telemetry, draft.attemptId);
    setFailed(false);
    goTo((step + 1) as Step);
  };
  return (
    <CreateLayout kind={mode.kind} step={step} onStep={goTo}
      footer={<><FormMessage message={failed ? validateStep(draft, step, today, mode.kind) : null} /><Primary onClick={next}>Continue <ArrowRightIcon aria-hidden="true" /></Primary></>}>
      {step === 0 ? <ArrangeStep draft={draft} update={update} today={today} /> : null}
      {step === 1 ? <IntroduceStep draft={draft} update={update} /> : null}
      {step === 2 ? <CostsStep draft={draft} update={update} editing={!creating} /> : null}
    </CreateLayout>
  );
}

function arranged(telemetry: ReturnType<typeof useTelemetry>, attemptId: string) {
  const key = `${telemetry.generation}:arranged:${attemptId}`;
  if (telemetry.enabled && document.visibilityState === 'visible' && !emitted.has(key)) { emitted.add(key); telemetry.emit('create_arranged', { attemptId }); }
}

function Review({ mode, draft, update, today }: Omit<FlowProps, 'step'> & { today: string }) {
  const { api, cache } = useApi();
  const telemetry = useTelemetry();
  const notify = useToast();
  const gate = useActionGate();
  const { goTo, exit } = useWizard(mode, 3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [final, setFinal] = useState(false);
  const [time, setTime] = useState<TimeResolution | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const intent = useMemo(() => new Intent(api.retry), [api]);
  const editing = mode.kind === 'edit';

  const handleTimeError = (e: ApiError, d: MealDraft) => {
    const resolution = timeResolution(e);
    if (!resolution) return false;
    if (!editing) telemetry.emit('form_error', { attemptId: d.attemptId, step: 'arrange', field: resolution.target === 'start' ? 'time' : 'closeTime', errorCode: e.code === 'TIME_AMBIGUOUS' ? 'time_ambiguous' : e.code === 'TIME_NONEXISTENT' ? 'time_nonexistent' : 'invalid' });
    setPicked(null);
    setTime(resolution);
    return true;
  };

  const save = async (d: MealDraft, mealId: string, base: Meal) => {
    const issue = validateStep(d, 3, today, 'edit');
    if (issue) return setError(issue);
    const body = toEditBody(d, base);
    if (!body) return setError('You haven’t changed anything yet.');
    setBusy(true);
    setError(null);
    try {
      await intent.run([base.version, body], (key) => api.client.call('editMeal', { params: { mealId }, body, ifMatch: base.version, idempotencyKey: key }));
      clearDraft(`edit:${mealId}`);
      cache.delete(`meal:${mealId}`);
      cache.delete('myMeals');
      notify('Changes saved. Guests see the updated details.');
      exit(hostRoute(mealId));
    } catch (e) {
      if (!(e instanceof ApiError)) return setError('Something went wrong. Please try again.');
      if (handleTimeError(e, d)) return;
      const finalMessage = EDIT_FINAL[e.code];
      if (finalMessage) {
        setFinal(true);
        setError(finalMessage);
        // The guest list shows the lock or cancellation when the host goes back.
        cache.delete(`meal:${mealId}`);
        return;
      }
      if (e.code === 'NOT_FOUND') return setError(body.venueRef ? 'This restaurant can’t be verified right now. Go back and choose it again.' : 'This meal isn’t available any more.');
      setError(e.kind === 'validation' ? 'Some details need another look. Check each step and try again.' : mealActionMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const publish = async (d: MealDraft) => {
    const issue = validateStep(d, 3, today);
    if (issue) {
      const properties = validationMetric(d.attemptId, stepOfIssue(d, today, issue), issue);
      if (properties) telemetry.emit('form_error', properties);
      return setError(issue);
    }
    arranged(telemetry, d.attemptId);
    const body = toCreateBody(d);
    if (!body) return;
    setBusy(true);
    setError(null);
    try {
      const res = await intent.run(body, (key) => api.client.call('createMeal', { body, idempotencyKey: key }));
      clearDraft('create');
      cache.delete('myMeals');
      // The new meal's group chat exists now; the inbox reloads it.
      cache.delete('inbox');
      notify('Meal published.');
      exit(mealPath(res.data));
    } catch (e) {
      if (!(e instanceof ApiError)) return setError('Something went wrong. Please try again.');
      if (handleTimeError(e, d)) return;
      for (const properties of serverValidationMetrics(d.attemptId, e.fieldErrors)) telemetry.emit('form_error', properties);
      if (gate.handle(e, '/create/review')) return;
      if (e.code === 'NOT_FOUND') return setError('This restaurant can’t be verified right now. Go back and choose it again.');
      setError(e.kind === 'validation' ? 'Some details need another look. Check each step and try again.' : mealActionMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const submit = (d: MealDraft) => (mode.kind === 'edit' ? save(d, mode.mealId, mode.base) : publish(d));

  const applyOffset = () => {
    if (!time || time.kind !== 'choose' || picked === null) return;
    const patch: Partial<MealDraft> = time.target === 'start' ? { startOffset: picked, reviewConfirmed: true } : { closeOffset: picked, reviewConfirmed: true };
    const nextDraft = updateDraft(draft, patch);
    update(patch);
    setTime(null);
    void submit(nextDraft);
  };

  const venue = draft.venue;
  const when = draft.date && draft.time ? `${longDate(draft.date)} · ${draft.time} London time${draft.startOffset !== null ? ` (${draft.startOffset === 60 ? 'BST' : 'GMT'})` : ''}` : 'No time chosen';
  const closes = draft.closeDate && draft.closeTime ? `Applications close ${longDate(draft.closeDate)}, ${draft.closeTime}` : 'No deadline chosen';
  const footer = (
    <>
      <FormMessage message={error ?? (time && time.kind !== 'choose' ? time.message : null)} />
      {time && time.kind !== 'choose' ? <TextAction onClick={() => { setTime(null); goTo(0); }}>{time.target === 'start' ? 'Change the meal time' : 'Change the deadline'}</TextAction> : null}
      {final && mode.kind === 'edit' ? <TextAction onClick={() => exit(hostRoute(mode.mealId))}>Back to your guest list</TextAction> : null}
      {/* The required confirmation sits with Publish so it is always visible before publishing. */}
      {editing
        ? <p className="hint">If you change the restaurant, time or group size, update your booking with the restaurant yourself.</p>
        : <CheckRow label="I’ve reviewed the details guests will see." checked={draft.reviewConfirmed} onChange={(reviewConfirmed) => { setError(null); update({ reviewConfirmed }); }} />}
      <Primary busy={busy} disabled={final} onClick={() => void submit(draft)}>
        {editing ? <>Save changes <CheckIcon aria-hidden="true" /></> : <>Publish meal <ArrowRightIcon aria-hidden="true" /></>}
      </Primary>
    </>
  );

  return (
    <CreateLayout kind={mode.kind} step={3} onStep={goTo} footer={footer} tall>
      <Section>
        <h2 className="rtitle">{draft.title || 'Untitled meal'}</h2>
        {draft.description ? <p className="rdesc">{draft.description}</p> : null}
        {/* P-05: undeclared cuisine/dietary shows as “Not provided”, exactly as guests will see it. */}
        <p className="chint">{`Cuisine: ${draft.cuisineCode ? CUISINES[draft.cuisineCode] : 'Not provided'} · Dietary options: ${draft.dietaryCodes.length ? draft.dietaryCodes.map((c) => DIETARY[c]).join(' · ') : 'Not provided'}. Host-reported · not an allergy guarantee.`}</p>
      </Section>

      <ReviewGroup title="Place & time" icon={<SewingPinFilledIcon />} onEdit={() => goTo(0)} editLabel="Edit place and time">
        {venue ? (
          <VenuePhoto venueRef={venue.venueRef} placeId={venue.placeId} label={venue.name}>
            {({ image, attribution }) => (
              <>
                <div className="rplace">
                  <span className="vthumb small">{image}</span>
                  <span className="vtx"><b>{venue.name ?? 'Selected restaurant'}</b><span className="muted">{venue.address ?? 'Choose the restaurant again to refresh its details.'}</span></span>
                </div>
                {attribution}
              </>
            )}
          </VenuePhoto>
        ) : <p className="cunset">No restaurant chosen</p>}
        <p className={draft.date && draft.time ? 'cval' : 'cunset'}>{when}</p>
        <p className="muted">{`${draft.minimum}–${draft.capacity} people including you · ${closes}`}</p>
      </ReviewGroup>

      <ReviewGroup title="The company" icon={<ChatBubbleIcon />} onEdit={() => goTo(1)} editLabel="Edit introduction">
        <p className={draft.mood ? 'cval' : 'cunset'}>{draft.mood ? MOODS[draft.mood] : 'No atmosphere chosen'}</p>
        <p className="muted">{draft.languages.length ? draft.languages.map((l) => LANGUAGES[l]).join(' · ') : 'No language chosen'}</p>
      </ReviewGroup>

      <ReviewGroup title={editing ? 'Costs' : 'Costs & reservation'} icon={<Pound />} onEdit={() => goTo(2)} editLabel={editing ? 'Edit costs' : 'Edit costs and reservation'}>
        <p className="cval">{`${budgetText(draft)} estimated per person`}</p>
        <p className="muted">Everyone pays their own share at the restaurant</p>
        {editing ? null : <p className="chint">{draft.bookingConfirmed ? reservationDeclaration(draft) : 'Reservation not confirmed yet.'}</p>}
      </ReviewGroup>

      <Section title="If plans change" icon={<InfoCircledIcon />} right={<Link className="inl" to="/cancellation-terms">Cancellation terms</Link>}>
        <p className="muted">No in-app payment, so nothing to refund. Before the meal you can cancel for everyone from Your guest list; let the restaurant know yourself.</p>
      </Section>

      <Sheet open={time?.kind === 'choose'} onOpenChange={(o) => { if (!o) setTime(null); }} title="Which time do you mean?">
        <p className="body">{`Clocks go back in London on this date, so ${time?.target === 'close' ? draft.closeTime : draft.time} happens twice. Choose one.`}</p>
        {time?.kind === 'choose' ? (
          <ChoiceGroup<string>
            label="Time zone"
            options={time.choices.map((c) => [String(c.utcOffsetMinutes), `${c.label} · ${c.utcOffsetMinutes === 60 ? 'before' : 'after'} the clocks go back`] as const)}
            value={picked === null ? null : String(picked)}
            onChange={(v) => setPicked(Number(v))}
          />
        ) : null}
        <Primary disabled={picked === null} onClick={applyOffset}>{editing ? 'Save with this time' : 'Publish with this time'}</Primary>
      </Sheet>
    </CreateLayout>
  );
}

/** The step an issue belongs to, for the fixed form_error vocabulary. */
function stepOfIssue(d: MealDraft, today: string, issue: string): Step {
  for (const s of [0, 1, 2] as const) if (validateStep(d, s, today) === issue) return s;
  return 3;
}

/** A Review card: the step cards' style, with an “Edit” link back to its step. */
function ReviewGroup({ title, icon, onEdit, editLabel, children }: { title: string; icon: ReactNode; onEdit: () => void; editLabel: string; children: ReactNode }) {
  return (
    <Section title={title} icon={icon} right={<InlineLink label="Edit" ariaLabel={editLabel} onClick={onEdit} />}>
      <div className="rgroup">{children}</div>
    </Section>
  );
}

