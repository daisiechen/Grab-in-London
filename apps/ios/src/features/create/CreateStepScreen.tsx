import { useAnalyticsPresentation } from '../../analytics/hooks.ts';
import { formErrorProperties, serverFormErrors } from '../../analytics/form-errors.ts';
import { useAssistantContext, useAssistantEditor } from '../assistant/hooks.ts';
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { ActivityIndicator, Keyboard, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ApiError, type ResponseOf, type TimeChoice } from '@fancy/client';
import { CUISINES, DIETARY, MOODS, type CuisineCode, type DietaryCode, type LanguageCode, type MoodCode } from '@fancy/contracts';
import { useServices, useSessionState } from '../../services.tsx';
import type { QueryCache } from '../../api/cache.ts';
import { loadErrorMessage, useQuery } from '../../api/useQuery.ts';
import { SessionScope } from '../auth/SessionScope.tsx';
import { mealKey } from '../meals/MealDetailScreen.tsx';
import { POLICY_VERSION } from '../../config.ts';
import { londonToday, longDate } from '../../lib/london.ts';
import { Primary, TextAction } from '../../ui/Button.tsx';
import { RestaurantPhoto } from '../../ui/RestaurantPhoto.tsx';
import { CheckRow } from '../../ui/CheckRow.tsx';
import { ChoiceGroup, MultiChoice } from '../../ui/ChoiceGroup.tsx';
import { DateChoices } from '../../ui/DateChoices.tsx';
import { Field } from '../../ui/Field.tsx';
import { FormMessage } from '../../ui/FormMessage.tsx';
import { Screen } from '../../ui/Screen.tsx';
import { Sheet } from '../../ui/Sheet.tsx';
import { Body, Heading } from '../../ui/Text.tsx';
import { createStyles } from '../../ui/styles.ts';
import { colors } from '../../ui/tokens.ts';
import { languageOptions } from '../profile/model.ts';
import { toggle } from '../discover/filters.ts';
import { languagesLabel } from '../meals/format.ts';
import { mealActionMessage } from '../meals/messages.ts';
import { rememberReturnTo } from '../auth/intent.ts';
import { CreateLayout, DropPanel, DropTrigger, Hint, InlineLink, NumberChoice, Section, TimeGrid, shared } from './CreateLayout.tsx';
import { VenuePicker } from './VenuePicker.tsx';
import { budgetIssues, deadlineTooLate, draftFromMeal, editBlockedReason, emptyDraft, timeResolution, toCreateBody, toEditBody, updateDraft, validateStep, type CreateDraft, type EditableMeal, type Step, type TimeResolution } from './model.ts';

type Detail = ResponseOf<'getMeal'>['data'];

export const CREATE_DRAFT_KEY = 'create';
/** Edit drafts live under their own per-meal keys, so editing never touches an unpublished new meal. */
export const editDraftKey = (mealId: string) => `edit:${mealId}`;
/** The meal version the edit started from: the diff base and the If-Match version. */
export const editBaseKey = (mealId: string) => `edit:${mealId}:base`;

export type FlowMode = { kind: 'create' } | { kind: 'edit'; mealId: string };
const CREATE_MODE: FlowMode = { kind: 'create' };
const CREATE_ROUTES = ['/create', '/create/introduce', '/create/costs', '/create/review'] as const;
const stepRoutes = (mode: FlowMode): readonly string[] =>
  mode.kind === 'create' ? CREATE_ROUTES : ['', '/introduce', '/costs', '/review'].map((s) => `/meals/${mode.mealId}/edit${s}`);
const draftKeyOf = (mode: FlowMode) => (mode.kind === 'create' ? CREATE_DRAFT_KEY : editDraftKey(mode.mealId));
const hostRoute = (mealId: string) => `/meals/${mealId}/host`;
const SIZES = [2, 3, 4, 5, 6] as const;

/**
 * Starts editing a meal: resumes an unsaved edit of the same meal version, otherwise prefills a fresh
 * draft from the meal (a newer version — e.g. after a save — always starts again from the server copy).
 */
