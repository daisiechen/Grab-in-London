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
 * Google Maps SDK is approved (G-PLACES); until then there is no illustrative map.
 */
export function DiscoverScreen() {
  const { api, now } = useServices();
  const router = useRouter();
  const today = londonToday(now());
  const [applied, setApplied] = useState<Filters>(emptyFilters);
  const [pending, setPending] = useState<Filters>(emptyFilters);
  const [sheet, setSheet] = useState<SheetKind>('');
  const [meals, setMeals] = useState<Meal[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(
    async (filters: Filters, after: string | null) => {
      const id = ++requestId.current;
      setLoading(true);
      setError(null);
      try {
        const res = await api.call('discoverMeals', { query: toQuery(filters, after ?? undefined) });
        if (id !== requestId.current) return;
        setMeals((prev) => (after ? [...prev, ...res.data] : res.data));
        setCursor(res.page.hasMore ? res.page.nextCursor : null);
      } catch (e) {
        if (id !== requestId.current) return;
        setError(e instanceof ApiError ? loadErrorMessage(e) : 'Something went wrong. Please try again.');
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [api],
  );

  useEffect(() => {
    void load(applied, null);
  }, [applied, load]);

  const open = (kind: SheetKind) => {
    setPending(applied);
    setSheet(kind);
  };
  const apply = () => {
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
