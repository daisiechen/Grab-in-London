import { Fragment, useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, MinusIcon, PlusIcon } from '@radix-ui/react-icons';
import { HALF_HOUR_SLOTS } from '../../lib/london.ts';
import { STEPS, type FlowKind, type Step } from './model.ts';

/*
 * Create / edit page frame and its small parts, the web form of apps/ios/src/features/create/
 * CreateLayout.tsx: compact step row, page title, soft section cards, inline drop-down pickers,
 * the 48-slot time grid and the people stepper. Classes live in styles/app.css (“Create”).
 */

const HEADINGS = ['A place at your table.', 'Good company starts here.', 'Keep things clear.', 'Ready to bring people together?'] as const;
const INTROS = [
  'Choose a restaurant, then find a time for your group.',
  'Give new faces a feel for your meal.',
  'Let everyone know what they’ll spend and who’s booking.',
  'Check the details your guests will see before you publish.',
] as const;
const EDIT_HEADINGS = ['Change the place and time.', 'Update your introduction.', 'Update the costs.', 'Ready to save your changes?'] as const;
const EDIT_INTROS = [
  'You can change these until you approve your first guest.',
  'Refresh what new faces read about your meal.',
  'Adjust what guests should expect to spend.',
  'Check the details guests will see. Only what you changed is saved.',
] as const;

export const stepHeading = (kind: FlowKind, step: Step) => (kind === 'edit' ? EDIT_HEADINGS : HEADINGS)[step];

export function CreateLayout({ step, onStep, footer, children, kind, tall }: { step: Step; onStep: (s: Step) => void; footer: ReactNode; children: ReactNode; kind: FlowKind; tall?: boolean }) {
  return (
    <div className={`scroll has-footer create${tall ? ' tall' : ''}`}>
      <StepIndicator step={step} onStep={onStep} />
      <header className="ph page">
        <div className="row"><h1>{stepHeading(kind, step)}</h1></div>
        <p>{(kind === 'edit' ? EDIT_INTROS : INTROS)[step]}</p>
      </header>
      {children}
      <div className="footer">{footer}</div>
    </div>
  );
}

/** Demo `.create-progress`, compact: done steps can be revisited, later ones are disabled. */
export function StepIndicator({ step, onStep }: { step: Step; onStep: (s: Step) => void }) {
  return (
    <nav className="wsteps" aria-label={`Step ${step + 1} of 4`}>
      {STEPS.map((label, i) => {
        const done = i < step;
        const current = i === step;
        return (
          <Fragment key={label}>
            {i > 0 ? <span className={`wline${i <= step ? ' on' : ''}`} aria-hidden="true" /> : null}
            <button
              type="button"
              className={`wstep${done ? ' done' : ''}${current ? ' current' : ''}`}
              disabled={i >= step}
              aria-current={current ? 'step' : undefined}
              aria-label={done ? `${label}, completed` : current ? `${label}, current step` : label}
              onClick={() => onStep(i as Step)}
            >
              <span className="wdot" aria-hidden="true">{done ? <CheckIcon width={11} height={11} /> : i + 1}</span>
              <span aria-hidden="true">{label}</span>
            </button>
          </Fragment>
        );
      })}
    </nav>
  );
}