export function startMealEdit(drafts: QueryCache, meal: EditableMeal) {
  const base = drafts.get<EditableMeal>(editBaseKey(meal.id));
  if (base?.version === meal.version && drafts.get(editDraftKey(meal.id))) return;
  drafts.set(editBaseKey(meal.id), meal);
  drafts.set(editDraftKey(meal.id), draftFromMeal(meal));
}

function useFlowDraft(mode: FlowMode): [CreateDraft, (patch: Partial<CreateDraft>) => void] {
  const { drafts, newId } = useServices();
  const key = draftKeyOf(mode);
  const versionKey = `${key}:editor-version`;
  const [fallback] = useState(() => drafts.get<CreateDraft>(key) ?? emptyDraft(newId()));
  const draft = useSyncExternalStore((cb) => drafts.subscribe(cb), () => drafts.get<CreateDraft>(key) ?? fallback);
  useEffect(() => { if (!drafts.get(key)) drafts.set(key, fallback); }, [drafts, fallback, key]);
  const update = (patch: Partial<CreateDraft>) => {
    drafts.set(versionKey, (drafts.get<number>(versionKey) ?? 0) + 1);
    drafts.set(key, updateDraft(drafts.get<CreateDraft>(key) ?? fallback, patch));
  };
  useAssistantEditor({ key, kind: 'CREATE', targetId: null, current: () => ({ text: [draft.title, draft.description].filter(Boolean).join('\n'), version: String(drafts.get<number>(versionKey) ?? 0) }), apply: (d) => { if (d.fields) update({ title: d.fields.title, description: d.fields.description }); } });
  return [draft, update];
}

/** Four-step Create (Arrange / Introduce / Costs / Review); native back keeps the in-memory draft. */
export function CreateStepScreen({ step }: { step: Step }) {
  const state = useSessionState();
  const router = useRouter();
  if (state.status !== 'signedIn' || !state.session.user.profileGate.profileComplete) {
    return (
      <Screen>
        <Heading>Host a meal</Heading>
        <Body>Sign in and complete your profile to host a meal.</Body>
        <Primary label="Continue" onPress={() => { rememberReturnTo('/create'); router.push(state.status === 'signedIn' ? '/profile-setup' : '/sign-in'); }} />
      </Screen>
    );
  }
  return <CreateStep step={step} mode={CREATE_MODE} />;
}

/**
 * Host “Edit meal”: the same four steps prefilled from the meal, saved with editMeal. Only allowed
 * while OPEN, before the deadline and before the first approval (r07); otherwise explains why.
 */
export function EditStepScreen({ step }: { step: Step }) {
  return <SessionScope><EditStep step={step} /></SessionScope>;
}

function EditStep({ step }: { step: Step }) {
  const { mealId } = useLocalSearchParams<{ mealId: string }>();
  const id = String(mealId);
  const { api, drafts, now } = useServices();
  const router = useRouter();
  const detail = useQuery<Detail>(mealKey(id), async () => (await api.call('getMeal', { params: { mealId: id } })).data);
  const ready = useSyncExternalStore((cb) => drafts.subscribe(cb), () => drafts.get(editDraftKey(id)) !== undefined && drafts.get(editBaseKey(id)) !== undefined);
  const meal = detail.data?.meal;
  const blocked = meal ? editBlockedReason(meal, now()) : null;
  // Opened directly (not from the guest list): prefill once the meal has loaded.
  useEffect(() => { if (meal && !blocked && !ready) startMealEdit(drafts, meal); }, [meal, blocked, ready, drafts]);

  if (meal && !blocked && ready) return <CreateStep step={step} mode={{ kind: 'edit', mealId: id }} />;
  return (
    <View style={styles.state} testID="edit-state">
      {blocked ? (
        <>
          <FormMessage message={blocked} />
          <Primary secondary label="Back to your guest list" onPress={() => router.dismissTo(hostRoute(id))} />
        </>
      ) : detail.error ? (
        <>
          <FormMessage message={loadErrorMessage(detail.error)} />
          <Primary secondary label="Try again" onPress={() => void detail.reload()} />
        </>
      ) : <ActivityIndicator accessibilityLabel="Loading your meal" />}
    </View>
  );
}

