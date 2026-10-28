import { useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import type { ResponseOf } from '@fancy/client';
import { MY_MEAL_SECTIONS } from '@fancy/contracts';
import { allPages } from '../../api/pages.ts';
import { useServices, useSessionState } from '../../services.tsx';
import { loadErrorMessage, useQuery } from '../../api/useQuery.ts';
import { Primary, TextAction } from '../../ui/Button.tsx';
import { FormMessage } from '../../ui/FormMessage.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { MealCard } from '../../ui/MealCard.tsx';
import { createStyles } from '../../ui/styles.ts';
import { colors } from '../../ui/tokens.ts';
import { rememberReturnTo } from '../auth/intent.ts';
import { applicationLabel, bookingLabel } from './format.ts';

type Section = (typeof MY_MEAL_SECTIONS)[number];
type Item = ResponseOf<'myMeals'>['data'][number];
const LABELS: Record<Section, string> = { UPCOMING: 'Upcoming', APPLICATIONS: 'Applications', HOSTING: 'Hosting', PAST: 'Past', CANCELLED: 'Cancelled' };

/** Per-row status line: application progress for applicants, host-reported booking for seat holders (r07). */
export function rowStatus(item: Item, section: Section): string {
  if (item.meal.status === 'CANCELLED') return 'Meal cancelled';
  if (item.application?.state === 'CANCELLED') return applicationLabel(item.application);
  if (section === 'PAST') return item.role === 'HOST' ? 'Completed · You hosted' : 'Completed';
  if (item.role === 'HOST') return `You’re hosting · ${bookingLabel(item.meal)}`;
  if (item.role === 'GUEST') return `Seat confirmed · ${bookingLabel(item.meal)}`;
  return applicationLabel(item.application);
}

function Header() {
  return (
    <View>
      <Text style={styles.eyebrow}>GOOD PLANS, ALL IN ONE PLACE</Text>
      <Text accessibilityRole="header" style={styles.h1}>Your next good meal.</Text>
    </View>
  );
}

/** Five own sections (API §6); sections may intentionally overlap. */
export function MyMealsScreen() {
  const state = useSessionState();
  const router = useRouter();
  const [section, setSection] = useState<Section>('UPCOMING');
  if (state.status !== 'signedIn') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={[styles.pad, styles.fill]}>
          <Header />
          <View style={[styles.empty, styles.centred]}>
            <Icon name="Calendar" size={30} color={colors.forest} />
            <Text style={styles.emptyTitle}>A good meal is waiting.</Text>
            <Text style={styles.emptyBody}>Sign in to see the tables you’re hosting and joining.</Text>
            <View style={styles.emptyAction}><Primary label="Sign in" onPress={() => { rememberReturnTo('/meals'); router.push('/sign-in'); }} /></View>
          </View>
        </View>
      </SafeAreaView>
    );
  }
  return <SignedInMeals section={section} onSection={setSection} />;
}

