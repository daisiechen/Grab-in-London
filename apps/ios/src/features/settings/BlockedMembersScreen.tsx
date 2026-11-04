import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ApiError, type ResponseOf } from '@fancy/client';
import { allPages } from '../../api/pages.ts';
import { loadErrorMessage, useQuery } from '../../api/useQuery.ts';
import { useServices } from '../../services.tsx';
import { AccountPage, accountText } from '../../ui/AccountPage.tsx';
import { Avatar } from '../../ui/Avatar.tsx';
import { Primary, TextAction } from '../../ui/Button.tsx';
import { FormMessage } from '../../ui/FormMessage.tsx';
import { Sheet } from '../../ui/Sheet.tsx';
import { Body } from '../../ui/Text.tsx';
import { createStyles } from '../../ui/styles.ts';
import { colors } from '../../ui/tokens.ts';

type Blocked = ResponseOf<'listBlocks'>['data'][number];
export const BLOCKS_KEY = 'blocks';

/** Own blocked members (Settings → Blocked members): open a profile, or unblock with confirmation. */
export function BlockedMembersScreen() {
  const { api, newId } = useServices();
  const router = useRouter();
  const q = useQuery<Blocked[]>(BLOCKS_KEY, () => allPages((cursor) => api.call('listBlocks', { query: { limit: 50, ...(cursor ? { cursor } : {}) } })));
  const [confirm, setConfirm] = useState<Blocked | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // One key per unblock intent: reused if the same confirmation is retried.
  const intent = useRef<{ id: string; key: string } | null>(null);

  const unblock = async (m: Blocked) => {
    if (intent.current?.id !== m.profile.id) intent.current = { id: m.profile.id, key: newId() };
    setBusy(true);
    setError(null);
    try {
      await api.call('unblock', { params: { subjectId: m.profile.id }, ifMatch: m.version, idempotencyKey: intent.current.key });
      intent.current = null;
      setConfirm(null);
      setNotice(`${m.profile.displayName} is unblocked. Your previous connection isn’t restored.`);
      await q.reload();
    } catch (e) {
      setError(e instanceof ApiError && e.kind === 'conflict' ? 'This setting changed. Reload and try again.' : 'We couldn’t unblock this member. Please try again.');
      if (e instanceof ApiError && e.kind === 'conflict') await q.reload();
    } finally {
      setBusy(false);
    }
  };

  const list = q.data ?? null;
  return (
    <AccountPage testID="blocked-members">
      <Text accessibilityRole="header" style={accountText.h1}>Blocked members</Text>
      <Text style={accountText.prose}>They can’t contact you privately. Meal groups you already share are unchanged. Nobody is told when you block or unblock them.</Text>
      {notice ? <Text style={styles.notice} accessibilityLiveRegion="polite">{notice}</Text> : null}
      {q.error ? (
        <View style={styles.state}><FormMessage message={loadErrorMessage(q.error)} /><Primary secondary label="Try again" onPress={() => void q.reload()} /></View>
      ) : !list ? <ActivityIndicator style={styles.state} accessibilityLabel="Loading blocked members" />
        : list.length === 0 ? <Text style={[accountText.muted, styles.state]}>You haven’t blocked anyone. You can block a member from their profile.</Text>
          : (
            <View style={styles.list}>
              {list.map((m) => (
                <View key={m.profile.id} style={styles.row}>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Open ${m.profile.displayName}’s profile`} style={styles.person} onPress={() => router.push(`/profiles/${m.profile.id}`)}>
                    <Avatar person={m.profile} size={40} />
                    <Text style={styles.name} numberOfLines={1}>{m.profile.displayName}</Text>
                  </Pressable>
                  <TextAction label="Unblock" onPress={() => { setError(null); setConfirm(m); }} />
                </View>
              ))}
            </View>
          )}
      <Sheet visible={confirm !== null} title={`Unblock ${confirm?.profile.displayName ?? ''}?`} onClose={() => { if (!busy) setConfirm(null); }}>
        <Body>They won’t be told. Your previous choice to meet again isn’t restored; you can only reconnect after another shared meal.</Body>
        <FormMessage message={error} />
        <View style={styles.sheetActions}>
          <Primary label="Unblock" busy={busy} onPress={() => { if (confirm) void unblock(confirm); }} />
          <TextAction label="Keep blocked" disabled={busy} onPress={() => setConfirm(null)} />
        </View>
      </Sheet>
    </AccountPage>
  );
}

const styles = createStyles({
  state: { marginTop: 18, gap: 10 },
  notice: { marginTop: 12, fontSize: 13, lineHeight: 19, color: colors.forest, fontWeight: '600' },
  list: { marginTop: 14 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  person: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  name: { flexShrink: 1, fontSize: 15, fontWeight: '600', color: colors.ink },
  sheetActions: { gap: 8, marginTop: 12, alignItems: 'stretch' },
});