function CreateStep({ step, mode }: { step: Step; mode: FlowMode }) {
  const services = useServices();
  const router = useRouter();
  const [draft, update] = useFlowDraft(mode);
  const creating = mode.kind === 'create';
  useAnalyticsPresentation('create_started', { attemptId: draft.attemptId }, creating);
  useAssistantContext({ sourcePage: 'CREATE' });
  const [error, setError] = useState<string | null>(null);
  const today = londonToday(services.now());
  const routes = stepRoutes(mode);
  const goTo = (s: Step) => { Keyboard.dismiss(); router.navigate(routes[s]!); };

  if (step === 3) return <Review draft={draft} update={update} today={today} goTo={goTo} mode={mode} />;

  const next = () => {
    Keyboard.dismiss();
    const issue = validateStep(draft, step, today, mode.kind);
    if (issue) {
      if (creating) { const properties = formErrorProperties(draft.attemptId, issue); if (properties) services.analytics.emit('form_error', properties); }
      return setError(issue);
    }
    if (step === 0 && creating) services.analytics.emit('create_arranged', { attemptId: draft.attemptId });
    setError(null);
    router.push(routes[step + 1]!);
  };

  return (
    <CreateLayout
      testID={`create-step-${step}`}
      kind={mode.kind}
      step={step}
      onStep={goTo}
      footer={<><FormMessage message={error} /><Primary label="Continue" icon="ArrowRight" onPress={next} /></>}
    >
      {step === 0 ? <Arrange draft={draft} update={update} today={today} /> : null}
      {step === 1 ? <Introduce draft={draft} update={update} /> : null}
      {step === 2 ? <Costs draft={draft} update={update} editing={!creating} /> : null}
    </CreateLayout>
  );
}

type Part = { draft: CreateDraft; update: (patch: Partial<CreateDraft>) => void };
type Picker = '' | 'date' | 'time' | 'closeDate' | 'closeTime';

function Arrange({ draft, update, today }: Part & { today: string }) {
  const [open, setOpen] = useState<Picker>('');
  const toggleOpen = (p: Picker) => { Keyboard.dismiss(); setOpen(open === p ? '' : p); };
  const guests = draft.capacity - 1;
  return (
    <>
      <VenuePicker draft={draft} update={update} />

      <Section title="Your table">
        <View style={shared.row}>
          <NumberChoice label="People, including you" options={SIZES} value={draft.capacity} onChange={(capacity) => update({ capacity })} />
        </View>
        <View style={shared.row}>
          <NumberChoice label="Minimum people, including you" options={SIZES.filter((n) => n <= draft.capacity)} value={draft.minimum} onChange={(minimum) => update({ minimum })} />
        </View>
        <Hint>{`${guests} guest${guests === 1 ? '' : 's'} + you · friendship-first, at every table size. If fewer than ${draft.minimum} people are confirmed when applications close, the meal is cancelled.`}</Hint>
      </Section>

      <Section title="When">
        <View style={shared.row}>
          <DropTrigger label="Date" icon="Calendar" value={draft.date ? longDate(draft.date) : null} placeholder="Choose a date" open={open === 'date'} onPress={() => toggleOpen('date')} />
          <DropTrigger label="Time" icon="Clock" value={draft.time} placeholder="Choose a time" open={open === 'time'} onPress={() => toggleOpen('time')} />
        </View>
        {open === 'date' ? <DropPanel testID="picker-date"><DateChoices label="Meal date" today={today} selected={draft.date ? [draft.date] : []} onToggle={(date) => { update({ date }); setOpen(draft.time ? '' : 'time'); }} /></DropPanel> : null}
        {open === 'time' ? <DropPanel testID="picker-time"><TimeGrid label="Meal time" value={draft.time} onChange={(time) => { update({ time }); setOpen(''); }} /></DropPanel> : null}
        <Hint>London time. This is your planned meeting time; confirm opening hours and book with the restaurant separately.</Hint>
      </Section>

      <Section title="Applications close">
        <View style={shared.row}>
          <DropTrigger label="Deadline date" icon="Calendar" value={draft.closeDate ? longDate(draft.closeDate) : null} placeholder="Choose a date" open={open === 'closeDate'} onPress={() => toggleOpen('closeDate')} />
          <DropTrigger label="Deadline time" icon="Clock" value={draft.closeTime} placeholder="Choose a time" open={open === 'closeTime'} onPress={() => toggleOpen('closeTime')} />
        </View>
        {open === 'closeDate' ? <DropPanel testID="picker-closeDate"><DateChoices label="Deadline date" today={today} latest={draft.date ?? undefined} selected={draft.closeDate ? [draft.closeDate] : []} onToggle={(closeDate) => { update({ closeDate, closeEdited: true }); setOpen(''); }} /></DropPanel> : null}
        {open === 'closeTime' ? <DropPanel testID="picker-closeTime"><TimeGrid label="Deadline time" value={draft.closeTime} isDisabled={(t) => deadlineTooLate(draft, t)} onChange={(closeTime) => { update({ closeTime, closeEdited: true }); setOpen(''); }} /></DropPanel> : null}
        <Hint>Defaults to an hour before the meal; it must be at least 30 minutes before. At the deadline, applications and approvals stop.</Hint>
      </Section>
    </>
  );
}

