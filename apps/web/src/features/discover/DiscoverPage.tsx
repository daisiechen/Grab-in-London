import { ApiError } from '@fancy/client';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { CUISINES, DIETARY, MOODS, type CuisineCode, type DietaryCode, type LanguageCode, type MoodCode } from '@fancy/contracts';
import { CalendarIcon, ChevronDownIcon, GlobeIcon, ListBulletIcon, MagnifyingGlassIcon, MixerHorizontalIcon, PersonIcon, SewingPinIcon } from '@radix-ui/react-icons';
import { useTelemetry } from '../../api/telemetry.tsx';
import { useApi } from '../../api/ApiProvider.tsx';
import { useQuery } from '../../api/useQuery.ts';
import { useSignedIn } from '../../api/session.tsx';
import { errorMessage } from '../../api/errors.ts';
import type { Meal } from '../../api/types.ts';
import { longDate } from '../../lib/format.ts';
import { DESKTOP, useMedia } from '../../lib/useMedia.ts';
import { signInPath } from '../../lib/returnTo.ts';
import { ChoiceGroup, Field, FormMessage, Notice, PageHeader, Primary, SkeletonCards, StateBlock, TextAction } from '../../ui/components.tsx';
import { DateChoices } from '../../ui/DateChoices.tsx';
import { Sheet } from '../../ui/Sheet.tsx';
import { useDocumentMeta } from '../../seo/useDocumentMeta.ts';
import { DISCOVER_DESCRIPTION, DISCOVER_TITLE } from '../../seo/meal-seo.ts';
import { MealCard } from '../meals/MealCard.tsx';
import { areaName } from '../meals/present.ts';
import { ObservedMeal } from './ObservedMeal.tsx';
import { groupByArea } from './areas.ts';
import { emptyFilters, filtersToParams, filtersToQuery, moreFilterCount, parseFilters, toggle, type Filters, type TimeOfDay } from './filters.ts';

type SheetKind = '' | 'date' | 'size' | 'filters';
interface Results { meals: Meal[]; nextCursor: string | null; requestId: string; key: string }

const BUDGETS: Array<readonly [string, string]> = [['', 'Any budget'], ['2000', 'Up to £20'], ['3000', 'Up to £30'], ['4000', 'Up to £40']];
const LANGUAGE_OPTIONS: Array<readonly [LanguageCode, string]> = [['en', 'English'], ['zh', 'Chinese'], ['fr', 'French'], ['es', 'Spanish'], ['hi', 'Hindi']];
const dateButtonLabel = (dates: string[]) => (dates.length > 1 ? `${dates.length} dates` : dates[0] ? longDate(dates[0]) : 'Any date');
const sizeButtonLabel = (sizes: number[]) => (sizes.length ? `${[...sizes].sort().join(', ')} people` : 'Table size');
const plural = (n: number) => `${n} ${n === 1 ? 'meal' : 'meals'}`;

/**
 * Discover (iOS DiscoverScreen, spec F2): date / size / more filters, the illustrated area map
 * with count pins, and the list. Phones switch list ⇄ map; desktop shows the list beside a sticky
 * map. Applied filters, view and selected area live in the URL, so sharing and back keep them.
 */
