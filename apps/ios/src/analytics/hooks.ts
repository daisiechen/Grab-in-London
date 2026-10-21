import { useCallback,useEffect,useRef,useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useServices } from '../services.tsx';
import type { EventType,Properties } from './allowlist.ts';
export function useAnalyticsState(){const {analytics}=useServices();return useSyncExternalStore(analytics.subscribe,analytics.getState);}
/** Actual focused, foreground presentation, never a response arriving behind another screen. */
export function useAnalyticsPresentation(type:EventType,properties:Properties,ready:boolean){
 useAnalyticsPresentations([{type,properties}],ready);
}
export function useAnalyticsPresentations(events:Array<{type:EventType;properties:Properties;key?:string}>,ready:boolean){
 const {analytics}=useServices();const state=useAnalyticsState(),seen=useRef(new Set<string>()),json=JSON.stringify(events);
 useFocusEffect(useCallback(()=>{
  if(!ready||!state.enabled)return;
  const present=()=>{if(!ready||!state.enabled||AppState.currentState!=='active')return;for(const event of JSON.parse(json) as Array<{type:EventType;properties:Properties;key?:string}>){const key=`${state.generation}:${event.type}:${event.key??JSON.stringify(event.properties)}`;if(!seen.current.has(key)&&analytics.emit(event.type,event.properties))seen.current.add(key);}};
  present();const subscription=AppState.addEventListener('change',present);return()=>subscription.remove();
 },[analytics,json,ready,state.enabled,state.generation]));
 useEffect(()=>()=>{seen.current.clear();},[]);
}
