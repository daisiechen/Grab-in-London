import { useEffect, useRef, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { ActionPage, BRAND_PAPER } from '../../../ui/ActionPage.tsx';
import { Notice } from '../../../ui/Bits.tsx';
import { Primary, TextAction } from '../../../ui/Button.tsx';
import { FormMessage } from '../../../ui/FormMessage.tsx';
import { useServices, useSessionState } from '../../../services.tsx';
import { clearPendingLink, getPendingLink, submitPendingLink } from '../link.ts';
import { useFinishSignIn } from '../useAuthGate.ts';
import { authText } from './auth-text.ts';

export function LinkRequiredScreen() {
 const router=useRouter();const services=useServices();const state=useSessionState();const finish=useFinishSignIn();
 const mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return ()=>{mounted.current=false;};},[]);
 const [now,setNow]=useState(services.now());const [busy,setBusy]=useState(false);const [issue,setIssue]=useState<string|null>(null);
 useEffect(()=>{const timer=setInterval(()=>setNow(services.now()),1000);return ()=>clearInterval(timer);},[services]);
 const pending=getPendingLink(now);
 const confirm=async()=>{
  const generation=services.session.generation;
  setBusy(true);setIssue(null);
  const result=await submitPendingLink(services);
  if(!mounted.current||generation!==services.session.generation||(!result.ok&&result.stale))return;
  setBusy(false);
  if(!result.ok){setIssue(result.message);return;}
  try {
   const updated=await services.session.revalidate();
   if(!mounted.current||generation!==services.session.generation||getPendingLink(services.now()))return;
   if(updated.status==='signedIn')finish(updated.session);
   else setIssue('The link was saved. Check your connection and sign in again.');
  }catch{if(mounted.current&&generation===services.session.generation&&!getPendingLink(services.now()))setIssue('The link was saved. Check your connection and sign in again.');}
 };
 const ready=!!pending?.proof&&state.status==='signedIn';
 const cancel=()=>{clearPendingLink();router.replace('/sign-in');};
 const footer=!pending
  ?<Primary label="Back to sign-in" onPress={cancel}/>
  :ready
   ?<><Primary label="Confirm account link" busy={busy} onPress={()=>void confirm()}/><TextAction label="Cancel account link" disabled={busy} onPress={cancel}/></>
   :<><Primary label="Sign in with original account" disabled={busy} onPress={()=>router.replace('/sign-in')}/><TextAction label="Cancel account link" disabled={busy} onPress={cancel}/></>;
 return <ActionPage testID="link-required" paper footer={footer}>
  <Stack.Screen options={{headerStyle:{backgroundColor:BRAND_PAPER},headerShadowVisible:false}}/>
  <Text accessibilityRole="header" style={authText.h1}>You already have an account.</Text>
  <Text style={authText.prose}>This email matches an existing Fancy account. Sign in the way you did before, then confirm the link. Your account data will stay in place.</Text>
  {!pending?<Notice icon>This link has expired or ended. Start sign-in again.</Notice>:<Notice icon>{ready&&state.status==='signedIn'?`Signed in as ${state.session.user.displayName}. Confirm only if this is your original account.`:'Use the sign-in method already linked to your original account.'}</Notice>}
  {ready?<TextAction label="Not you? Sign in with original account" disabled={busy} onPress={()=>router.replace('/sign-in')}/>:null}
  <View><FormMessage message={issue}/></View>
 </ActionPage>;
}
