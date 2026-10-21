import type { CuisineCode, DietaryCode, LanguageCode, MoodCode } from '@fancy/contracts';
import type { RequestOf } from '@fancy/client';

export type DiscoverQuery = NonNullable<RequestOf<'discoverMeals'>['query']>;
export type TimeOfDay = 'any' | 'lunch' | 'dinner';

/** Applied vs pending filters (UX contract): the sheet edits a copy; Apply commits, closing discards. */
export interface Filters {
  dates: string[];
  timeOfDay: TimeOfDay;
  tableSizes: number[];
  budgetMaxPence: number | null;
  languages: LanguageCode[];
  moods: MoodCode[];
  cuisineCodes: CuisineCode[];
  dietaryCodes: DietaryCode[];
  keyword: string;
}

export const emptyFilters = (): Filters => ({ dates: [], timeOfDay: 'any', tableSizes: [], budgetMaxPence: null, languages: [], moods: [], cuisineCodes: [], dietaryCodes: [], keyword: '' });

export const BUDGET_STEPS = [2000, 3000, 4000] as const;

/** OR within a dimension (comma list), AND across dimensions; empty dimensions are omitted (= Any). */
export function toQuery(f: Filters, cursor?: string): DiscoverQuery {
  const csv = <T extends string | number>(v: readonly T[]) => (v.length ? [...new Set(v)].sort().join(',') : undefined);
  const q: DiscoverQuery = {};
  const dates = csv(f.dates);
  if (dates) q.dates = dates;
  if (f.timeOfDay !== 'any') q.timeOfDay = f.timeOfDay;
  const sizes = csv(f.tableSizes);
  if (sizes) q.tableSizes = sizes;
  if (f.budgetMaxPence !== null) q.budgetMaxPence = f.budgetMaxPence;
  const langs = csv(f.languages);
  if (langs) q.languages = langs;
  const moods = csv(f.moods);
  if (moods) q.moods = moods;
  const cuisines = csv(f.cuisineCodes);
  if (cuisines) q.cuisineCodes = cuisines;
  const dietary = csv(f.dietaryCodes);
  if (dietary) q.dietaryCodes = dietary;
  const keyword = f.keyword.trim();
  if (keyword) q.keyword = keyword.slice(0, 80);
  if (cursor) q.cursor = cursor;
  return q;
}

export const activeFilterCount = (f: Filters) =>
  [f.dates.length, f.timeOfDay !== 'any', f.tableSizes.length, f.budgetMaxPence !== null, f.languages.length, f.moods.length, f.cuisineCodes.length, f.dietaryCodes.length, f.keyword.trim()].filter(Boolean).length;

export const toggle = <T,>(list: readonly T[], v: T): T[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
