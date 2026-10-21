/** en-GB / Europe/London / GBP presentation helpers. Times shown are server-provided London wall times. */

const whole = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });
const exact = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "£25" for whole pounds, "£25.50" otherwise (integer pence in, never floating money maths). */
export const formatPence = (pence: number): string => (pence % 100 === 0 ? whole : exact).format(pence / 100);

/** Prototype style: "£25–40" (second bound without the symbol), or a single "£30". */
export function budgetRange(minPence: number, maxPence: number): string {
  if (minPence === maxPence) return formatPence(minPence);
  return `${formatPence(minPence)}–${formatPence(maxPence).replace('£', '')}`;
}

/** "Fri 23 Oct" from a YYYY-MM-DD London calendar date, without involving the device time zone. */
export function longDate(localDate: string): string {
  const [y, m, d] = localDate.split('-').map(Number) as [number, number, number];
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(Date.UTC(y, m - 1, d));
}

const lastSunday = (year: number, month: number): number => {
  const last = new Date(Date.UTC(year, month, 0));
  return last.getUTCDate() - last.getUTCDay();
};

/** London changes clocks on the last Sunday of March and October (UK rule). */
export function isLondonTransitionDate(localDate: string): boolean {
  const [y, m, d] = localDate.split('-').map(Number) as [number, number, number];
  return (m === 3 || m === 10) && d === lastSunday(y, m);
}

export const offsetLabel = (utcOffsetMinutes: number): string => (utcOffsetMinutes === 60 ? 'BST' : utcOffsetMinutes === 0 ? 'GMT' : `UTC${utcOffsetMinutes >= 0 ? '+' : ''}${utcOffsetMinutes / 60}`);

export interface ZonedLike { localDate: string; localTime: string; utcOffsetMinutes: number }

/** "Fri 23 Oct · 19:30 London time"; adds BST/GMT on clock-change days so repeated times stay unambiguous. */
export function zonedLabel(z: ZonedLike): string {
  return `${longDate(z.localDate)} · ${timeLabel(z)}`;
}

/** "19:30 London time", or "01:30 GMT London time" on a clock-change day. */
export function timeLabel(z: ZonedLike): string {
  return isLondonTransitionDate(z.localDate) ? `${z.localTime} ${offsetLabel(z.utcOffsetMinutes)} London time` : `${z.localTime} London time`;
}

export function initials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? '?').toUpperCase() + (parts[1]?.[0] ?? '').toUpperCase();
}
