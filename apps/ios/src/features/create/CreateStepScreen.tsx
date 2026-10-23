import {NativeMap} from '../maps/NativeMap.tsx';
import { useAnalyticsPresentation } from '../../analytics/hooks.ts';
import { formErrorProperties,serverFormErrors } from '../../analytics/form-errors.ts';
import {useAssistantContext,useAssistantEditor} from '../assistant/hooks.ts';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Keyboard, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ApiError, IntentTracker, IntentUnresolvedError, type ResponseOf, type TimeChoice } from '@fancy/client';
import { CUISINES, DIETARY, MOODS, type CuisineCode, type DietaryCode, type LanguageCode, type MoodCode } from '@fancy/contracts';
import { useServices, useSessionState } from '../../services.tsx';
import { POLICY_VERSION } from '../../config.ts';
import { HALF_HOUR_SLOTS, londonToday, longDate } from '../../lib/london.ts';
import { Primary, TextAction } from '../../ui/Button.tsx';
import {RestaurantPhoto} from '../../ui/RestaurantPhoto.tsx';
import { CheckRow } from '../../ui/CheckRow.tsx';
import { ChoiceGroup, MultiChoice } from '../../ui/ChoiceGroup.tsx';
import { DateChoices } from '../../ui/DateChoices.tsx';
import { Field } from '../../ui/Field.tsx';
import { FormMessage } from '../../ui/FormMessage.tsx';
import { Screen } from '../../ui/Screen.tsx';
import { Sheet } from '../../ui/Sheet.tsx';
import { Body, Eyebrow, Heading, SectionTitle } from '../../ui/Text.tsx';
import { languageOptions } from '../profile/model.ts';
import { toggle } from '../discover/filters.ts';
import { mealActionMessage } from '../meals/messages.ts';
import { rememberReturnTo } from '../auth/intent.ts';
import { STEPS, emptyDraft, timeResolution, toCreateBody, updateDraft, validateStep, type CreateDraft, type Step, type TimeResolution, type VenueChoice } from './model.ts';

export const CREATE_DRAFT_KEY = 'create';
const STEP_ROUTES = ['/create', '/create/introduce', '/create/costs', '/create/review'] as const;
const SIZES = [2, 3, 4, 5, 6] as const;
type Candidate = ResponseOf<'searchVenues'>['data'][number];

function useCreateDraft(): [CreateDraft, (patch: Partial<CreateDraft>) => void] {
  const { drafts, newId } = useServices();
  const [fallback]=useState(()=>emptyDraft(newId()));
  const draft=useSyncExternalStore(cb=>drafts.subscribe(cb),()=>drafts.get<CreateDraft>(CREATE_DRAFT_KEY)??fallback);
  useEffect(()=>{if(!drafts.get(CREATE_DRAFT_KEY))drafts.set(CREATE_DRAFT_KEY,fallback);},[drafts,fallback]);
  const update=(patch:Partial<CreateDraft>)=>{
    drafts.set('create:editor-version',(drafts.get<number>('create:editor-version')??0)+1);
    drafts.set(CREATE_DRAFT_KEY,updateDraft(drafts.get<CreateDraft>(CREATE_DRAFT_KEY)??fallback,patch));
  };
  useAssistantEditor({key:'create',kind:'CREATE',targetId:null,current:()=>({text:[draft.title,draft.description].filter(Boolean).join('\n'),version:String(drafts.get<number>('create:editor-version')??0)}),apply:d=>{if(d.fields)update({title:d.fields.title,description:d.fields.description});}});
  return [draft,update];
}

/** Four-step Create (Arrange / Introduce / Costs / Review); native back keeps the in-memory draft. */
export function CreateStepScreen({ step }: { step: Step }) {
  const state = useSessionState();
  const router = useRouter();
  if (state.status !== 'signedIn' || !state.session.user.profileGate.profileComplete) {
    return (
      <Screen>
        <Body>Sign in and complete your profile to host a meal.</Body>
        <Primary label="Continue" onPress={() => { rememberReturnTo('/create'); router.push(state.status === 'signedIn' ? '/profile-setup' : '/sign-in'); }} />
      </Screen>
    );
  }
  return <CreateStep step={step} />;
}

