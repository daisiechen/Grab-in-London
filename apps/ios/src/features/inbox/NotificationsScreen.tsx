import {useCallback,useRef,useState,type ReactNode} from 'react';
import {AppState,Pressable,Text,View} from 'react-native';
import {useFocusEffect,useRouter} from 'expo-router';
import {ApiError,type ResponseOf} from '@fancy/client';
import {useServices,useSessionState} from '../../services.tsx';
import {AccountPage} from '../../ui/AccountPage.tsx';
import {Primary,TextAction} from '../../ui/Button.tsx';
import {Icon,type IconName} from '../../ui/Icon.tsx';
import {createStyles} from '../../ui/styles.ts';
import {colors} from '../../ui/tokens.ts';
import {FormMessage} from '../../ui/FormMessage.tsx';
import {loadErrorMessage} from '../../api/useQuery.ts';
import {rememberReturnTo} from '../auth/intent.ts';
const labels:Record<string,string>={deletion_received:'Account deletion requested',deletion_completed:'Account deletion completed',meal_cancelled:'Meal cancelled',application_submitted:'New request to join',application_withdrawn:'Request withdrawn',guest_left:'Guest left the meal',application_expired:'Request expired',booking_updated:'Booking updated',application_approved:'Request approved',application_declined:'Request declined'};
type Notice=ResponseOf<'listNotifications'>['data'][number];
export function NotificationsScreen(){
 const state=useSessionState(),{session}=useServices(),router=useRouter();
 if(state.status==='unavailable')return <AccountPage testID="notifications"><Empty icon="ExclamationTriangle" title="We couldn’t verify your session." action={<Primary label="Retry session" onPress={()=>void session.revalidate()}/>}/></AccountPage>;
 if(state.status!=='signedIn')return <AccountPage testID="notifications"><Empty icon="Bell" title="Sign in to see your notifications." action={<Primary label="Sign in" onPress={()=>{rememberReturnTo('/inbox');router.push('/sign-in');}}/>}/></AccountPage>;
 return <SignedInNotifications key={state.session.user.id}/>;
}
function SignedInNotifications(){
 const {api,session,newId}=useServices(),router=useRouter();
 const [items,setItems]=useState<Notice[]|null>(null),[cursor,setCursor]=useState<string|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[marking,setMarking]=useState<string[]>([]);
 const seenCursors=useRef(new Set<string>());
 const revision=useRef(0),active=useRef(false),reading=useRef<number|null>(null),writes=useRef(new Set<string>()),keys=useRef(new Map<string,string>());
 const load=useCallback(async(next?:string)=>{
  if(reading.current!==null||!active.current)return;const r=revision.current,g=session.generation;reading.current=r;
  const valid=()=>active.current&&revision.current===r&&session.generation===g;
  setBusy(true);setError('');
  try{const current=await session.revalidate();session.assertGeneration(g);if(!valid()||current.status!=='signedIn')return;
   const result=await api.call('listNotifications',{query:{limit:30,...(next?{cursor:next}:{})}});session.assertGeneration(g);if(!valid())return;
   const page=result.page;if(page.hasMore!==(page.nextCursor!==null)||(page.nextCursor&&(page.nextCursor===next||(!!next&&seenCursors.current.has(page.nextCursor))))){setCursor(null);throw Error('INVALID_PAGINATION');}
   if(!next)seenCursors.current.clear();if(next)seenCursors.current.add(next);
   setItems(old=>next?[...new Map([...(old??[]),...result.data].map(n=>[n.id,n])).values()]:result.data);setCursor(result.page.nextCursor);
  }catch(e){if(valid()){if(e instanceof ApiError&&[401,403,404,410].includes(e.status)){setItems(null);setCursor(null);}setError(e instanceof ApiError?loadErrorMessage(e):'Couldn’t load notifications. Try again.');}}
  finally{if(reading.current===r)reading.current=null;if(valid())setBusy(false);}
 },[api,session]);
 useFocusEffect(useCallback(()=>{active.current=true;setMarking([...writes.current]);void load();const listener=AppState.addEventListener('change',state=>{revision.current++;reading.current=null;if(state!=='active'){active.current=false;setItems(null);setCursor(null);}else{active.current=true;setMarking([...writes.current]);void load();}});return()=>{active.current=false;revision.current++;reading.current=null;setItems(null);setCursor(null);listener.remove();};},[load]));
 const mark=async(n:Notice)=>{if(!active.current||reading.current!==null||writes.current.has(n.id))return;writes.current.add(n.id);setMarking([...writes.current]);const r=revision.current,g=session.generation;const valid=()=>active.current&&revision.current===r&&session.generation===g;
  const key=keys.current.get(n.id)??newId();keys.current.set(n.id,key);setError('');
  try{const result=await api.call('markRead',{params:{notificationId:n.id},idempotencyKey:key});session.assertGeneration(g);if(valid()){setItems(old=>old?.map(x=>x.id===n.id?result.data:x)??null);keys.current.delete(n.id);}}
  catch(e){if(valid()){if(e instanceof ApiError&&[401,403,404,410].includes(e.status)){setItems(null);setCursor(null);}setError('Couldn’t mark this notification as read. Retry explicitly.');}}
  finally{writes.current.delete(n.id);if(active.current)setMarking([...writes.current]);}
 };
 const open=(n:Notice)=>{if(!n.readAt)void mark(n);if(n.conversationId)router.push(`/chat/${n.conversationId}`);else if(n.mealId)router.push(`/meals/${n.mealId}`);};
 return (
  <AccountPage testID="notifications">
   {error?<View style={styles.error}><FormMessage message={error}/><Primary secondary label="Retry loading notifications" disabled={busy} onPress={()=>void load()}/></View>:null}
   {busy&&!items?<Text style={styles.loading}>Loading notifications…</Text>:null}
   {items?.length===0&&!error&&!busy?<Empty icon="Bell" title="No notifications yet." body="Requests, approvals and changes to your meals will show up here. Messages stay in your chats."/>:null}
   {items?.map(n=>{
    const unread=!n.readAt,target=!!(n.conversationId||n.mealId),label=labels[n.template]??'You have an update.';
    return (
     <View key={n.id} style={styles.row}>
      <Pressable accessibilityRole={target?'button':'text'} accessibilityLabel={`${label}, ${when(n.createdAt)}${unread?', unread':''}`} disabled={!target} onPress={()=>open(n)} style={styles.rowMain}>
       <View style={[styles.icon,unread&&styles.iconUnread]}><Icon name={ICONS[n.template]??'Bell'} size={16} color={colors.forest}/></View>
       <View style={styles.copy}>
        <Text style={[styles.title,unread&&styles.titleUnread]} numberOfLines={2}>{label}</Text>
        <Text style={styles.time}>{when(n.createdAt)}</Text>
       </View>
       {unread?<View style={styles.dot} accessibilityElementsHidden importantForAccessibility="no"/>:null}
      </Pressable>
      {unread?<View style={styles.markRow}><TextAction label="Mark as read" disabled={busy||marking.includes(n.id)} onPress={()=>void mark(n)}/></View>:null}
     </View>
    );
   })}
   {cursor?<View style={styles.more}><TextAction label="Load more notifications" disabled={busy} onPress={()=>void load(cursor)}/></View>:null}
  </AccountPage>
 );
}

