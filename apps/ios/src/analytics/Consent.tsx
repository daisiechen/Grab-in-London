import { useState,useSyncExternalStore } from 'react';
import { View } from 'react-native';
import { Body,SectionTitle } from '../ui/Text.tsx';
import { Primary } from '../ui/Button.tsx';
import { SettingsLink } from '../ui/AccountPage.tsx';
import { FormMessage } from '../ui/FormMessage.tsx';
import { Sheet } from '../ui/Sheet.tsx';
import { useSessionState } from '../services.tsx';
import type { AnalyticsManager } from './manager.ts';

const COPY='Allow optional usage analytics, including meal views and discovery results? We don’t collect message text or search keywords. You can decline and keep using Fancy. Your choice lasts for this account session.';

function Choices({manager,onChosen}:{manager:AnalyticsManager;onChosen?:()=>void}) {
  const state=useSyncExternalStore(manager.subscribe,manager.getState);
  return <View style={{gap:8}} accessibilityLabel="Optional analytics">
    <Body>{COPY}</Body>
    <Primary secondary disabled={state.busy} label="Allow analytics" onPress={()=>{onChosen?.();void manager.choose(true);}}/>
    <Primary secondary disabled={state.busy} label="Decline analytics" onPress={()=>{onChosen?.();void manager.choose(false);}}/>
    <FormMessage message={state.error}/>
  </View>;
}

/** Settings row: collapsed once a choice exists, expandable to change it. */
export function AnalyticsConsent({manager}:{manager:AnalyticsManager}) {
  const state=useSyncExternalStore(manager.subscribe,manager.getState),[expanded,setExpanded]=useState(false);
  if(state.choice!=='unknown'&&!expanded&&!state.error)return <SettingsLink label="Analytics preferences" onPress={()=>setExpanded(true)}/>;
  return <View style={{gap:8}}><SectionTitle>Help improve Fancy</SectionTitle><Choices manager={manager} onChosen={()=>setExpanded(false)}/></View>;
}

/**
 * One prompt per signed-in session while no choice exists, presented as a bottom sheet so it never
 * pushes the discovery layout down. Closing it leaves analytics off; Settings can change it later.
 */
export function AnalyticsConsentSheet({manager}:{manager:AnalyticsManager}) {
  const state=useSyncExternalStore(manager.subscribe,manager.getState),session=useSessionState(),[closed,setClosed]=useState(false);
  const visible=session.status==='signedIn'&&!closed&&(state.choice==='unknown'||Boolean(state.error));
  return <Sheet visible={visible} title="Help improve Fancy" onClose={()=>setClosed(true)}>
    <Choices manager={manager} onChosen={()=>setClosed(true)}/>
  </Sheet>;
}
