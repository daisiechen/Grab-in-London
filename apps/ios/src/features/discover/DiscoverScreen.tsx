import {useAssistantContext} from '../assistant/hooks.ts';
import { useAnalyticsPresentations,useAnalyticsState } from '../../analytics/hooks.ts';
import { useNativeImpressions,type DiscoveryProof } from '../../analytics/impressions.ts';
import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ApiError } from '@fancy/client';
import { CUISINES, DIETARY, MOODS, type CuisineCode, type DietaryCode, type LanguageCode, type MoodCode } from '@fancy/contracts';
import { useServices } from '../../services.tsx';
import { loadErrorMessage } from '../../api/useQuery.ts';
import { londonToday, longDate } from '../../lib/london.ts';
import { Primary, TextAction } from '../../ui/Button.tsx';
import { ChoiceGroup, MultiChoice } from '../../ui/ChoiceGroup.tsx';
import { DateChoices } from '../../ui/DateChoices.tsx';
import { FormMessage } from '../../ui/FormMessage.tsx';
import { MealCard } from '../../ui/MealCard.tsx';
import { Sheet } from '../../ui/Sheet.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { colors } from '../../ui/tokens.ts';
import { BRAND_COPY } from '../../ui/brand.ts';
import { languageOptions } from '../profile/model.ts';
import type { Meal } from '../meals/format.ts';
import { groupByArea } from './areas.ts';
import { useHideHelperLauncher } from '../assistant/launcher-visibility.ts';
import { DiscoverMap, nativeMapAvailable } from './DiscoverMap';
import { BUDGET_STEPS, activeFilterCount, emptyFilters, toQuery, toggle, type Filters, type TimeOfDay } from './filters.ts';
import { createStyles } from '../../ui/styles.ts';

type SheetKind = '' | 'date' | 'size' | 'filters' | 'area';
const SIZE_OPTIONS = [2, 3, 4, 5, 6] as const;

/**
 * Discover list with the prototype's draft/apply filters. The same query backs the map once the
 * Google native Maps SDK is configured; otherwise lists remain available.
 */
