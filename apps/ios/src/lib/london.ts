/**
 * Calendar helpers on London wall-clock strings (YYYY-MM-DD / HH:mm). Pure string/UTC-date
 * arithmetic: no device time-zone guessing. DST validity is decided by the server (TIME_AMBIGUOUS /
 * TIME_NONEXISTENT), never silently corrected here.
 */
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const parts = (date: string) => date.split('-').map(Number) as [number, number, number];
const utc = (date: string) => {
  const [y, m, d] = parts(date);
  return new Date(Date.UTC(y, m - 1, d));
};
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function addDays(date: string, days: number): string {
  const d = utc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return iso(d);
}

export function longDate(date: string): string {
  const d = utc(date);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export function monthTitle(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return `${MONTHS_LONG[m - 1]} ${y}`;
}

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

/** Calendar grid for a month: leading blanks (Monday-first) and the dates. */
export function monthGrid(month: string): { leading: number; dates: string[] } {
  const first = `${month}-01`;
  const leading = (utc(first).getUTCDay() + 6) % 7;
  const dates: string[] = [];
  for (let d = first; d.startsWith(month); d = addDays(d, 1)) dates.push(d);
  return { leading, dates };
}

/** Today's date in London (Intl with explicit zone; injectable for tests). */
export function londonToday(now: number = Date.now()): string {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' });
  return fmt.format(new Date(now));
}

/** Half-hour start slots (API §6: Create starts on half-hour slots). */
export const HALF_HOUR_SLOTS: string[] = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);

/** Wall-clock minus minutes, rolling the date (e.g. 00:30 − 60 → previous day 23:30). */
export function minusMinutes(date: string, time: string, minutes: number): { date: string; time: string } {
  const [h, m] = time.split(':').map(Number) as [number, number];
  let total = h * 60 + m - minutes;
  let d = date;
  while (total < 0) {
    total += 1440;
    d = addDays(d, -1);
  }
  return { date: d, time: `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}` };
}

/** Wall-clock order comparison; equal returns 0. */
export function compareWall(a: { date: string; time: string }, b: { date: string; time: string }): number {
  return `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`);
}

/** Minutes between two wall-clock values ignoring DST (used only for the local T−30 sanity check). */
export function wallMinutesBetween(earlier: { date: string; time: string }, later: { date: string; time: string }): number {
  const toMin = (v: { date: string; time: string }) => {
    const [h, m] = v.time.split(':').map(Number) as [number, number];
    return utc(v.date).getTime() / 60000 + h * 60 + m;
  };
  return toMin(later) - toMin(earlier);
}

export const offsetLabel = (minutes: number) => (minutes === 60 ? 'BST' : minutes === 0 ? 'GMT' : `UTC${minutes >= 0 ? '+' : '−'}${Math.abs(minutes / 60)}`);
