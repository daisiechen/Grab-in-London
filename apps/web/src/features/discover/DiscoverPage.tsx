import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { CUISINES, DIETARY, LANGUAGES, MOODS, type CuisineCode, type DietaryCode, type LanguageCode, type MoodCode } from '@fancy/contracts';
import { CalendarIcon, ChevronDownIcon, LayersIcon, ListBulletIcon, MagnifyingGlassIcon, MixerHorizontalIcon, PersonIcon } from '@radix-ui/react-icons';
import { useApi } from '../../api/ApiProvider.tsx';
import { useQuery } from '../../api/useQuery.ts';
import { errorMessage } from '../../api/errors.ts';
import type { Meal } from '../../api/types.ts';
import { longDate } from '../../lib/format.ts';
import { ChoiceGroup, Field, FormError, Loading, Primary, TextAction } from '../../ui/components.tsx';
import { Sheet } from '../../ui/Sheet.tsx';
import { useToast } from '../../ui/toast.tsx';
import { MealCard } from '../meals/MealCard.tsx';
import { areaName } from '../meals/present.ts';
import {
  emptyFilters, filtersToParams, filtersToQuery, moreFilterCount, parseFilters, toggle, upcomingLondonDates, type Filters, type TimeOfDay,
} from './filters.ts';

type SheetKind = '' | 'date' | 'size' | 'filters';
interface Results { meals: Meal[]; nextCursor: string | null }

const BUDGETS: Array<readonly [string, string]> = [['', 'Any budget'], ['2000', 'Up to £20'], ['3000', 'Up to £30'], ['4000', 'Up to £40'], ['6000', 'Up to £60']];

const dateButtonLabel = (dates: string[]) => (dates.length > 1 ? `${dates.length} dates` : dates[0] ? longDate(dates[0]) : 'Any date');
const sizeButtonLabel = (sizes: number[]) => (sizes.length ? (sizes.length === 1 ? `${sizes[0]} people` : `${sizes.length} sizes`) : 'Table size');

/**
 * Guest-readable Discover (T08). Pending sheet filters are separate from applied filters;
 * apply commits to the URL, closing discards, clear only affects the draft until applied.
 * Areas view groups the same result set by areaCode (no illustrative map; G-PLACES).
 */
