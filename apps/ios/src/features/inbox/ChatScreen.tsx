import {useAssistantContext,useAssistantEditor} from '../assistant/hooks.ts';
import {ReadAcknowledger} from './read-ack.ts';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ApiError, type ResponseOf } from '@fancy/client';
import { allPages } from '../../api/pages.ts';
import { useServices, useSessionState } from '../../services.tsx';
import { Primary, TextAction } from '../../ui/Button.tsx';
import { FormMessage } from '../../ui/FormMessage.tsx';
import { Sheet } from '../../ui/Sheet.tsx';
import { Body } from '../../ui/Text.tsx';
import { colors, radius, sizes, spacing, type } from '../../ui/tokens.ts';
import { rememberReturnTo } from '../auth/intent.ts';
import { compareSeq, MessagePoller } from './poller.ts';
import { conversationKey, type Conversation, type InboxItem } from './InboxScreen.tsx';

type Message = ResponseOf<'readMessages'>['data'][number];
interface Outgoing { clientMessageId: string; body: string; status: 'sending' | 'failed' }

export function mergeMessages(current: readonly Message[], incoming: readonly Message[]): Message[] {
  const byId = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => compareSeq(a.seq, b.seq));
}

/**
 * Group/direct chat. LIVE only while the conversation allows sending and the screen is focused in the
 * foreground; HISTORY (read-only, no polling) after leaving, dissolution or a 403. Messages are never
 * queued offline: a failed send stays on screen with an explicit Retry (same clientMessageId).
 */
export function ChatScreen() {
  const state = useSessionState();
  const { session } = useServices();
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const router = useRouter();
  if (state.status !== 'signedIn') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.pad}>
          <Body>Please sign in again to see this conversation.</Body>
          <Primary label="Sign in" onPress={() => { rememberReturnTo('/inbox'); router.push('/sign-in'); }} />
        </View>
      </SafeAreaView>
    );
  }
  // Unmount every private state owner on session end/account switch, including unsent bodies,
  // messages, leave intents and the poller's lastSeq. Caches alone cannot clear React local state.
  return <AuthenticatedChatScreen key={`${conversationId}:${state.session.user.id}:${session.generation}`} />;
}

function AuthenticatedChatScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const id = String(conversationId);
  const services = useServices();
  const { api, cache, newId } = services;
  const state = useSessionState();
  const [conversation, setConversation] = useState<Conversation | null>(() => cache.get<Conversation>(conversationKey(id)) ?? null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [outgoing, setOutgoing] = useState<Outgoing[]>([]);
  const [text, setText] = useState('');
  const editorVersion=useRef(0);
  const [readOnly, setReadOnly] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const signedIn = state.status === 'signedIn';
  const live = !!conversation && conversation.canSend && !conversation.dissolved && !readOnly;
  const leaveKey = useRef(newId());
  useAssistantContext({sourcePage:'INBOX',...(conversation?.kind==='GROUP'?{explicitConversationId:id}:{})});
  useAssistantEditor({key:`chat:${id}`,kind:'GROUP',targetId:id,current:()=>({text,version:String(editorVersion.current)}),apply:d=>{if(conversation?.kind==='GROUP'&&live&&d.text!==null){editorVersion.current++;setText(d.text);}}});
  const readAck=useMemo(()=>new ReadAcknowledger(async throughSeq=>{await api.call('markConversationRead',{params:{conversationId:id},body:{throughSeq}});cache.delete('inbox');}),[api,cache,id]);
  const viewable=useRef((info:{viewableItems:Array<{isViewable:boolean;item:Message}>})=>{void readAck.presented(info.viewableItems.filter(i=>i.isViewable).map(i=>i.item.seq));});
  viewable.current=info=>{void readAck.presented(info.viewableItems.filter(i=>i.isViewable).map(i=>i.item.seq));};
  const onViewable=useCallback((info:{viewableItems:Array<{isViewable:boolean;item:Message}>})=>viewable.current(info),[]);

  // CONTRACT GAP: no getConversation operation; metadata comes from the Inbox list.
  useEffect(() => {
    if (conversation || !signedIn) return;
    let active = true;
    allPages((cursor) => api.call('inbox', { query: { limit: 100, ...(cursor ? { cursor } : {}) } }))
      .then((items) => {
        const found = items.map((i: InboxItem) => i.conversation).find((c) => c?.id === id) ?? null;
        if (!active) return;
        if (found) {
          cache.set(conversationKey(id), found);
          setConversation(found);
        } else setLoadError('This conversation isn’t available.');
      })
      .catch(() => active && setLoadError('We couldn’t load this conversation. Check your connection and try again.'));
    return () => {
      active = false;
    };
  }, [api, cache, conversation, id, signedIn]);

  const poller = useMemo(
    () =>
      new MessagePoller<Message>({
        fetchAfter: async (afterSeq, cursor) => {
          const res = await api.call('readMessages', { params: { conversationId: id }, query: { mode: 'LIVE', ...(afterSeq ? { afterSeq } : {}), ...(cursor ? { cursor } : {}), limit: 50 } });
          return { messages: res.data, scannedThroughSeq:res.page.scannedThroughSeq??res.data.at(-1)?.seq??'0', nextCursor: res.page.nextCursor, hasMore: res.page.hasMore };
        },
        onPage:page=>readAck.scannedThrough(page.scannedThroughSeq??'0',page.messages.at(-1)?.seq??null),
        onMessages: (m) => setMessages((cur) => mergeMessages(cur, m)),
        onForbidden: () => {
          setReadOnly(true);
          setNotice('You can no longer send messages here. Earlier messages you were allowed to see stay read-only.');
        },
        onSignedOut: () => setNotice('Please sign in again to keep chatting.'),
        onError: (e) => setNotice(e ? 'Reconnecting… Messages will appear when you’re back online.' : null),
      }),
    [api, id,readAck],
  );
  useEffect(() => () => poller.stop(), [poller]);

  // Read-only history load (no polling) when the conversation is archived.
  useEffect(() => {
    if (!conversation || live || !signedIn) return;
    let active = true;
    allPages((cursor) => api.call('readMessages', { params: { conversationId: id }, query: { mode: 'HISTORY', limit: 100, ...(cursor ? { cursor } : {}) } }))
      .then((items) => active && setMessages((cur) => mergeMessages(cur, items)))
      .catch((e: unknown) => active && setLoadError(e instanceof ApiError && e.kind === 'forbidden' ? 'This history isn’t available to you.' : 'We couldn’t load messages.'));
    return () => {
      active = false;
    };
  }, [api, conversation, id, live, signedIn]);

  // Foreground + focused + live → poll; anything else → paused. Resume triggers an immediate catch-up.
  useFocusEffect(
    useCallback(() => {
      if (!signedIn) return undefined;
      readAck.setActive(AppState.currentState==='active');
      if(live&&AppState.currentState==='active')poller.resume();
      const sub = AppState.addEventListener('change', (next) => {
        readAck.setActive(next==='active');
        if(next==='active'&&live)poller.resume();else poller.pause();
      });
      return () => {
        sub.remove();
        poller.pause();readAck.setActive(false);
      };
    }, [live, signedIn, poller,readAck]),
  );

  const send = async (item: Outgoing) => {
    setOutgoing((cur) => cur.map((o) => (o.clientMessageId === item.clientMessageId ? { ...o, status: 'sending' } : o)));
    try {
      const res = await api.call('sendMessage', { params: { conversationId: id }, body: { body: item.body, clientMessageId: item.clientMessageId } });
      setOutgoing((cur) => cur.filter((o) => o.clientMessageId !== item.clientMessageId));
      setMessages((cur) => mergeMessages(cur, [res.data]));
      poller.seed(res.data.seq);
    } catch (e) {
      if (e instanceof ApiError && (e.kind === 'forbidden' || e.code === 'CONNECTION_NOT_AUTHORIZED')) {
        setReadOnly(true);
        poller.stop();
        setOutgoing((cur) => cur.filter((o) => o.clientMessageId !== item.clientMessageId));
        setNotice('You can no longer send messages here. Your message wasn’t sent.');
        return;
      }
      setOutgoing((cur) => cur.map((o) => (o.clientMessageId === item.clientMessageId ? { ...o, status: 'failed' } : o)));
    }
  };

  const submit = () => {
    const body = text.trim();
    if (!body) return;
    if (body.length > 2000) return setNotice('Messages can be up to 2,000 characters.');
    const item: Outgoing = { clientMessageId: newId(), body, status: 'sending' };
    editorVersion.current++;setText('');
    setOutgoing((cur) => [...cur, item]);
    void send(item);
  };

  const leave = async () => {
    if (!conversation) return;
    setBusy(true);
    try {
      const updated = (await api.call('leaveGroup', { params: { conversationId: id }, body: { confirm: true }, idempotencyKey: leaveKey.current, ifMatch: conversation.version })).data;
      cache.set(conversationKey(id), updated);
      cache.delete('inbox');
      setConversation(updated);
      setReadOnly(true);
      poller.stop();
      setSheet(false);
      setNotice('You left the group. Earlier messages stay read-only; your seat is unchanged.');
    } catch (e) {
      setNotice(e instanceof ApiError && e.kind === 'conflict' ? 'This group changed a moment ago. Please try again.' : 'We couldn’t leave the group. Please try again.');
      if (e instanceof ApiError && e.kind === 'conflict') leaveKey.current = newId();
    } finally {
      setBusy(false);
    }
  };


  return (
    <SafeAreaView style={styles.safe} edges={['bottom']} testID="chat">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={88}>
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">{conversation?.title ?? 'Conversation'}</Text>
          {conversation?.kind === 'GROUP' && live ? <TextAction label="Leave group" onPress={() => setSheet(true)} /> : null}
        </View>
        <FormMessage message={loadError} />
        <FormMessage message={notice} tone="info" />
        <FlatList
          testID="chat-messages"
          onViewableItemsChanged={onViewable}
          viewabilityConfig={{itemVisiblePercentThreshold:80}}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.pad}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <View style={styles.bubble} accessibilityLabel={`${item.sender.displayName}: ${item.redacted ? 'Message removed' : item.body}`}>
              <Text style={styles.sender}>{item.sender.displayName}</Text>
              {/* Plain text only: bodies are never interpreted as markup. */}
              <Text style={styles.body}>{item.redacted ? 'Message removed' : item.body}</Text>
            </View>
          )}
          ListFooterComponent={
            <View style={{ gap: 6 }}>
              {outgoing.map((o) => (
                <View key={o.clientMessageId} style={[styles.bubble, styles.mine]}>
                  <Text style={styles.body}>{o.body}</Text>
                  {o.status === 'sending' ? <Text style={styles.meta}>Sending…</Text> : (
                    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                      <Text style={[styles.meta, { color: colors.danger }]}>Not sent</Text>
                      <TextAction label="Retry" onPress={() => void send(o)} />
                      <TextAction label="Delete" onPress={() => setOutgoing((cur) => cur.filter((x) => x.clientMessageId !== o.clientMessageId))} />
                    </View>
                  )}
                </View>
              ))}
            </View>
          }
          ListEmptyComponent={<Body muted>No messages yet. Say hello!</Body>}
        />
        {live ? (
          <View style={styles.composer}>
            <TextInput accessibilityLabel="Message" value={text} onChangeText={value=>{editorVersion.current++;setText(value);}} placeholder="Message" placeholderTextColor={colors.muted} multiline maxLength={2000} style={styles.input} />
            <Primary label="Send" disabled={!text.trim()} onPress={submit} />
          </View>
        ) : conversation ? (
          <Text style={[styles.meta, styles.pad]}>History is read-only.</Text>
        ) : null}
      </KeyboardAvoidingView>
      <Sheet visible={sheet} title="Leave this group?" onClose={() => setSheet(false)}>
        <Body>You won’t see new messages. Earlier messages stay read-only, and your seat at the meal doesn’t change.</Body>
        <Primary secondary label="Stay in group" onPress={() => setSheet(false)} />
        <TextAction destructive label="Leave group" disabled={busy} onPress={() => void leave()} />
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  pad: { padding: spacing.page, gap: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.page, paddingTop: 8 },
  title: { fontSize: type.section, fontWeight: '700', color: colors.ink, flex: 1 },
  bubble: { padding: 10, borderRadius: radius.md, backgroundColor: colors.surface, gap: 2 },
  mine: { backgroundColor: colors.selectedSurface, alignSelf: 'flex-end' },
  sender: { fontSize: type.meta, fontWeight: '700', color: colors.forest },
  body: { fontSize: type.body, color: colors.ink },
  meta: { fontSize: type.meta, color: colors.muted },
  composer: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', padding: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  input: { flex: 1, minHeight: sizes.field, maxHeight: 120, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: type.body, color: colors.ink },
});
