import { useAssistantEditor, useAssistantEditorRevision } from '../assistant/index.ts';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTelemetry } from '../../api/telemetry.tsx';
import { serverValidationMetrics,validationMetric } from './validationMetrics.ts';
import { Link,useLocation,useNavigate } from 'react-router';
import { ApiError, type TimeChoice } from '@fancy/client';
import { LANGUAGES, MOODS } from '@fancy/contracts';
import { ArrowRightIcon, CheckIcon } from '@radix-ui/react-icons';
import { useApi } from '../../api/ApiProvider.tsx';
import { useSession } from '../../api/session.tsx';
import { Intent } from '../../api/webApi.ts';
import { errorMessage } from '../../api/errors.ts';
import { clearDraft, loadDraft, saveDraft } from '../../lib/drafts.ts';
import { budgetRange, longDate, offsetLabel } from '../../lib/format.ts';
import { signInPath } from '../../lib/returnTo.ts';
import { FormError, Loading, Primary, PrimaryLink, TextAction } from '../../ui/components.tsx';
import { useToast } from '../../ui/toast.tsx';
import { useActionGate } from '../auth/gate.ts';
import { cuisineLabel, dietaryLabel } from '../meals/present.ts';
import { ArrangeStep, CostsStep, IntroduceStep } from './steps.tsx';
import { newDraft, poundsToPence, timeFieldOf, toCreateBody, validateStep, type MealDraft, type Step } from './model.ts';
import {TermsPage} from './TermsPage.tsx';

const STEPS = ['Arrange', 'Introduce', 'Costs', 'Review'] as const;
const HEADINGS = ['A place at your table.', 'Good company starts here.', 'Keep things clear.', 'Ready to bring people together?'];
const PROSE = [
  'Choose a restaurant, then find a time for your group.',
  'Give new faces a feel for your meal.',
  'Let everyone know what they’ll pay and who’s booking.',
  'Check the details your guests will see before you publish.',
];

interface Ambiguity { field: 'start' | 'close'; choices: TimeChoice[] }

/**
 * Create meal (T07): four prototype steps, external booking / pay at venue only (P-01).
 * London times go to the server as TimeInput; a repeated wall time is answered by an explicit
 * BST/GMT choice and a nonexistent one is an error (P-03). Nothing publishes until the host
 * ticks both confirmations and presses Publish.
 */
export function CreatePage() {
  const terms=useLocation().pathname==='/create/terms';
  const started=useRef(!terms);
  if(!terms)started.current=true;
  // Direct public terms access never initializes a private draft. An in-flow detour keeps
  // this same mounted owner, including its transient provider display and explicit ticks.
  return started.current?<CreateFlow terms={terms}/>:<TermsPage/>;
}

