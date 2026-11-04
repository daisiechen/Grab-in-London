export type Language = 'zh' | 'en';
export type Translate = (zh: string, en: string) => string;

export const makeT = (lang: Language): Translate => (zh, en) => (lang === 'zh' ? zh : en);

const locale = (lang: Language) => (lang === 'zh' ? 'zh-CN' : 'en-GB');

/** Server ratio shape (AdminPageData metrics/series values). */
export interface RatioValue {
  numerator: number;
  denominator: number;
}
export type MetricValue = RatioValue | number | null;

export const isRatio = (value: MetricValue | undefined): value is RatioValue =>
  typeof value === 'object' && value !== null && 'numerator' in value && 'denominator' in value;

export const formatNumber = (lang: Language, value: number | null | undefined): string =>
  value === null || value === undefined || !Number.isFinite(value) ? '—' : value.toLocaleString(locale(lang));

/**
 * Presentation only: renders a server-supplied numerator/denominator pair as a percentage.
 * A zero denominator, null or a missing value is "—" (never 0%).
 */
export const formatRatio = (value: MetricValue | undefined): string => {
  if (!isRatio(value) || value.denominator === 0) return '—';
  return `${((value.numerator / value.denominator) * 100).toFixed(1)}%`;
};

/** Renders any server metric value: ratios as %, plain numbers localised, null/missing as "—". */
export const formatMetric = (lang: Language, value: MetricValue | undefined): string =>
  isRatio(value) ? formatRatio(value) : typeof value === 'number' ? formatNumber(lang, value) : '—';

export const formatLondonTime = (lang: Language, iso: string): string =>
  new Intl.DateTimeFormat(locale(lang), {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(iso));

const dayFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' });

/** Calendar day (YYYY-MM-DD) of an instant in Europe/London. */
export const londonDay = (iso: string): string => {
  const parts = Object.fromEntries(dayFormatter.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};

/** Definition versions arrive as stored by the server (`v4`); a bare `4` is shown with the prefix. */
export const versionLabel = (version: string): string => (/^v/i.test(version) ? version : `v${version}`);
