import { useId, useState } from 'react';
import { addMonths, londonToday, longDate, monthGrid, monthTitle } from '../lib/london.ts';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/**
 * Month/day chooser on London calendar dates (iOS DateChoices). Past dates, and any after `latest`,
 * are disabled. Real checkbox/radio inputs, so keyboard and screen readers work natively.
 */
export function DateChoices({ label, selected, onToggle, today = londonToday(), latest, multiple = false }: {
  label: string; selected: readonly string[]; onToggle: (date: string) => void; today?: string; latest?: string | undefined; multiple?: boolean;
}) {
  const [month, setMonth] = useState((selected[0] ?? today).slice(0, 7));
  const name = useId();
  const { leading, dates } = monthGrid(month);
  const canGoBack = month > today.slice(0, 7);
  return (
    <fieldset className="field cal">
      <legend>{label}</legend>
      <div className="cal-head">
        <button type="button" aria-label="Previous month" disabled={!canGoBack} onClick={() => setMonth(addMonths(month, -1))}>‹</button>
        <strong aria-live="polite">{monthTitle(month)}</strong>
        <button type="button" aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))}>›</button>
      </div>
      <div className="cal-grid">
        {WEEKDAYS.map((w, i) => <span key={i} className="wd" aria-hidden="true">{w}</span>)}
        {Array.from({ length: leading }, (_, i) => <span key={`b${i}`} />)}
        {dates.map((d) => {
          const off = d < today || (latest !== undefined && d > latest);
          const on = selected.includes(d);
          return (
            <label key={d} className={`cal-day${on ? ' on' : ''}${off ? ' off' : ''}`}>
              <input type={multiple ? 'checkbox' : 'radio'} name={name} checked={on} disabled={off} aria-label={longDate(d)} onChange={() => onToggle(d)} />
              <span aria-hidden="true">{Number(d.slice(8))}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