function CreateFlow({terms}:{terms:boolean}) {
  const { api, cache } = useApi();
  const { state } = useSession();
  const gate = useActionGate();
  const navigate = useNavigate();
  const notify = useToast();
  const [draft, setDraft] = useState<MealDraft>(() => loadDraft<MealDraft>('create') ?? newDraft());
  const [step, setStep] = useState<Step>(0);
  const [error, setError] = useState('');
  const [ambiguity, setAmbiguity] = useState<Ambiguity | null>(null);
  const [busy, setBusy] = useState(false);
  const intent = useMemo(() => new Intent(api.retry), [api]);
  const telemetry=useTelemetry();
  const started=useRef(new Set<string>()),arranged=useRef(new Set<string>());
  const begin=()=>{
    const key=`${telemetry.generation}:${draft.attemptId}`;
    if(telemetry.enabled&&document.visibilityState==='visible'&&!started.current.has(key)){started.current.add(key);telemetry.emit('create_started',{attemptId:draft.attemptId});}
  };
  useEffect(()=>{if(!terms&&state.status==='signed-in')begin();},[terms,state.status,telemetry.enabled,telemetry.generation,draft.attemptId]);
  const arrangedEvent=()=>{
    begin();const key=`${telemetry.generation}:${draft.attemptId}`;
    if(telemetry.enabled&&document.visibilityState==='visible'&&!arranged.current.has(key)){arranged.current.add(key);telemetry.emit('create_arranged',{attemptId:draft.attemptId});}
  };
  const formError=(s:Step,issue:string)=>{begin();const properties=validationMetric(draft.attemptId,s,issue);if(properties)telemetry.emit('form_error',properties);};

  useEffect(() => { if(!terms)saveDraft('create', draft); }, [draft,terms]);
  const editorVersion = useAssistantEditorRevision(JSON.stringify(draft));
  useAssistantEditor(!terms&&state.status === 'signed-in' && !busy ? { kind: 'CREATE', targetId: null, version: editorVersion, text: [draft.title,draft.description].filter(Boolean).join('\n'), apply: (candidate) => { if(candidate.fields){setDraft(previous=>({...previous,...candidate.fields,bookingConfirmed:false,reviewConfirmed:false}));setStep(1);setError('');} } } : null);

  if(terms)return <TermsPage/>;

  if (state.status === 'loading') return <Loading />;
  if (state.status === 'guest') {
    return (
      <div className="body-pad">
        <h1>A place at your table.</h1>
        <p className="prose">Sign in to host a meal. Anything you’ve started is kept on this device.</p>
        <PrimaryLink to={signInPath('/create')}>Sign in to continue <ArrowRightIcon /></PrimaryLink>
      </div>
    );
  }

  const update = (patch: Partial<MealDraft>) => {
    begin();
    setDraft((d) => ({ ...d, ...patch, ...('reviewConfirmed' in patch ? {} : { reviewConfirmed: false }), ...(touchesBooking(patch) ? { bookingConfirmed: false } : {}) }));
    setError('');
    if ('date' in patch || 'time' in patch || 'closeDate' in patch || 'closeTime' in patch) setAmbiguity(null);
  };

  const next = () => {
    const issue = validateStep(draft, step);
    setError(issue);
    if(issue)formError(step,issue);
    if (!issue) {if(step===0)arrangedEvent();setStep((s) => Math.min(3, s + 1) as Step);}
  };

  const publish = async () => {
    for (const s of [0, 1, 2, 3] as const) {
      const issue = validateStep(draft, s);
      if (issue) { formError(s,issue);setError(issue); if (s < 3) setStep(s); return; }
    }
    arrangedEvent();
    if (!gate.check('/create')) return;
    const body = toCreateBody(draft);
    if (!body) return;
    setBusy(true);
    setError('');
    try {
      const res = await intent.run(body, (key) => api.client.call('createMeal', { body, idempotencyKey: key }));
      clearDraft('create');
      cache.delete('myMeals');
      notify('Meal published.');
      navigate(`/meals/${res.data.id}`, { replace: true });
    } catch (e) {
      if (gate.handle(e, '/create')) return;
      const field = e instanceof ApiError ? timeFieldOf(e.fieldErrors) : null;
      if(field&&e instanceof ApiError&&['TIME_AMBIGUOUS','TIME_NONEXISTENT','INVALID_OFFSET'].includes(e.code))telemetry.emit('form_error',{attemptId:draft.attemptId,step:'arrange',field:field==='start'?'time':'closeTime',errorCode:e.code==='TIME_AMBIGUOUS'?'time_ambiguous':e.code==='TIME_NONEXISTENT'?'time_nonexistent':'invalid'});
      else if(e instanceof ApiError)for(const properties of serverValidationMetrics(draft.attemptId,e.fieldErrors))telemetry.emit('form_error',properties);
      if (e instanceof ApiError && e.code === 'TIME_AMBIGUOUS' && e.choices?.length && field) {
        setAmbiguity({ field, choices: e.choices });
        setError(errorMessage(e));
      } else if (e instanceof ApiError && (e.code === 'TIME_NONEXISTENT' || e.code === 'INVALID_OFFSET') && field) {
        setDraft((d) => ({ ...d, ...(field === 'close' ? { closeOffset: null } : { startOffset: null }), reviewConfirmed: false }));
        setStep(0);
        setError(`${field === 'close' ? 'Deadline: ' : 'Meal time: '}${errorMessage(e)}`);
      } else {
        setError(errorMessage(e));
      }
    } finally {
      setBusy(false);
    }
  };

  const chooseOffset = (choice: TimeChoice) => {
    if (!ambiguity) return;
    setDraft((d) => ({ ...d, ...(ambiguity.field === 'close' ? { closeOffset: choice.utcOffsetMinutes } : { startOffset: choice.utcOffsetMinutes }) }));
    setError('');
  };
  const chosenOffset = ambiguity ? (ambiguity.field === 'close' ? draft.closeOffset : draft.startOffset) : null;
  const min = poundsToPence(draft.budgetMin);
  const max = poundsToPence(draft.budgetMax);

  return (
    <div className="body-pad create-flow">
      <div className="create-progress" aria-label={`Step ${step + 1} of 4`}>
        {STEPS.map((label, i) => (
          <button type="button" key={label} disabled={i > step} aria-current={i === step ? 'step' : undefined} onClick={() => { setError(''); setStep(i as Step); }}>
            <span>{i < step ? <CheckIcon /> : i + 1}</span>{label}
          </button>
        ))}
      </div>
      <h1>{HEADINGS[step]}</h1>
      <p className="prose">{PROSE[step]}</p>
      {step === 0 && <ArrangeStep draft={draft} update={update} />}
      {step === 1 && <IntroduceStep draft={draft} update={update} />}
      {step === 2 && <CostsStep draft={draft} update={update} />}
      {step === 3 && (
        <>
          <div className="create-review">
            <div className="eyebrow">YOUR NEW TABLE</div>
            <h2>{draft.title}</h2>
            <p>{draft.description}</p>
            {([
              ['Place & time', draft.venue?.name ? `${draft.venue.name} · ${draft.venue.address ?? ''}` : 'Selected restaurant · choose again to refresh its display details', `${draft.date ? longDate(draft.date) : ''} · ${draft.time} London time · ${draft.capacity} people including you (minimum ${draft.minimum})`, 0],
              ['The company', draft.mood ? MOODS[draft.mood] : '', `${draft.languages.map((l) => LANGUAGES[l]).join(' & ')} · Cuisine: ${cuisineLabel({ cuisineCode: draft.cuisineCode })} · Dietary: ${dietaryLabel({ dietaryCodes: draft.dietaryCodes.length ? draft.dietaryCodes : null })}`, 1],
              ['Costs & reservation', min !== null && max !== null ? `${budgetRange(min, max)} estimated per person` : '', 'Pay at the restaurant · Host reports already booked', 2],
            ] as const).map(([label, a, b, s]) => (
              <section key={label}>
                <div><strong>{label}</strong><TextAction onClick={() => { setStep(s); update({}); }}>Edit</TextAction></div>
                <p>{a}</p>
                <small>{b}</small>
              </section>
            ))}
            <section>
              <div><strong>Applications close</strong></div>
              <p>{draft.closeDate ? longDate(draft.closeDate) : ''} · {draft.closeTime} London time</p>
            </section>
          </div>
          {ambiguity && (
            <fieldset className="filter-section">
              <legend>{ambiguity.field === 'close' ? 'Which deadline did you mean?' : 'Which meal time did you mean?'}</legend>
              <p className="muted">The clocks go back that night, so {ambiguity.field === 'close' ? draft.closeTime : draft.time} happens twice in London.</p>
              <div className="choice-grid">
                {ambiguity.choices.map((c, i) => (
                  <label key={c.utcOffsetMinutes} className={`choice-chip${chosenOffset === c.utcOffsetMinutes ? ' chosen' : ''}`}>
                    <input type="radio" name="offset" checked={chosenOffset === c.utcOffsetMinutes} onChange={() => chooseOffset(c)} />
                    {ambiguity.field === 'close' ? draft.closeTime : draft.time} {c.label || offsetLabel(c.utcOffsetMinutes)} · {i === 0 ? 'first time' : 'second time'}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <div className="summary-box"><strong>Cancellation terms</strong><p>No in-app payment to refund.</p></div>
          <label className="create-consent">
            <input type="checkbox" checked={draft.reviewConfirmed} onChange={(e) => update({ reviewConfirmed: e.target.checked })} />
            <span>I’ve checked the arrangements and the <Link to="/create/terms">cancellation terms</Link>.</span>
          </label>
        </>
      )}
      <FormError>{error}</FormError>
      <Primary disabled={busy || (ambiguity !== null && chosenOffset === null)} onClick={() => void (step === 3 ? publish() : next())}>
        {step === 3 ? 'Publish meal' : 'Continue'} <ArrowRightIcon />
      </Primary>
      {step > 0 && <TextAction onClick={() => { setError(''); setStep((s) => (s - 1) as Step); }}>Previous step</TextAction>}
    </div>
  );
}

/** The host's booking declaration is about this venue, size and time; changing them needs a new tick. */
const touchesBooking = (patch: Partial<MealDraft>) => ['venue', 'capacity', 'date', 'time'].some((k) => k in patch);
