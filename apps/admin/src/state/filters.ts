import { LEGACY_LANGUAGE_LABELS } from '@fancy/contracts';
import type { Language } from '../i18n.ts';

/**
 * Canonical admin filters (measurement contract §5), persisted in the URL with the contract's
 * field names. Empty set = all; same field OR, across fields AND (evaluated by the server).
 */
export const LANGUAGE_FILTERS = ['en', 'zh'] as const;
export const SIZE_FILTERS = ['2', '3', '4', '5', '6', '7+'] as const;
export const BUDGET_BANDS = ['0-20', '20-30', '30-40', '40+', 'unknown'] as const;
export const SEGMENTS = ['new', 'existing'] as const;

export type LanguageFilter = (typeof LANGUAGE_FILTERS)[number];
export type SizeFilter = (typeof SIZE_FILTERS)[number];
export type BudgetBand = (typeof BUDGET_BANDS)[number];
export type Segment = (typeof SEGMENTS)[number];

export interface AdminFilters {
  /** YYYY-MM-DD, London calendar day; '' = default range ending at the snapshot day. */
  from: string;
  to: string;
  areas: string[];
  sources: string[];
  segments: Segment[];
  languages: LanguageFilter[];
  sizes: SizeFilter[];
  budgetBands: BudgetBand[];
}

export type SetField = 'areas' | 'sources' | 'segments' | 'languages' | 'sizes' | 'budgetBands';
export const SET_FIELDS: readonly SetField[] = ['areas', 'sources', 'segments', 'languages', 'sizes', 'budgetBands'];

/** G1: the contract carries `segments` (new|existing) on page, drilldown and export filters. */
export const SEGMENTS_SUPPORTED = true;

export const emptyFilters = (): AdminFilters => ({
  from: '', to: '', areas: [], sources: [], segments: [], languages: [], sizes: [], budgetBands: [],
});

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isDate = (value: string) => DATE.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`))
  && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
/** Contract slugs: areas `a-z0-9` with single hyphens, sources `a-z0-9_-`. Legacy labels ("Soho") are lower-cased/hyphenated. */
const AREA_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SOURCE_SLUG = /^[a-z0-9_-]+$/;
const slug = (v: string) => v.trim().toLowerCase().replace(/\s+/g, '-');

const ordered = <T extends string>(domain: readonly T[], values: Iterable<string>): T[] => {
  const set = new Set(values);
  return domain.filter((v) => set.has(v));
};
const slugSet = (pattern: RegExp) => (values: Iterable<string>): string[] =>
  [...new Set([...values].map(slug).filter((v) => pattern.test(v)))].sort();
const areaSet = slugSet(AREA_SLUG);
const sourceSet = slugSet(SOURCE_SLUG);

const list = (raw: string | null): string[] => (!raw || raw === 'all' ? [] : raw.split(',').filter(Boolean));

/** Legacy prototype values (admin/src) → canonical values. Unrepresentable values are dropped. */
const legacyLanguages = (values: string[]): string[] => values.flatMap((v): readonly string[] => {
  if (v === '中文 / English') return ['zh'];
  return LEGACY_LANGUAGE_LABELS[v] ?? [v];
});
const legacySizes = (values: string[]): string[] =>
  values.flatMap((v) => (v === 'duo' ? ['2'] : v === 'group' ? ['3', '4', '5', '6'] : [v]));
/** Old "≤ £30" equals the [0,20]∪(20,30] bands; "≤ £25" has no exact band and is dropped (reported as gap G7). */
const legacyBudgets = (values: string[]): string[] => values.flatMap((v) => (v === '30' ? ['0-20', '20-30'] : [v]));

export interface UrlState {
  filters: AdminFilters;
  lang: Language;
  snapshotId: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Reads canonical keys first, then the prototype's legacy keys (start/end/area/…); invalid input falls back to defaults. */
export function parseSearch(search: string): UrlState {
  const params = new URLSearchParams(search);
  const pick = (key: string, legacy: string) => (params.has(key) ? params.get(key) : params.get(legacy));
  let from = pick('from', 'start') ?? '';
  let to = pick('to', 'end') ?? '';
  if (!isDate(from) || !isDate(to) || from > to) { from = ''; to = ''; }
  const filters: AdminFilters = {
    from,
    to,
    areas: areaSet(list(pick('areas', 'area'))),
    sources: sourceSet(list(pick('sources', 'source'))),
    segments: ordered(SEGMENTS, list(pick('segments', 'segment'))),
    languages: ordered(LANGUAGE_FILTERS, legacyLanguages(list(pick('languages', 'language')))),
    sizes: ordered(SIZE_FILTERS, legacySizes(list(pick('sizes', 'size')))),
    budgetBands: ordered(BUDGET_BANDS, legacyBudgets(list(pick('budgetBands', 'budget')))),
  };
  const snapshot = params.get('snapshot');
  return { filters, lang: params.get('lang') === 'en' ? 'en' : 'zh', snapshotId: snapshot && UUID.test(snapshot) ? snapshot.toLowerCase() : null };
}

/** Writes only canonical keys, so refresh/back restores the same state. */
export function toSearch({ filters, lang, snapshotId }: UrlState): string {
  const params = new URLSearchParams();
  if (filters.from && filters.to) { params.set('from', filters.from); params.set('to', filters.to); }
  for (const field of SET_FIELDS) if (filters[field].length) params.set(field, filters[field].join(','));
  params.set('lang', lang);
  if (snapshotId) params.set('snapshot', snapshotId);
  return `?${params}`;
}

export const addDays = (day: string, days: number): string =>
  new Date(Date.parse(`${day}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/** Inclusive range of `days` London calendar days ending at `endDay`. */