/** One soft card per section, with a light red * when required and an optional link on the right. */
export function Section({ title, icon, children, right, required = false }: { title?: string; icon?: ReactNode; children: ReactNode; right?: ReactNode; required?: boolean }) {
  return (
    <section className="csec">
      {title ? (
        <div className="csec-head">
          <h2>
            {icon ? <span className="csec-ic" aria-hidden="true">{icon}</span> : null}
            {title}{required ? <><span className="csec-req" aria-hidden="true"> *</span><span className="vh">, required</span></> : null}
          </h2>
          {right}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export const Hint = ({ children, id }: { children: ReactNode; id?: string }) => <p className="chint" id={id}>{children}</p>;

/** Small forest link (“Edit”, “Change”) with a descriptive accessible name. */
export function InlineLink({ label, ariaLabel, onClick }: { label: string; ariaLabel: string; onClick: () => void }) {
  return <button type="button" className="inl" aria-label={ariaLabel} onClick={onClick}>{label}</button>;
}

/** Inline dropdown trigger; its panel opens right below the row. */
export function DropTrigger({ id, label, value, placeholder, icon, open, onClick }: { id: string; label: string; value: string | null; placeholder: string; icon: ReactNode; open: boolean; onClick: () => void }) {
  return (
    <div className="dtrig">
      <span className="dlab" aria-hidden="true">{label}</span>
      <button type="button" id={id} className={open ? 'open' : ''} aria-expanded={open} aria-controls={open ? `${id}-panel` : undefined} aria-label={`${label}: ${value ?? placeholder}`} onClick={onClick}>
        <span className={`dic${value ? ' set' : ''}`} aria-hidden="true">{icon}</span>
        <span className={value ? 'dval' : 'dph'}>{value ?? placeholder}</span>
        {open ? <ChevronUpIcon aria-hidden="true" /> : <ChevronDownIcon aria-hidden="true" />}
      </button>
    </div>
  );
}

/**
 * In-place picker panel. A pointer pick closes it (as a tap does on iOS); keyboard users move with
 * the arrow keys and close with Enter or Escape, which puts focus back on the trigger.
 */
export function DropPanel({ triggerId, onClose, children }: { triggerId: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const pointer = useRef(false);
  useEffect(() => { ref.current?.scrollIntoView?.({ block: 'nearest' }); }, []);
  const done = (refocus: boolean) => { onClose(); if (refocus) document.getElementById(triggerId)?.focus(); };
  const key = (e: KeyboardEvent) => {
    pointer.current = false;
    if (e.key === 'Escape' || (e.key === 'Enter' && e.target instanceof HTMLInputElement && e.target.type === 'radio')) { e.preventDefault(); done(true); }
  };
  return (
    <div ref={ref} id={`${triggerId}-panel`} className="dpanel" onKeyDown={key} onPointerDown={() => { pointer.current = true; }}
      onChange={(e) => { if (pointer.current && e.target instanceof HTMLInputElement && e.target.type === 'radio') done(false); }}>
      {children}
    </div>
  );
}

/** All 48 half-hour London times as real radios, opened scrolled to the current choice. */
export function TimeGrid({ label, value, onChange, isDisabled }: { label: string; value: string | null; onChange: (time: string) => void; isDisabled?: (time: string) => boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const name = `tg-${label.replace(/\W+/g, '-').toLowerCase()}`;
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const anchor = Math.max(0, HALF_HOUR_SLOTS.indexOf(value ?? '18:00'));
    el.scrollTop = Math.max(0, Math.floor(anchor / 6) - 1) * 40;
    const checked = el.querySelector<HTMLInputElement>('input:checked') ?? el.querySelector<HTMLInputElement>(`input[value="${value ?? '18:00'}"]`) ?? el.querySelector<HTMLInputElement>('input:not(:disabled)');
    checked?.focus({ preventScroll: true });
  }, []);
  return (
    <fieldset className="tgrid-wrap">
      <legend className="vh">{label}</legend>
      <div className="tgrid" ref={box}>
        {HALF_HOUR_SLOTS.map((t) => {
          const on = t === value;
          const off = !on && !!isDisabled?.(t);
          return (
            <label key={t} className={`tcell${on ? ' on' : ''}${off ? ' off' : ''}`}>
              <input type="radio" name={name} value={t} checked={on} disabled={off} onChange={() => onChange(t)} />
              <span>{t}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Compact people stepper: label and hint on the left, − value + on the right, disabled at the bounds. */
export function Stepper({ label, hint, name, value, min, max, onChange }: { label: string; hint?: string; name: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  const step = (delta: number) => { const next = Math.min(max, Math.max(min, value + delta)); if (next !== value) onChange(next); };
  return (
    <div className="stepper" role="group" aria-label={hint ? `${label}, ${hint}` : label}>
      <span className="stx"><b>{label}</b>{hint ? <small>{hint}</small> : null}</span>
      <span className="stc">
        <button type="button" aria-label={`Decrease ${name}`} disabled={value <= min} onClick={() => step(-1)}><MinusIcon aria-hidden="true" /></button>
        <output aria-live="polite" aria-label={`${label}: ${value} ${value === 1 ? 'person' : 'people'}`}>{value}</output>
        <button type="button" aria-label={`Increase ${name}`} disabled={value >= max} onClick={() => step(1)}><PlusIcon aria-hidden="true" /></button>
      </span>
    </div>
  );
}

/** Ticked confirmation row (iOS CheckRow). */
export function CheckRow({ label, checked, onChange }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="check crow">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
