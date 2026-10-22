import {useHeaderHeight} from 'expo-router/react-navigation';
import {useAssistantContext,useAssistantEditor} from '../assistant/hooks.ts';
import {ReadAcknowledger} from './read-ack.ts';
import { useAnalyticsPresentation } from '../../analytics/hooks.ts';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { AppState, Keyboard, FlatList, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
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

type KeyboardRect={screenX:number;screenY:number;width:number;height:number};
/** Window-space intersection, measured on the fixed outer viewport (not its padded child). */
export function createKeyboardViewportTracker(measure:(done:(x:number,y:number,width:number,height:number)=>void)=>void,publish:(padding:number)=>void){
 let revision=0,alive=true,keyboard:KeyboardRect|null=null;
 const refresh=()=>{if(!alive)return;const current=++revision,frame=keyboard;if(!frame||frame.screenY<=0){publish(0);return;}measure((x,y,width,height)=>{
  if(!alive||revision!==current||![x,y,width,height,frame.screenX,frame.screenY,frame.width,frame.height].every(Number.isFinite))return;
  const intersects=frame.width>0&&frame.height>0&&width>0&&height>0&&x<frame.screenX+frame.width&&x+width>frame.screenX&&y<frame.screenY+frame.height;
  publish(intersects?Math.min(height,Math.max(0,y+height-frame.screenY)):0);
 });};
 return {refresh,keyboard(frame:KeyboardRect|null){keyboard=frame;refresh();},start(){alive=true;revision++;},stop(){alive=false;keyboard=null;revision++;}};
}

function AuthenticatedChatScreen() {
  const headerHeight=useHeaderHeight();
  const viewport=useRef<ComponentRef<typeof View>>(null);
  const [keyboardPadding,setKeyboardPadding]=useState(0);
  const keyboardTracker=useMemo(()=>createKeyboardViewportTracker(done=>viewport.current?.measureInWindow(done),setKeyboardPadding),[]);
  useFocusEffect(useCallback(()=>{
    keyboardTracker.start();keyboardTracker.refresh();
    const show=Keyboard.addListener('keyboardWillShow',event=>keyboardTracker.keyboard(event.endCoordinates));
    const change=Keyboard.addListener('keyboardWillChangeFrame',event=>keyboardTracker.keyboard(event.endCoordinates));
    const hide=Keyboard.addListener('keyboardWillHide',()=>keyboardTracker.keyboard(null));
    return()=>{show.remove();change.remove();hide.remove();keyboardTracker.stop();};
  },[keyboardTracker]));
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const id = String(conversationId);
  const services = useServices();
  const { api, cache, newId, session } = services;
  const state = useSessionState();
  const [conversation, setConversation] = useState<Conversation | null>(() => cache.get<Conversation>(conversationKey(id)) ?? null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasRead,setHasRead]=useState(false);
  useAnalyticsPresentation('chat_opened',{conversationId:id},conversation?.kind==='GROUP'&&hasRead);
  const [outgoing, setOutgoing] = useState<Outgoing[]>([]);
  const [text, setText] = useState('');
  const editorVersion=useRef(0);
  const [readOnly, setReadOnly] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [host,setHost]=useState<{mealId:string;id:string}|null>(null);
  const metadataRevision=useRef(0);
  const refreshingMetadata=useRef(false);
  const [metadataLoading,setMetadataLoading]=useState(false);
  const [dissolveError,setDissolveError]=useState<string|null>(null);
  const [dissolveSheet,setDissolveSheet]=useState(false);
  const [dissolveBlocked,setDissolveBlocked]=useState(false);
  const dissolveKey=useRef<{version:string;key:string}|null>(null);
  const dissolving=useRef(false);
  const isHost=state.status==='signedIn'&&host?.mealId===conversation?.mealId&&host?.id===state.session.user.id;
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

  useEffect(()=>{
    let active=true;setHost(null);
    if(conversation?.kind==='GROUP'&&conversation.mealId){
      void api.call('getMeal',{params:{mealId:conversation.mealId}}).then(res=>{if(active)setHost({mealId:res.data.meal.id,id:res.data.meal.host.id});}).catch(()=>{if(active)setHost(null);});
    }
    return()=>{active=false;};
  },[api,conversation?.kind,conversation?.mealId]);

  const poller = useMemo(
    () =>
      new MessagePoller<Message>({
        fetchAfter: async (afterSeq, cursor) => {
          const res = await api.call('readMessages', { params: { conversationId: id }, query: { mode: 'LIVE', ...(afterSeq ? { afterSeq } : {}), ...(cursor ? { cursor } : {}), limit: 50 } });
          setHasRead(true);
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
      .then((items) => {if(active){setHasRead(true);setMessages((cur) => mergeMessages(cur, items));}})
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


  const refreshGroup=async()=>{
    if(refreshingMetadata.current)return;
    refreshingMetadata.current=true;setMetadataLoading(true);
    const revision=++metadataRevision.current;
    const generation=session.generation;
    try{
      const items=await allPages(cursor=>api.call('inbox',{query:{limit:100,...(cursor?{cursor}:{})}}));
      session.assertGeneration(generation);
      if(revision!==metadataRevision.current)return;
      const found=items.map((item:InboxItem)=>item.conversation).find(c=>c?.id===id);
      if(!found||found.kind!=='GROUP')throw new Error('GROUP_UNAVAILABLE');
      cache.set(conversationKey(id),found);setConversation(found);setDissolveBlocked(false);
      if(found.dissolved||!found.canSend){setReadOnly(true);poller.stop();setNotice('This group is read-only. Earlier messages remain available.');}
      else setNotice('This group changed. Review it and confirm again.');
    }catch{if(session.generation===generation&&revision===metadataRevision.current){setDissolveBlocked(true);setNotice('We couldn’t refresh this group. Reload group details before trying again.');}}
    finally{refreshingMetadata.current=false;if(session.generation===generation)setMetadataLoading(false);}
  };
  const dissolve=async()=>{
    if(!conversation||!isHost||!live||dissolveBlocked||dissolving.current)return;
    dissolving.current=true;setBusy(true);setDissolveError(null);const generation=session.generation;
    if(dissolveKey.current?.version!==conversation.version)dissolveKey.current={version:conversation.version,key:newId()};
    try{
      const updated=(await api.call('dissolveGroup',{params:{conversationId:id},body:{confirm:true},ifMatch:conversation.version,idempotencyKey:dissolveKey.current.key})).data;
      session.assertGeneration(generation);cache.set(conversationKey(id),updated);cache.delete('inbox');setConversation(updated);setReadOnly(true);poller.stop();setDissolveSheet(false);setNotice('Group dissolved. Everyone’s earlier messages remain read-only.');
    }catch(error){
      if(session.generation!==generation)return;
      if(error instanceof ApiError&&error.kind==='conflict'){setDissolveBlocked(true);setDissolveSheet(false);dissolveKey.current=null;await refreshGroup();}
      else setDissolveError('We couldn’t dissolve the group. Your text is kept. Please try again.');
    }finally{dissolving.current=false;if(session.generation===generation)setBusy(false);}
  };


  return (
    <SafeAreaView style={[styles.safe,{paddingTop:Platform.OS==='ios'?headerHeight:0}]} edges={['bottom']} testID="chat">
      <View testID="chat-keyboard-viewport" ref={viewport} collapsable={false} style={{flex:1,paddingBottom:Platform.OS==='ios'?keyboardPadding:0}} onLayout={keyboardTracker.refresh}>
      <View testID="chat-keyboard" style={{flex:1}}>
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">{conversation?.title ?? 'Conversation'}</Text>
          {conversation?.kind === 'GROUP' && live ? (isHost ? (!dissolveBlocked ? <TextAction label="Dissolve group" onPress={()=>{setDissolveError(null);setDissolveSheet(true);}}/> : null) : <TextAction label="Leave group" onPress={() => setSheet(true)} />) : null}
        </View>
        <FormMessage message={loadError} />
        <FormMessage message={notice} tone="info" />
        {dissolveBlocked?<TextAction label="Reload group details" disabled={metadataLoading} onPress={()=>void refreshGroup()}/>:null}
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
          <View><Text style={[styles.meta, styles.pad]}>History is read-only.</Text>{text?<View style={styles.pad}><Body>{`Unsent text: ${text}`}</Body><TextAction label="Discard unsent text" onPress={()=>{editorVersion.current++;setText('');}}/></View>:null}</View>
        ) : null}
      </View>
      </View>
      <Sheet visible={dissolveSheet} title="Dissolve this group?" onClose={()=>setDissolveSheet(false)}>
        <Body>Everyone will lose the ability to send new messages. Earlier messages stay available. This does not cancel the meal or change attendance. The group cannot reopen.</Body>
        <FormMessage message={dissolveError}/>
        <Primary secondary label="Keep group" onPress={()=>setDissolveSheet(false)}/>
        <TextAction destructive label="Confirm dissolution" disabled={busy||dissolveBlocked} onPress={()=>void dissolve()}/>
      </Sheet>
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
