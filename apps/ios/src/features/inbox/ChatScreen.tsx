import {useAssistantContext,useAssistantEditor} from '../assistant/hooks.ts';
import {ReadAcknowledger} from './read-ack.ts';
import { useAnalyticsPresentation } from '../../analytics/hooks.ts';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ComponentRef } from 'react';
import { AppState, Keyboard, FlatList, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ApiError, type ResponseOf } from '@fancy/client';
import { allPages } from '../../api/pages.ts';
import { useServices, useSessionState } from '../../services.tsx';
import { Primary, TextAction } from '../../ui/Button.tsx';
import { FormMessage } from '../../ui/FormMessage.tsx';
import { Sheet } from '../../ui/Sheet.tsx';
import { LinkRow } from '../../ui/LinkRow.tsx';
import { Body } from '../../ui/Text.tsx';
import { Avatar } from '../../ui/Avatar.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { createStyles } from '../../ui/styles.ts';
import { colors } from '../../ui/tokens.ts';
import { longDate } from '../../lib/london.ts';
import { bookingLabel, mealPeople, venueName, type Meal } from '../meals/format.ts';
import { rememberReturnTo } from '../auth/intent.ts';
import { compareSeq, MessagePoller } from './poller.ts';
import { conversationKey, type Conversation, type InboxItem } from './InboxScreen.tsx';
import { messageReportRoute, rememberMessageSubject, reportedMessages } from './message-reports.ts';

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
        <View style={styles.signedOut}>
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

/** London wall-clock day and time of an instant (message timestamps and day separators). */
export function londonStamp(instant:string|number):{day:string;time:string}{
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(instant)).map(p=>[p.type,p.value]));
 return {day:`${parts.year}-${parts.month}-${parts.day}`,time:`${parts.hour}:${parts.minute}`};
}

