import { useEffect, useState } from 'react';
import { FilterPopover, MultiSelect } from '../../components/controls.tsx';
import { Icon } from '../../components/Icon.tsx';
import type { SnapshotInfo } from '../../api/admin-api.ts';
import type { Translate } from '../../i18n.ts';
import {
  advancedCount, checkDates, emptyFilters, effectiveDates, rangeEnding, SEGMENTS_SUPPORTED, SET_FIELDS,
  type AdminFilters, type BudgetBand, type DateCheck, type LanguageFilter, type SetField, type SizeFilter,
} from '../../state/filters.ts';

type Dimension = SnapshotInfo['dimensions']['areas'][number];

export const optionLabels = (t: Translate) => ({
  languages: [['en', 'English'], ['zh', t('中文', 'Chinese')]] as [LanguageFilter, string][],
  sizes: [...(['2', '3', '4', '5', '6'] as const).map((v) => [v, `${v} ${t('人', 'people')}`] as [SizeFilter, string]), ['7+', t('7 人及以上', '7+ people')]] as [SizeFilter, string][],
  budgetBands: [['0-20', '£0–20'], ['20-30', '> £20–30'], ['30-40', '> £30–40'], ['40+', '> £40'], ['unknown', t('预算未填写', 'Unspecified')]] as [BudgetBand, string][],
  segments: [['new', t('期内注册', 'Joined in period')], ['existing', t('期前注册', 'Joined earlier')]] as [string, string][],
});

const fieldNames = (t: Translate): Record<SetField, string> => ({
  areas: t('区域', 'Area'), sources: t('来源', 'Source'), segments: t('用户', 'Users'),
  languages: t('交流语言', 'Language'), sizes: t('人数', 'Size'), budgetBands: t('预算', 'Budget'),
});

/** Options as they exist in the pinned snapshot; URL values missing from it stay listed (code as label) so they can be removed. */
const withSelected = (options: readonly Dimension[], selected: readonly string[]): [string, string][] => [
  ...options.map((o) => [o.code, o.label] as [string, string]),
  ...selected.filter((v) => !options.some((o) => o.code === v)).map((v) => [v, v] as [string, string]),
];

