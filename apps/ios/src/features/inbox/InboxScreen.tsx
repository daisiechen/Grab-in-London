import { useCallback, useRef, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import type { ResponseOf } from '@fancy/client';
import { allPages } from '../../api/pages.ts';
import { useServices, useSessionState, type Services } from '../../services.tsx';
import { loadErrorMessage, useQuery } from '../../api/useQuery.ts';
import { Avatar } from '../../ui/Avatar.tsx';
import { PageHeader } from '../../ui/PageHeader.tsx';
import { Primary } from '../../ui/Button.tsx';
import { FormMessage } from '../../ui/FormMessage.tsx';
import { Icon, type IconName } from '../../ui/Icon.tsx';
import { createStyles } from '../../ui/styles.ts';
import { colors } from '../../ui/tokens.ts';
import { rememberReturnTo } from '../auth/intent.ts';
import { applicationLabel, whenLabel } from '../meals/format.ts';

export type InboxItem = ResponseOf<'inbox'>['data'][number];
export type Conversation = NonNullable<InboxItem['conversation']>;
type Application = NonNullable<InboxItem['application']>;
type Tab = 'chats' | 'applications';
export const conversationKey = (id: string) => `conversation:${id}`;

/** Inbox read shared by Inbox and Meals; caches each conversation for the chat header. */
export async function loadInbox({ api, cache, session }: Pick<Services, 'api' | 'cache' | 'session'>): Promise<InboxItem[]> {
  const generation = session.generation;
  const items = await allPages((cursor) => api.call('inbox', { query: { limit: 100, ...(cursor ? { cursor } : {}) } }));
  session.assertGeneration(generation);
  for (const item of items) if (item.conversation) cache.set(conversationKey(item.conversation.id), item.conversation);
  return items;
}

const SESSION_ERROR = 'We couldn’t verify your session. Check your connection and retry loading inbox.';

/** Chats and application next steps (demo inbox); pending requests never look like “no activity”. */
export function InboxScreen() {
  const state = useSessionState();
  const { session } = useServices();
  const router = useRouter();
  if (state.status === 'unavailable') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.pad}>
          <Header />
          <FormMessage message={SESSION_ERROR} />
          <Primary label="Retry loading inbox" onPress={() => void session.revalidate()} />
        </View>
      </SafeAreaView>
    );
  }
  if (state.status !== 'signedIn') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={[styles.pad, styles.fill]}>
          <Header />
          <View style={styles.centred}>
            <Empty icon="ChatBubble" title="Your next hello starts here." body="Sign in to see your group chats and requests." action="Sign in" primary onPress={() => { rememberReturnTo('/inbox'); router.push('/sign-in'); }} />
          </View>
        </View>
      </SafeAreaView>
    );
  }
  return <SignedInInbox />;
}

function Header({ waiting = false, onBell }: { waiting?: boolean; onBell?: () => void }) {
  return (
    <View>
      <PageHeader
        size="tab"
        title={waiting ? 'Your table is taking shape.' : 'A little hello.'}
        subtitle="Before and after the table."
        right={onBell ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Notifications" hitSlop={8} style={styles.bell} onPress={onBell}>
            <Icon name="Bell" size={17} color={colors.forest} />
          </Pressable>
        ) : null}
      />
    </View>
  );
}

