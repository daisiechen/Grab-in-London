import { useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import type { ResponseOf } from '@fancy/client';
import { MY_MEAL_SECTIONS } from '@fancy/contracts';
import { allPages } from '../../api/pages.ts';
import { useServices, useSessionState } from '../../services.tsx';
import { loadErrorMessage, useQuery } from '../../api/useQuery.ts';
import { Primary } from '../../ui/Button.tsx';
import { ChoiceGroup } from '../../ui/ChoiceGroup.tsx';
import { FormMessage } from '../../ui/FormMessage.tsx';
import { MealCard } from '../../ui/MealCard.tsx';
import { Body, Heading } from '../../ui/Text.tsx';
import { colors, spacing } from '../../ui/tokens.ts';
import { rememberReturnTo } from '../auth/intent.ts';
import { applicationLabel } from './format.ts';

type Section = (typeof MY_MEAL_SECTIONS)[number];
type Item = ResponseOf<'myMeals'>['data'][number];
const LABELS: Record<Section, string> = { UPCOMING: 'Upcoming', APPLICATIONS: 'Applications', HOSTING: 'Hosting', PAST: 'Past', CANCELLED: 'Cancelled' };

/** Five own sections (API §6); sections may intentionally overlap. */
export function MyMealsScreen() {
  const state = useSessionState();
  const router = useRouter();
  const [section, setSection] = useState<Section>('UPCOMING');
  if (state.status !== 'signedIn') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.pad}>
          <Heading>Your meals</Heading>
          <Body>Sign in to see the tables you’re hosting and joining.</Body>
          <Primary label="Sign in" onPress={() => { rememberReturnTo('/meals'); router.push('/sign-in'); }} />
        </View>
      </SafeAreaView>
    );
  }
  return <SignedInMeals section={section} onSection={setSection} />;
}

function SignedInMeals({ section, onSection }: { section: Section; onSection: (s: Section) => void }) {
  const { api } = useServices();
  const router = useRouter();
  const q = useQuery<Item[]>(`myMeals:${section}`, () => allPages((cursor) => api.call('myMeals', { query: { section, limit: 50, ...(cursor ? { cursor } : {}) } })));
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        testID="my-meals"
        contentContainerStyle={styles.pad}
        data={q.data ?? []}
        keyExtractor={(i) => `${i.meal.id}:${i.application?.id ?? i.role}`}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 12 }}>
            <Heading>Meals</Heading>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <ChoiceGroup<Section> label="Sections" options={MY_MEAL_SECTIONS.map((s) => [s, LABELS[s]] as const)} value={section} onChange={onSection} />
            </ScrollView>
            {q.error ? <FormMessage message={loadErrorMessage(q.error)} /> : null}
            {q.error ? <Primary secondary label="Try again" onPress={() => void q.reload()} /> : null}
          </View>
        }
        renderItem={({ item }) => (
          <MealCard meal={item.meal} status={item.role === 'HOST' ? 'You’re hosting' : applicationLabel(item.application)} onPress={() => router.push(`/meals/${item.meal.id}`)} />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          q.data ? (
            <View style={{ gap: 10 }}>
              <Body muted>{section === 'HOSTING' ? 'You’re not hosting any meals yet.' : section === 'APPLICATIONS' ? 'No requests yet.' : 'Nothing here yet.'}</Body>
              <Primary label={section === 'HOSTING' ? 'Create a meal' : 'Explore meals'} onPress={() => router.push(section === 'HOSTING' ? '/create' : '/')} />
            </View>
          ) : undefined
        }
        refreshing={q.loading}
        onRefresh={() => void q.reload()}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  pad: { padding: spacing.page, gap: 12 },
});