export function DiscoverPage() {
  const { api } = useApi();
  const notify = useToast();
  const [params, setParams] = useSearchParams();
  const applied = useMemo(() => parseFilters(params), [params]);
  const view = params.get('view') === 'areas' ? 'areas' : 'list';
  const queryKey = filtersToParams(applied).toString();
  const [sheet, setSheet] = useState<SheetKind>('');
  const [pending, setPending] = useState<Filters>(applied);
  const [extra, setExtra] = useState<{ key: string; meals: Meal[]; nextCursor: string | null } | null>(null);
  const [moreError, setMoreError] = useState('');
  const [area, setArea] = useState<string | null>(null);

  const results = useQuery<Results>(`discover:${queryKey}`, async (c) => {
    const res = await c.call('discoverMeals', { query: filtersToQuery(applied) });
    return { meals: res.data, nextCursor: res.page.nextCursor };
  });

  const meals = [...(results.data?.meals ?? []), ...(extra?.key === queryKey ? extra.meals : [])];
  const nextCursor = extra?.key === queryKey ? extra.nextCursor : results.data?.nextCursor ?? null;

  const open = (kind: SheetKind) => { setPending(applied); setSheet(kind); };
  const apply = (next: Filters) => {
    setSheet('');
    setArea(null);
    setParams(filtersToParams(next, params));
  };
  const setView = (v: 'list' | 'areas') => {
    const p = new URLSearchParams(params);
    if (v === 'areas') p.set('view', 'areas'); else p.delete('view');
    setParams(p, { replace: true });
  };
  const loadMore = async () => {
    if (!nextCursor) return;
    setMoreError('');
    try {
      const res = await api.client.call('discoverMeals', { query: filtersToQuery(applied, nextCursor) });
      setExtra({ key: queryKey, meals: [...(extra?.key === queryKey ? extra.meals : []), ...res.data], nextCursor: res.page.nextCursor });
    } catch (e) {
      setMoreError(errorMessage(e));
    }
  };

  const groups = useMemo(() => {
    const by = new Map<string, Meal[]>();
    for (const m of meals) by.set(m.areaCode, [...(by.get(m.areaCode) ?? []), m]);
    return [...by.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [meals]);
  const shown = view === 'areas' ? (area ? groups.find(([code]) => code === area)?.[1] ?? [] : []) : meals;
  const count = moreFilterCount(applied);
  const dates = upcomingLondonDates(28);

  return (
    <div className="discovery">
      <header className="discover-header">
        <button type="button" className="city" onClick={() => notify('London is our first city. More tables will follow.')}>London <ChevronDownIcon /></button>
        <h1>Fancy a bite?</h1>
        <p className="tagline">Meet new people over a meal.</p>
        <div className="discover-controls">
          <button type="button" onClick={() => open('date')} aria-label="Filter by date"><CalendarIcon />{dateButtonLabel(applied.dates)}<ChevronDownIcon /></button>
          <button type="button" onClick={() => open('size')} aria-label="Filter by table size"><PersonIcon />{sizeButtonLabel(applied.tableSizes)}<ChevronDownIcon /></button>
          <div className="view-toggle">
            <button type="button" aria-label="List view" aria-pressed={view === 'list'} className={view === 'list' ? 'selected' : ''} onClick={() => setView('list')}><ListBulletIcon /></button>
            <button type="button" aria-label="Areas view" aria-pressed={view === 'areas'} className={view === 'areas' ? 'selected' : ''} onClick={() => setView('areas')}><LayersIcon /></button>
          </div>
          <button type="button" className="more-filter" aria-label={count ? `More filters, ${count} active` : 'More filters'} onClick={() => open('filters')}>
            <MixerHorizontalIcon />{count > 0 && <span className="filter-count" aria-hidden="true">{count}</span>}
          </button>
        </div>
      </header>
      <div className="list-content">
        {results.error && !results.data ? (
          <div className="empty">
            <h3>We couldn’t load meals.</h3>
            <FormError>{errorMessage(results.error)}</FormError>
            <Primary secondary onClick={() => void results.reload()}>Try again</Primary>
          </div>
        ) : !results.data ? <Loading /> : (
          <>
            {view === 'areas' && (
              <>
                <div className="section-heading"><h2>Meals by area</h2><span>{meals.length} meals</span></div>
                <div className="area-list">
                  {groups.map(([code, list]) => (
                    <button type="button" key={code} aria-pressed={area === code} onClick={() => setArea(code)}>
                      <strong>{areaName(code)}</strong><span>{list.length} {list.length === 1 ? 'meal' : 'meals'}</span>
                    </button>
                  ))}
                </div>
                {!area && !!groups.length && <p className="muted">Choose an area to see its meals.</p>}
              </>
            )}
            {view === 'list' && <div className="section-heading"><h2>A seat for you</h2><span>{meals.length} meals</span></div>}
            {shown.map((m) => <div className="list-meal" key={m.id}><MealCard meal={m} compact /></div>)}
            {!meals.length && (
              <div className="empty">
                <MagnifyingGlassIcon />
                <h3>No meals found</h3>
                <p>Change your filters to find another table.</p>
                <Primary onClick={() => apply(emptyFilters)}>Clear filters</Primary>
              </div>
            )}
            {nextCursor && <TextAction onClick={() => void loadMore()}>Show more meals</TextAction>}
            <FormError>{moreError}</FormError>
          </>
        )}
      </div>

      <Sheet open={sheet === 'date'} onOpenChange={(o) => !o && setSheet('')} title="When would you like to eat?">
        <fieldset className="filter-section">
          <legend>Dates · London</legend>
          <div className="date-grid">
            {dates.map((d) => (
              <label key={d} className={`choice-chip${pending.dates.includes(d) ? ' chosen' : ''}`}>
                <input type="checkbox" checked={pending.dates.includes(d)} onChange={() => setPending({ ...pending, dates: toggle(pending.dates, d).sort() })} />
                {longDate(d)}
              </label>
            ))}
          </div>
        </fieldset>
        <SheetFooter onClear={() => setPending({ ...pending, dates: [] })} onApply={() => apply(pending)} />
      </Sheet>

      <Sheet open={sheet === 'size'} onOpenChange={(o) => !o && setSheet('')} title="Table size">
        <ChoiceGroup<string> multiple label="People, including the host" options={[2, 3, 4, 5, 6].map((n) => [String(n), `${n} people`] as const)}
          value={pending.tableSizes.map(String)} onChange={(v) => setPending({ ...pending, tableSizes: toggle(pending.tableSizes, Number(v)).sort() })} />
        <SheetFooter onClear={() => setPending({ ...pending, tableSizes: [] })} onApply={() => apply(pending)} />
      </Sheet>

      <Sheet open={sheet === 'filters'} onOpenChange={(o) => !o && setSheet('')} title="More filters">
        <Field label="Keyword">
          {(p) => <input {...p} type="search" maxLength={80} value={pending.keyword} onChange={(e) => setPending({ ...pending, keyword: e.target.value })} />}
        </Field>
        <ChoiceGroup<TimeOfDay> label="Time of day" options={[['any', 'Any time'], ['lunch', 'Lunch'], ['dinner', 'Dinner']]} value={pending.timeOfDay} onChange={(v) => setPending({ ...pending, timeOfDay: v })} />
        <ChoiceGroup<string> label="Budget per person" options={BUDGETS} value={pending.budgetMaxPence ? String(pending.budgetMaxPence) : ''}
          onChange={(v) => setPending({ ...pending, budgetMaxPence: v ? Number(v) : null })} />
        <ChoiceGroup<LanguageCode> multiple label="Conversation language" options={Object.entries(LANGUAGES) as Array<[LanguageCode, string]>} value={pending.languages} onChange={(v) => setPending({ ...pending, languages: toggle(pending.languages, v) })} />
        <ChoiceGroup<MoodCode> multiple label="Atmosphere" options={Object.entries(MOODS) as Array<[MoodCode, string]>} value={pending.moods} onChange={(v) => setPending({ ...pending, moods: toggle(pending.moods, v) })} />
        <ChoiceGroup<CuisineCode> multiple label="Cuisine (declared by host)" options={Object.entries(CUISINES) as Array<[CuisineCode, string]>} value={pending.cuisineCodes} onChange={(v) => setPending({ ...pending, cuisineCodes: toggle(pending.cuisineCodes, v) })} />
        <ChoiceGroup<DietaryCode> multiple label="Dietary options (declared by host)" options={Object.entries(DIETARY) as Array<[DietaryCode, string]>} value={pending.dietaryCodes} onChange={(v) => setPending({ ...pending, dietaryCodes: toggle(pending.dietaryCodes, v) })} />
        <p className="muted">Cuisine and dietary details are provided by hosts and aren’t an allergy guarantee. Meals without them don’t match these filters.</p>
        {!!pending.areaCodes.length && (
          <ChoiceGroup<string> multiple label="Areas" options={pending.areaCodes.map((a) => [a, areaName(a)] as const)} value={pending.areaCodes} onChange={(v) => setPending({ ...pending, areaCodes: toggle(pending.areaCodes, v) })} />
        )}
        <SheetFooter onClear={() => setPending({ ...emptyFilters, dates: pending.dates, tableSizes: pending.tableSizes })} onApply={() => apply(pending)} />
      </Sheet>
    </div>
  );
}

function SheetFooter({ onClear, onApply }: { onClear: () => void; onApply: () => void }) {
  return (
    <div className="filter-footer">
      <button type="button" className="filter-clear" onClick={onClear}>Clear</button>
      <Primary onClick={onApply}>Show meals</Primary>
    </div>
  );
}
