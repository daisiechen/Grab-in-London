import { useId, useState } from 'react';
import { CalendarIcon, ChatBubbleIcon, CheckCircledIcon, ClockIcon, CookieIcon, InfoCircledIcon, Pencil2Icon, PersonIcon, TimerIcon, TokensIcon } from '@radix-ui/react-icons';
import { CUISINES, DIETARY, LANGUAGES, MOODS, type CuisineCode, type DietaryCode, type LanguageCode, type MoodCode } from '@fancy/contracts';
import { longDate } from '../../lib/london.ts';
import { ChoiceGroup, Field } from '../../ui/components.tsx';
import { DateChoices } from '../../ui/DateChoices.tsx';
import { VenuePicker } from '../venues/VenuePicker.tsx';
import { toggle } from '../discover/filters.ts';
import { CheckRow, DropPanel, DropTrigger, Hint, Section, Stepper, TimeGrid } from './CreateLayout.tsx';
import { MAX_PEOPLE, MIN_PEOPLE, budgetIssues, budgetText, deadlineTooLate, reservationDeclaration, type MealDraft } from './model.ts';

/*
 * The first three Create / Edit steps (iOS CreateStepScreen Arrange, Introduce, Costs). Every
 * change goes through `update`, which applies the model's invalidations (updateDraft).
 */

export interface StepProps {
  draft: MealDraft;
  update: (patch: Partial<MealDraft>) => void;
}

type Picker = '' | 'date' | 'time' | 'closeDate' | 'closeTime';

export const Pound = () => <span className="glyph-pound">£</span>;

export function ArrangeStep({ draft, update, today }: StepProps & { today: string }) {
  const [open, setOpen] = useState<Picker>('');
  const uid = useId();
  const tid = (p: Picker) => `${uid}-${p}`;
  const toggleOpen = (p: Picker) => setOpen(open === p ? '' : p);
  // A pointer pick closes the panel; after the date, the time picker opens if no time is set yet.
  const closeFrom = (p: Picker) => () => setOpen((o) => (o === p ? (p === 'date' && !draft.time ? 'time' : '') : o));
  const guests = draft.capacity - 1;
  return (
    <>
      <VenuePicker value={draft.venue} onConfirm={(venue) => update({ venue })} />

      <Section required title="Your table" icon={<PersonIcon />}>
        {/* Lowering the table size pulls the minimum down with it (updateDraft). */}
        <div className="cbox steppers">
          <Stepper label="Minimum" hint="people, including you" name="minimum" value={draft.minimum} min={MIN_PEOPLE} max={draft.capacity} onChange={(minimum) => update({ minimum })} />
          <span className="cdiv" aria-hidden="true" />
          <Stepper label="Up to" hint={`${guests} guest${guests === 1 ? '' : 's'} + you`} name="maximum" value={draft.capacity} min={MIN_PEOPLE} max={MAX_PEOPLE} onChange={(capacity) => update({ capacity })} />
        </div>
        <Hint>{`Friendship-first, at every table size. If fewer than ${draft.minimum} people are confirmed when applications close, the meal is cancelled.`}</Hint>
      </Section>

      <Section required title="When" icon={<CalendarIcon />}>
        <div className="drow">
          <DropTrigger id={tid('date')} label="Date" icon={<CalendarIcon />} value={draft.date ? longDate(draft.date) : null} placeholder="Choose a date" open={open === 'date'} onClick={() => toggleOpen('date')} />
          <DropTrigger id={tid('time')} label="Time" icon={<ClockIcon />} value={draft.time || null} placeholder="Choose a time" open={open === 'time'} onClick={() => toggleOpen('time')} />
        </div>
        {open === 'date' ? (
          <DropPanel triggerId={tid('date')} onClose={closeFrom('date')}>
            <DateChoices label="Meal date" today={today} selected={draft.date ? [draft.date] : []} onToggle={(date) => update({ date })} />
          </DropPanel>
        ) : null}
        {open === 'time' ? (
          <DropPanel triggerId={tid('time')} onClose={closeFrom('time')}>
            <TimeGrid label="Meal time" value={draft.time || null} onChange={(time) => update({ time })} />
          </DropPanel>
        ) : null}
        <Hint>London time. This is your planned meeting time; confirm opening hours and book with the restaurant separately.</Hint>
      </Section>

      <Section required title="Applications close" icon={<TimerIcon />}>
        <div className="drow">
          <DropTrigger id={tid('closeDate')} label="Deadline date" icon={<CalendarIcon />} value={draft.closeDate ? longDate(draft.closeDate) : null} placeholder="Choose a date" open={open === 'closeDate'} onClick={() => toggleOpen('closeDate')} />
          <DropTrigger id={tid('closeTime')} label="Deadline time" icon={<ClockIcon />} value={draft.closeTime || null} placeholder="Choose a time" open={open === 'closeTime'} onClick={() => toggleOpen('closeTime')} />
        </div>
        {open === 'closeDate' ? (
          <DropPanel triggerId={tid('closeDate')} onClose={closeFrom('closeDate')}>
            <DateChoices label="Deadline date" today={today} latest={draft.date || undefined} selected={draft.closeDate ? [draft.closeDate] : []} onToggle={(closeDate) => update({ closeDate, closeEdited: true })} />
          </DropPanel>
        ) : null}
        {open === 'closeTime' ? (
          <DropPanel triggerId={tid('closeTime')} onClose={closeFrom('closeTime')}>
            <TimeGrid label="Deadline time" value={draft.closeTime || null} isDisabled={(t) => deadlineTooLate(draft, t)} onChange={(closeTime) => update({ closeTime, closeEdited: true })} />
          </DropPanel>
        ) : null}
        <Hint>Defaults to an hour before the meal; it must be at least 30 minutes before. At the deadline, applications and approvals stop.</Hint>
      </Section>
    </>
  );
}

