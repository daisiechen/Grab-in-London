import {useCallback,useRef,useState} from 'react';
import {AppState,View} from 'react-native';
import {useFocusEffect,useRouter} from 'expo-router';
import {ApiError,type ResponseOf} from '@fancy/client';
import {useServices,useSessionState} from '../../services.tsx';
import {Screen} from '../../ui/Screen.tsx';
import {Body,Heading} from '../../ui/Text.tsx';
import {Primary} from '../../ui/Button.tsx';
import {FormMessage} from '../../ui/FormMessage.tsx';
import {loadErrorMessage} from '../../api/useQuery.ts';
import {rememberReturnTo} from '../auth/intent.ts';
const labels:Record<string,string>={deletion_received:'Account deletion requested',deletion_completed:'Account deletion completed',meal_cancelled:'Meal cancelled',application_submitted:'New request to join',application_withdrawn:'Request withdrawn',guest_left:'Guest left the meal',application_expired:'Request expired',booking_updated:'Booking updated',application_approved:'Request approved',application_declined:'Request declined'};
type Notice=ResponseOf<'listNotifications'>['data'][number];
export function NotificationsScreen(){
 const state=useSessionState(),{session}=useServices(),router=useRouter();
 if(state.status==='unavailable')return <Screen><Heading>Notifications</Heading><Body>We couldn’t verify your session.</Body><Primary label="Retry session" onPress={()=>void session.revalidate()}/></Screen>;
 if(state.status!=='signedIn')return <Screen><Heading>Notifications</Heading><Body>Sign in to see your notifications.</Body><Primary label="Sign in" onPress={()=>{rememberReturnTo('/inbox');router.push('/sign-in');}}/></Screen>;
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
 return <Screen><Heading>Notifications</Heading>{busy?<Body>Loading notifications…</Body>:null}{error?<><FormMessage message={error}/><Primary label="Retry loading notifications" disabled={busy} onPress={()=>void load()}/></>:null}{items?.length===0&&!error&&!busy?<Body>No notifications yet.</Body>:null}{items?.map(n=><View key={n.id} style={{gap:8}}><Body>{labels[n.template]??'You have an update.'}</Body><Body>{n.createdAt}</Body><Body>{n.readAt?'Read':'Unread'}</Body>{!n.readAt?<Primary label="Mark as read" disabled={busy||marking.includes(n.id)} onPress={()=>void mark(n)}/>:null}{n.mealId?<Primary label="View meal" secondary onPress={()=>router.push(`/meals/${n.mealId}`)}/>:null}</View>)}{cursor?<Primary label="Load more notifications" disabled={busy} onPress={()=>void load(cursor)}/>:null}</Screen>;
}