function CreateStep({ step }: { step: Step }) {
  const services = useServices();
  const router = useRouter();
  const [draft, update] = useCreateDraft();
  useAnalyticsPresentation('create_started',{attemptId:draft.attemptId},true);
  useAssistantContext({sourcePage:'CREATE'});
  const [error, setError] = useState<string | null>(null);
  const today = londonToday(services.now());

  const next = () => {
    Keyboard.dismiss();
    const issue = validateStep(draft, step, today);
    if (issue) {const properties=formErrorProperties(draft.attemptId,issue);if(properties)services.analytics.emit('form_error',properties);return setError(issue);}
    if(step===0)services.analytics.emit('create_arranged',{attemptId:draft.attemptId});
    setError(null);
    router.push(STEP_ROUTES[(step + 1) as 1 | 2 | 3]);
  };

  return (
    <Screen testID={`create-step-${step}`} footer={step < 3 ? <Primary label="Continue" onPress={next} /> : undefined}>
      <Eyebrow>{`STEP ${step + 1} OF 4 · ${STEPS[step].toUpperCase()}`}</Eyebrow>
      {step === 0 ? <Arrange draft={draft} update={update} today={today} /> : null}
      {step === 1 ? <Introduce draft={draft} update={update} /> : null}
      {step === 2 ? <Costs draft={draft} update={update} /> : null}
      {step === 3 ? <Review draft={draft} update={update} today={today} /> : null}
      <FormMessage message={error} />
    </Screen>
  );
}

type Part = { draft: CreateDraft; update: (patch: Partial<CreateDraft>) => void };