export function IntroduceStep({ draft, update }: StepProps) {
  return (
    <>
      <Section required title="Name and description" icon={<Pencil2Icon />}>
        <Field label="Give your meal a name" hint="5–80 characters" counter={`${draft.title.length}/80`}>
          {(p) => <input {...p} className="input" maxLength={80} placeholder="e.g. Friday dinner & new faces" value={draft.title} onChange={(e) => update({ title: e.target.value })} />}
        </Field>
        <Field label="What should people expect?" hint="20–1,000 characters" counter={`${draft.description.length.toLocaleString('en-GB')}/1,000`}>
          {(p) => <textarea {...p} className="textarea" rows={4} maxLength={1000} placeholder="A relaxed dinner, a shared interest, or simply good company…" value={draft.description} onChange={(e) => update({ description: e.target.value })} />}
        </Field>
      </Section>
      <Section required title="The company" icon={<ChatBubbleIcon />}>
        <ChoiceGroup<MoodCode> label="Atmosphere" options={Object.entries(MOODS) as Array<[MoodCode, string]>} value={draft.mood} onChange={(mood) => update({ mood })} />
        <ChoiceGroup<LanguageCode> multiple label="Conversation language" options={Object.entries(LANGUAGES) as Array<[LanguageCode, string]>}
          value={draft.languages} onChange={(v) => update({ languages: toggle(draft.languages, v) })} />
      </Section>
      <Section title="Food (optional)" icon={<CookieIcon />}>
        <ChoiceGroup<CuisineCode | 'NONE'> label="Cuisine"
          options={[['NONE', 'Not provided'], ...(Object.entries(CUISINES) as Array<[CuisineCode, string]>)]}
          value={draft.cuisineCode ?? 'NONE'} onChange={(v) => update({ cuisineCode: v === 'NONE' ? null : v })} />
        <ChoiceGroup<DietaryCode> multiple label="Dietary options" options={Object.entries(DIETARY) as Array<[DietaryCode, string]>}
          value={draft.dietaryCodes} onChange={(v) => update({ dietaryCodes: toggle(draft.dietaryCodes, v) })} />
        <Hint>Host-reported · not an allergy guarantee. Only add what you know about the restaurant; leave blank if you’re not sure.</Hint>
      </Section>
    </>
  );
}

/** r07: no platform payment, deposit or refund — expected spend per person, paid at the restaurant. */
export function CostsStep({ draft, update, editing }: StepProps & { editing: boolean }) {
  const budget = budgetIssues(draft);
  return (
    <>
      <Section title="How guests pay" icon={<Pound />}>
        <p className="cval">Pay at the restaurant</p>
        <p className="muted">Everyone pays their own share at the restaurant. Nothing is collected in the app.</p>
      </Section>
      <Section required title="Expected spend" icon={<TokensIcon />}>
        <div className="row2">
          <Field label="From / person (£)" error={budget.min} quietError>
            {(p) => <input {...p} className="input" inputMode="decimal" placeholder="e.g. 20" value={draft.budgetMin} onChange={(e) => update({ budgetMin: e.target.value })} />}
          </Field>
          <Field label="To / person (£)" error={budget.max} quietError>
            {(p) => <input {...p} className="input" inputMode="decimal" placeholder="e.g. 35" value={draft.budgetMax} onChange={(e) => update({ budgetMax: e.target.value })} />}
          </Field>
        </div>
        <div className="cbox spend">
          <span><b>Estimated per person</b><small>A guide for guests, not a fixed charge.</small></span>
          <strong>{budgetText(draft)}</strong>
        </div>
      </Section>
      {/* Edit keeps the booking already reported on the meal; Review reminds the host to update it. */}
      {editing ? null : (
        <Section required title="Restaurant reservation" icon={<CheckCircledIcon />}>
          <Hint>You book the table with the restaurant yourself. Fancy doesn’t reserve tables. Tick to confirm before you continue.</Hint>
          <CheckRow label={reservationDeclaration(draft)} checked={draft.bookingConfirmed} onChange={(bookingConfirmed) => update({ bookingConfirmed })} />
        </Section>
      )}
      <Section title="If plans change" icon={<InfoCircledIcon />}>
        <Hint>Nothing is paid in the app, so there’s nothing to refund. If you cancel, let the restaurant know yourself; your group chat stays open.</Hint>
      </Section>
    </>
  );
}