function SignedInInbox() {
  const services = useServices();
  const { session } = services;
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('chats');
  const q = useQuery<InboxItem[]>('inbox', () => loadInbox(services));
  const [focusError, setFocusError] = useState('');
  const [validating, setValidating] = useState(false);
  const [pulling, setPulling] = useState(false);
  const firstFocus = useRef(true), refreshJob = useRef<Promise<void> | null>(null);
  const refresh = useCallback(() => {
    if (refreshJob.current) return refreshJob.current;
    const generation = session.generation;
    const job = (async () => {
      setValidating(true); setFocusError('');
      try {
        const current = await session.revalidate(); session.assertGeneration(generation);
        if (current.status !== 'signedIn') { setFocusError(SESSION_ERROR); return; }
        await q.reload();
      } catch { if (session.generation === generation) setFocusError(SESSION_ERROR); }
      finally { if (session.generation === generation) setValidating(false); }
    })();
    refreshJob.current = job; void job.finally(() => { if (refreshJob.current === job) refreshJob.current = null; }); return job;
  }, [session, q.reload]);
  useFocusEffect(useCallback(() => {
    // The initial useQuery effect already loads once. A mounted screen returning from chat must revalidate.
    if (firstFocus.current) { firstFocus.current = false; return; }
    void refresh();
  }, [refresh]));
  const chats = (q.data ?? []).filter((i) => i.conversation);
  const groups = chats.filter((i) => i.conversation?.kind === 'GROUP');
  const direct = chats.filter((i) => i.conversation?.kind === 'DIRECT');
  const applications = (q.data ?? []).filter((i) => i.application && !i.conversation);
  const waiting = applications.filter((i) => i.application?.state === 'PENDING');
  const failed = q.error || focusError;
  const loaded = !!q.data && !failed;
  type Row = { kind: 'heading'; key: string; title: string } | { kind: 'chat' | 'application'; key: string; item: InboxItem };
  const rows: Row[] = tab === 'chats'
    ? [
      ...(groups.length ? [{ kind: 'heading' as const, key: 'h-groups', title: 'Your meal groups' }] : []),
      ...groups.map((item) => ({ kind: 'chat' as const, key: item.conversation!.id, item })),
      ...(direct.length ? [{ kind: 'heading' as const, key: 'h-direct', title: 'Personal conversations' }] : []),
      ...direct.map((item) => ({ kind: 'chat' as const, key: item.conversation!.id, item })),
    ]
    : applications.map((item, n) => ({ kind: 'application' as const, key: item.application?.id ?? String(n), item }));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        testID="inbox"
        contentContainerStyle={styles.pad}
        data={rows}
        keyExtractor={(r) => r.key}
        // Only a pull shows the spinner (a focus refetch toggling it can leave the list offset on iOS).
        refreshing={pulling}
        onRefresh={() => { setPulling(true); void refresh().finally(() => setPulling(false)); }}
        ListHeaderComponent={
          <View>
            <Header waiting={waiting.length > 0} onBell={() => router.push('/notifications')} />
            <View style={styles.tabs} accessibilityRole="tablist" accessibilityLabel="Inbox sections">
              {([['chats', 'Chats', chats.length], ['applications', 'Applications', applications.length]] as const).map(([value, label, count]) => (
                <Pressable key={value} accessibilityRole="tab" accessibilityLabel={q.data ? `${label} · ${count}` : label} accessibilityState={{ selected: tab === value }} style={[styles.tab, tab === value && styles.tabActive]} onPress={() => setTab(value)}>
                  <Text style={[styles.tabText, tab === value && styles.tabTextActive]}>{label}</Text>
                  {q.data ? <View style={styles.pill}><Text style={styles.pillText}>{String(count)}</Text></View> : null}
                </Pressable>
              ))}
            </View>
            {!q.data && !failed ? <Text style={styles.muted}>Loading inbox…</Text> : null}
            {failed ? <View style={styles.error}><FormMessage message={focusError || (q.error ? loadErrorMessage(q.error) : '')} /><Primary label="Retry loading inbox" disabled={q.loading || validating} onPress={() => void refresh()} /></View> : null}
            {loaded && tab === 'applications' && applications.length ? (
              <>
                <SectionTitle title="Applications & next steps" />
                <Text style={styles.lead}>You’ve applied. Your group chat opens once the host approves your request.</Text>
              </>
            ) : null}
          </View>
        }
        renderItem={({ item: row }) =>
          row.kind === 'heading' ? <SectionTitle title={row.title} />
            : row.kind === 'chat' ? <ChatRow item={row.item} onPress={() => router.push(`/chat/${row.item.conversation!.id}`)} />
              : <ApplicationCard item={row.item} onPress={() => row.item.application && router.push(`/meals/${row.item.application.mealId}`)} />
        }
        ListEmptyComponent={loaded ? (
          tab === 'chats' ? (
            <>
              <Empty icon="ChatBubble" title="Your next hello starts here." body="Apply to a meal to track your request here. Once your host approves your request, your group chat will appear." action="Find a meal" onPress={() => router.navigate('/')} />
              {waiting.length ? (
                <View style={styles.hint}>
                  <Icon name="LockClosed" size={13} color={colors.muted} />
                  <Text style={styles.hintText}>No open groups yet. Your group chat opens once the host approves your request.</Text>
                </View>
              ) : null}
            </>
          ) : <Empty icon="Clock" title="No pending applications." body="Your applications will appear here while you wait for approval." action="Find a meal" onPress={() => router.navigate('/')} />
        ) : undefined}
        ListFooterComponent={loaded ? (
          <View style={styles.notice}>
            <Icon name="LockClosed" size={14} color="#607160" />
            <Text style={styles.noticeText}>No unsolicited private messages. Connect after a shared meal, when you both want to.</Text>
          </View>
        ) : undefined}
      />
    </SafeAreaView>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <View style={styles.sectionTitle}>
      <Text accessibilityRole="header" style={styles.h2}>{title}</Text>
    </View>
  );
}