function VenuePicker({ draft, update }: Part) {
  const { api, newId } = useServices();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Candidate[] | null>(null);
  const [issue, setIssue] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [mapReady,setMapReady]=useState(false);
  useAnalyticsPresentation('map_opened',{},mapReady&&!!results?.some(candidate=>candidate.location));
  const confirmKeys = useRef(new Map<string, string>());

  const search = async () => {
    setMapReady(false);
    const term = q.trim();
    if (!term) return;
    setIssue(null);
    try {
      setResults((await api.call('searchVenues', { query: { q: term.slice(0, 120) } })).data);
    } catch (e) {
      setResults(null);
      setIssue(e instanceof ApiError && e.kind === 'unavailable' ? 'Restaurant search is temporarily unavailable. Please try again shortly.' : 'We couldn’t search restaurants. Check your connection and try again.');
    }
  };

  const choose = async (c: Candidate) => {
    setBusy(c.placeId);
    setIssue(null);
    if (!confirmKeys.current.has(c.placeId)) confirmKeys.current.set(c.placeId, newId());
    try {
      const v = (await api.call('confirmVenue', { body: { placeId: c.placeId }, idempotencyKey: confirmKeys.current.get(c.placeId)! })).data;
      if (!v.available) {
        setIssue('This restaurant can’t be verified right now. Choose another.');
      } else {
        const choice: VenueChoice = { venueRef: v.venueRef, placeId: v.placeId, name: v.name??c.name, address: v.address ?? c.address, attribution: c.attributions.map((a) => a.text).join(' · ') };
        update({ venue: choice });
        setMapReady(false);
        setResults(null);
      }
    } catch (e) {
      setIssue(e instanceof ApiError && e.kind === 'not_found' ? 'This restaurant can’t be verified right now. Choose another.' : 'We couldn’t confirm this restaurant. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ gap: 10 }}>
      <SectionTitle>Restaurant</SectionTitle>
      {draft.venue ? (
        <View accessibilityLabel={`Selected restaurant ${draft.venue.name}`}>
          <Body>{draft.venue.name}</Body>
          <Body muted>{draft.venue.address}</Body>
          {draft.venue.attribution ? <Body muted>{draft.venue.attribution}</Body> : null}
        </View>
      ) : null}
      <Field label="Search restaurants" value={q} onChangeText={setQ} returnKeyType="search" onSubmitEditing={() => void search()} placeholder="Name or area" />
      <Primary secondary label="Search" onPress={() => void search()} />
      <FormMessage message={issue} />
      {results?.length === 0 ? <Body muted>No restaurants found. Try another name. Your current choice is kept.</Body> : null}
      {results?.length?<Body muted>Google Maps</Body>:null}
      {results?.some(c=>c.location)?<NativeMap label="Restaurant choices" points={results.flatMap(c=>c.location?[{id:c.placeId,title:c.name,lat:c.location.lat,lng:c.location.lng,attributions:c.attributions.map(a=>a.text)}]:[])} onSelect={id=>{const candidate=results.find(c=>c.placeId===id);if(candidate&&busy===null)void choose(candidate);}} onReady={()=>setMapReady(true)}/>:null}
      {results?.map((c) => (
        <View key={c.placeId} style={{ gap: 2 }}>
          <Primary secondary label={`Choose ${c.name}`} busy={busy === c.placeId} disabled={busy !== null} onPress={() => void choose(c)} />
          <Body muted>{c.address}</Body>
          {c.attributions.map((a, i) => <Body key={i} muted>{a.text}</Body>)}
        </View>
      ))}
      <Body muted>Choosing a restaurant here doesn’t reserve a table.</Body>
    </View>
  );
}

function TimeSlots({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <ChoiceGroup<string> label={label} options={HALF_HOUR_SLOTS.map((t) => [t, t] as const)} value={value} onChange={onChange} />
    </ScrollView>
  );
}

function Arrange({ draft, update, today }: Part & { today: string }) {
  return (
    <View style={{ gap: 16 }}>
      <Heading>Arrange your table</Heading>
      <VenuePicker draft={draft} update={update} />
      <DateChoices label="Date" today={today} selected={draft.date ? [draft.date] : []} onToggle={(date) => update({ date })} />
      <TimeSlots label="Time" value={draft.time} onChange={(time) => update({ time })} />
      <Body muted>London time. This is your planned meeting time; confirm opening hours and book with the restaurant separately.</Body>
      <ChoiceGroup<string> label="People, including you" options={SIZES.map((n) => [String(n), String(n)] as const)} value={String(draft.capacity)} onChange={(v) => update({ capacity: Number(v) })} />
      <ChoiceGroup<string> label="Minimum people, including you" options={SIZES.filter((n) => n <= draft.capacity).map((n) => [String(n), String(n)] as const)} value={String(draft.minimum)} onChange={(v) => update({ minimum: Number(v) })} />
      <SectionTitle>Applications close</SectionTitle>
      <DateChoices label="Deadline date" today={today} selected={draft.closeDate ? [draft.closeDate] : []} onToggle={(closeDate) => update({ closeDate, closeEdited: true })} />
      <TimeSlots label="Deadline time" value={draft.closeTime} onChange={(closeTime) => update({ closeTime, closeEdited: true })} />
      <Body muted>Defaults to an hour before the meal; it must be at least 30 minutes before.</Body>
    </View>
  );
}

function Introduce({ draft, update }: Part) {
  return (
    <View style={{ gap: 16 }}>
      <Heading>Introduce your meal</Heading>
      <Field label="Give your meal a name" value={draft.title} onChangeText={(title) => update({ title })} maxLength={80} placeholder="e.g. Friday dinner & new faces" />
      <Field label="What should people expect?" value={draft.description} onChangeText={(description) => update({ description })} maxLength={1000} multiline placeholder="A relaxed dinner, a shared interest, or simply good company…" />
      <ChoiceGroup<MoodCode> label="Atmosphere" options={Object.entries(MOODS) as Array<[MoodCode, string]>} value={draft.mood} onChange={(mood) => update({ mood })} />
      <MultiChoice<LanguageCode> label="Conversation language" options={languageOptions} values={draft.languages} onToggle={(v) => update({ languages: toggle(draft.languages, v) })} />
      <ChoiceGroup<'NONE' | CuisineCode> label="Cuisine (optional)" options={[['NONE', 'Not provided'], ...(Object.entries(CUISINES) as Array<[CuisineCode, string]>)]} value={draft.cuisineCode ?? 'NONE'} onChange={(v) => update({ cuisineCode: v === 'NONE' ? null : v })} />
      <MultiChoice<DietaryCode> label="Dietary options (optional)" options={Object.entries(DIETARY) as Array<[DietaryCode, string]>} values={draft.dietaryCodes} onToggle={(v) => update({ dietaryCodes: toggle(draft.dietaryCodes, v) })} />
      <Body muted>Only add what you know about the restaurant. Leave blank if you’re not sure.</Body>
    </View>
  );
}

function reservationDeclaration(draft: CreateDraft): string {
  return `I have already booked a table at ${draft.venue?.name ?? 'the restaurant'} for ${draft.capacity} people${draft.date ? ` on ${longDate(draft.date)}` : ''}${draft.time ? ` at ${draft.time} (Europe/London)` : ''}. This is my confirmation, not verification by Fancy.`;
}

function Costs({ draft, update }: Part) {
  return (
    <View style={{ gap: 16 }}>
      <Heading>Keeping costs clear</Heading>
      <Field label="Budget from / person (£)" value={draft.budgetMin} onChangeText={(budgetMin) => update({ budgetMin })} keyboardType="decimal-pad" placeholder="20" />
      <Field label="Budget to / person (£)" value={draft.budgetMax} onChangeText={(budgetMax) => update({ budgetMax })} keyboardType="decimal-pad" placeholder="35" />
      <SectionTitle>How guests pay</SectionTitle>
      <Body>Pay at the restaurant. Fancy doesn’t take payments or deposits.</Body>
      <SectionTitle>Restaurant reservation</SectionTitle>
      <CheckRow label={reservationDeclaration(draft)} checked={draft.bookingDeclarationConfirmed} onChange={(v) => update({ bookingDeclarationConfirmed: v })} />
    </View>
  );
}

function Review({ draft, update, today }: Part & { today: string }) {
  const services = useServices();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [time, setTime] = useState<TimeResolution | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const tracker = useMemo(() => new IntentTracker(services.newId), [services]);
  const [unknown, setUnknown] = useState(false);
  // Session end and unmount fence any late publish result (no navigation for an old session).
  useEffect(() => {
    const reset = () => tracker.reset();
    services.onSessionEnd.add(reset);
    return () => { services.onSessionEnd.delete(reset); tracker.reset(); };
  }, [tracker, services]);
  const latest = useRef<CreateDraft>(draft);
  latest.current = draft;

  const published = (mealId: string | null) => {
    setUnknown(false);
    services.drafts.delete(CREATE_DRAFT_KEY);
    services.cache.invalidate('myMeals:');
    router.replace(mealId ? `/meals/${mealId}` : '/meals');
  };

  /** Unknown publish: read the original intent's receipt; never mint a second create. */
  const checkPublish = async () => {
    setBusy(true); setError(null);
    const generation = tracker.generation;
    try {
      const outcome = await tracker.reconcile(services.api, 'createMeal');
      if (generation !== tracker.generation) return;
      if (outcome === 'saved') return published(tracker.lastReceipt?.resourceId ?? null);
      if (outcome === 'resend') { setBusy(false); return void publish(latest.current); }
      if (outcome === 'rejected' || outcome === 'conflict' || outcome === 'expired') { setUnknown(false); return setError('That publish wasn’t accepted. Your draft is kept; review it and publish again.'); }
      setError('Still no confirmed result. Your draft is kept; check again shortly.');
    } finally { if (generation === tracker.generation) setBusy(false); }
  };

  const publish = async (d: CreateDraft) => {
    Keyboard.dismiss();
    const issue = validateStep(d, 3, today);
    if (issue) {const properties=formErrorProperties(d.attemptId,issue);if(properties)services.analytics.emit('form_error',properties);return setError(issue);}
    services.analytics.emit('create_arranged',{attemptId:d.attemptId});
    const body = toCreateBody(d, POLICY_VERSION);
    setBusy(true);
    setError(null);
    const generation = tracker.generation;
    try {
      const meal = (await tracker.run(body, (idempotencyKey) => services.api.call('createMeal', { body, idempotencyKey }))).data;
      if (generation !== tracker.generation) return;
      published(meal.id);
    } catch (e) {
      if (generation !== tracker.generation) return;
      if (e instanceof IntentUnresolvedError) return setError('Your earlier publish hasn’t been confirmed yet. Check its status before publishing changes.');
      if (tracker.pending) { setUnknown(true); return setError('Status unknown: we couldn’t confirm whether your meal was published. Your draft is kept.'); }
      if (!(e instanceof ApiError)) return setError('Something went wrong. Please try again.');
      const resolution = timeResolution(e);
      if(resolution)services.analytics.emit('form_error',{attemptId:d.attemptId,step:'arrange',field:resolution.target==='start'?'time':'closeTime',errorCode:e.code==='TIME_AMBIGUOUS'?'time_ambiguous':e.code==='TIME_NONEXISTENT'?'time_nonexistent':'invalid'});
      else for(const properties of serverFormErrors(d.attemptId,e.fieldErrors))services.analytics.emit('form_error',properties);
      if (resolution) {
        setPicked(null);
        setTime(resolution);
        return;
      }
      if (e.code === 'PROFILE_INCOMPLETE') {
        rememberReturnTo('/create/review');
        router.push('/profile-setup');
        return;
      }
      if (e.code === 'NOT_FOUND') return setError('This restaurant can’t be verified right now. Go back and choose it again.');
      setError(e.kind === 'validation' ? 'Some details need another look. Check each step and try again.' : mealActionMessage(e));
    } finally {
      if (generation === tracker.generation) setBusy(false);
    }
  };

  const applyOffset = () => {
    if (!time || time.kind !== 'choose' || picked === null) return;
    const patch: Partial<CreateDraft> = time.target === 'start' ? { startOffset: picked, reviewConfirmed: true } : { closeOffset: picked, reviewConfirmed: true };
    const nextDraft = updateDraft(draft, patch);
    update(patch);
    setTime(null);
    void publish(nextDraft);
  };

  const edit = (s: Step) => router.navigate(STEP_ROUTES[s]);
  return (
    <View style={{ gap: 14 }}>
      <Heading>Review your meal</Heading>
      <SectionTitle>Arrange</SectionTitle>
      {draft.venue?<RestaurantPhoto venueRef={draft.venue.venueRef} placeId={draft.venue.placeId} name={draft.venue.name}/>:null}
      <Body>{draft.venue?.name ?? 'No restaurant chosen'}</Body>
      <Body>{draft.date && draft.time ? `${longDate(draft.date)} · ${draft.time} London time${draft.startOffset !== null ? ` (${draft.startOffset === 60 ? 'BST' : 'GMT'})` : ''}` : 'No time chosen'}</Body>
      <Body>{`${draft.minimum}–${draft.capacity} people including you`}</Body>
      <Body>{draft.closeDate && draft.closeTime ? `Applications close ${longDate(draft.closeDate)} · ${draft.closeTime}` : ''}</Body>
      <TextAction label="Edit arrangement" onPress={() => edit(0)} />
      <SectionTitle>Introduce</SectionTitle>
      <Body>{draft.title}</Body>
      <Body muted>{draft.description}</Body>
      <Body>{`Cuisine: ${draft.cuisineCode ? CUISINES[draft.cuisineCode] : 'Not provided'} · Dietary: ${draft.dietaryCodes.length ? draft.dietaryCodes.map((c) => DIETARY[c]).join(' · ') : 'Not provided'}`}</Body>
      <TextAction label="Edit introduction" onPress={() => edit(1)} />
      <SectionTitle>Costs</SectionTitle>
      <Body>{`£${draft.budgetMin}–£${draft.budgetMax} per person · Pay at the restaurant`}</Body>
      <Body>{draft.bookingDeclarationConfirmed ? reservationDeclaration(draft) : 'Reservation not confirmed yet.'}</Body>
      <TextAction label="Edit costs" onPress={() => edit(2)} />
      <CheckRow label="I’ve reviewed these details. Guests see them when they apply." checked={draft.reviewConfirmed} onChange={(v) => update({ reviewConfirmed: v })} />
      <FormMessage message={error ?? (time && time.kind !== 'choose' ? time.message : null)} />
      {time && time.kind !== 'choose' ? <TextAction label={time.target === 'start' ? 'Change the meal time' : 'Change the deadline'} onPress={() => { setTime(null); edit(0); }} /> : null}
      {unknown ? <Primary secondary label="Check status" disabled={busy} onPress={() => void checkPublish()} /> : null}
      <Primary label="Publish meal" busy={busy} onPress={() => void publish(draft)} />
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
        <Primary label="Publish with this time" disabled={picked === null} onPress={applyOffset} />
      </Sheet>
    </View>
  );
}
