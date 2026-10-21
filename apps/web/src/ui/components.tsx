import { useId, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ChevronLeftIcon } from '@radix-ui/react-icons';
import { initials } from '../lib/format.ts';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { secondary?: boolean };

export function Primary({ secondary, className, type = 'button', children, ...rest }: ButtonProps) {
  return (
    <button type={type} className={`primary${secondary ? ' secondary' : ''}${className ? ` ${className}` : ''}`} {...rest}>
      {children}
    </button>
  );
}

export function PrimaryLink({ to, secondary, children }: { to: string; secondary?: boolean; children: ReactNode }) {
  return <Link to={to} className={`primary${secondary ? ' secondary' : ''}`}>{children}</Link>;
}

export function TextAction({ danger, type = 'button', className, ...rest }: ButtonProps & { danger?: boolean }) {
  return <button type={type} className={`text-action${danger ? ' danger' : ''}${className ? ` ${className}` : ''}`} {...rest} />;
}

/** Labelled native control; `error` is announced via aria-describedby. */
export function Field({ label, hint, error, children }: {
  label: string; hint?: string | undefined; error?: string | undefined;
  children: (props: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: true }) => ReactNode;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : '', error ? errorId : ''].filter(Boolean).join(' ');
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children({ id, ...(describedBy ? { 'aria-describedby': describedBy } : {}), ...(error ? { 'aria-invalid': true as const } : {}) })}
      {hint && <small id={hintId}>{hint}</small>}
      {error && <span className="field-error" id={errorId}>{error}</span>}
    </div>
  );
}

/** Radio (single) or checkbox (multi) chip group, as the prototype's ChoiceGroup. */
export function ChoiceGroup<V extends string>({ label, options, value, onChange, multiple }: {
  label: string;
  options: ReadonlyArray<readonly [V, string]>;
  value: V | readonly V[] | null;
  onChange: (value: V) => void;
  multiple?: boolean;
}) {
  const name = useId();
  const selected = (v: V) => (Array.isArray(value) ? value.includes(v) : value === v);
  return (
    <fieldset className="filter-section">
      <legend>{label}</legend>
      <div className="choice-grid">
        {options.map(([v, text]) => (
          <label key={v} className={`choice-chip${selected(v) ? ' chosen' : ''}`}>
            <input type={multiple ? 'checkbox' : 'radio'} name={name} value={v} checked={selected(v)} onChange={() => onChange(v)} />
            {text}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function Notice({ icon, children, role }: { icon?: ReactNode; children: ReactNode; role?: 'status' | 'alert' }) {
  return <div className="notice" {...(role ? { role } : {})}>{icon}<span>{children}</span></div>;
}

export function FormError({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p className="form-error" role="alert">{children}</p>;
}

export function PageHeader({ title, backTo,backState }: { title: string; backTo?: string;backState?:unknown }) {
  return (
    <header className="page-header">
      {backTo ? <Link to={backTo} state={backState} aria-label="Back"><ChevronLeftIcon /></Link> : <span />}
      <strong>{title}</strong>
      <span />
    </header>
  );
}

export function Avatar({ name, url, size = 40 }: { name: string | null | undefined; url?: string | null | undefined; size?: number }) {
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: Math.round(size / 2.8) }} aria-hidden={url ? undefined : true}>
      {url ? <img src={url} alt="" /> : initials(name)}
    </span>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return <p className="loading" role="status">{label}</p>;
}
