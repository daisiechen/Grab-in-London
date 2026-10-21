import { CUISINES, DIETARY, LANGUAGES, MOODS, type CuisineCode, type DietaryCode, type LanguageCode, type MoodCode } from '@fancy/contracts';
import { longDate } from '../../lib/format.ts';
import { ChoiceGroup, Field } from '../../ui/components.tsx';
import { VenuePicker } from '../venues/VenuePicker.tsx';
import { toggle, upcomingLondonDates } from '../discover/filters.ts';
import { HALF_HOUR_SLOTS, defaultClose, type MealDraft } from './model.ts';

export interface StepProps {
  draft: MealDraft;
  /** Arrangement changes clear both confirmations, as in the prototype. */
  update: (patch: Partial<MealDraft>) => void;
  lockedVenue?: boolean;
}

const SIZES = [2, 3, 4, 5, 6] as const;

export function ArrangeStep({ draft, update, lockedVenue }: StepProps) {
  const schedule = (patch: Partial<MealDraft>) => {
    const next = { ...draft, ...patch };
    const close = (patch.date !== undefined || patch.time !== undefined) && next.date && next.time ? defaultClose(next.date, next.time) : null;
    update({ ...patch, ...(close ?? {}), ...(patch.date !== undefined || patch.time !== undefined ? { startOffset: null, closeOffset: null } : {}) });
  };
  const dates = upcomingLondonDates(42);
  return (
    <>
      {lockedVenue
        ? <p className="muted">Restaurant: {draft.venue?.name}</p>
        : <VenuePicker value={draft.venue} onConfirm={(venue) => update({ venue })} />}
      <ChoiceGroup<string> label="People, including you" value={String(draft.capacity)}
        options={SIZES.map((n) => [String(n), `${n} people`] as const)}
        onChange={(v) => update({ capacity: Number(v), minimum: Math.min(draft.minimum, Number(v)) })} />
      <ChoiceGroup<string> label="Minimum people, including you" value={String(draft.minimum)}
        options={SIZES.filter((n) => n <= draft.capacity).map((n) => [String(n), `${n} people`] as const)}
        onChange={(v) => update({ minimum: Number(v) })} />
      <p className="muted">{draft.capacity - 1} guest{draft.capacity === 2 ? '' : 's'} + you · friendship-first, at every table size.</p>
      <fieldset className="filter-section">
        <legend>Date · London</legend>
        <div className="date-grid">
          {dates.map((d) => (
            <label key={d} className={`choice-chip${draft.date === d ? ' chosen' : ''}`}>
              <input type="radio" name="meal-date" checked={draft.date === d} onChange={() => schedule({ date: d })} />
              {longDate(d)}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Time" hint="London time. This is your planned meeting time; confirm opening hours and book with the restaurant separately.">
        {(p) => (
          <select {...p} value={draft.time} onChange={(e) => schedule({ time: e.target.value })}>
            <option value="">Choose a time</option>
            {HALF_HOUR_SLOTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
      </Field>
      <h2>Applications close</h2>
      <Field label="Deadline date">
        {(p) => <input {...p} type="date" value={draft.closeDate} max={draft.date || undefined} onChange={(e) => update({ closeDate: e.target.value, closeOffset: null })} />}
      </Field>
      <Field label="Deadline time" hint="At least 30 minutes before the meal. At the deadline, we stop applications and approvals and cancel if your minimum isn’t met.">
        {(p) => <input {...p} type="time" step={60} value={draft.closeTime} onChange={(e) => update({ closeTime: e.target.value, closeOffset: null })} />}
      </Field>
    </>
  );
}

export function IntroduceStep({ draft, update }: StepProps) {
  return (
    <>
      <Field label="Give your meal a name" hint={`5–80 characters · ${draft.title.length}/80`}>
        {(p) => <input {...p} maxLength={80} placeholder="e.g. Friday dinner & new faces" value={draft.title} onChange={(e) => update({ title: e.target.value })} />}
      </Field>
      <Field label="What should people expect?" hint={`20–1,000 characters · ${draft.description.length}/1,000`}>
        {(p) => <textarea {...p} rows={4} maxLength={1000} placeholder="A relaxed dinner, a shared interest, or simply good company…" value={draft.description} onChange={(e) => update({ description: e.target.value })} />}
      </Field>
      <ChoiceGroup<MoodCode> label="Atmosphere" options={Object.entries(MOODS) as Array<[MoodCode, string]>} value={draft.mood} onChange={(mood) => update({ mood })} />
      <ChoiceGroup<LanguageCode> multiple label="Conversation language" options={Object.entries(LANGUAGES) as Array<[LanguageCode, string]>}
        value={draft.languages} onChange={(v) => update({ languages: toggle(draft.languages, v) })} />
      <ChoiceGroup<CuisineCode | 'NONE'> label="Cuisine · optional"
        options={[['NONE', 'Not provided'], ...(Object.entries(CUISINES) as Array<[CuisineCode, string]>)]}
        value={draft.cuisineCode ?? 'NONE'} onChange={(v) => update({ cuisineCode: v === 'NONE' ? null : v })} />
      <ChoiceGroup<DietaryCode> multiple label="Dietary options · optional" options={Object.entries(DIETARY) as Array<[DietaryCode, string]>}
        value={draft.dietaryCodes} onChange={(v) => update({ dietaryCodes: toggle(draft.dietaryCodes, v) })} />
      <p className="muted">Leave these as “Not provided” if you’re unsure. Guests see them as your declaration, not an allergy guarantee.</p>
    </>
  );
}

export function CostsStep({ draft, update, showBooking = true }: StepProps & { showBooking?: boolean }) {
  return (
    <>
      <div className="summary-box">
        <strong>Pay at the restaurant</strong>
        <p>Everyone pays their own share. Nothing collected in the app.</p>
      </div>
      <div className="form-grid">
        <Field label="Budget from / person (£)">
          {(p) => <input {...p} inputMode="decimal" value={draft.budgetMin} onChange={(e) => update({ budgetMin: e.target.value })} />}
        </Field>
        <Field label="Budget to / person (£)">
          {(p) => <input {...p} inputMode="decimal" value={draft.budgetMax} onChange={(e) => update({ budgetMax: e.target.value })} />}
        </Field>
      </div>
      <div className="cost-receipt">
        <span>Each guest pays after approval<strong>£0.00</strong></span>
        <span>Collected when you publish<strong>£0.00</strong></span>
        <small>Estimated spend is a guide, not a fixed charge.</small>
      </div>
      {showBooking && (
        <label className="create-consent">
          <input type="checkbox" checked={draft.bookingConfirmed} onChange={(e) => update({ bookingConfirmed: e.target.checked })} />
          <span>
            I have a reservation at {draft.venue?.name ?? 'the restaurant'} for {draft.capacity} people
            {draft.date ? ` on ${longDate(draft.date)}` : ''}{draft.time ? ` at ${draft.time}` : ''}. This is my confirmation, not verification by the app.
          </span>
        </label>
      )}
      <div className="summary-box">
        <strong>Cancellation terms</strong>
        <p>No in-app payment to refund. Let the host know if plans change.</p>
      </div>
    </>
  );
}