function Introduce({ draft, update }: Part) {
  return (
    <>
      <View style={styles.fields}>
        <Field label="Give your meal a name" hint={`5–80 characters · ${draft.title.length}/80`} value={draft.title} onChangeText={(title) => update({ title })} maxLength={80} placeholder="e.g. Friday dinner & new faces" />
        <Field label="What should people expect?" hint={`20–1,000 characters · ${draft.description.length}/1,000`} value={draft.description} onChangeText={(description) => update({ description })} maxLength={1000} multiline placeholder="A relaxed dinner, a shared interest, or simply good company…" />
      </View>
      <View style={styles.fields}>
        <ChoiceGroup<MoodCode> label="Atmosphere" options={Object.entries(MOODS) as Array<[MoodCode, string]>} value={draft.mood} onChange={(mood) => update({ mood })} />
        <MultiChoice<LanguageCode> label="Conversation language" options={languageOptions} values={draft.languages} onToggle={(v) => update({ languages: toggle(draft.languages, v) })} />
        <ChoiceGroup<'NONE' | CuisineCode> label="Cuisine · optional" options={[['NONE', 'Not provided'], ...(Object.entries(CUISINES) as Array<[CuisineCode, string]>)]} value={draft.cuisineCode ?? 'NONE'} onChange={(v) => update({ cuisineCode: v === 'NONE' ? null : v })} />
        <MultiChoice<DietaryCode> label="Dietary options · optional" options={Object.entries(DIETARY) as Array<[DietaryCode, string]>} values={draft.dietaryCodes} onToggle={(v) => update({ dietaryCodes: toggle(draft.dietaryCodes, v) })} />
        <Hint>Host-reported · not an allergy guarantee. Only add what you know about the restaurant; leave blank if you’re not sure.</Hint>
      </View>
    </>
  );
}

export function reservationDeclaration(draft: CreateDraft): string {
  return `I have already booked a table at ${draft.venue?.name ?? 'the restaurant'} for ${draft.capacity} people${draft.date ? ` on ${longDate(draft.date)}` : ''}${draft.time ? ` at ${draft.time} (Europe/London)` : ''}. This is my confirmation, not verification by Fancy.`;
}

