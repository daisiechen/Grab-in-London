import { useState,useSyncExternalStore } from 'react';
import { View } from 'react-native';
import { Body,SectionTitle } from '../ui/Text.tsx';
import { Primary,TextAction } from '../ui/Button.tsx';
import { FormMessage } from '../ui/FormMessage.tsx';
import type { AnalyticsManager } from './manager.ts';
export function AnalyticsConsent({manager}:{manager:AnalyticsManager}) {
  const state=useSyncExternalStore(manager.subscribe,manager.getState),[expanded,setExpanded]=useState(false);
  if(state.choice!=='unknown'&&!expanded&&!state.error)return <TextAction label="Analytics preferences" onPress={()=>setExpanded(true)}/>;
  return <View style={{padding:12,gap:8}} accessibilityLabel="Optional analytics">
    <SectionTitle>Help improve Fancy</SectionTitle>
    <Body>Allow optional usage analytics, including meal views and discovery results? We don’t collect message text or search keywords. You can decline and keep using Fancy. Your choice lasts for this account session.</Body>
    <Primary secondary disabled={state.busy} label="Allow analytics" onPress={()=>{setExpanded(false);void manager.choose(true);}}/>
    <Primary secondary disabled={state.busy} label="Decline analytics" onPress={()=>{setExpanded(false);void manager.choose(false);}}/>
    <FormMessage message={state.error}/>
  </View>;
}
