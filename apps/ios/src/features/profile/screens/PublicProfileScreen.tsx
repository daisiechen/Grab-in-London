import { useEffect, useState } from 'react';
import { useAnalyticsPresentation } from '../../../analytics/hooks.ts';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { ApiError, type ResponseOf } from '@fancy/client';
import { Primary, TextAction } from '../../../ui/Button.tsx';
import { FormMessage } from '../../../ui/FormMessage.tsx';
import { Screen } from '../../../ui/Screen.tsx';
import { colors } from '../../../ui/tokens.ts';
import { createStyles } from '../../../ui/styles.ts';
import { useServices } from '../../../services.tsx';
import {MemberSafety} from '../../connections/MemberSafety.tsx';
import { ProfileView } from './ProfileView.tsx';

type Data = ResponseOf<'getPublicProfile'>['data'];

/** Guest-visible public projection and published references. */
export function PublicProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { api,session:manager } = useServices();
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useAnalyticsPresentation('profile_view',{userId:String(userId)},!!data);

  useEffect(() => {
    let live = true;
    setError(null);
    setData(null);
    const generation=manager.generation;
    api
      .call('getPublicProfile', { params: { userId: String(userId) } })
      .then((res) => {if(live&&manager.generation===generation)setData(res.data);})
      .catch((e: unknown) => live && manager.generation===generation && setError(e instanceof ApiError && e.kind === 'not_found' ? 'This profile isn’t available.' : 'We couldn’t load this profile. Check your connection and try again.'));
    return () => {
      live = false;
    };
  }, [api, manager, manager.generation, userId, attempt]);

  if (error) {
    return (
      <Screen>
        <FormMessage message={error} />
        <Primary secondary label="Try again" onPress={() => setAttempt((n) => n + 1)} />
      </Screen>
    );
  }
  if (!data||data.profile.id!==String(userId)) return <Screen><ActivityIndicator accessibilityLabel="Loading profile" /></Screen>;
  const p = data.profile;
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.body} testID="public-profile">
      <ProfileView displayName={p.displayName} avatarUrl={p.avatarUrl} bio={p.bio} languages={p.languages} interests={p.interests} background={p.background} />
      <Text accessibilityRole="header" style={styles.h2}>From people at the table</Text>
      {data.reviews.length === 0 ? <Text style={styles.muted}>No public references yet.</Text> : data.reviews.map((r) => (
        <View key={r.id} style={styles.quote}>
          <Text style={styles.quoteText}>{`“${r.body}”`}</Text>
          <Text style={styles.quoteBy}>{`${r.author.displayName} · Shared a meal in ${monthName(r.publishedAt)}`}</Text>
        </View>
      ))}
      <View style={styles.safety}>
        <MemberSafety subjectId={p.id} name={p.displayName}/>
        <TextAction label="Report this profile" onPress={() => router.push(`/report?targetType=USER&targetId=${p.id}`)} />
        {router.canGoBack() ? <TextAction label="Go back" onPress={() => router.back()} /> : null}
      </View>
    </ScrollView>
  );
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthName = (instant: string) => MONTHS[new Date(instant).getUTCMonth()] ?? '';

const styles = createStyles({
  page: { flex: 1, backgroundColor: colors.white },
  body: { paddingTop: 25, paddingHorizontal: 21, paddingBottom: 40 },
  h2: { fontSize: 17, letterSpacing: -0.3, fontWeight: '700', color: colors.ink, marginTop: 27, marginBottom: 13 },
  muted: { fontSize: 12, color: colors.muted, lineHeight: 18 },
  quote: { padding: 18, backgroundColor: '#f5f6f0', borderRadius: 12, marginBottom: 10 },
  quoteText: { fontSize: 14, lineHeight: 22, color: colors.ink },
  quoteBy: { marginTop: 11, fontSize: 11, color: colors.muted },
  safety: { marginTop: 18, gap: 4, alignItems: 'center' },
});
