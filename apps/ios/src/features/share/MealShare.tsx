import {useEffect,useRef,useState} from 'react';
import {Linking,ScrollView,Share,Text,useWindowDimensions} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {publicMealInvitation,type PublicMealShareInput} from '@fancy/client';
import {Primary} from '../../ui/Button.tsx';
import {Body} from '../../ui/Text.tsx';
import {Sheet} from '../../ui/Sheet.tsx';
import {colors,type} from '../../ui/tokens.ts';

/** Explicit user actions only; never read the clipboard or infer recipient delivery. */
export function MealShare({meal,origin=process.env.EXPO_PUBLIC_MEAL_ORIGIN??''}:{meal:PublicMealShareInput;origin?:string}){
 const [open,setOpen]=useState(false),[note,setNote]=useState(''),[busy,setBusy]=useState(false);
 const epoch=useRef(0),{height}=useWindowDimensions();
 useEffect(()=>()=>{epoch.current++;},[]);
 let invitation:ReturnType<typeof publicMealInvitation>|null=null;
 try{invitation=publicMealInvitation(origin,meal);}catch{/* No private-route fallback. */}
 const close=()=>{epoch.current++;setOpen(false);setNote('');setBusy(false);};
 const copy=async(value:string)=>{
  const generation=epoch.current;setBusy(true);setNote('');
  try{if(!await Clipboard.setStringAsync(value))throw new Error('Copy unavailable');if(generation===epoch.current)setNote('Copied.');}
  catch{if(generation===epoch.current)setNote('Couldn’t copy. Select the link or invitation text below to copy it.');}
  finally{if(generation===epoch.current)setBusy(false);}
 };
 const share=async()=>{
  if(!invitation)return;
  const generation=epoch.current;setBusy(true);setNote('');
  try{await Share.share({message:invitation.text,url:invitation.url});}
  catch{if(generation===epoch.current)setNote('System sharing isn’t available. You can copy the link below.');}
  finally{if(generation===epoch.current)setBusy(false);}
 };
 const whatsapp=async()=>{
  if(!invitation)return;
  const generation=epoch.current;
  try{await Linking.openURL(invitation.whatsappUrl);}
  catch{if(generation===epoch.current)setNote('WhatsApp couldn’t open. You can copy the invitation below.');}
 };
 return <>
  <Primary secondary label="Share meal" onPress={()=>{epoch.current++;setNote('');setOpen(true);}}/>
  <Sheet visible={open} title="Share this meal" onClose={close}>
   <ScrollView style={{maxHeight:height*0.65}} contentContainerStyle={{gap:12}}>
    {invitation?<>
     <Body>Share the public meal link. Availability can change; everyone reviews the latest meal before requesting to join.</Body>
     <Primary label="More sharing options" disabled={busy} onPress={()=>void share()}/>
     <Primary secondary label="WhatsApp" disabled={busy} onPress={()=>void whatsapp()}/>
     <Primary secondary label="Copy link for WeChat" disabled={busy} onPress={()=>void copy(invitation.url)}/>
     <Primary secondary label="Copy link" disabled={busy} onPress={()=>void copy(invitation.url)}/>
     <Primary secondary label="Copy invitation text" disabled={busy} onPress={()=>void copy(invitation.text)}/>
     <Text selectable accessibilityLabel="Meal link" style={{fontSize:type.body,color:colors.ink}}>{invitation.url}</Text>
     <Text selectable accessibilityLabel="Invitation text" style={{fontSize:type.body,color:colors.ink}}>{invitation.text}</Text>
     <Text accessibilityLiveRegion="polite">{note||'Opening a sharing app doesn’t confirm that an invitation was sent.'}</Text>
    </>:<Body>Sharing is temporarily unavailable. You can still view this meal.</Body>}
   </ScrollView>
  </Sheet>
 </>;
}