const budgetText = (d: CreateDraft) => {
  const [min, max] = [d.budgetMin.trim(), d.budgetMax.trim()];
  // Never echo an invalid range (e.g. “£500–20”) as the estimate; the field errors explain it.
  const issues = budgetIssues(d);
  if ((!min && !max) || issues.min || issues.max) return '—';
  return min && min === max ? `£${min}` : `£${min || '–'}–${max || '–'}`;
};

/** r07: no platform payment, deposit or refund — expected spend per person, paid at the restaurant. */
function Costs({ draft, update, editing }: Part & { editing: boolean }) {
  const budget = budgetIssues(draft);
  return (
    <>
      <Section title="How guests pay">
        <View style={styles.payRow} accessible accessibilityLabel="Pay at the restaurant. Everyone pays their own share at the restaurant. Nothing is collected in the app.">
          <Text style={styles.payGlyph}>£</Text>
          <View style={shared.half}>
            <Text style={shared.strong}>Pay at the restaurant</Text>
            <Text style={shared.muted}>Everyone pays their own share at the restaurant. Nothing is collected in the app.</Text>
          </View>
        </View>
      </Section>
      <Section title="Expected spend">
        <View style={shared.row}>
          <View style={shared.half}><Field label="From / person (£)" accessibilityLabel="Budget from per person in pounds" value={draft.budgetMin} onChangeText={(budgetMin) => update({ budgetMin })} keyboardType="decimal-pad" placeholder="e.g. 20" error={budget.min} /></View>
          <View style={shared.half}><Field label="To / person (£)" accessibilityLabel="Budget to per person in pounds" value={draft.budgetMax} onChangeText={(budgetMax) => update({ budgetMax })} keyboardType="decimal-pad" placeholder="e.g. 35" error={budget.max} /></View>
        </View>
        <View style={[shared.soft, styles.spendRow]}>
          <View style={shared.half}>
            <Text style={shared.body}>Estimated per person</Text>
            <Text style={shared.tiny}>A guide for guests, not a fixed charge.</Text>
          </View>
          <Text style={styles.spendValue}>{budgetText(draft)}</Text>
        </View>
      </Section>
      {/* Edit keeps the booking already reported on the meal; Review reminds the host to update it. */}
      {editing ? null : (
        <Section title="Restaurant reservation" right={<Text style={styles.required} accessibilityLabel="Required to continue">Required</Text>}>
          <Hint>You book the table with the restaurant yourself. Fancy doesn’t reserve tables. Tick to confirm before you continue.</Hint>
          <CheckRow label={reservationDeclaration(draft)} checked={draft.bookingDeclarationConfirmed} onChange={(v) => update({ bookingDeclarationConfirmed: v })} />
        </Section>
      )}
      <Section title="If plans change">
        <Hint>Nothing is paid in the app, so there’s nothing to refund. If you cancel, let the restaurant know yourself; your group chat stays open.</Hint>
      </Section>
    </>
  );
}

/** Save errors after which this edit can’t continue; the way out is back to the guest list. */
const EDIT_FINAL: Record<string, string> = {
  ARRANGEMENT_LOCKED: 'A guest has been approved, so the restaurant, time, budget and group size are locked. Your changes weren’t saved.',
  DEADLINE_PASSED: 'Applications have closed, so this meal can’t be edited any more. Your changes weren’t saved.',
  MEAL_CANCELLED: 'This meal was cancelled, so it can’t be edited. Your changes weren’t saved.',
  VERSION_CONFLICT: 'This meal changed since you started editing. Go back to your guest list and start again.',
  STATE_CONFLICT: 'This meal changed since you started editing. Go back to your guest list and start again.',
  FORBIDDEN: 'Only the host can edit this meal.',
};

