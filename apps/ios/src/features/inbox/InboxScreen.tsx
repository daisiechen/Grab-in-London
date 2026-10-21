import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import type { ResponseOf } from '@fancy/client';
import { allPages } from '../../api/pages.ts';
import { useServices, useSessionState } from '../../services.tsx';
import { loadErrorMessage, useQuery } from '../../api/useQuery.ts';
import { Primary } from '../../ui/Button.tsx';
import { ChoiceGroup } from '../../ui/ChoiceGroup.tsx';
import { FormMessage } from '../../ui/FormMessage.tsx';
import { Body, Heading } from '../../ui/Text.tsx';
import { colors, radius, spacing, type } from '../../ui/tokens.ts';
import { rememberReturnTo } from '../auth/intent.ts';
import { applicationLabel } from '../meals/format.ts';

export type InboxItem = ResponseOf<'inbox'>['data'][number];
export type Conversation = NonNullable<InboxItem['conversation']>;
export const conversationKey = (id: string) => `conversation:${id}`;

/** Chats and application next steps; pending requests never look like “no activity”. */
export function InboxScreen() {
  const state = useSessionState();
  const router = useRouter();
  if (state.status !== 'signedIn') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.pad}>
          <Heading>Inbox</Heading>
          <Body>Sign in to see your group chats and requests.</Body>
          <Primary label="Sign in" onPress={() => { rememberReturnTo('/inbox'); router.push('/sign-in'); }} />
        </View>
      </SafeAreaView>
    );
  }
  return <SignedInInbox />;
}

function SignedInInbox() {
  const { api, cache } = useServices();
  const router = useRouter();
  const [tab, setTab] = useState<'chats' | 'applications'>('chats');
  const q = useQuery<InboxItem[]>('inbox', async () => {
    const items = await allPages((cursor) => api.call('inbox', { query: { limit: 100, ...(cursor ? { cursor } : {}) } }));
    for (const item of items) if (item.conversation) cache.set(conversationKey(item.conversation.id), item.conversation);
    return items;
  });
  const chats = (q.data ?? []).filter((i) => i.conversation);
  const applications = (q.data ?? []).filter((i) => i.application && !i.conversation);
  const items = tab === 'chats' ? chats : applications;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        testID="inbox"
        contentContainerStyle={styles.pad}
        data={items}
        keyExtractor={(i, n) => i.conversation?.id ?? i.application?.id ?? String(n)}
        refreshing={q.loading}
        onRefresh={() => void q.reload()}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 12 }}>
            <Heading>Inbox</Heading>
            <ChoiceGroup<'chats' | 'applications'> label="Inbox sections" options={[['chats', `Chats · ${chats.length}`], ['applications', `Applications & next steps · ${applications.length}`]]} value={tab} onChange={setTab} />
            {q.error ? <FormMessage message={loadErrorMessage(q.error)} /> : null}
          </View>
        }
        renderItem={({ item }) =>
          item.conversation ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`${item.conversation.title}${item.unreadCount ? `, ${item.unreadCount} unread` : ''}`} style={styles.row} onPress={() => router.push(`/chat/${item.conversation!.id}`)}>
              <Text style={styles.title}>{item.conversation.title}</Text>
              <Text style={styles.meta}>{item.lastMessage ? item.lastMessage.preview : 'No messages yet'}</Text>
              {item.conversation.dissolved || !item.conversation.canSend ? <Text style={styles.meta}>Archived · read-only</Text> : null}
              {item.unreadCount ? <Text style={styles.badge}>{`${item.unreadCount} new`}</Text> : null}
            </Pressable>
          ) : (
            <Pressable accessibilityRole="button" accessibilityLabel={applicationLabel(item.application ?? null)} style={styles.row} onPress={() => item.application && router.push(`/meals/${item.application.mealId}`)}>
              <Text style={styles.title}>{applicationLabel(item.application ?? null)}</Text>
              <Text style={styles.meta}>{item.application?.state === 'PENDING' ? 'Your host reviews each request. A pending request doesn’t hold a seat.' : 'View the meal for details.'}</Text>
            </Pressable>
          )
        }
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={q.data ? <Body muted>{tab === 'chats' ? 'Group chats open once your seat is confirmed.' : 'No requests yet.'}</Body> : undefined}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  pad: { padding: spacing.page },
  row: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: 12, gap: 4 },
  title: { fontSize: type.body, fontWeight: '700', color: colors.ink },
  meta: { fontSize: type.meta, color: colors.muted },
  badge: { fontSize: type.meta, color: colors.forest, fontWeight: '700' },
});