function AuthenticatedChatScreen() {
  const insets=useSafeAreaInsets();
  const router=useRouter();
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
  const { api, cache, newId, now, session } = services;
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
  /** Long-pressed message whose actions sheet is open (only other members' visible messages). */
  const [actionsFor,setActionsFor]=useState<Message|null>(null);
  const subscribeCache=useCallback((listener:()=>void)=>cache.subscribe(listener),[cache]);
  const reported=useSyncExternalStore(subscribeCache,()=>reportedMessages(cache));
  const [busy, setBusy] = useState(false);
  const [meal,setMeal]=useState<Meal|null>(null);
  const [view,setView]=useState<'chat'|'settings'>('chat');
  const metadataRevision=useRef(0);
  const refreshingMetadata=useRef(false);
  const [metadataLoading,setMetadataLoading]=useState(false);
  const [dissolveError,setDissolveError]=useState<string|null>(null);
  const [dissolveSheet,setDissolveSheet]=useState(false);
  const [dissolveBlocked,setDissolveBlocked]=useState(false);
  const dissolveKey=useRef<{version:string;key:string}|null>(null);
  const dissolving=useRef(false);
  const myId=state.status==='signedIn'?state.session.user.id:null;
  const tableMeal=meal&&meal.id===conversation?.mealId?meal:null;
  const isHost=!!myId&&tableMeal?.host.id===myId;
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
    let active=true;setMeal(null);
    if(conversation?.kind==='GROUP'&&conversation.mealId){
      // Authoritative host check and the pinned meal context (date, venue, host-reported booking).
      void api.call('getMeal',{params:{mealId:conversation.mealId}}).then(res=>{if(active)setMeal(res.data.meal);}).catch(()=>{if(active)setMeal(null);});
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
      setSheet(false);setView('chat');
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
      session.assertGeneration(generation);cache.set(conversationKey(id),updated);cache.delete('inbox');setConversation(updated);setReadOnly(true);poller.stop();setDissolveSheet(false);setView('chat');setNotice('Group dissolved. Everyone’s earlier messages remain read-only.');
    }catch(error){
      if(session.generation!==generation)return;
      if(error instanceof ApiError&&error.kind==='conflict'){setDissolveBlocked(true);setDissolveSheet(false);dissolveKey.current=null;await refreshGroup();}
      else setDissolveError('We couldn’t dissolve the group. Your text is kept. Please try again.');
    }finally{dissolving.current=false;if(session.generation===generation)setBusy(false);}
  };


  const group=conversation?.kind==='GROUP';
  const today=londonStamp(now()).day;
  const dayLabel=(day:string)=>day===today?'TODAY':longDate(day).toUpperCase();
  const goBack=()=>{if(view==='settings'){setView('chat');return;}if(router.canGoBack())router.back();else router.navigate('/inbox');};
  const openMeal=()=>{if(conversation?.mealId)router.push(`/meals/${conversation.mealId}`);};
  const notices=(
    <>
      <FormMessage message={loadError} />
      <FormMessage message={notice} tone="info" />
      {dissolveBlocked?<TextAction label="Reload group details" disabled={metadataLoading} onPress={()=>void refreshGroup()}/>:null}
    </>
  );
  const people=tableMeal?mealPeople(tableMeal):[];
  // Reporting a message (Apple 1.2): the report page takes the sender and an excerpt from the session cache,
  // never the URL. After the receipt the message is hidden for this reporter (message-reports.ts).
  const openReport=(m:Message)=>{setActionsFor(null);rememberMessageSubject(cache,m.id,{senderName:m.sender.displayName,excerpt:m.body});router.push(messageReportRoute(m.id));};

  return (
    <SafeAreaView style={[styles.safe,{paddingTop:insets.top}]} edges={['bottom']} testID="chat">
      {/* The page draws the demo .page-header itself so content starts right under the safe area. */}
      <Stack.Screen options={{headerShown:false}} />
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={view==='settings'?'Back to chat':'Back'} hitSlop={8} style={styles.headerButton} onPress={goBack}>
          <Icon name="ArrowLeft" size={18} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle} accessibilityRole="header" numberOfLines={1}>{view==='settings'?'Group settings':conversation?.title ?? 'Conversation'}</Text>
        {group&&view==='chat'?(
          <Pressable accessibilityRole="button" accessibilityLabel="Open group settings" hitSlop={8} style={styles.headerButton} onPress={()=>setView('settings')}>
            <Icon name="Gear" size={18} color={colors.ink} />
          </Pressable>
        ):<View style={styles.headerSpacer} />}
      </View>
      <View testID="chat-keyboard-viewport" ref={viewport} collapsable={false} style={{flex:1,paddingBottom:Platform.OS==='ios'?keyboardPadding:0}} onLayout={keyboardTracker.refresh}>
      <View testID="chat-keyboard" style={{flex:1}}>
        {view==='settings'&&conversation?(
          <ScrollView testID="group-settings" contentContainerStyle={styles.settings}>
            <Text style={styles.settingsTitle}>{conversation.title}</Text>
            {conversation.mealId?<Primary secondary label="View meal" icon="ArrowRight" onPress={openMeal}/>:null}
            {notices}
            {people.length?(
              <>
                <View style={styles.sectionRow}><Text accessibilityRole="header" style={styles.h2}>At this table</Text><View style={styles.pill}><Text style={styles.pillText}>{String(people.length)}</Text></View></View>
                {people.map(p=>(
                  <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`View ${p.displayName}’s profile`} style={styles.member} onPress={()=>router.push(`/profiles/${p.id}`)}>
                    <Avatar person={p} size={40}/>
                    <View style={styles.flex}>
                      <Text style={styles.memberName}>{p.displayName}</Text>
                      <Text style={styles.memberRole}>{`${p.id===tableMeal?.host.id?'Host':'Guest'}${p.id===myId?' · You':''}`}</Text>
                    </View>
                  </Pressable>
                ))}
              </>
            ):null}
            {live?(
              <View style={styles.settingsSection}>
                <Text accessibilityRole="header" style={styles.h2}>Your membership</Text>
                <Text style={styles.muted}>Group membership is separate from your meal participation.</Text>
                {isHost&&conversation.mealId?<Primary secondary label="Manage meal & applications" onPress={()=>router.push(`/meals/${conversation.mealId}/host`)}/>:null}
                {isHost?(!dissolveBlocked?<Primary secondary label="Dissolve group" onPress={()=>{setDissolveError(null);setDissolveSheet(true);}}/>:null):<Primary secondary label="Leave group" onPress={()=>setSheet(true)}/>}
              </View>
            ):(
              <View style={styles.readOnlyNotice}><Icon name="LockClosed" size={14} color="#607160"/><Text style={styles.readOnlyText}>This group is read-only. Your earlier messages remain available.</Text></View>
            )}
          </ScrollView>
        ):null}
        <View style={[styles.flex,view==='settings'&&conversation?styles.hidden:null]}>
        <FlatList
          testID="chat-messages"
          onViewableItemsChanged={onViewable}
          viewabilityConfig={{itemVisiblePercentThreshold:80}}
          data={messages}
          extraData={reported}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={styles.listHeader}>
              {group&&conversation?.mealId?(
                <Pressable accessibilityRole="button" accessibilityLabel={tableMeal?`View meal: ${longDate(tableMeal.startsAt.localDate)} at ${tableMeal.startsAt.localTime}, ${venueName(tableMeal)}, ${bookingLabel(tableMeal)}`:'View meal'} style={styles.pinned} onPress={openMeal}>
                  <Icon name="Calendar" size={15} color={colors.forest}/>
                  <View style={styles.flex}>
                    <Text style={styles.pinnedTitle}>{tableMeal?`${longDate(tableMeal.startsAt.localDate)} · ${tableMeal.startsAt.localTime}`:'Your meal'}</Text>
                    <Text style={styles.pinnedMeta} numberOfLines={2}>{tableMeal?`${venueName(tableMeal)} · ${bookingLabel(tableMeal)} · Pay at the restaurant`:'View the meal for time and place'}</Text>
                  </View>
                  <Icon name="ChevronRight" size={14} color={colors.muted}/>
                </Pressable>
              ):conversation?.kind==='DIRECT'?(
                <View style={styles.pinned}>
                  <Icon name="Heart" size={15} color={colors.forest}/>
                  <View style={styles.flex}><Text style={styles.pinnedTitle}>You both want to meet again</Text><Text style={styles.pinnedMeta}>Start a conversation or find another table together.</Text></View>
                </View>
              ):null}
              {notices}
            </View>
          }
          renderItem={({ item, index }) => {
            const stamp=londonStamp(item.createdAt);
            const previous=messages[index-1];
            const newDay=!previous||londonStamp(previous.createdAt).day!==stamp.day;
            const mine=item.sender.id===myId;
            const hiddenByMe=reported.has(item.id);
            const body=hiddenByMe ? 'You reported this message' : item.redacted ? 'Message removed' : item.body;
            const label=`${mine?'You':item.sender.displayName}: ${body}, ${stamp.time}`;
            // Only another member's visible message can be reported; never your own, a removed or an already reported one.
            const reportable=!mine&&!item.redacted&&!hiddenByMe;
            const bubble=<Text style={[styles.bubble,mine?styles.bubbleMine:null,(item.redacted||hiddenByMe)&&styles.redacted]}>{body}</Text>;
            return (
              <View>
                {newDay?<Text style={styles.day}>{live||index>0?dayLabel(stamp.day):`ARCHIVE · ${dayLabel(stamp.day)}`}</Text>:null}
                <View style={[styles.message,mine&&styles.messageMine]} accessibilityLabel={reportable?undefined:label}>
                  {!mine?<Avatar person={item.sender} size={30} onPress={()=>router.push(`/profiles/${item.sender.id}`)}/>:null}
                  <View style={styles.messageCopy}>
                    {!mine&&group?<Pressable accessibilityRole="link" accessibilityLabel={`${item.sender.displayName}, view profile`} hitSlop={6} style={styles.senderPress} onPress={()=>router.push(`/profiles/${item.sender.id}`)}><Text style={styles.sender}>{item.sender.displayName}</Text></Pressable>:null}
                    {/* Plain text only: bodies are never interpreted as markup. */}
                    {reportable?(
                      <Pressable
                        testID={`message-${item.id}`}
                        accessibilityLabel={label}
                        accessibilityHint="Long press for message options."
                        accessibilityActions={[{name:'report',label:'Report message'}]}
                        onAccessibilityAction={event=>{if(event.nativeEvent.actionName==='report')openReport(item);}}
                        onLongPress={()=>setActionsFor(item)}
                        delayLongPress={350}
                        style={({pressed})=>pressed?styles.bubblePressed:null}
                      >{bubble}</Pressable>
                    ):bubble}
                    <Text style={[styles.time,mine&&styles.timeMine]}>{stamp.time}</Text>
                  </View>
                  {/* Own messages carry your avatar on the right, mirroring everyone else's on the left. */}
                  {mine?<Avatar person={item.sender} size={30}/>:null}
                </View>
              </View>
            );
          }}
          ListFooterComponent={
            <View>
              {outgoing.map((o) => (
                <View key={o.clientMessageId} style={[styles.message,styles.messageMine]}>
                  <View style={styles.messageCopy}>
                    <Text style={[styles.bubble,styles.bubbleMine,o.status==='failed'&&styles.bubbleFailed]}>{o.body}</Text>
                    {o.status === 'sending' ? <Text style={[styles.time,styles.timeMine]}>Sending…</Text> : (
                      <View style={styles.failedRow}>
                        <Text style={[styles.time, { color: colors.danger }]}>Not sent</Text>
                        <TextAction label="Retry" onPress={() => void send(o)} />
                        <TextAction label="Delete" onPress={() => setOutgoing((cur) => cur.filter((x) => x.clientMessageId !== o.clientMessageId))} />
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </View>
          }
          ListEmptyComponent={conversation&&!loadError?<Text style={styles.empty}>{live?'No messages yet. Say a little hello!':'No earlier messages.'}</Text>:undefined}
        />
        {live ? (
          <View style={styles.composer}>
            <TextInput accessibilityLabel="Message" value={text} onChangeText={value=>{editorVersion.current++;setText(value);}} placeholder="Say a little hello…" placeholderTextColor={colors.muted} multiline maxLength={2000} style={styles.input} />
            <Pressable accessibilityRole="button" accessibilityLabel="Send message" accessibilityState={{disabled:!text.trim()}} disabled={!text.trim()} onPress={submit} style={[styles.send,!text.trim()&&styles.sendDisabled]}>
              <Icon name="PaperPlane" size={17} color={colors.white}/>
            </Pressable>
          </View>
        ) : conversation ? (
          <View style={styles.readOnlyBar}>
            <View style={styles.readOnlyRow}><Icon name="LockClosed" size={13} color={colors.muted}/><Text style={styles.readOnlyBarText}>History is read-only.</Text></View>
            {text?<View><Body>{`Unsent text: ${text}`}</Body><TextAction label="Discard unsent text" onPress={()=>{editorVersion.current++;setText('');}}/></View>:null}
          </View>
        ) : null}
        </View>
      </View>
      </View>
      <Sheet visible={!!actionsFor} title="Message options" onClose={()=>setActionsFor(null)}>
        {actionsFor?<Text style={styles.quote} numberOfLines={3}>{`${actionsFor.sender.displayName}: ${actionsFor.body}`}</Text>:null}
        <LinkRow first icon="ExclamationTriangle" label="Report message" onPress={()=>{if(actionsFor)openReport(actionsFor);}}/>
      </Sheet>
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

const styles = createStyles({
  safe: { flex: 1, backgroundColor: colors.white },
  flex: { flex: 1, minWidth: 0 },
  hidden: { display: 'none' },
  signedOut: { padding: 16, gap: 12 },
  header: { height: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.white },
  // Same round control as FloatingBack on other header-less pages.
  headerButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  headerSpacer: { width: 36, height: 36 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 13, fontWeight: '700', color: colors.ink, paddingHorizontal: 6 },
  list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 },
  listHeader: { gap: 8 },
  pinned: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: '#f0f4eb', borderRadius: 10 },
  pinnedTitle: { fontSize: 12, fontWeight: '700', color: colors.ink },
  pinnedMeta: { fontSize: 10, lineHeight: 14, color: colors.muted, marginTop: 3 },
  day: { textAlign: 'center', marginTop: 16, marginBottom: 4, fontSize: 9, letterSpacing: 0.7, color: '#9aa197' },
  message: { flexDirection: 'row', gap: 7, marginTop: 12, maxWidth: '88%' },
  messageMine: { alignSelf: 'flex-end', justifyContent: 'flex-end' },
  messageCopy: { flexShrink: 1, minWidth: 0 },
  senderPress: { alignSelf: 'flex-start' },
  sender: { fontSize: 10, color: colors.ink, marginBottom: 4 },
  bubble: { paddingVertical: 10, paddingHorizontal: 13, backgroundColor: '#f1f3ed', borderTopLeftRadius: 2, borderTopRightRadius: 13, borderBottomLeftRadius: 13, borderBottomRightRadius: 13, overflow: 'hidden', fontSize: 13, lineHeight: 20, color: colors.ink },
  bubbleMine: { backgroundColor: colors.forest, color: colors.white, borderTopLeftRadius: 13, borderTopRightRadius: 2 },
  bubbleFailed: { opacity: 0.6 },
  bubblePressed: { opacity: 0.7 },
  quote: { fontSize: 13, lineHeight: 19, color: colors.muted },
  redacted: { fontStyle: 'italic', color: colors.muted },
  time: { fontSize: 9, color: colors.muted, marginTop: 4 },
  timeMine: { textAlign: 'right' },
  failedRow: { flexDirection: 'row', gap: 12, alignItems: 'center', justifyContent: 'flex-end' },
  empty: { textAlign: 'center', fontSize: 12, color: colors.muted, marginTop: 24 },
  composer: { flexDirection: 'row', gap: 9, alignItems: 'flex-end', paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.white },
  input: { flex: 1, minHeight: 40, maxHeight: 120, backgroundColor: '#f4f5ef', borderWidth: 1, borderColor: colors.line, borderRadius: 20, paddingHorizontal: 14, paddingTop: 11, paddingBottom: 11, fontSize: 13, color: colors.ink },
  send: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center' },
  sendDisabled: { opacity: 0.45 },
  readOnlyBar: { paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.line, gap: 6 },
  readOnlyRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  readOnlyBarText: { fontSize: 12, color: colors.muted },
  settings: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 10 },
  settingsTitle: { fontSize: 24, lineHeight: 29, letterSpacing: -0.8, fontWeight: '700', color: colors.ink, marginBottom: 4 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  h2: { fontSize: 16, fontWeight: '700', color: colors.ink },
  pill: { paddingVertical: 2, paddingHorizontal: 6, backgroundColor: '#f0f3ec', borderRadius: 7 },
  pillText: { fontSize: 10, lineHeight: 13, color: '#536c5b' },
  member: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  memberName: { fontSize: 13, fontWeight: '700', color: colors.ink },
  memberRole: { fontSize: 11, color: colors.muted, marginTop: 3 },
  settingsSection: { gap: 10, marginTop: 14 },
  muted: { fontSize: 12, lineHeight: 18, color: colors.muted },
  readOnlyNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 12, borderRadius: 9, backgroundColor: '#f2f5ee', marginTop: 14 },
  readOnlyText: { flex: 1, fontSize: 11, lineHeight: 17, color: '#607160' },
});
