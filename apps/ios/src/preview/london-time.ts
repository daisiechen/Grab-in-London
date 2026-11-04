/**
 * Europe/London wall time for the preview fake, from the fixed UK rule (BST from the last Sunday of
 * March 01:00 UTC to the last Sunday of October 01:00 UTC). Mirrors the server's resolveLondonTime:
 * a repeated wall time needs an explicit offset and a skipped one is rejected, never shifted.
 */
export interface ZonedTime {
  instant: string;
  localDate: string;
  localTime: string;
  timeZone: 'Europe/London';
  utcOffsetMinutes: number;
}
export interface TimeInput {
  localDate: string;
  localTime: string;
  timeZone: 'Europe/London';
  utcOffsetMinutes?: number;
}
export type TimeProblem =
  | { code: 'VALIDATION_FAILED' }
  | { code: 'TIME_NONEXISTENT' }
  | { code: 'TIME_AMBIGUOUS'; choices: Array<{ utcOffsetMinutes: number; label: string; instant: string }> }
  | { code: 'INVALID_OFFSET' };

const MINUTE = 60_000;

function lastSundayAt0100Utc(year: number, month: number): number {
  const last = new Date(Date.UTC(year, month + 1, 0));
  return Date.UTC(year, month, last.getUTCDate() - last.getUTCDay(), 1);
}

export function londonOffsetMinutes(ms: number): number {
  const year = new Date(ms).getUTCFullYear();
  return ms >= lastSundayAt0100Utc(year, 2) && ms < lastSundayAt0100Utc(year, 9) ? 60 : 0;
}

export function londonTime(ms: number): ZonedTime {
  const offset = londonOffsetMinutes(ms);
  const wall = new Date(ms + offset * MINUTE).toISOString();
  return { instant: new Date(ms).toISOString(), localDate: wall.slice(0, 10), localTime: wall.slice(11, 16), timeZone: 'Europe/London', utcOffsetMinutes: offset };
}

/** London wall time → instant, or the contract error the server would return. */
export function resolveLondonTime(input: TimeInput): ZonedTime | TimeProblem {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.localDate) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.localTime)) return { code: 'VALIDATION_FAILED' };
  const wall = Date.parse(`${input.localDate}T${input.localTime}:00Z`);
  if (!Number.isFinite(wall) || new Date(wall).toISOString().slice(0, 10) !== input.localDate) return { code: 'VALIDATION_FAILED' };
  const choices = [0, 60].map((offset) => londonTime(wall - offset * MINUTE)).filter((z) => z.localDate === input.localDate && z.localTime === input.localTime);
  if (!choices.length) return { code: 'TIME_NONEXISTENT' };
  if (input.utcOffsetMinutes === undefined && choices.length > 1) {
    return { code: 'TIME_AMBIGUOUS', choices: choices.map((c) => ({ utcOffsetMinutes: c.utcOffsetMinutes, label: c.utcOffsetMinutes === 60 ? 'BST' : 'GMT', instant: c.instant })) };
  }
  const chosen = input.utcOffsetMinutes === undefined ? choices[0] : choices.find((c) => c.utcOffsetMinutes === input.utcOffsetMinutes);
  return chosen ?? { code: 'INVALID_OFFSET' };
}

/** Instant of a London wall time known to be unambiguous (seed data). */
export function londonInstant(localDate: string, localTime: string): number {
  const resolved = resolveLondonTime({ localDate, localTime, timeZone: 'Europe/London' });
  if (!('instant' in resolved)) throw new Error(`Seed time ${localDate} ${localTime} is not a unique London time`);
  return Date.parse(resolved.instant);
}