const ICONS:Record<string,IconName>={meal_cancelled:'CrossCircled',application_submitted:'Person',application_withdrawn:'Person',guest_left:'Person',application_expired:'Clock',booking_updated:'Calendar',application_approved:'CheckCircled',application_declined:'CrossCircled',deletion_received:'Trash',deletion_completed:'Trash'};
const WHEN=new Intl.DateTimeFormat('en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/London'});
/** London wall time, e.g. “Wed 21 Oct, 11:00”. */
export const when=(instant:string)=>WHEN.format(new Date(instant));

/** Same empty-state pattern as Meals and Inbox. */
function Empty({icon,title,body,action}:{icon:IconName;title:string;body?:string;action?:ReactNode}){
 return <View style={styles.empty}><Icon name={icon} size={30} color={colors.forest}/><Text style={styles.emptyTitle}>{title}</Text>{body?<Text style={styles.emptyBody}>{body}</Text>:null}{action?<View style={styles.emptyAction}>{action}</View>:null}</View>;
}

const styles=createStyles({
 error:{gap:10,marginBottom:12},
 loading:{fontSize:13,color:colors.muted},
 row:{borderBottomWidth:1,borderBottomColor:colors.line,paddingVertical:10},
 rowMain:{flexDirection:'row',alignItems:'center',gap:12,minHeight:44},
 icon:{width:36,height:36,borderRadius:18,backgroundColor:colors.surface,alignItems:'center',justifyContent:'center'},
 iconUnread:{backgroundColor:colors.selectedSurface},
 copy:{flex:1,gap:2},
 title:{fontSize:14,lineHeight:19,color:colors.ink},
 titleUnread:{fontWeight:'700'},
 time:{fontSize:12,color:colors.muted},
 dot:{width:8,height:8,borderRadius:4,backgroundColor:colors.forest},
 markRow:{alignItems:'flex-start',marginLeft:48},
 more:{alignItems:'center',marginTop:8},
 empty:{flexGrow:1,alignItems:'center',justifyContent:'center',gap:8,paddingVertical:40,paddingHorizontal:10},
 emptyTitle:{fontSize:18,fontWeight:'700',color:colors.ink,textAlign:'center',marginTop:4},
 emptyBody:{fontSize:13,lineHeight:19,color:colors.muted,textAlign:'center'},
 emptyAction:{alignSelf:'stretch',marginTop:10},
});