function SignedInMeals({ section, onSection }: { section: Section; onSection: (s: Section) => void }) {
  const services = useServices();
  const { api } = services;
  const router = useRouter();
  const q = useQuery<Item[]>(`myMeals:${section}`, () => allPages((cursor) => api.call('myMeals', { query: { section, limit: 50, ...(cursor ? { cursor } : {}) } })));
  const hosting = section === 'HOSTING';
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        testID="my-meals"
        contentContainerStyle={styles.pad}
        data={q.data ?? []}
        keyExtractor={(i) => `${i.meal.id}:${i.application?.id ?? i.role}`}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <Header />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabs} accessibilityRole="tablist" accessibilityLabel="Meal categories">
              {MY_MEAL_SECTIONS.map((s) => (
                <Pressable key={s} accessibilityRole="tab" accessibilityLabel={LABELS[s]} accessibilityState={{ selected: section === s }} style={[styles.tab, section === s && styles.tabSelected]} onPress={() => onSection(s)}>
                  <Text style={[styles.tabText, section === s && styles.tabTextSelected]}>{LABELS[s]}</Text>
                </Pressable>
              ))}
            </ScrollView>
            {q.error ? <View style={styles.error}><FormMessage message={loadErrorMessage(q.error)} /><Primary secondary label="Try again" onPress={() => void q.reload()} /></View> : null}
          </View>
        }
        renderItem={({ item, index }) => {
          const past = section === 'PAST';
          const canManage = item.role === 'HOST' && item.meal.status === 'OPEN' && !past;
          const feedback = past && item.meal.allowedActions.includes('POST_MEAL');
          return (
            <View style={[styles.listMeal, index === 0 && styles.listMealFirst]}>
              <MealCard compact meal={item.meal} onPress={() => router.push(`/meals/${item.meal.id}`)} onPerson={(p) => router.push(`/profiles/${p.id}`)} />
              <View style={styles.foot}>
                <View style={styles.tag}><Text style={styles.tagText} numberOfLines={1}>{rowStatus(item, section)}</Text></View>
                {canManage ? <TextAction label="Manage" onPress={() => router.push(`/meals/${item.meal.id}/host`)} /> : null}
              </View>
              {feedback ? <View style={styles.action}><Primary secondary label="Leave feedback" onPress={() => router.push(`/post-meal/${item.meal.id}`)} /></View> : null}
              {item.conversationId && section !== 'APPLICATIONS' ? (
                <View style={styles.chatLink}><TextAction label="Open group chat" onPress={() => router.push(`/chat/${item.conversationId}`)} /></View>
              ) : null}
            </View>
          );
        }}
        ListEmptyComponent={
          q.data ? (
            <View style={styles.empty}>
              <Icon name="Calendar" size={30} color={colors.forest} />
              <Text style={styles.emptyTitle}>{hosting ? 'Your table starts with you.' : 'A good meal is waiting.'}</Text>
              <Text style={styles.emptyBody}>{section === 'APPLICATIONS' ? 'Your requests will appear here.' : section === 'PAST' ? 'Meals you’ve shared will appear here.' : section === 'CANCELLED' ? 'Cancelled meals will appear here.' : 'Find a table that fits your evening.'}</Text>
              <View style={styles.emptyAction}><Primary label={hosting ? 'Create a meal' : 'Explore meals'} icon="ArrowRight" onPress={() => (hosting ? router.push('/create') : router.navigate('/'))} /></View>
            </View>
          ) : undefined
        }
        refreshing={q.loading}
        onRefresh={() => void q.reload()}
      />
    </SafeAreaView>
  );
}

const styles = createStyles({
  // Signed-out empty state sits in the middle of the free space instead of leaving a blank lower half.
  fill: { flex: 1 },
  centred: { flex: 1, justifyContent: 'center', paddingBottom: 60 },
  safe: { flex: 1, backgroundColor: colors.white },
  pad: { paddingHorizontal: 16, paddingTop: 2, paddingBottom: 24 },
  headerBlock: { marginBottom: 14 },
  eyebrow: { fontSize: 9, letterSpacing: 1.3, fontWeight: '700', color: '#647a6b', marginBottom: 6 },
  h1: { fontSize: 27, lineHeight: 31, letterSpacing: -1.1, fontWeight: '700', color: colors.ink },
  tabsScroll: { marginTop: 14, marginHorizontal: -16 },
  tabs: { gap: 7, paddingHorizontal: 16 },
  tab: { borderWidth: 1, borderColor: colors.line, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  tabSelected: { backgroundColor: colors.forest, borderColor: colors.forest },
  tabText: { fontSize: 12, color: colors.ink },
  tabTextSelected: { color: colors.white, fontWeight: '600' },
  error: { gap: 10, marginTop: 12 },
  listMeal: { borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 16 },
  listMealFirst: { paddingTop: 0 },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 10, minHeight: 28 },
  tag: { flexShrink: 1, paddingVertical: 4, paddingHorizontal: 8, backgroundColor: '#f0f3ec', borderRadius: 7 },
  tagText: { fontSize: 11, lineHeight: 15, color: '#536c5b', fontWeight: '600' },
  action: { marginTop: 10 },
  chatLink: { alignItems: 'flex-start' },
  empty: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 10, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.ink, textAlign: 'center', marginTop: 4 },
  emptyBody: { fontSize: 13, lineHeight: 19, color: colors.muted, textAlign: 'center' },
  emptyAction: { alignSelf: 'stretch', marginTop: 10 },
});
