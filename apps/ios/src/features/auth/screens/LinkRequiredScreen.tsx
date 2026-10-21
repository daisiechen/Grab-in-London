import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Primary, TextAction } from '../../../ui/Button.tsx';
import { Screen } from '../../../ui/Screen.tsx';
import { Body, Heading } from '../../../ui/Text.tsx';
import { FormMessage } from '../../../ui/FormMessage.tsx';
import { useServices, useSessionState } from '../../../services.tsx';
import { clearPendingLink, getPendingLink, submitPendingLink } from '../link.ts';
import { useFinishSignIn } from '../useAuthGate.ts';

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
 return <Screen testID="link-required">
  <Heading>You already have an account.</Heading>
  <Body>This email matches an existing Fancy account. Sign in the way you did before, then confirm the link. Your account data will stay in place.</Body>
  {!pending?<Body>This link has expired or ended. Start sign-in again.</Body>:<>
   <Body>{pending.proof&&state.status==='signedIn'?`Signed in as ${state.session.user.displayName}. Confirm only if this is your original account.`:'Use the sign-in method already linked to your original account.'}</Body>
   {pending.proof&&state.status==='signedIn'?<Primary label="Confirm account link" busy={busy} onPress={()=>void confirm()}/>:null}
   <Primary secondary label="Sign in with original account" disabled={busy} onPress={()=>router.replace('/sign-in')}/>
  </>}
  <FormMessage message={issue}/>
  <TextAction label={pending?'Cancel account link':'Back to sign-in'} disabled={busy} onPress={()=>{clearPendingLink();router.replace('/sign-in');}}/>
 </Screen>;
}