export function DiscoverPage() {
  const { api } = useApi();
  const telemetry = useTelemetry();
  const session = useSignedIn();
  const desktop = useMedia(DESKTOP);
  const rendered = useRef(new Set<string>());
  const [params, setParams] = useSearchParams();
  const applied = useMemo(() => parseFilters(params), [params]);
  const filterKey = filtersToParams(applied).toString();
  useDocumentMeta({ title: DISCOVER_TITLE, description: DISCOVER_DESCRIPTION, canonical: '/discover', robots: filterKey ? 'noindex' : 'index' });
  const view = params.get('view') === 'list' ? 'list' : 'map';
  const areaParam = params.get('area');
  const queryKey = `${telemetry.enabled ? `analytics-${telemetry.generation}` : 'private'}:${filterKey}`;
  const [sheet, setSheet] = useState<SheetKind>('');
  const [pending, setPending] = useState<Filters>(applied);
  const [cityOpen, setCityOpen] = useState(false);
  const [extra, setExtra] = useState<{ key: string; meals: Meal[]; nextCursor: string | null; proofs: Record<string, string>; requests: string[] } | null>(null);
  const [moreError, setMoreError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const pendingFilterEvents = useRef<{ key: string; filters: string[] } | null>(null);

  const results = useQuery<Results>(`discover:${queryKey}`, async (c) => {
    const res = await c.call('discoverMeals', { query: filtersToQuery(applied) });
    return { meals: res.data, nextCursor: res.page.nextCursor, requestId: res.meta.requestId, key: queryKey };
  });

  useEffect(() => {
    if (!telemetry.enabled) return;
    const presented = () => {
      if (document.visibilityState !== 'visible') return;
      if (results.data?.key === queryKey && pendingFilterEvents.current?.key === queryKey) {
        for (const filter of pendingFilterEvents.current.filters) telemetry.emit('filter_applied', { filter });
        pendingFilterEvents.current = null;
      }
      for (const id of [results.data?.key === queryKey ? results.data.requestId : undefined, ...(extra?.key === queryKey ? extra.requests : [])]) {
        if (id && !rendered.current.has(id)) { rendered.current.add(id); telemetry.emit('discovery_results', { discoveryRequestId: id }); }
      }
    };
    presented();
    document.addEventListener('visibilitychange', presented);
    return () => document.removeEventListener('visibilitychange', presented);
  }, [telemetry, results.data, extra, queryKey]);

  const meals = [...(results.data?.meals ?? []), ...(extra?.key === queryKey ? extra.meals : [])];
  const nextCursor = extra?.key === queryKey ? extra.nextCursor : results.data?.nextCursor ?? null;
  const proofFor = (id: string) => (extra?.key === queryKey ? extra.proofs[id] : undefined) ?? (results.data?.key === queryKey ? results.data.requestId : undefined);

  const setUi = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) if (v) next.set(k, v); else next.delete(k);
    setParams(next, { replace: true });
  };
  const open = (kind: SheetKind) => { setPending(applied); setSheet(kind); };
  const apply = (next: Filters) => {
    const dimensions = [['area', 'areaCodes'], ['dates', 'dates'], ['languages', 'languages'], ['capacity', 'tableSizes'], ['budget', 'budgetMaxPence'], ['cuisine', 'cuisineCodes'], ['dietary', 'dietaryCodes']] as const;
    pendingFilterEvents.current = telemetry.enabled ? { key: `analytics-${telemetry.generation}:${filtersToParams(next).toString()}`, filters: dimensions.filter(([, key]) => JSON.stringify(next[key]) !== JSON.stringify(applied[key])).map(([name]) => name) } : null;
    setSheet('');
    const base = new URLSearchParams(params);
    base.delete('area');
    setParams(filtersToParams(next, base));
  };
  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setMoreError('');
    setLoadingMore(true);
    try {
      const res = await api.client.call('discoverMeals', { query: filtersToQuery(applied, nextCursor) });
      const prev = extra?.key === queryKey ? extra : null;
      setExtra({ key: queryKey, meals: [...(prev?.meals ?? []), ...res.data], nextCursor: res.page.nextCursor, proofs: { ...(prev?.proofs ?? {}), ...Object.fromEntries(res.data.map((m) => [m.id, res.meta.requestId])) }, requests: [...(prev?.requests ?? []), res.meta.requestId] });
    } catch (e) {
      setMoreError(e instanceof ApiError ? errorMessage(e) : 'We couldn’t load more meals. Please try again.');
    } finally {
      setLoadingMore(false);
    }
  };

  const { groups, unplaced } = useMemo(() => groupByArea(meals), [meals]);
  const busiest = groups.reduce<(typeof groups)[number] | undefined>((best, g) => (!best || g.meals.length > best.meals.length ? g : best), undefined);
  const selected = groups.find((g) => g.code === areaParam) ?? null;
  const area = selected ?? busiest ?? null;
  const count = moreFilterCount(applied);

  const card = (m: Meal, variant: 'compact' | 'dense') => (
    <ObservedMeal key={m.id} meal={m} requestId={proofFor(m.id)}><MealCard meal={m} variant={variant} /></ObservedMeal>
  );
  const more = nextCursor ? <TextAction disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? 'Loading…' : 'Show more meals'}</TextAction> : null;
  const guestNote = !session ? <Notice>Browsing is open to everyone. Sign in when you want to ask for a seat — hosts review every request.</Notice> : null;

  const map = (
    <div className="map">
      <div className="inner">
        <img src="/images/london-map.jpg" alt="Illustrated map of central London" width="780" height="900" />
        {groups.map((g) => (
          <button key={g.code} type="button" className="pin" style={{ left: `${g.x}%`, top: `${g.y}%` }} aria-pressed={area?.code === g.code}
            aria-label={`${g.name}: ${plural(g.meals.length)}`} onClick={() => setUi({ area: g.code })}>{g.meals.length}</button>
        ))}
      </div>
      <span className="map-key" aria-hidden="true">Numbers = meals in each area</span>
    </div>
  );

  let listColumn: ReactNode;
  if (desktop || view === 'list') {
    const listMeals = desktop && selected ? selected.meals : meals;
    listColumn = (
      <>
        <div className="listhead big">
          {desktop && selected ? (
            <><h2>{`Meals in ${selected.name}`}</h2><TextAction className="inline" onClick={() => setUi({ area: null })}>Show all areas</TextAction></>
          ) : (
            <><h2>A seat for you</h2><span>{plural(meals.length)}</span></>
          )}
        </div>
        <div>{listMeals.map((m) => <div className="list-card" key={m.id}>{card(m, 'compact')}</div>)}</div>
        {!(desktop && selected) && more}
        <FormMessage message={moreError} />
      </>
    );
  } else {
    const areaMeals = area?.meals ?? unplaced;
    const others = meals.filter((m) => !areaMeals.includes(m));
    listColumn = (
      <div className="sheet-top">
        <div className="listhead">
          <h2>{`${plural(areaMeals.length)} in ${area?.name ?? 'London'}`}</h2>
          <button type="button" className="link" onClick={() => setUi({ view: 'list', area: null })}><ListBulletIcon aria-hidden="true" />View all in list</button>
        </div>
        <div className="cards">{areaMeals.map((m) => card(m, 'dense'))}</div>
        {others.length > 0 && <><p className="sub">More nearby</p><div className="cards">{others.map((m) => card(m, 'dense'))}</div></>}
      </div>
    );
  }

  return (
    <div className="scroll">
      <PageHeader
        size="tab" title="Fancy a bite?" subtitle="Meet new people over a meal."
        right={session ? (
          <button type="button" className="chip" aria-expanded={cityOpen} aria-label="City: London" onClick={() => setCityOpen(!cityOpen)}>
            <SewingPinIcon width={13} height={13} aria-hidden="true" />London<ChevronDownIcon width={11} height={11} aria-hidden="true" />
          </button>
        ) : <Link className="chip solid mobile-only" to={signInPath('/discover')}>Sign in</Link>}
      />
      {cityOpen && <p className="notice" role="status">London is our first city. More cities are on the way.</p>}
      <div className="filters">
        <button type="button" className={`fbtn${applied.dates.length ? ' on' : ''}`} aria-label="Filter by date" aria-expanded={sheet === 'date'} onClick={() => open('date')}>
          <CalendarIcon width={14} height={14} aria-hidden="true" /><span>{dateButtonLabel(applied.dates)}</span><ChevronDownIcon width={10} height={10} aria-hidden="true" />
        </button>
        <button type="button" className={`fbtn${applied.tableSizes.length ? ' on' : ''}`} aria-label="Filter by table size" aria-expanded={sheet === 'size'} onClick={() => open('size')}>
          <PersonIcon width={14} height={14} aria-hidden="true" /><span>{sizeButtonLabel(applied.tableSizes)}</span><ChevronDownIcon width={10} height={10} aria-hidden="true" />
        </button>
        <span className="seg" role="group" aria-label="View">
          <button type="button" aria-label="List view" aria-pressed={view === 'list'} onClick={() => setUi({ view: 'list', area: null })}><ListBulletIcon width={16} height={16} aria-hidden="true" /></button>
          <button type="button" aria-label="Map view" aria-pressed={view === 'map'} onClick={() => setUi({ view: null })}><GlobeIcon width={16} height={16} aria-hidden="true" /></button>
        </span>
        <button type="button" className="fbtn icon" aria-label={count ? `More filters, ${count} active` : 'More filters'} aria-expanded={sheet === 'filters'} onClick={() => open('filters')}>
          <MixerHorizontalIcon width={14} height={14} aria-hidden="true" />{count > 0 && <span className="fcount" aria-hidden="true">{count}</span>}
        </button>
      </div>

      {results.error && !results.data ? (
        <StateBlock icon={<MagnifyingGlassIcon width={28} height={28} aria-hidden="true" />} title="We couldn’t load meals." action={<Primary onClick={() => void results.reload()}>Try again</Primary>}>
          {`${errorMessage(results.error)} Your filters are kept.`}
        </StateBlock>
      ) : !results.data ? (
        <>{view === 'map' && !desktop && <div className="map sk" style={{ marginBottom: 14 }} />}<SkeletonCards /></>
      ) : meals.length === 0 ? (
        <StateBlock icon={<MagnifyingGlassIcon width={28} height={28} aria-hidden="true" />} title="No meals found"
          action={<Primary secondary onClick={() => apply(emptyFilters)}>Clear filters</Primary>}>
          Change your filters to find another table — new meals are added every week.
        </StateBlock>
      ) : (
        <>
          {unplaced.length > 0 && (desktop || view === 'map') && (
            <Notice>Some restaurants have no map position yet. {!desktop && <button type="button" className="link" onClick={() => setUi({ view: 'list', area: null })}>See all meals in list</button>}</Notice>
          )}
          <div className="discgrid">
            <div className={`dmap${view === 'list' ? ' hide' : ''}`}>{map}</div>
            <div className="dlist">{listColumn}{guestNote}</div>
          </div>
        </>
      )}

      <Sheet open={sheet === 'date'} onOpenChange={(o) => !o && setSheet('')} title="When would you like to eat?">
        <DateChoices label="Choose one or more dates" multiple selected={pending.dates} onToggle={(d) => setPending({ ...pending, dates: toggle(pending.dates, d).sort() })} />
        <SheetFooter clearLabel="Any date" onClear={() => setPending({ ...pending, dates: [] })} onApply={() => apply(pending)} />
      </Sheet>
      <Sheet open={sheet === 'size'} onOpenChange={(o) => !o && setSheet('')} title="Table size">
        <ChoiceGroup<string> multiple label="Table size, including the host" options={[2, 3, 4, 5, 6].map((n) => [String(n), `${n} people`] as const)}
          value={pending.tableSizes.map(String)} onChange={(v) => setPending({ ...pending, tableSizes: toggle(pending.tableSizes, Number(v)).sort() })} />
        <SheetFooter clearLabel="Any size" onClear={() => setPending({ ...pending, tableSizes: [] })} onApply={() => apply(pending)} />
      </Sheet>
      <Sheet open={sheet === 'filters'} onOpenChange={(o) => !o && setSheet('')} title="More filters">
        <Field label="Keyword">
          {(p) => <input {...p} className="input" type="search" maxLength={80} value={pending.keyword} onChange={(e) => setPending({ ...pending, keyword: e.target.value })} />}
        </Field>
        <ChoiceGroup<TimeOfDay> label="Time of day" options={[['any', 'Any time'], ['lunch', 'Lunch'], ['dinner', 'Dinner']]} value={pending.timeOfDay} onChange={(v) => setPending({ ...pending, timeOfDay: v })} />
        <ChoiceGroup<string> label="Budget per person" options={BUDGETS} value={pending.budgetMaxPence ? String(pending.budgetMaxPence) : ''} onChange={(v) => setPending({ ...pending, budgetMaxPence: v ? Number(v) : null })} />
        <ChoiceGroup<LanguageCode> multiple label="Conversation language" options={LANGUAGE_OPTIONS} value={pending.languages} onChange={(v) => setPending({ ...pending, languages: toggle(pending.languages, v) })} />
        <ChoiceGroup<MoodCode> multiple label="Atmosphere" options={Object.entries(MOODS) as Array<[MoodCode, string]>} value={pending.moods} onChange={(v) => setPending({ ...pending, moods: toggle(pending.moods, v) })} />
        <ChoiceGroup<CuisineCode> multiple label="Cuisine (host-declared)" options={Object.entries(CUISINES) as Array<[CuisineCode, string]>} value={pending.cuisineCodes} onChange={(v) => setPending({ ...pending, cuisineCodes: toggle(pending.cuisineCodes, v) })} />
        <ChoiceGroup<DietaryCode> multiple label="Dietary (host-declared)" options={Object.entries(DIETARY) as Array<[DietaryCode, string]>} value={pending.dietaryCodes} onChange={(v) => setPending({ ...pending, dietaryCodes: toggle(pending.dietaryCodes, v) })} />
        <p className="muted">Cuisine and dietary details come from hosts and aren’t an allergy guarantee. Meals without them don’t match these filters.</p>
        {!!pending.areaCodes.length && (
          <ChoiceGroup<string> multiple label="Areas" options={pending.areaCodes.map((a) => [a, areaName(a)] as const)} value={pending.areaCodes} onChange={(v) => setPending({ ...pending, areaCodes: toggle(pending.areaCodes, v) })} />
        )}
        <SheetFooter clearLabel="Clear filters" onClear={() => setPending({ ...emptyFilters, dates: pending.dates, tableSizes: pending.tableSizes })} onApply={() => apply(pending)} />
      </Sheet>
    </div>
  );
}

function SheetFooter({ clearLabel, onClear, onApply }: { clearLabel: string; onClear: () => void; onApply: () => void }) {
  return (
    <div className="drop-foot">
      <TextAction onClick={onClear}>{clearLabel}</TextAction>
      <Primary onClick={onApply}>Show meals</Primary>
    </div>
  );
}
