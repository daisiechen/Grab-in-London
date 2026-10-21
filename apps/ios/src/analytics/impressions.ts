import { useCallback,useEffect,useRef } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useServices } from '../services.tsx';
import type { Meal } from '../features/meals/format.ts';
import { useAnalyticsState } from './hooks.ts';
export interface DiscoveryProof {requestId:string;generation:number}
export function useNativeImpressions(meals:Meal[],proofs:Record<string,DiscoveryProof>){
 const {analytics,session,now}=useServices(),state=useAnalyticsState();
 const latest=useRef({meals,proofs});latest.current={meals,proofs};
 const visible=useRef(new Set<string>()),seen=useRef(new Set<string>()),timers=useRef(new Map<string,ReturnType<typeof setTimeout>>()),focused=useRef(false);
 const schedule=useRef(()=>{});
 const stop=()=>{for(const timer of timers.current.values())clearTimeout(timer);timers.current.clear();};
 schedule.current=()=>{
  stop();if(!focused.current||AppState.currentState!=='active'||!analytics.getState().enabled)return;
  const generation=analytics.getState().generation;
  for(const id of visible.current){
   const meal=latest.current.meals.find(m=>m.id===id),proof=latest.current.proofs[id],key=`${generation}:${id}`;
   if(!meal||!proof||proof.generation!==generation||seen.current.has(key))continue;
   const eligible=()=>{const auth=session.getState();return meal.status==='OPEN'&&Date.parse(meal.startsAt.instant)>now()&&Date.parse(meal.closesAt.instant)>now()&&(auth.status==='signedIn'?meal.allowedActions.includes('APPLY'):auth.status==='signedOut'&&meal.confirmedCount<meal.capacity);};
   if(!eligible())continue;
   timers.current.set(id,setTimeout(()=>{
    timers.current.delete(id);
    if(!focused.current||AppState.currentState!=='active'||analytics.getState().generation!==generation||!visible.current.has(id)||!eligible())return;
    if(analytics.emit('meal_impression',{mealId:id,discoveryRequestId:proof.requestId,visibleRatio:0.5,durationMs:1000,eligible:true,foreground:true}))seen.current.add(key);
   },1000));
  }
 };
 useFocusEffect(useCallback(()=>{focused.current=true;schedule.current();const sub=AppState.addEventListener('change',()=>schedule.current());return()=>{focused.current=false;stop();sub.remove();};},[]));
 useEffect(()=>{seen.current.clear();schedule.current();},[state.generation]);
 useEffect(()=>{schedule.current();return stop;},[meals,proofs,state.enabled]);
 return useCallback((info:{viewableItems:Array<{isViewable:boolean|null;item:Meal}>})=>{visible.current=new Set(info.viewableItems.filter(i=>i.isViewable).map(i=>i.item.id));schedule.current();},[]);
}
