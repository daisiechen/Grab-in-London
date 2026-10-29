import { useId, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { ArrowLeftIcon, ChevronRightIcon, InfoCircledIcon } from '@radix-ui/react-icons';
import { avatarSrc } from './avatar.ts';

/*
 * Shared web primitives, one per iOS component in apps/ios/src/ui (Button, Field, ChoiceGroup,
 * PageHeader, FloatingBack, Avatar, LinkRow, Bits, FormMessage). Class names live in styles/app.css.
 */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { secondary?: boolean; busy?: boolean; danger?: boolean };

/** Primary/secondary button (45px, forest); busy keeps the label and is announced via aria-busy. */
export function Primary({ secondary, danger, busy, className, type = 'button', children, disabled, ...rest }: ButtonProps) {
  const cls = ['btn', secondary ? 'sec' : '', danger ? 'danger' : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <button type={type} className={cls} disabled={disabled || busy} aria-busy={busy || undefined} {...rest}>
      {busy && <span className="spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function PrimaryLink({ to, secondary, children, state, className, replace }: { to: string; secondary?: boolean; children: ReactNode; state?: unknown; className?: string; replace?: boolean }) {
  return <Link to={to} state={state} replace={replace ?? false} className={['btn', secondary ? 'sec' : '', className ?? ''].filter(Boolean).join(' ')}>{children}</Link>;
}

/** One link style app-wide (iOS TextAction): 13px semibold forest, no underline. */
export function TextAction({ danger, type = 'button', className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { danger?: boolean }) {
  return <button type={type} className={['textact', danger ? 'danger' : '', className ?? ''].filter(Boolean).join(' ')} {...rest} />;
}

export const Required = () => <span className="req" aria-hidden="true">*</span>;

export interface FieldControlProps { id: string; 'aria-describedby'?: string; 'aria-invalid'?: true; 'aria-required'?: true; required?: boolean }

/**
 * Labelled control. Required fields carry the pale `*` (iOS Create) and `aria-required`; the
 * error sits under the field with role=alert; hint and counter share one help row.
 */
export function Field({ label, hint, error, counter, required, strong, quietError, children }: {
  /** The page announces the same message elsewhere (avoid a second alert). */
  quietError?: boolean;
  label: ReactNode; hint?: ReactNode | undefined; error?: string | undefined | null; counter?: string | undefined; required?: boolean; strong?: boolean;
  children: (props: FieldControlProps) => ReactNode;
}) {
  const id = useId();
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const describedBy = [hint || counter ? helpId : '', error ? errorId : ''].filter(Boolean).join(' ');
  return (
    <div className={`field${strong ? ' strong' : ''}`}>
      <label htmlFor={id}>{label}{required && <Required />}</label>
      {children({ id, ...(describedBy ? { 'aria-describedby': describedBy } : {}), ...(error ? { 'aria-invalid': true as const } : {}), ...(required ? { 'aria-required': true as const } : {}) })}
      {(hint || counter) && <div className="help" id={helpId}><span>{hint}</span>{counter && <span>{counter}</span>}</div>}
      {error && <div className="err" id={errorId} {...(quietError ? {} : { role: 'alert' })}>{error}</div>}
    </div>
  );
}

/** Radio (single) or checkbox (multi) chips with real inputs, as iOS ChoiceGroup / MultiChoice. */
export function ChoiceGroup<V extends string>({ label, options, value, onChange, multiple, required, error, disabled }: {
  label: ReactNode;
  options: ReadonlyArray<readonly [V, string]>;
  value: V | readonly V[] | null;
  onChange: (value: V) => void;
  multiple?: boolean;
  required?: boolean;
  error?: string | null | undefined;
  disabled?: (value: V) => boolean;
}) {
  const name = useId();
  const selected = (v: V) => (Array.isArray(value) ? value.includes(v) : value === v);
  return (
    <fieldset className="field" aria-invalid={error ? true : undefined} aria-describedby={error ? `${name}-err` : undefined}>
      <legend>{label}{required && <Required />}</legend>
      <div className="choices">
        {options.map(([v, text]) => (
          <label key={v} className={`choice${selected(v) ? ' on' : ''}`}>
            <input type={multiple ? 'checkbox' : 'radio'} name={name} value={v} checked={selected(v)} disabled={disabled?.(v)} onChange={() => onChange(v)} />
            {text}
          </label>
        ))}
      </div>
      {error && <div className="err" id={`${name}-err`} role="alert">{error}</div>}
    </fieldset>
  );
}

export function Notice({ icon = true, children, role, tone }: { icon?: boolean | ReactNode; children: ReactNode; role?: 'status' | 'alert'; tone?: 'warn' }) {
  return (
    <div className={`notice${tone ? ` ${tone}` : ''}`} {...(role ? { role } : {})}>
      {icon === true ? <InfoCircledIcon width={15} height={15} aria-hidden="true" /> : icon || null}
      <span>{children}</span>
    </div>
  );
}

/** Single status/alert line (iOS FormMessage). */
export function FormMessage({ message, tone = 'error' }: { message: string | null | undefined; tone?: 'error' | 'info' }) {
  if (!message) return null;
  return <p className={`msg-line ${tone}`} role={tone === 'error' ? 'alert' : 'status'}>{message}</p>;
}

export function FormError({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p className="form-error" role="alert">{children}</p>;
}

/** 36px back disc (iOS FloatingBack): history back when there is history, else the fallback route. */
export function BackDisc({ fallback = '/discover', label = 'Back' }: { fallback?: string; label?: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  // `default` is the entry the visitor landed on (a shared link, a new tab): there is no in-app page to go back to.
  const back = () => { if (location.key !== 'default') navigate(-1); else navigate(fallback, { replace: true }); };
  return <button type="button" className="disc" aria-label={label} onClick={back}><ArrowLeftIcon width={18} height={18} aria-hidden="true" /></button>;
}

/** Pushed-page title row: back disc, title with a muted context line, optional control on the right. */
export function TitleBar({ title, subtitle, right, back = '/discover', noBack }: { title: ReactNode; subtitle?: ReactNode; right?: ReactNode; back?: string; noBack?: boolean }) {
  return (
    <div className="titlebar">
      {!noBack && <BackDisc fallback={back} />}
      <div className="t">
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {right}
    </div>
  );
}

/**
 * The one page-title pattern (iOS PageHeader): big title, a muted line under it, an optional
 * control on the title row. `tab` for top-level tabs, `page` for pushed pages. Legacy callers
 * pass `backTo`, which renders the pushed-page title row with a back disc.
 */
export function PageHeader({ title, subtitle, right, size = 'page', backTo }: { title: string; subtitle?: string | undefined; right?: ReactNode; size?: 'tab' | 'page'; backTo?: string; backState?: unknown }) {
  if (backTo) return <TitleBar title={title} subtitle={subtitle} right={right} back={backTo} />;
  return (
    <header className={`ph ${size}`}>
      <div className="row"><h1>{title}</h1>{right}</div>
      {subtitle ? <p>{subtitle}</p> : null}
    </header>
  );
}

/** Circular portrait; initial on the pale surface when there is no photo (iOS Avatar). */
export function Avatar({ name, url, size = 32, label }: { name: string | null | undefined; url?: string | null | undefined; size?: number; label?: string }) {
  const src = avatarSrc(url);
  const initial = (name ?? '').trim().slice(0, 1).toUpperCase() || '·';
  return (
    <span className="av" style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }} {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}>
      {src ? <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" /> : initial}
    </span>
  );
}

/** A row that clearly navigates (iOS LinkRow): icon in a soft circle, label, chevron. */
export function LinkRow({ icon, label, sub, to, onClick, first, danger, external }: { icon: ReactNode; label: string; sub?: string | undefined; to?: string; onClick?: () => void; first?: boolean; danger?: boolean; external?: boolean }) {
  const cls = ['lr', first ? 'first' : '', danger ? 'danger' : ''].filter(Boolean).join(' ');
  const subId = useId();
  // The label is the accessible name; the secondary line is its description.
  const a11y = sub ? { 'aria-label': label, 'aria-describedby': subId } : {};
  const inner = <><span className="ci" aria-hidden="true">{icon}</span><span className="lb">{label}{sub && <small id={subId}>{sub}</small>}</span><ChevronRightIcon width={16} height={16} aria-hidden="true" /></>;
  if (to && external) return <a className={cls} href={to} {...a11y}>{inner}</a>;
  if (to) return <Link className={cls} to={to} {...a11y}>{inner}</Link>;
  return <button type="button" className={cls} onClick={onClick} {...a11y}>{inner}</button>;
}

export const Pill = ({ children, tone }: { children: ReactNode; tone?: 'good' | 'warn' | '' }) => <span className={`pill${tone ? ` ${tone}` : ''}`}>{children}</span>;
export const Tag = ({ children }: { children: ReactNode }) => <span className="tag">{children}</span>;

/** Empty, error and gated states: icon, title, one line, next step. */
export function StateBlock({ icon, title, children, action, headingLevel = 2 }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode; headingLevel?: 1 | 2 }) {
  const H = headingLevel === 1 ? 'h1' : 'h2';
  return (
    <div className="state">
      {icon}
      <H>{title}</H>
      {children ? <p>{children}</p> : null}
      {action}
    </div>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return <p className="loading" role="status">{label}</p>;
}

/** Card-shaped placeholders while a list loads (no large blank areas, spec §5). */
export function SkeletonCards({ count = 3, label = 'Loading meals' }: { count?: number; label?: string }) {
  return (
    <div className="cards" aria-busy="true" role="status">
      <span className="vh">{label}</span>
      {Array.from({ length: count }, (_, i) => (
        <div className="card" key={i} aria-hidden="true">
          <div className="body">
            <span className="photo sk" />
            <span className="copy">
              <span className="sk" style={{ height: 14, width: '70%', margin: '2px 0 8px' }} />
              <span className="sk" style={{ height: 10, width: '50%', marginBottom: 8 }} />
              <span className="sk" style={{ height: 10, width: '60%', marginBottom: 6 }} />
              <span className="sk" style={{ height: 10, width: '40%' }} />
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
