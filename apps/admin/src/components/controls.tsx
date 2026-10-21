import { useEffect, useRef, type ReactNode } from 'react';
import type { Translate } from '../i18n.ts';
import { Icon } from './Icon.tsx';

export function NativeSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (value: string) => void; options: [string, string][];
}) {
  return (
    <label className="select-control">
      <span>{label}</span>
      <span className="select-wrap">
        <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
        </select>
        <Icon name="down" size={14} />
      </span>
    </label>
  );
}

/**
 * Multi-select disclosure (prototype behaviour): outside click/focus, Escape and route change close it;
 * Escape returns focus to the trigger. `value` is the selected set; empty = all.
 */
export function MultiSelect({ label, allLabel, value, options, onChange }: {
  label: string; allLabel: string; value: readonly string[]; options: [string, string][]; onChange: (value: string[]) => void;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const dismiss = (event: Event) => {
      if (ref.current?.open && !ref.current.contains(event.target as Node)) ref.current.open = false;
    };
    const close = () => { if (ref.current) ref.current.open = false; };
    document.addEventListener('click', dismiss);
    document.addEventListener('focusin', dismiss);
    window.addEventListener('hashchange', close);
    return () => {
      document.removeEventListener('click', dismiss);
      document.removeEventListener('focusin', dismiss);
      window.removeEventListener('hashchange', close);
    };
  }, []);
  const names = value.map((v) => options.find(([key]) => key === v)?.[1] ?? v);
  return (
    <details ref={ref} className="multi-select select-control" onKeyDown={(e) => {
      if (e.key === 'Escape' && ref.current?.open) {
        e.stopPropagation(); e.preventDefault(); ref.current.open = false; ref.current.querySelector('summary')?.focus();
      }
    }}>
      <summary aria-label={label}>
        <span className="multi-caption"><span className="filter-label">{label}</span><span>{names.length ? names.join('、') : allLabel}</span></span>
        <Icon name="down" size={14} />
      </summary>
      <div className="multi-options" role="group" aria-label={label}>
        <label><input type="checkbox" checked={!value.length} onChange={() => onChange([])} />{allLabel}</label>
        {options.map(([v, text]) => (
          <label key={v}>
            <input type="checkbox" checked={value.includes(v)} onChange={() =>
              onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v])} />
            {text}
          </label>
        ))}
      </div>
    </details>
  );
}

export function FilterPopover({ children, t, count, route }: { children: ReactNode; t: Translate; count: number; route: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const dismiss = (event: Event) => {
      if (ref.current?.open && !ref.current.contains(event.target as Node)) ref.current.open = false;
    };
    document.addEventListener('pointerdown', dismiss, true);
    document.addEventListener('focusin', dismiss);
    return () => {
      document.removeEventListener('pointerdown', dismiss, true);
      document.removeEventListener('focusin', dismiss);
    };
  }, []);
  useEffect(() => { if (ref.current) ref.current.open = false; }, [route]);
  return (
    <details className="advanced-filter" ref={ref} onKeyDown={(event) => {
      if (event.key === 'Escape' && ref.current?.open) {
        event.preventDefault(); event.stopPropagation(); ref.current.open = false; ref.current.querySelector('summary')?.focus();
      }
    }}>
      <summary>
        {t('更多筛选', 'More filters')}
        {count > 0 && <span className="filter-count">{count}</span>}
        <Icon name="down" size={13} />
      </summary>
      <div>{children}</div>
    </details>
  );
}
