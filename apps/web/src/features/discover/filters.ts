import { CUISINES, DIETARY, LANGUAGES, MOODS, TIME_OF_DAY, type CuisineCode, type DietaryCode, type LanguageCode, type MoodCode } from '@fancy/contracts';
import type { DiscoverQuery } from '../../api/types.ts';
import { validBounds,type Bounds } from '../maps/googleMaps.ts';

export type TimeOfDay = (typeof TIME_OF_DAY)[number];

/** Applied Discover filters (API §6). They live in the URL so back navigation restores them. */
export interface Filters {
  bounds:Bounds|null;
  dates: string[];
  timeOfDay: TimeOfDay;
  areaCodes: string[];
  budgetMaxPence: number | null;
  tableSizes: number[];
  languages: LanguageCode[];
  moods: MoodCode[];
  cuisineCodes: CuisineCode[];
  dietaryCodes: DietaryCode[];
  keyword: string;
}

export const emptyFilters: Filters = {
  bounds:null,
  dates: [], timeOfDay: 'any', areaCodes: [], budgetMaxPence: null, tableSizes: [], languages: [], moods: [], cuisineCodes: [], dietaryCodes: [], keyword: '',
};

const list = (v: string | null) => (v ? v.split(',').filter(Boolean) : []);
const only = <T extends string>(values: string[], allowed: readonly string[]) => [...new Set(values.filter((v) => allowed.includes(v)))] as T[];

/** Tolerant parse: unknown values in a shared/old link are dropped, never sent. */
export function parseFilters(params: URLSearchParams): Filters {
  const tod = params.get('timeOfDay');
  const budget = Number(params.get('budgetMaxPence'));
  const bounds=Object.fromEntries((['north','south','east','west'] as const).map(k=>[k,params.has(k)?Number(params.get(k)):NaN])) as unknown as Bounds;
  return {
    bounds:validBounds(bounds)?bounds:null,
    dates: [...new Set(list(params.get('dates')).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort(),
    timeOfDay: tod && (TIME_OF_DAY as readonly string[]).includes(tod) ? (tod as TimeOfDay) : 'any',
    areaCodes: [...new Set(list(params.get('areaCodes')).filter((a) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(a)))],
    budgetMaxPence: Number.isInteger(budget) && budget > 0 ? budget : null,
    tableSizes: [...new Set(list(params.get('tableSizes')).map(Number).filter((n) => Number.isInteger(n) && n >= 2 && n <= 6))].sort(),
    languages: only<LanguageCode>(list(params.get('languages')), Object.keys(LANGUAGES)),
    moods: only<MoodCode>(list(params.get('moods')), Object.keys(MOODS)),
    cuisineCodes: only<CuisineCode>(list(params.get('cuisineCodes')), Object.keys(CUISINES)),
    dietaryCodes: only<DietaryCode>(list(params.get('dietaryCodes')), Object.keys(DIETARY)),
    keyword: (params.get('keyword') ?? '').trim().slice(0, 80),
  };
}

/** URL form, also the cache key; `view` and other UI params are preserved by the caller. */
export function filtersToParams(f: Filters, base: URLSearchParams = new URLSearchParams()): URLSearchParams {
  const p = new URLSearchParams(base);
  for(const key of ['north','south','east','west'] as const){if(f.bounds)p.set(key,String(f.bounds[key]));else p.delete(key);}
  const setList = (k: string, v: readonly (string | number)[]) => (v.length ? p.set(k, v.join(',')) : p.delete(k));
  setList('dates', f.dates);
  if (f.timeOfDay !== 'any') p.set('timeOfDay', f.timeOfDay); else p.delete('timeOfDay');
  setList('areaCodes', f.areaCodes);
  if (f.budgetMaxPence) p.set('budgetMaxPence', String(f.budgetMaxPence)); else p.delete('budgetMaxPence');
  setList('tableSizes', f.tableSizes);
  setList('languages', f.languages);
  setList('moods', f.moods);
  setList('cuisineCodes', f.cuisineCodes);
  setList('dietaryCodes', f.dietaryCodes);
  if (f.keyword.trim()) p.set('keyword', f.keyword.trim()); else p.delete('keyword');
  return p;
}

/** Comma lists per DiscoverQuery; empty dimensions are omitted (= Any). */
export function filtersToQuery(f: Filters, cursor?: string): DiscoverQuery {
  const q: DiscoverQuery = {...(f.bounds??{})};
  if (f.dates.length) q.dates = f.dates.join(',');
  if (f.timeOfDay !== 'any') q.timeOfDay = f.timeOfDay;
  if (f.areaCodes.length) q.areaCodes = f.areaCodes.join(',');
  if (f.budgetMaxPence) q.budgetMaxPence = f.budgetMaxPence;
  if (f.tableSizes.length) q.tableSizes = f.tableSizes.join(',');
  if (f.languages.length) q.languages = f.languages.join(',');
  if (f.moods.length) q.moods = f.moods.join(',');
  if (f.cuisineCodes.length) q.cuisineCodes = f.cuisineCodes.join(',');
  if (f.dietaryCodes.length) q.dietaryCodes = f.dietaryCodes.join(',');
  if (f.keyword.trim()) q.keyword = f.keyword.trim();
  if (cursor) q.cursor = cursor;
  return q;
}

/** Count of active "More filters" dimensions (date and size have their own buttons). */
export function moreFilterCount(f: Filters): number {
  return [f.timeOfDay !== 'any', f.areaCodes.length > 0, f.budgetMaxPence !== null, f.languages.length > 0, f.moods.length > 0, f.cuisineCodes.length > 0, f.dietaryCodes.length > 0, f.keyword !== ''].filter(Boolean).length;
}

/** Next `days` London calendar dates starting today (device clock only picks chips; the server filters). */
export function upcomingLondonDates(days: number, now: number = Date.now()): string[] {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' });
  const [y, m, d] = fmt.format(now).split('-').map(Number) as [number, number, number];
  return Array.from({ length: days }, (_, i) => new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10));
}

export const toggle = <T,>(values: readonly T[], value: T): T[] => (values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);
