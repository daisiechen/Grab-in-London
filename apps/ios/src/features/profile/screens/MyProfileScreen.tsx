import {useAssistantContext} from '../../assistant/hooks.ts';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ResponseOf } from '@fancy/client';
import { Primary } from '../../../ui/Button.tsx';
import { PageHeader } from '../../../ui/PageHeader.tsx';
import { Icon } from '../../../ui/Icon.tsx';
import { colors } from '../../../ui/tokens.ts';
import { createStyles } from '../../../ui/styles.ts';
import { useServices, useSessionState } from '../../../services.tsx';
import { useQuery } from '../../../api/useQuery.ts';
import { rememberReturnTo } from '../../auth/intent.ts';
import { ProfileView } from './ProfileView.tsx';

type PublicData = ResponseOf<'getPublicProfile'>['data'];

/**
 * Profile tab (top-level, no stack header): content starts right under the safe area with the gear in
 * the portrait row. Signed-in members see their own profile as their tables see it, plus published
 * references; guests are invited to sign in (no private data shown).
 */
export function MyProfileScreen() {
  const state = useSessionState();
  useAssistantContext({sourcePage:'PROFILE'});
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { api } = useServices();
  const me = state.status === 'signedIn' ? state.session.user : null;
  // CONTRACT GAP: Me has no avatarUrl or references; the own public projection supplies both. Keyed by
  // version so a saved edit refreshes it.
  const pub = useQuery<PublicData>(me?.displayName ? `ownProfile:${me.id}:${me.version}` : null, async () => (await api.call('getPublicProfile', { params: { userId: me!.id } })).data);

  if (!me) {
    return (
      <ScrollView style={styles.page} contentContainerStyle={[styles.body, styles.guestPage, { paddingTop: insets.top + 4 }]} testID="profile-guest">
        <PageHeader size="tab" title="Your profile" subtitle="How your tables get to know you." />
        <View style={styles.guestBody}>
          {/* Same empty-state pattern as the signed-out Meals and Inbox tabs. */}
          <Icon name="Person" size={30} color={colors.forest} />
          <Text style={styles.emptyTitle}>Let your table get to know you.</Text>
          <Text style={[styles.prose, styles.centred]}>Sign in to set up the profile your tables will see.</Text>
          <View style={[styles.actions, styles.guestActions]}>
            <Primary
              label="Sign in or create an account"
              onPress={() => {
                rememberReturnTo('/profile');
                router.push('/sign-in');
              }}
            />
            <Primary secondary label="Check deletion status" onPress={() => router.push('/deletion-status')} />
          </View>
        </View>
      </ScrollView>
    );
  }
  const data = pub.data?.profile.id === me.id ? pub.data : null;
  const editButton = (
    <View style={styles.actions}>
      {!me.profileGate.profileComplete ? <Primary label="Finish your profile" onPress={() => router.push('/profile-setup')} /> : null}
      <Primary secondary label="Edit profile" icon="Person" onPress={() => router.push('/profile-edit')} />
    </View>
  );
  return (
    <View style={styles.page} testID="profile-own">
      <ScrollView style={styles.page} contentContainerStyle={[styles.body, { paddingTop: insets.top + 4 }]}>
        <ProfileView displayName={me.displayName} avatarUrl={data?.profile.avatarUrl ?? null} bio={me.bio} lifeStatus={me.lifeStatus} languages={me.languages} interests={me.interests} background={me.background} afterHeading={editButton} />
        <Text accessibilityRole="header" style={styles.h2}>Your shared meals</Text>
        {data && data.reviews.length > 0 ? data.reviews.map((r) => (
          <View key={r.id} style={styles.quote}>
            <Text style={styles.quoteText}>{`“${r.body}”`}</Text>
            <Text style={styles.quoteBy}>{`${r.author.displayName} · Shared a meal in ${monthName(r.publishedAt)}`}</Text>
          </View>
        )) : <Text style={styles.muted}>No published references yet. Your first table is a good place to start.</Text>}
      </ScrollView>
      <Pressable accessibilityRole="button" accessibilityLabel="Settings" hitSlop={8} onPress={() => router.push('/settings')} style={[styles.gear, { top: insets.top + 4 }]}>
        <Icon name="Gear" size={18} color={colors.ink} />
      </Pressable>
    </View>
  );
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthName = (instant: string) => MONTHS[new Date(instant).getUTCMonth()] ?? '';

const styles = createStyles({
  // Guest view: the title stays at the top like the other tabs; only the prompt is centred in the free space.
  guestPage: { flexGrow: 1 },
  guestBody: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, paddingBottom: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.ink, textAlign: 'center', marginTop: 4 },
  centred: { textAlign: 'center' },
  page: { flex: 1, backgroundColor: colors.white },
  body: { paddingHorizontal: 18, paddingBottom: 24 },
  gear: { position: 'absolute', right: 12, zIndex: 10, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffffee', borderWidth: 1, borderColor: colors.line },
  h1: { fontSize: 24, lineHeight: 28, letterSpacing: -0.8, fontWeight: '700', color: colors.ink, marginBottom: 6 },
  h2: { fontSize: 16, letterSpacing: -0.3, fontWeight: '700', color: colors.ink, marginTop: 18, marginBottom: 8 },
  prose: { color: '#55625a', fontSize: 14, lineHeight: 21 },
  muted: { fontSize: 12, color: colors.muted, lineHeight: 18 },
  actions: { gap: 8, marginTop: 12 },
  guestActions: { alignSelf: 'stretch', marginTop: 10 },
  quote: { padding: 14, backgroundColor: '#f5f6f0', borderRadius: 12, marginBottom: 8 },
  quoteText: { fontSize: 14, lineHeight: 21, color: colors.ink },
  quoteBy: { marginTop: 8, fontSize: 11, color: colors.muted },
});
