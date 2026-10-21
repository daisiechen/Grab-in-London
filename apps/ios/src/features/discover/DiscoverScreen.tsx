import {useAssistantContext} from '../assistant/hooks.ts';
import { useAnalyticsPresentations,useAnalyticsState } from '../../analytics/hooks.ts';
import { useNativeImpressions,type DiscoveryProof } from '../../analytics/impressions.ts';
import {NativeMap,type Bounds} from '../maps/NativeMap.tsx';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, View } from 'react-native';
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
import { Field } from '../../ui/Field.tsx';
import { FormMessage } from '../../ui/FormMessage.tsx';
import { MealCard } from '../../ui/MealCard.tsx';
import { Sheet } from '../../ui/Sheet.tsx';
import { Body, Heading } from '../../ui/Text.tsx';
import { colors, spacing } from '../../ui/tokens.ts';
import { BRAND_COPY } from '../../ui/brand.ts';
import { languageOptions } from '../profile/model.ts';
import type { Meal } from '../meals/format.ts';
import { BUDGET_STEPS, activeFilterCount, emptyFilters, toQuery, toggle, type Filters, type TimeOfDay } from './filters.ts';

type SheetKind = '' | 'date' | 'size' | 'filters';
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
  const [mapReady,setMapReady]=useState(false);
  const [mapMode,setMapMode]=useState(false);
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
    ...(mapMode&&mapReady?[{type:'map_opened' as const,properties:{}}]:[]),
  ],true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const [pendingBounds,setPendingBounds]=useState<Bounds|null>(null);
  const [bounds,setBounds]=useState<Bounds|null>(null);
  useAssistantContext({sourcePage:'DISCOVER',appliedFilters:{
    ...(applied.dates.length?{dates:applied.dates}:{}),...(applied.tableSizes.length?{tableSizes:applied.tableSizes}:{}),
    ...(applied.budgetMaxPence!==null?{budgetMaxPence:applied.budgetMaxPence}:{}),...(applied.languages.length?{languages:applied.languages}:{}),
    ...(applied.moods.length?{moods:applied.moods}:{}),...(applied.cuisineCodes.length?{cuisineCodes:applied.cuisineCodes}:{}),...(applied.dietaryCodes.length?{dietaryCodes:applied.dietaryCodes}:{}),
    ...(applied.timeOfDay!=='any'?{timeOfDay:applied.timeOfDay}:{}),...(applied.keyword.trim()?{keyword:applied.keyword.trim()}:{}),...(bounds?{bounds}:{}),
  }});

  const load = useCallback(
    async (filters: Filters, after: string | null) => {
      const id = ++requestId.current;
      const generation=analytics.getState().enabled?analytics.getState().generation:-1;
      setLoading(true);
      setError(null);
      try {
        const res = await api.call('discoverMeals', { query: {...toQuery(filters, after ?? undefined),...(bounds??{})} });
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
    [api,bounds,assistant,analytics,analyticsEpoch],
  );

  useEffect(() => {
    void load(applied, null);
  }, [applied, load]);

  const open = (kind: SheetKind) => {
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
  const sizeLabel = applied.tableSizes.length ? `${[...applied.tableSizes].sort().join(', ')} people` : 'Any size';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        testID="discover-list"
        onViewableItemsChanged={onViewable}
        viewabilityConfig={viewabilityConfig}
        data={meals}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ gap: 12 }}>
            <Heading>{BRAND_COPY.invitation}</Heading>
            <Field label="Search meals" value={pending.keyword} onChangeText={(keyword) => setPending({ ...pending, keyword })} returnKeyType="search" onSubmitEditing={() => setApplied({ ...applied, keyword: pending.keyword })} placeholder="Restaurant, cuisine or idea" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              <Primary secondary label={dateLabel} onPress={() => open('date')} />
              <Primary secondary label={sizeLabel} onPress={() => open('size')} />
              <Primary secondary label={count ? `Filters · ${count}` : 'Filters'} onPress={() => open('filters')} />
            </ScrollView>
            <Primary secondary label={mapMode?'Show list':'Show map'} onPress={()=>{setMapReady(false);setMapMode(p=>!p);}}/>
            {mapMode?<>
              <NativeMap points={meals.flatMap(m=>m.venue.available&&m.venue.location?[{id:m.id,title:m.title,lat:m.venue.location.lat,lng:m.venue.location.lng,attributions:m.venue.attributions.map(a=>a.text)}]:[])} onSelect={id=>router.push(`/meals/${id}`)} onMove={setPendingBounds} onReady={()=>setMapReady(true)}/>
              <Primary secondary label="Search this area" disabled={!pendingBounds} onPress={()=>{if(pendingBounds){pendingFilterEvents.current=analyticsState.enabled?['area']:[];setBounds(pendingBounds);}}}/>
              {bounds?<TextAction label="Clear map area" onPress={()=>{pendingFilterEvents.current=analyticsState.enabled?['area']:[];setBounds(null);}}/>:null}
            </>:null}
            <FormMessage message={error} />
            {error ? <Primary secondary label="Try again" onPress={() => void load(applied, null)} /> : null}
          </View>
        }
        renderItem={({ item }) => <MealCard meal={item} onPress={() => router.push(`/meals/${item.id}`)} />}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          loading || error ? undefined : (
            <View style={{ gap: 8, paddingTop: 20 }}>
              <Heading>No tables match just yet</Heading>
              <Body muted>Try another date or a wider budget.</Body>
              {count ? <Primary label="Clear filters" onPress={() => setApplied(emptyFilters())} /> : null}
            </View>
          )
        }
        ListFooterComponent={loading ? <ActivityIndicator accessibilityLabel="Loading meals" style={{ padding: 16 }} /> : undefined}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (cursor && !loading) void load(applied, cursor);
        }}
      />
      <Sheet visible={sheet === 'date'} title="Date" onClose={() => setSheet('')}>
        <DateChoices label="Choose one or more dates" multiple today={today} selected={pending.dates} onToggle={(d) => setPending({ ...pending, dates: toggle(pending.dates, d) })} />
        <TextAction label="Any date" onPress={() => setPending({ ...pending, dates: [] })} />
        <Primary label="Show meals" onPress={apply} />
      </Sheet>
      <Sheet visible={sheet === 'size'} title="Table size" onClose={() => setSheet('')}>
        <MultiChoice<string> label="Including the host" options={SIZE_OPTIONS.map((n) => [String(n), `${n} people`] as const)} values={pending.tableSizes.map(String)} onToggle={(v) => setPending({ ...pending, tableSizes: toggle(pending.tableSizes, Number(v)) })} />
        <Primary label="Show meals" onPress={apply} />
      </Sheet>
      <Sheet visible={sheet === 'filters'} title="Filters" onClose={() => setSheet('')}>
        <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ gap: 14 }}>
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
        </ScrollView>
        <TextAction label="Clear filters" onPress={() => setPending({ ...emptyFilters(), keyword: pending.keyword })} />
        <Primary label="Show meals" onPress={apply} />
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  content: { padding: spacing.page, gap: 0 },
});