function Review({ draft, update, today, goTo, mode }: Part & { today: string; goTo: (s: Step) => void; mode: FlowMode }) {
  const services = useServices();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [final, setFinal] = useState(false);
  const [time, setTime] = useState<TimeResolution | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const intent = useRef<{ key: string; body: string } | null>(null);
  const editing = mode.kind === 'edit';

  /** Same key for retries of the same request; a different body or base version is a new intent. */
  const keyFor = (serialized: string) => {
    if (!intent.current || intent.current.body !== serialized) intent.current = { key: services.newId(), body: serialized };
    return intent.current.key;
  };

  const handleTimeError = (e: ApiError, d: CreateDraft) => {
    const resolution = timeResolution(e);
    if (!resolution) return false;
    if (!editing) services.analytics.emit('form_error', { attemptId: d.attemptId, step: 'arrange', field: resolution.target === 'start' ? 'time' : 'closeTime', errorCode: e.code === 'TIME_AMBIGUOUS' ? 'time_ambiguous' : e.code === 'TIME_NONEXISTENT' ? 'time_nonexistent' : 'invalid' });
    setPicked(null);
    setTime(resolution);
    return true;
  };

  const save = async (d: CreateDraft, mealId: string) => {
    Keyboard.dismiss();
    const issue = validateStep(d, 3, today, 'edit');
    if (issue) return setError(issue);
    const base = services.drafts.get<EditableMeal>(editBaseKey(mealId));
    if (!base) return setError('Something went wrong. Please try again.');
    const body = toEditBody(d, base);
    if (!body) return setError('You haven’t changed anything yet.');
    const idempotencyKey = keyFor(JSON.stringify([base.version, body]));
    setBusy(true);
    setError(null);
    try {
      const updated = (await services.api.call('editMeal', { params: { mealId }, body, idempotencyKey, ifMatch: base.version })).data;
      intent.current = null;
      const cached = services.cache.get<Detail>(mealKey(mealId));
      if (cached) services.cache.set(mealKey(mealId), { ...cached, meal: updated });
      services.cache.invalidate('myMeals:');
      router.dismissTo(hostRoute(mealId));
    } catch (e) {
      if (!(e instanceof ApiError)) return setError('Something went wrong. Please try again.');
      // Business rejections are final for this request; only network/retryable failures reuse the key.
      if (e.kind !== 'network' && !e.retryable) intent.current = null;
      if (handleTimeError(e, d)) return;
      const finalMessage = EDIT_FINAL[e.code];
      if (finalMessage) {
        setFinal(true);
        setError(finalMessage);
        // Refresh the meal so the guest list shows the lock/cancellation when the host goes back.
        void services.api.call('getMeal', { params: { mealId } }).then((r) => services.cache.set(mealKey(mealId), r.data), () => undefined);
        return;
      }
      if (e.code === 'NOT_FOUND') return setError(body.venueRef ? 'This restaurant can’t be verified right now. Go back and choose it again.' : 'This meal isn’t available any more.');
      setError(e.kind === 'validation' ? 'Some details need another look. Check each step and try again.' : mealActionMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const publish = async (d: CreateDraft) => {
    Keyboard.dismiss();
    const issue = validateStep(d, 3, today);
    if (issue) { const properties = formErrorProperties(d.attemptId, issue); if (properties) services.analytics.emit('form_error', properties); return setError(issue); }
    services.analytics.emit('create_arranged', { attemptId: d.attemptId });
    const body = toCreateBody(d, POLICY_VERSION);
    const idempotencyKey = keyFor(JSON.stringify(body));
    setBusy(true);
    setError(null);
    try {
      const meal = (await services.api.call('createMeal', { body, idempotencyKey })).data;
      intent.current = null;
      services.drafts.delete(CREATE_DRAFT_KEY);
      services.cache.invalidate('myMeals:');
      router.replace(`/meals/${meal.id}`);
    } catch (e) {
      if (!(e instanceof ApiError)) return setError('Something went wrong. Please try again.');
      if (handleTimeError(e, d)) return;
      for (const properties of serverFormErrors(d.attemptId, e.fieldErrors)) services.analytics.emit('form_error', properties);
      if (e.code === 'PROFILE_INCOMPLETE') {
        rememberReturnTo('/create/review');
        router.push('/profile-setup');
        return;
      }
      if (e.code === 'NOT_FOUND') return setError('This restaurant can’t be verified right now. Go back and choose it again.');
      setError(e.kind === 'validation' ? 'Some details need another look. Check each step and try again.' : mealActionMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const submit = (d: CreateDraft) => (mode.kind === 'edit' ? save(d, mode.mealId) : publish(d));

  const applyOffset = () => {
    if (!time || time.kind !== 'choose' || picked === null) return;
    const patch: Partial<CreateDraft> = time.target === 'start' ? { startOffset: picked, reviewConfirmed: true } : { closeOffset: picked, reviewConfirmed: true };
    const nextDraft = updateDraft(draft, patch);
    update(patch);
    setTime(null);
    void submit(nextDraft);
  };

  const when = draft.date && draft.time ? `${longDate(draft.date)} · ${draft.time} London time${draft.startOffset !== null ? ` (${draft.startOffset === 60 ? 'BST' : 'GMT'})` : ''}` : 'No time chosen';
  const closes = draft.closeDate && draft.closeTime ? `Applications close ${longDate(draft.closeDate)}, ${draft.closeTime}` : 'No deadline chosen';
  const footer = (
    <>
      <FormMessage message={error ?? (time && time.kind !== 'choose' ? time.message : null)} />
      {time && time.kind !== 'choose' ? <TextAction label={time.target === 'start' ? 'Change the meal time' : 'Change the deadline'} onPress={() => { setTime(null); goTo(0); }} /> : null}
      {final && mode.kind === 'edit' ? <TextAction label="Back to your guest list" onPress={() => router.dismissTo(hostRoute(mode.mealId))} /> : null}
      {/* Required confirmation sits with Publish so it is always visible before publishing. */}
      {editing
        ? <Hint>If you change the restaurant, time or group size, update your booking with the restaurant yourself.</Hint>
        : <CheckRow label="I’ve reviewed the details guests will see." checked={draft.reviewConfirmed} onChange={(v) => update({ reviewConfirmed: v })} />}
      <Primary label={editing ? 'Save changes' : 'Publish meal'} icon={editing ? 'Check' : 'ArrowRight'} busy={busy} disabled={final} onPress={() => void submit(draft)} />
    </>
  );
  return (
    <CreateLayout testID="create-step-3" kind={mode.kind} step={3} onStep={goTo} footer={footer}>
      <View style={styles.review}>
        <Text style={styles.eyebrow}>{editing ? 'YOUR TABLE' : 'YOUR NEW TABLE'}</Text>
        <Text style={styles.reviewTitle}>{draft.title || 'Untitled meal'}</Text>
        {draft.description ? <Text style={shared.body} numberOfLines={4}>{draft.description}</Text> : null}
        {/* P-05 (owner decision): undeclared cuisine/dietary shows as “Not provided”, exactly as guests will see it. */}
        <Text style={shared.tiny}>{`Cuisine: ${draft.cuisineCode ? CUISINES[draft.cuisineCode] : 'Not provided'} · Dietary options: ${draft.dietaryCodes.length ? draft.dietaryCodes.map((c) => DIETARY[c]).join(' · ') : 'Not provided'}. Host-reported · not an allergy guarantee.`}</Text>

        <ReviewGroup title="Place & time" onEdit={() => goTo(0)} editLabel="Edit place and time">
          {draft.venue ? (
            <RestaurantPhoto venueRef={draft.venue.venueRef} placeId={draft.venue.placeId} name={draft.venue.name} fill>
              {({ image, attribution }) => (
                <>
                  <View style={styles.placeRow}>
                    <View style={styles.thumb}>{image}</View>
                    <View style={shared.half}>
                      <Text style={shared.strong} numberOfLines={1}>{draft.venue!.name}</Text>
                      <Text style={shared.muted} numberOfLines={2}>{draft.venue!.address}</Text>
                    </View>
                  </View>
                  {attribution}
                </>
              )}
            </RestaurantPhoto>
          ) : <Text style={shared.body}>No restaurant chosen</Text>}
          <Text style={shared.body}>{when}</Text>
          <Text style={shared.muted}>{`${draft.minimum}–${draft.capacity} people including you · ${closes}`}</Text>
        </ReviewGroup>

        <ReviewGroup title="The company" onEdit={() => goTo(1)} editLabel="Edit introduction">
          <Text style={shared.body}>{draft.mood ? MOODS[draft.mood] : 'No atmosphere chosen'}</Text>
          <Text style={shared.muted}>{draft.languages.length ? languagesLabel(draft.languages) : 'No language chosen'}</Text>
        </ReviewGroup>

        <ReviewGroup title={editing ? 'Costs' : 'Costs & reservation'} onEdit={() => goTo(2)} editLabel={editing ? 'Edit costs' : 'Edit costs and reservation'}>
          <Text style={shared.body}>{`${budgetText(draft)} estimated per person`}</Text>
          <Text style={shared.muted}>Everyone pays their own share at the restaurant</Text>
          {editing ? null : <Text style={shared.tiny}>{draft.bookingDeclarationConfirmed ? reservationDeclaration(draft) : 'Reservation not confirmed yet.'}</Text>}
        </ReviewGroup>
      </View>
      <View style={[shared.soft, styles.terms]}>
        <Text style={shared.strong}>If plans change</Text>
        <Text style={shared.muted}>No in-app payment, so nothing to refund. Before the meal you can cancel for everyone from Your guest list; let the restaurant know yourself.</Text>
        <View style={styles.termsLink}><TextAction label="Cancellation terms" onPress={() => router.push('/cancellation-terms')} /></View>
      </View>
      <Sheet visible={time?.kind === 'choose'} title="Which time do you mean?" onClose={() => setTime(null)}>
        <Body>{`Clocks go back in London on this date, so ${time?.target === 'close' ? draft.closeTime : draft.time} happens twice. Choose one.`}</Body>
        {time?.kind === 'choose' ? (
          <ChoiceGroup<string>
            label="Time zone"
            options={time.choices.map((c: TimeChoice) => [String(c.utcOffsetMinutes), `${c.label} · ${c.utcOffsetMinutes === 60 ? 'before' : 'after'} the clocks go back`] as const)}
            value={picked === null ? null : String(picked)}
            onChange={(v) => setPicked(Number(v))}
          />
        ) : null}
        <Primary label={editing ? 'Save with this time' : 'Publish with this time'} disabled={picked === null} onPress={applyOffset} />
      </Sheet>
    </CreateLayout>
  );
}

function ReviewGroup({ title, onEdit, editLabel, children }: { title: string; onEdit: () => void; editLabel: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <View style={styles.groupHead}>
        <Text accessibilityRole="header" style={styles.groupTitle}>{title}</Text>
        <InlineLink label="Edit" accessibilityLabel={editLabel} onPress={onEdit} />
      </View>
      {children}
    </View>
  );
}

const styles = createStyles({
  fields: { gap: 14, marginTop: 14 },
  payRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  payGlyph: { width: 16, textAlign: 'center', fontSize: 15, lineHeight: 18, fontWeight: '700', color: colors.forest },
  spendRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  spendValue: { fontSize: 16, fontWeight: '700', color: colors.forest },
  review: { marginTop: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 12, gap: 4 },
  eyebrow: { fontSize: 9, letterSpacing: 1.3, color: '#647a6b', fontWeight: '700' },
  reviewTitle: { fontSize: 17, lineHeight: 22, fontWeight: '700', color: colors.ink },
  group: { borderTopWidth: 1, borderTopColor: colors.line, marginTop: 10, paddingTop: 10, gap: 4 },
  groupHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  groupTitle: { fontSize: 13, fontWeight: '700', color: colors.ink },
  placeRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  thumb: { width: 48, height: 48, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.surface },
  terms: { marginTop: 12 },
  termsLink: { alignItems: 'flex-start' },
  state: { flex: 1, padding: 18, gap: 12, backgroundColor: colors.white },
  required: { fontSize: 11, fontWeight: '700', color: colors.forest },
});