export function FilterBar({ t, filters, snapshotDay, dimensions, route, onChange }: {
  t: Translate;
  /** Area/source options from the pinned snapshot. */
  dimensions: SnapshotInfo['dimensions'];
  filters: AdminFilters;
  /** Latest selectable day (London day of snapshot asOf). */
  snapshotDay: string;
  route: string;
  onChange(next: AdminFilters): void;
}) {
  const applied = effectiveDates(filters, snapshotDay);
  const [dates, setDates] = useState(applied);
  const [error, setError] = useState<DateCheck | null>(null);
  // A new snapshot or an external change resets the date draft to the applied range.
  useEffect(() => { setDates(applied); setError(null); }, [applied.from, applied.to]);
  const dirty = dates.from !== applied.from || dates.to !== applied.to;
  // Budget bands and the legacy threshold are mutually exclusive (server rejects both).
  const set = (field: SetField, values: string[]) =>
    onChange({ ...filters, [field]: values, ...(field === 'budgetBands' && values.length ? { legacyBudgetMax: null } : {}) });
  const areaOptions = withSelected(dimensions.areas, filters.areas);
  const sourceOptions = withSelected(dimensions.sources, filters.sources);
  const labels = optionLabels(t);
  const names = fieldNames(t);
  const range = (days: number) => onChange({ ...filters, ...rangeEnding(snapshotDay, days) });
  const reset = () => onChange(emptyFilters());
  const display = (field: SetField, value: string) =>
    (field === 'languages' || field === 'sizes' || field === 'budgetBands' || field === 'segments'
      ? (labels[field] as [string, string][]).find(([k]) => k === value)?.[1]
      : field === 'areas' ? areaOptions.find(([k]) => k === value)?.[1]
        : field === 'sources' ? sourceOptions.find(([k]) => k === value)?.[1] : undefined) ?? value;

  return (
    <>
      <section className="filter-panel" aria-label={t('全局筛选', 'Global filters')}>
        <div className="date-filter">
          <span className="filter-label">{t('观察日期', 'Observation dates')}</span>
          <div className="date-inputs">
            <input type="date" aria-label={t('开始日期', 'Start date')} value={dates.from} max={snapshotDay}
              onChange={(e) => { const value = e.currentTarget.value; setDates((prev) => ({ ...prev, from: value })); }} />
            <span>—</span>
            <input type="date" aria-label={t('结束日期', 'End date')} value={dates.to} max={snapshotDay}
              onChange={(e) => { const value = e.currentTarget.value; setDates((prev) => ({ ...prev, to: value })); }} />
            <button className="text-button" disabled={!dirty} onClick={() => {
              const check = checkDates(dates.from, dates.to, snapshotDay);
              if (check !== 'ok') setError(check);
              else { setError(null); onChange({ ...filters, ...dates }); }
            }}>{t('应用', 'Apply')}</button>
          </div>
        </div>
        <div className="quick-ranges">
          {[7, 28, 90].map((days) => {
            const r = rangeEnding(snapshotDay, days);
            return (
              <button key={days} onClick={() => range(days)} aria-pressed={applied.from === r.from && applied.to === r.to}>
                {days}{t('天', 'd')}
              </button>
            );
          })}
        </div>
        <MultiSelect label={names.areas} allLabel={t('全部区域', 'All areas')} value={filters.areas} options={areaOptions} onChange={(v) => set('areas', v)} />
        <MultiSelect label={names.sources} allLabel={t('全部来源', 'All sources')} value={filters.sources} options={sourceOptions} onChange={(v) => set('sources', v)} />
        {SEGMENTS_SUPPORTED && (
          <MultiSelect label={names.segments} allLabel={t('全部用户', 'All users')} value={filters.segments} options={labels.segments} onChange={(v) => set('segments', v)} />
        )}
        <button className="text-button reset-filter" onClick={reset}>{t('重置', 'Reset')}</button>
        <FilterPopover t={t} count={advancedCount(filters)} route={route}>
          <MultiSelect label={names.languages} allLabel={t('全部语言', 'All languages')} value={filters.languages} options={labels.languages} onChange={(v) => set('languages', v)} />
          <MultiSelect label={names.sizes} allLabel={t('全部人数', 'All sizes')} value={filters.sizes} options={labels.sizes} onChange={(v) => set('sizes', v)} />
          <MultiSelect label={t('人均预算', 'Budget / person')} allLabel={t('全部预算', 'All budgets')} value={filters.budgetBands} options={labels.budgetBands} onChange={(v) => set('budgetBands', v)} />
        </FilterPopover>
      </section>
      <div className="active-filters" aria-label={t('已应用筛选', 'Applied filters')}>
        {SET_FIELDS.filter((field) => filters[field].length && (field !== 'segments' || SEGMENTS_SUPPORTED)).map((field) => (
          <button key={field} className="filter-chip" aria-label={`${t('移除筛选', 'Remove filter')}: ${names[field]}`} onClick={() => set(field, [])}>
            {names[field]}: {filters[field].map((v) => display(field, v)).join('、')}
            <Icon name="close" size={12} />
          </button>
        ))}
        {filters.legacyBudgetMax && (
          <button className="filter-chip" aria-label={`${t('移除筛选', 'Remove filter')}: ${t('旧预算上限', 'Legacy budget cap')}`} onClick={() => onChange({ ...filters, legacyBudgetMax: null })}>
            {t('预算', 'Budget')}: ≤ £{filters.legacyBudgetMax}
            <Icon name="close" size={12} />
          </button>
        )}
      </div>
      {dirty && !error && <p className="draft-note">{t('日期尚未应用，图表仍使用上次范围。', 'Dates not applied; charts still use the previous range.')}</p>}
      {error && (
        <p className="inline-error" role="alert">
          {t('请选择有效日期，开始日期不得晚于结束日期，结束日期不得晚于快照。', 'Choose valid dates. Start must precede end; end cannot be after snapshot.')}
        </p>
      )}
    </>
  );
}