export function DiscoverScreen() {
  const { api, now,assistant,analytics } = useServices();
  const analyticsState=useAnalyticsState();
  const analyticsEpoch=analyticsState.enabled?analyticsState.generation:0;
  const [proofs,setProofs]=useState<Record<string,DiscoveryProof>>({});
  const [presented,setPresented]=useState<DiscoveryProof|null>(null);
  const pendingFilterEvents=useRef<string[]>([]);
  const [filterEvents,setFilterEvents]=useState<string[]>([]);
  const [mapMode,setMapMode]=useState(true);
  const [areaCode,setAreaCode]=useState<string|null>(null);
  const [toast,setToast]=useState<string|null>(null);
  const router = useRouter();
  const today = londonToday(now());
  const [applied, setApplied] = useState<Filters>(emptyFilters);
  const [pending, setPending] = useState<Filters>(emptyFilters);
  const [sheet, setSheet] = useState<SheetKind>('');
  const [meals, setMeals] = useState<Meal[]>([]);
  const onViewable=useNativeImpressions(meals,proofs);
  const viewabilityConfig=useRef({itemVisiblePercentThreshold:50}).current;
  useAnalyticsPresentations([
    ...[...new Set(Object.values(proofs).filter(p=>p.generation===analyticsState.generation).map(p=>p.requestId))].map(discoveryRequestId=>({type:'discovery_results' as const,properties:{discoveryRequestId}})),
    ...(presented?.generation===analyticsState.generation?filterEvents.map(filter=>({type:'filter_applied' as const,properties:{filter},key:presented.requestId+filter})):[]),
    ...(presented?.generation===analyticsState.generation&&meals.length===0?[{type:'discovery_results' as const,properties:{discoveryRequestId:presented.requestId}}]:[]),
    ...(mapMode?[{type:'map_opened' as const,properties:{}}]:[]),
  ],true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  useAssistantContext({sourcePage:'DISCOVER',appliedFilters:{
    ...(applied.dates.length?{dates:applied.dates}:{}),...(applied.tableSizes.length?{tableSizes:applied.tableSizes}:{}),
    ...(applied.budgetMaxPence!==null?{budgetMaxPence:applied.budgetMaxPence}:{}),...(applied.languages.length?{languages:applied.languages}:{}),
    ...(applied.moods.length?{moods:applied.moods}:{}),...(applied.cuisineCodes.length?{cuisineCodes:applied.cuisineCodes}:{}),...(applied.dietaryCodes.length?{dietaryCodes:applied.dietaryCodes}:{}),
    ...(applied.timeOfDay!=='any'?{timeOfDay:applied.timeOfDay}:{}),...(applied.keyword.trim()?{keyword:applied.keyword.trim()}:{}),
  }});

  const load = useCallback(
    async (filters: Filters, after: string | null) => {
      const id = ++requestId.current;
      const generation=analytics.getState().enabled?analytics.getState().generation:-1;
      setLoading(true);
      setError(null);
      try {
        const res = await api.call('discoverMeals', { query: toQuery(filters, after ?? undefined) });
        if (id !== requestId.current) return;
        assistant.observeAreas(res.data.map(m=>m.areaCode));
        setMeals((prev) => (after ? [...prev, ...res.data] : res.data));
        const proof={requestId:res.meta.requestId,generation};
        setProofs(previous=>({... (after?previous:{}),...Object.fromEntries(res.data.map(meal=>[meal.id,proof]))}));setPresented(proof);
        setFilterEvents(pendingFilterEvents.current);pendingFilterEvents.current=[];
        setCursor(res.page.hasMore ? res.page.nextCursor : null);
      } catch (e) {
        if (id !== requestId.current) return;
        setError(e instanceof ApiError ? loadErrorMessage(e) : 'Something went wrong. Please try again.');
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [api,assistant,analytics,analyticsEpoch],
  );

  useEffect(() => {
    void load(applied, null);
  }, [applied, load]);

  const open = (kind: SheetKind) => {
    if (sheet === kind) { setSheet(''); return; }
    setPending(applied);
    setSheet(kind);
  };
  const apply = () => {
    pendingFilterEvents.current=analyticsState.enabled?([['dates','dates'],['capacity','tableSizes'],['budget','budgetMaxPence'],['languages','languages'],['cuisine','cuisineCodes'],['dietary','dietaryCodes']] as const).filter(([,key])=>JSON.stringify(applied[key])!==JSON.stringify(pending[key])).map(([name])=>name):[];
    setApplied(pending);
    setSheet('');
  };
  const count = activeFilterCount(applied);
  const dateLabel = applied.dates.length > 1 ? `${applied.dates.length} dates` : applied.dates[0] ? longDate(applied.dates[0]) : 'Any date';
  const sizeLabel = applied.tableSizes.length ? `${[...applied.tableSizes].sort().join(', ')} people` : 'Table size';

  const { groups, unplaced } = groupByArea(meals, nativeMapAvailable() ? 'geo' : 'illustrated');
  // Meals without a map position still get a preview (as “London”) so the map never reads as empty.
  const busiest = groups.reduce<(typeof groups)[number] | undefined>((best, g) => (!best || g.meals.length > best.meals.length ? g : best), undefined);
  const area = groups.find((g) => g.code === areaCode) ?? busiest ?? (unplaced.length ? { code: 'london', name: 'London', meals: unplaced } : null);
  const areaMeals = area?.meals ?? [];
  // The map preview shows two cards: the selected area's meals first, then other meals to fill.
  const previewList = [...areaMeals, ...meals.filter((m) => !areaMeals.includes(m))];
  const featured = previewList[0] ?? null;
  const openMeal = (m: Meal) => router.push(`/meals/${m.id}`);
  const openPerson = (p: Meal['host']) => router.push(`/profiles/${p.id}`);
  const selectArea = (code: string) => {
    setAreaCode(code);
    previewScroll.current?.scrollTo({ y: 0, animated: false });
  };
  const notify = (message: string) => setToast(message);
  const previewScroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const { height: windowHeight } = useWindowDimensions();
  // The map keeps about a quarter of the screen; the scrollable meal list below gets the rest.
  const mapHeight = Math.max(190, Math.round(windowHeight * 0.26));
  useHideHelperLauncher(sheet === 'date' || sheet === 'size' || sheet === 'filters');
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  const empty = (
    <View style={styles.empty}>
      <Icon name="MagnifyingGlass" size={33} color={colors.forest} />
      <Text style={styles.emptyTitle}>No tables match just yet</Text>
      <Text style={styles.emptyBody}>Try another date or a wider budget.</Text>
      <Primary label="Clear filters" onPress={() => setApplied(emptyFilters())} />
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text accessibilityRole="header" style={styles.h1}>{BRAND_COPY.invitation}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="City: London" hitSlop={8} style={styles.city} onPress={() => notify('London is our first city. More tables will follow.')}>
            <Icon name="SewingPin" size={13} color={colors.forest} />
            <Text style={styles.cityText}>London</Text>
            <Icon name="ChevronDown" size={11} color={colors.ink} />
          </Pressable>
        </View>
        <Text style={styles.tagline}>{BRAND_COPY.slogan}</Text>
        <View style={styles.controls}>
          <Pressable accessibilityRole="button" accessibilityLabel="Filter by date" accessibilityState={{ expanded: sheet === 'date' }} style={[styles.control, sheet === 'date' && styles.controlOpen]} onPress={() => open('date')}>
            <Icon name="Calendar" size={14} />
            <Text style={styles.controlText} numberOfLines={1}>{dateLabel}</Text>
            <Icon name={sheet === 'date' ? 'ChevronUp' : 'ChevronDown'} size={10} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Filter by table size" accessibilityState={{ expanded: sheet === 'size' }} style={[styles.control, sheet === 'size' && styles.controlOpen]} onPress={() => open('size')}>
            <Icon name="Person" size={14} />
            <Text style={styles.controlText} numberOfLines={1}>{sizeLabel}</Text>
            <Icon name={sheet === 'size' ? 'ChevronUp' : 'ChevronDown'} size={10} />
          </Pressable>
          <View style={styles.toggle}>
            <Pressable accessibilityRole="button" accessibilityLabel="List view" accessibilityState={{ selected: !mapMode }} style={[styles.toggleButton, !mapMode && styles.toggleSelected]} onPress={() => setMapMode(false)}>
              <Icon name="ListBullet" size={16} color={mapMode ? colors.ink : colors.white} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Map view" accessibilityState={{ selected: mapMode }} style={[styles.toggleButton, mapMode && styles.toggleSelected]} onPress={() => setMapMode(true)}>
              <Icon name="Globe" size={16} color={mapMode ? colors.white : colors.ink} />
            </Pressable>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={count ? `More filters, ${count} active` : 'More filters'} accessibilityState={{ expanded: sheet === 'filters' }} style={[styles.control, styles.more, sheet === 'filters' && styles.controlOpen]} onPress={() => open('filters')}>
            <Icon name="MixerHorizontal" size={14} />
            {count ? <View style={styles.count}><Text style={styles.countText}>{count}</Text></View> : null}
          </Pressable>
        </View>
      </View>
      <View style={styles.flex}>
      <FormMessage message={error} />
      {error ? <View style={styles.retry}><Primary secondary label="Try again" onPress={() => void load(applied, null)} /></View> : null}
      {mapMode ? (
        <View style={styles.flex}>
          {unplaced.length ? (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>Some restaurants have no map position yet. </Text>
              <TextAction label="See all meals in list" onPress={() => setMapMode(false)} />
            </View>
          ) : null}
          <View style={[styles.map, { height: mapHeight }]}>
            <DiscoverMap groups={groups} activeCode={area?.code ?? null} onSelect={selectArea} />
            <View style={styles.mapKey} pointerEvents="none"><Text style={styles.mapKeyText}>Numbers = meals in each area</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel="Show central London" style={styles.locate} onPress={() => { if (groups[0]) selectArea(groups[0].code); notify('Showing central London. Location access is not needed.'); }}>
              <Icon name="PaperPlane" size={18} />
            </Pressable>
          </View>
          <View style={[styles.preview, styles.flex]} accessibilityLabel="Selected area meals">
            {featured && area ? (
              <>
                <Pressable accessibilityRole="button" accessibilityLabel={`View all ${areaMeals.length} ${areaMeals.length === 1 ? 'meal' : 'meals'} in ${area.name}`} onPress={() => setSheet('area')}>
                  <View style={styles.grip} />
                  <View style={styles.areaRow}>
                    <Text style={styles.areaTitle}>{`${areaMeals.length} ${areaMeals.length === 1 ? 'meal' : 'meals'} in ${area.name}`}</Text>
                    <View style={styles.viewAll}><Text style={styles.viewAllText}>View all</Text><Icon name="ChevronUp" size={13} color={colors.forest} /></View>
                  </View>
                </Pressable>
                <ScrollView ref={previewScroll} style={styles.flex} contentContainerStyle={styles.previewList} testID="map-preview-list">
                  {previewList.map((m, i) => (
                    <View key={m.id}>
                      {i > 0 && i === areaMeals.length ? <Text style={styles.moreNearby}>MORE NEARBY</Text> : i > 0 ? <View style={styles.cardGap} /> : null}
                      <MealCard dense meal={m} onPress={() => openMeal(m)} />
                    </View>
                  ))}
                </ScrollView>
              </>
            ) : loading ? <ActivityIndicator accessibilityLabel="Loading meals" style={{ padding: 24 }} /> : error ? null : empty}
          </View>
        </View>
      ) : (
        <FlatList
          testID="discover-list"
          style={styles.flex}
          onViewableItemsChanged={onViewable}
          viewabilityConfig={viewabilityConfig}
          data={meals}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={styles.sectionHeading}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>A seat for you</Text>
              <Text style={styles.sectionCount}>{`${meals.length} ${meals.length === 1 ? 'meal' : 'meals'}`}</Text>
            </View>
          }
          renderItem={({ item, index }) => <View style={[styles.listMeal, index === 0 && styles.listMealFirst]}><MealCard compact meal={item} onPress={() => openMeal(item)} onPerson={openPerson} /></View>}
          ListEmptyComponent={loading || error ? undefined : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No meals found</Text>
              <Text style={styles.emptyBody}>Change your filters to find another table.</Text>
              <Primary label="Clear filters" onPress={() => setApplied(emptyFilters())} />
            </View>
          )}
          ListFooterComponent={loading ? <ActivityIndicator accessibilityLabel="Loading meals" style={{ padding: 16 }} /> : undefined}
          onEndReachedThreshold={0.4}
          onEndReached={() => { if (cursor && !loading) void load(applied, cursor); }}
        />
      )}
      {toast ? <View style={styles.toast} pointerEvents="none" accessibilityLiveRegion="polite"><Text style={styles.toastText}>{toast}</Text></View> : null}
      <Sheet visible={sheet === 'area'} title={area ? `${areaMeals.length} ${areaMeals.length === 1 ? 'meal' : 'meals'} in ${area.name}` : 'Meals'} onClose={() => setSheet('')}>
        <ScrollView style={{ maxHeight: 520 }}>
          {areaMeals.map((m, i) => <View key={m.id} style={[styles.listMeal, i === 0 && styles.areaFirst]}><MealCard compact meal={m} onPress={() => { setSheet(''); openMeal(m); }} onPerson={(p) => { setSheet(''); openPerson(p); }} /></View>)}
        </ScrollView>
      </Sheet>
      {sheet === 'date' || sheet === 'size' || sheet === 'filters' ? (
        <View style={styles.dropLayer}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" style={styles.dropBackdrop} onPress={() => setSheet('')} />
          <View style={styles.dropPanel}>
            <ScrollView style={styles.dropScroll} contentContainerStyle={styles.dropContent} keyboardShouldPersistTaps="handled">
              {sheet === 'date' ? (
                <DateChoices label="Choose one or more dates" multiple today={today} selected={pending.dates} onToggle={(d) => setPending({ ...pending, dates: toggle(pending.dates, d) })} />
              ) : sheet === 'size' ? (
                <MultiChoice<string> label="Table size, including the host" options={SIZE_OPTIONS.map((n) => [String(n), `${n} people`] as const)} values={pending.tableSizes.map(String)} onToggle={(v) => setPending({ ...pending, tableSizes: toggle(pending.tableSizes, Number(v)) })} />
              ) : (
                <>
                  <ChoiceGroup<TimeOfDay> label="Time of day" options={[['any', 'Any time'], ['lunch', 'Lunch'], ['dinner', 'Dinner']]} value={pending.timeOfDay} onChange={(timeOfDay) => setPending({ ...pending, timeOfDay })} />
                  <ChoiceGroup<string>
                    label="Budget per person"
                    options={[['any', 'Any budget'], ...BUDGET_STEPS.map((p) => [String(p), `Up to £${p / 100}`] as const)]}
                    value={pending.budgetMaxPence === null ? 'any' : String(pending.budgetMaxPence)}
                    onChange={(v) => setPending({ ...pending, budgetMaxPence: v === 'any' ? null : Number(v) })}
                  />
                  <MultiChoice<LanguageCode> label="Conversation language" options={languageOptions} values={pending.languages} onToggle={(v) => setPending({ ...pending, languages: toggle(pending.languages, v) })} />
                  <MultiChoice<MoodCode> label="Atmosphere" options={Object.entries(MOODS) as Array<[MoodCode, string]>} values={pending.moods} onToggle={(v) => setPending({ ...pending, moods: toggle(pending.moods, v) })} />
                  <MultiChoice<CuisineCode> label="Cuisine (host-declared)" options={Object.entries(CUISINES) as Array<[CuisineCode, string]>} values={pending.cuisineCodes} onToggle={(v) => setPending({ ...pending, cuisineCodes: toggle(pending.cuisineCodes, v) })} />
                  <MultiChoice<DietaryCode> label="Dietary (host-declared)" options={Object.entries(DIETARY) as Array<[DietaryCode, string]>} values={pending.dietaryCodes} onToggle={(v) => setPending({ ...pending, dietaryCodes: toggle(pending.dietaryCodes, v) })} />
                </>
              )}
            </ScrollView>
            <View style={styles.dropFooter}>
              <View style={styles.dropClear}>
                <TextAction
                  label={sheet === 'date' ? 'Any date' : sheet === 'size' ? 'Any size' : 'Clear filters'}
                  onPress={() => setPending(sheet === 'date' ? { ...pending, dates: [] } : sheet === 'size' ? { ...pending, tableSizes: [] } : { ...emptyFilters(), keyword: pending.keyword })}
                />
              </View>
              <View style={styles.dropApply}><Primary label="Show meals" onPress={apply} /></View>
            </View>
          </View>
        </View>
      ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = createStyles({
  safe: { flex: 1, backgroundColor: colors.white },
  flex: { flex: 1 },
  header: { paddingTop: 2, paddingHorizontal: 16, paddingBottom: 8, backgroundColor: colors.white, zIndex: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  city: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 9, borderRadius: 16, backgroundColor: colors.surface },
  cityText: { fontSize: 12, fontWeight: '700', color: colors.ink },
  h1: { flexShrink: 1, fontSize: 27, lineHeight: 31, letterSpacing: -1.1, fontWeight: '700', color: colors.ink },
  // Same subtitle as PageHeader (12/17 muted) on every tab.
  tagline: { fontSize: 12, lineHeight: 17, color: colors.muted, marginTop: 3, marginBottom: 9 },
  controls: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  control: { borderWidth: 1, borderColor: colors.line, height: 35, borderRadius: 9, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, flexShrink: 1 },
  controlText: { fontSize: 11, color: colors.ink, flexShrink: 1 },
  controlOpen: { borderColor: colors.forest, backgroundColor: colors.selectedSurface },
  toggle: { flexDirection: 'row', borderWidth: 1, borderColor: colors.line, borderRadius: 9, overflow: 'hidden', marginLeft: 'auto' },
  toggleButton: { height: 33, width: 34, alignItems: 'center', justifyContent: 'center' },
  toggleSelected: { backgroundColor: colors.forest },
  more: { width: 32, paddingHorizontal: 0, flexShrink: 0 },
  count: { position: 'absolute', right: -2, top: -4, width: 12, height: 12, borderRadius: 6, backgroundColor: colors.peach, alignItems: 'center', justifyContent: 'center' },
  countText: { fontSize: 8, color: colors.ink },
  retry: { paddingHorizontal: 16, paddingBottom: 8 },
  notice: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 12, borderRadius: 9, backgroundColor: '#f2f5ee' },
  noticeText: { fontSize: 11, color: '#607160' },
  map: { backgroundColor: '#eeeee5', overflow: 'hidden' },
  mapKey: { position: 'absolute', top: 10, left: 12, backgroundColor: '#fffffff0', borderWidth: 1, borderColor: colors.line, borderRadius: 16, paddingVertical: 5, paddingHorizontal: 9, zIndex: 3 },
  mapKeyText: { color: '#4f6457', fontSize: 9 },
  locate: { position: 'absolute', bottom: 22, right: 15, width: 35, height: 35, borderRadius: 18, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.13, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, zIndex: 3 },
  preview: { backgroundColor: colors.white, borderTopLeftRadius: 19, borderTopRightRadius: 19, paddingHorizontal: 16, paddingBottom: 8, marginTop: -10, zIndex: 4 },
  grip: { height: 3, width: 28, backgroundColor: '#bfc4bd', borderRadius: 3, marginTop: 6, marginBottom: 6, alignSelf: 'center' },
  areaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 },
  areaTitle: { fontSize: 11, fontWeight: '600', color: colors.forest },
  viewAll: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  viewAllText: { fontSize: 10, color: colors.forest },
  cardGap: { height: 10 },
  previewList: { paddingBottom: 12 },
  moreNearby: { fontSize: 9, fontWeight: '700', letterSpacing: 1.2, color: colors.muted, marginTop: 12, marginBottom: 8 },
  listContent: { paddingTop: 10, paddingHorizontal: 17, paddingBottom: 20 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 },
  sectionTitle: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3, color: colors.ink },
  sectionCount: { fontSize: 11, color: colors.muted },
  listMeal: { borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 19 },
  listMealFirst: { paddingTop: 0 },
  areaFirst: { paddingTop: 10 },
  empty: { alignItems: 'center', paddingVertical: 15, paddingHorizontal: 8, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.ink, textAlign: 'center' },
  emptyBody: { fontSize: 13, color: colors.muted, textAlign: 'center', marginBottom: 12 },
  dropLayer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 20 },
  dropBackdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(16,36,31,0.18)' },
  dropPanel: { backgroundColor: colors.white, borderBottomLeftRadius: 19, borderBottomRightRadius: 19, borderTopWidth: 1, borderTopColor: colors.line, maxHeight: '78%', shadowColor: colors.ink, shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  dropScroll: { flexGrow: 0 },
  dropContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, gap: 14 },
  dropFooter: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  dropClear: { flexShrink: 0 },
  dropApply: { flex: 1 },
  toast: { position: 'absolute', left: 17, right: 17, bottom: 42, backgroundColor: colors.forest, paddingVertical: 13, paddingHorizontal: 16, borderRadius: 12, shadowColor: colors.forest, shadowOpacity: 0.19, shadowRadius: 20, shadowOffset: { width: 0, height: 5 }, zIndex: 150 },
  toastText: { color: colors.white, fontSize: 12 },
});
