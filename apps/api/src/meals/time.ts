import { DomainError } from '../common/errors.ts';
export interface TimeInput { localDate: string; localTime: string; timeZone: 'Europe/London'; utcOffsetMinutes?: number }
export interface ZonedTime { instant: string; localDate: string; localTime: string; timeZone: 'Europe/London'; utcOffsetMinutes: number }
const format = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
export function londonTime(at: Date): ZonedTime {
  const parts = Object.fromEntries(format.formatToParts(at).map((p) => [p.type, p.value]));
  const localDate = `${parts.year}-${parts.month}-${parts.day}`, localTime = `${parts.hour}:${parts.minute}`;
  const wall = Date.parse(`${localDate}T${localTime}:00Z`);
  // Both sides must use minute precision; seconds/milliseconds are not part of a zone offset.
  const utcMinute = Math.floor(at.getTime() / 60_000) * 60_000;
  return { instant: at.toISOString(), localDate, localTime, timeZone: 'Europe/London', utcOffsetMinutes: (wall - utcMinute) / 60_000 };
}
/** Match possible offsets against IANA zone data; no silent DST normalisation. */
export function resolveLondonTime(input: TimeInput): ZonedTime {
  if (input.timeZone !== 'Europe/London' || !/^\d{4}-\d{2}-\d{2}$/.test(input.localDate) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.localTime)) throw new DomainError('VALIDATION_FAILED', 'Invalid London date/time.');
  const wall = Date.parse(`${input.localDate}T${input.localTime}:00Z`);
  if (!Number.isFinite(wall) || new Date(wall).toISOString().slice(0,10) !== input.localDate) throw new DomainError('VALIDATION_FAILED', 'Invalid date.');
  const choices = [0,60].map((offset) => londonTime(new Date(wall - offset * 60_000))).filter((v) => v.localDate === input.localDate && v.localTime === input.localTime);
  if (!choices.length) throw new DomainError('TIME_NONEXISTENT', 'This local time does not exist. Choose another time.');
  if (input.utcOffsetMinutes === undefined && choices.length > 1) throw new DomainError('TIME_AMBIGUOUS', 'Choose BST or GMT for this repeated time.', { choices: choices.map((c) => ({ utcOffsetMinutes: c.utcOffsetMinutes, label: c.utcOffsetMinutes === 60 ? 'BST' : 'GMT', instant: c.instant })) });
  const chosen = input.utcOffsetMinutes === undefined ? choices[0] : choices.find((c) => c.utcOffsetMinutes === input.utcOffsetMinutes);
  if (!chosen) throw new DomainError('INVALID_OFFSET', 'The selected offset does not match London time.');
  return chosen;
}