function ChatRow({ item, onPress }: { item: InboxItem; onPress: () => void }) {
  const c = item.conversation!;
  const archived = c.dissolved || !c.canSend;
  const unread = item.unreadCount > 0;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${c.title}${unread ? `, ${item.unreadCount} unread` : ''}`} style={({ pressed }) => [styles.row, pressed && styles.pressed]} onPress={onPress}>
      {c.avatar ? (
        // The other member (direct) or the host (group); a small bubble marks a meal group.
        <View>
          <Avatar person={c.avatar} size={46} />
          {c.kind === 'GROUP' ? <View style={styles.groupMark}><Icon name="ChatBubble" size={11} color={colors.white} /></View> : null}
        </View>
      ) : <View style={styles.convIcon}><Icon name={c.kind === 'DIRECT' ? 'Heart' : 'ChatBubble'} size={19} color={colors.forest} /></View>}
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, unread && styles.rowTitleUnread]} numberOfLines={1}>{c.title}</Text>
        <Text style={[styles.preview, unread && styles.previewUnread]} numberOfLines={2}>{item.lastMessage ? item.lastMessage.preview : 'No messages yet'}</Text>
        <Text style={styles.rowMeta}>{archived ? 'Archived · Read-only' : c.kind === 'GROUP' ? 'Seat confirmed · Meal group' : 'You both want to meet again'}</Text>
      </View>
      {unread ? (
        <View style={styles.badge}><Text style={styles.badgeText}>{item.unreadCount > 99 ? '99+' : String(item.unreadCount)}</Text></View>
      ) : <Icon name="ArrowRight" size={16} color={colors.ink} />}
    </Pressable>
  );
}

const STATUS: Record<Application['state'], { tag: string; body: (host: string) => string }> = {
  PENDING: { tag: 'Waiting for host approval', body: (host) => `${host} will review your introduction. A pending request doesn’t hold a seat, and you haven’t joined the group yet.` },
  CONFIRMED: { tag: 'Seat confirmed', body: () => 'Your seat is confirmed. This group chat isn’t available to you any more.' },
  DECLINED: { tag: 'Application declined', body: () => 'The host couldn’t offer you a seat this time. Find another table that fits your evening.' },
  WITHDRAWN: { tag: 'Application withdrawn', body: () => 'You withdrew this request.' },
  EXPIRED: { tag: 'Application expired', body: () => 'Applications for this meal have closed.' },
  CANCELLED: { tag: 'Participation cancelled', body: () => 'You’re no longer attending this meal.' },
};

/** Demo .inbox-progress-card: Applied → Host approval → Group chat (r07: no payment step). */
function ApplicationCard({ item, onPress }: { item: InboxItem; onPress: () => void }) {
  const a = item.application!;
  const m = item.applicationMeal;
  const host = m?.hostDisplayName ?? 'Your host';
  const approved = a.state === 'CONFIRMED';
  const status = STATUS[a.state];
  const steps: Array<[label: string, icon: IconName, done: boolean]> = [
    ['Applied', 'Check', true],
    ['Host approval', approved ? 'Check' : 'Person', approved],
    ['Group chat', 'LockClosed', false],
  ];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={m ? `${m.title}, ${whenLabel(m.startsAt)} London, hosted by ${host}, ${applicationLabel(a)}` : applicationLabel(a)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={onPress}
    >
      {m ? (
        <View style={styles.cardHeading}>
          <Avatar person={{ displayName: host, avatarUrl: null }} size={40} />
          <View style={styles.rowCopy}>
            <Text style={styles.cardTitle} numberOfLines={2}>{m.title}</Text>
            <Text style={styles.rowMeta}>{`${whenLabel(m.startsAt)} · London`}</Text>
          </View>
        </View>
      ) : null}
      <View style={styles.track} accessibilityLabel={approved ? 'Applied; host approved; group chat' : 'Applied; awaiting host approval; then group chat'}>
        {steps.map(([label, icon, done]) => (
          <View key={label} style={styles.step}>
            <Icon name={icon} size={13} color={done ? colors.forest : colors.muted} />
            <Text style={[styles.stepText, done && styles.stepDone]}>{label}</Text>
          </View>
        ))}
      </View>
      <View style={styles.tag}><Text style={styles.tagText}>{status.tag}</Text></View>
      <Text style={styles.cardBody}>{status.body(host)}</Text>
      <Text style={styles.link}>View application</Text>
    </Pressable>
  );
}

function Empty({ icon, title, body, action, onPress, primary = false }: { icon: IconName; title: string; body: string; action: string; onPress: () => void; primary?: boolean }) {
  return (
    <View style={styles.empty}>
      <Icon name={icon} size={30} color={colors.forest} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
      <View style={styles.emptyAction}><Primary secondary={!primary} label={action} onPress={onPress} /></View>
    </View>
  );
}

const styles = createStyles({
  // Signed-out empty state sits in the middle of the free space instead of leaving a blank lower half.
  fill: { flex: 1 },
  centred: { flex: 1, justifyContent: 'center', paddingBottom: 60 },
  safe: { flex: 1, backgroundColor: colors.white },
  pad: { paddingHorizontal: 16, paddingTop: 2, paddingBottom: 24 },
  bell: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  tabs: { flexDirection: 'row', gap: 8, marginTop: 14, marginBottom: 6 },
  tab: { flex: 1, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.forest },
  tabText: { fontSize: 13, color: colors.muted },
  tabTextActive: { color: colors.ink, fontWeight: '700' },
  pill: { paddingVertical: 2, paddingHorizontal: 6, backgroundColor: '#f0f3ec', borderRadius: 7 },
  pillText: { fontSize: 10, lineHeight: 13, color: '#536c5b' },
  muted: { fontSize: 13, color: colors.muted, marginTop: 12 },
  error: { gap: 10, marginTop: 10 },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 2 },
  h2: { fontSize: 16, fontWeight: '700', color: colors.ink },
  lead: { fontSize: 12, lineHeight: 18, color: colors.muted, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.line },
  pressed: { backgroundColor: '#123f3508' },
  groupMark: { position: 'absolute', right: -2, bottom: -2, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.forest, borderWidth: 2, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  convIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#ecefe7', alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 13, fontWeight: '600', color: colors.ink },
  rowTitleUnread: { fontWeight: '700' },
  preview: { fontSize: 11, lineHeight: 15, color: colors.muted, marginVertical: 3 },
  previewUnread: { color: colors.ink },
  rowMeta: { fontSize: 10, lineHeight: 13, color: colors.muted },
  badge: { minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 10, fontWeight: '700', color: colors.white },
  card: { borderWidth: 1, borderColor: colors.line, borderRadius: 15, padding: 16, marginTop: 12 },
  cardHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardTitle: { fontSize: 15, lineHeight: 19, fontWeight: '700', color: colors.ink, marginBottom: 2 },
  track: { flexDirection: 'row', justifyContent: 'space-between', gap: 6, marginVertical: 14 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepText: { fontSize: 10, color: colors.muted },
  stepDone: { color: colors.forest, fontWeight: '700' },
  tag: { alignSelf: 'flex-start', paddingVertical: 4, paddingHorizontal: 8, backgroundColor: '#f0f3ec', borderRadius: 7 },
  tagText: { fontSize: 10, lineHeight: 14, color: '#536c5b', fontWeight: '700' },
  cardBody: { fontSize: 13, lineHeight: 20, color: colors.ink, marginTop: 8 },
  link: { fontSize: 12, color: colors.forest, textDecorationLine: 'underline', marginTop: 10 },
  empty: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 10, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.ink, textAlign: 'center', marginTop: 4 },
  emptyBody: { fontSize: 13, lineHeight: 19, color: colors.muted, textAlign: 'center' },
  emptyAction: { alignSelf: 'stretch', marginTop: 10 },
  hint: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginTop: 4 },
  hintText: { flex: 1, fontSize: 12, lineHeight: 18, color: colors.muted },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, paddingVertical: 13, paddingHorizontal: 12, borderRadius: 9, backgroundColor: '#f2f5ee', marginTop: 18 },
  noticeText: { flex: 1, fontSize: 11, lineHeight: 17, color: '#607160' },
});