export const rangeEnding = (endDay: string, days: number) => ({ from: addDays(endDay, -(days - 1)), to: endDay });

export const DEFAULT_RANGE_DAYS = 28;

export type DateCheck = 'ok' | 'missing' | 'reversed' | 'after_snapshot';

/** PRD §3.1: start after end, a missing date, or an end after the snapshot day is an error. */
export function checkDates(from: string, to: string, snapshotDay: string): DateCheck {
  if (!from || !to || !isDate(from) || !isDate(to)) return 'missing';
  if (from > to) return 'reversed';
  if (to > snapshotDay) return 'after_snapshot';
  return 'ok';
}

/** Effective dates for a snapshot: URL dates if still valid for it, else the default 28-day range. */
export function effectiveDates(filters: AdminFilters, snapshotDay: string) {
  return checkDates(filters.from, filters.to, snapshotDay) === 'ok'
    ? { from: filters.from, to: filters.to }
    : rangeEnding(snapshotDay, DEFAULT_RANGE_DAYS);
}

export interface FilterQuery {
  from: string;
  to: string;
  areas?: string;
  languages?: string;
  budgetBands?: string;
  sizes?: string;
  sources?: string;
  segments?: string;
}

/** Contract query (adminPage/adminDrilldown/adminExport filters) in a stable canonical order. */
export function toQuery(filters: AdminFilters, snapshotDay: string): FilterQuery {
  const query: FilterQuery = effectiveDates(filters, snapshotDay);
  if (filters.areas.length) query.areas = areaSet(filters.areas).join(',');
  if (filters.sources.length) query.sources = sourceSet(filters.sources).join(',');
  if (filters.languages.length) query.languages = ordered(LANGUAGE_FILTERS, filters.languages).join(',');
  if (filters.sizes.length) query.sizes = ordered(SIZE_FILTERS, filters.sizes).join(',');
  if (filters.segments.length) query.segments = ordered(SEGMENTS, filters.segments).join(',');
  if (filters.budgetBands.length) query.budgetBands = ordered(BUDGET_BANDS, filters.budgetBands).join(',');
  return query;
}

/** Stable key for caching one (snapshot, page, filters) combination. */
export const queryKey = (query: FilterQuery): string =>
  (Object.keys(query) as (keyof FilterQuery)[]).sort().map((k) => `${k}=${query[k] ?? ''}`).join('&');

/** Hidden "more filters" count shown on the popover trigger. */
export const advancedCount = (filters: AdminFilters) =>
  [filters.languages, filters.sizes, filters.budgetBands].filter((v) => v.length > 0).length;
