import {useEffect,useRef,useState} from 'react';
import {AppState,KeyboardAvoidingView,Platform,Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {useRouter} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useServices} from '../../services.tsx';
import {Primary,TextAction} from '../../ui/Button.tsx';
import {CheckRow} from '../../ui/CheckRow.tsx';
import {Field} from '../../ui/Field.tsx';
import {FormMessage} from '../../ui/FormMessage.tsx';
import {Sheet} from '../../ui/Sheet.tsx';
import {Body,Heading} from '../../ui/Text.tsx';
import {colors,radius} from '../../ui/tokens.ts';
import {PreferencesView} from './PreferencesView.tsx';
import {useAssistantState} from './hooks.ts';
import {ASSISTANT_INPUT_MAX,OVERLONG_INPUT_MESSAGE,type AIDraft} from './manager.ts';

/** Native floating entry + modal; shares the approved green/peach tokens and existing Sheet. */
export function AssistantWidget(){
 const {assistant}=useServices();const s=useAssistantState();const insets=useSafeAreaInsets();const router=useRouter();
 const [active,setActive]=useState(AppState.currentState==='active');
 const [includeEditor,setIncludeEditor]=useState(false);const [replace,setReplace]=useState<AIDraft|null>(null);const [busy,setBusy]=useState(false);
 const editTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 useEffect(()=>{const sub=AppState.addEventListener('change',state=>{setActive(state==='active');if(state!=='active'){setReplace(null);setIncludeEditor(false);if(editTimer.current){clearTimeout(editTimer.current);editTimer.current=null;void assistant.edited();}assistant.pause();}else void assistant.resume();});return()=>sub.remove();},[assistant]);
 useEffect(()=>{
  if(!s.open||!active)return;
  const ttl=setInterval(()=>assistant.tick(),1000);
  const poll=s.phase==='processing'?setInterval(()=>void assistant.poll(),2000):null;
  return()=>{clearInterval(ttl);if(poll)clearInterval(poll);};
 },[assistant,s.open,s.phase,active]);
 useEffect(()=>()=>{if(editTimer.current)clearTimeout(editTimer.current);},[]);
 useEffect(()=>{setReplace(null);setIncludeEditor(false);},[s.open]);
 useEffect(()=>{setReplace(null);},[s.result]);
 const transfer=async(d:AIDraft,confirm:boolean)=>{setBusy(true);try{await assistant.transfer(d,confirm);setReplace(null);}catch(e){assistant.report(e);}finally{setBusy(false);}};
 const useDraft=(d:AIDraft)=>{
  const editor=assistant.editorFor(d);
  if(!editor){assistant.close();router.push(d.kind==='CREATE'?'/create/introduce':d.kind==='GROUP'?`/chat/${d.targetId}`:`/meals/${d.targetId}/apply`);return;}
  if(editor.current().text.trim()){setReplace(d);return;}
  void transfer(d,false);
 };
 return <>
  <Pressable accessibilityRole="button" accessibilityLabel="Ask Fancy" style={[styles.launcher,{bottom:Math.max(insets.bottom,12)+64}]} onPress={()=>assistant.open()}><Text style={styles.launcherText}>✦ Ask Fancy</Text></Pressable>
  <Sheet visible={s.open} title="Ask Fancy" onClose={()=>{if(editTimer.current){clearTimeout(editTimer.current);editTimer.current=null;void assistant.edited();}assistant.close();}}>
   <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined}>
    <ScrollView style={{maxHeight:480}} contentContainerStyle={{gap:12}} keyboardShouldPersistTaps="handled">
     {s.view==='preferences'?<PreferencesView key={`${s.preferenceVersion}:${s.view}:${JSON.stringify(s.preferences)}`}/>:<>
      {s.view==='home'?<><Heading>A little help finding your table.</Heading><Body muted>Find, compare or draft a few words. You choose what to send or publish.</Body><Primary label={s.restorable||s.turns.length?'Continue conversation':'Start conversation'} onPress={()=>void assistant.continue()}/><TextAction label="My preferences" onPress={()=>void assistant.preferences()}/></>:null}
      {s.view==='chat'?<>
       {s.turns.map((turn,i)=><View key={i} style={[styles.turn,turn.role==='user'&&styles.mine]}><Body>{turn.text}</Body></View>)}
       {s.phase==='processing'?<View accessibilityRole="alert"><Body>Thinking… You can close this panel and continue later.</Body></View>:null}
       <Field label="Ask Fancy a question" value={s.text} error={s.text.length>ASSISTANT_INPUT_MAX?OVERLONG_INPUT_MESSAGE:null} multiline onChangeText={text=>{
        assistant.setText(text);
        // Only real edits renew activity; rendering, polling and panel opening do not.
        if(!editTimer.current)editTimer.current=setTimeout(()=>{editTimer.current=null;void assistant.edited();},1000);
       }}/>
       {assistant.contextValue.sourcePage==='CREATE'||assistant.contextValue.explicitConversationId||assistant.contextValue.explicitMealId?<CheckRow label="Include the text in this form for polishing" checked={includeEditor} onChange={setIncludeEditor}/>:null}
       <Primary label="Ask" disabled={!s.text.trim()||s.text.length>ASSISTANT_INPUT_MAX||s.phase==='processing'} busy={s.phase==='loading'} onPress={()=>void assistant.send(includeEditor)}/>
      </>:null}
      {s.result?.cards.map(card=><Primary key={card.mealId} secondary label={`${card.title} · up to £${card.budgetMaxPence/100} · ${card.capacity} people`} onPress={()=>{assistant.close();router.push(`/meals/${card.mealId}`);}}/>)}
      {s.result?.comparison?.map(card=><View key={card.mealId} style={styles.turn}><Body>{`${card.title} · ${card.status}\n${card.startsAt}\nUp to £${card.budgetMaxPence/100} · ${card.capacity} people`}</Body><TextAction label={`Open ${card.title}`} onPress={()=>{assistant.close();router.push(`/meals/${card.mealId}`);}}/></View>)}
      {s.result?.draft?<View style={styles.turn}><Body>{s.result.draft.text??`${s.result.draft.fields?.title}\n${s.result.draft.fields?.description}`}</Body><Primary secondary label={assistant.editorFor(s.result.draft)?'Use text in form':'Open form to review'} busy={busy} onPress={()=>useDraft(s.result!.draft!)}/><Body muted>Nothing is sent, booked or published by using this candidate.</Body></View>:null}
      {s.result?.preferenceProposal?<View style={styles.turn}><Body>{`Suggested preferences: ${s.result.preferenceProposal.fields.areas.join(', ')}${s.result.preferenceProposal.fields.budgetMaxPence!==null?` · Up to £${s.result.preferenceProposal.fields.budgetMaxPence/100}`:''}${s.result.preferenceProposal.fields.tableSizes.length?` · ${s.result.preferenceProposal.fields.tableSizes.join(', ')} people`:''}. Review the language, dietary and atmosphere selections in My preferences before confirming.`}</Body><Primary label="Confirm proposed preferences" onPress={()=>void assistant.savePreferences(s.result!.preferenceProposal!.fields,s.result!.preferenceProposal!.id)}/></View>:null}
      {replace?<View style={styles.confirm} accessibilityRole="alert"><Body>Your form already has text. Keep it, or replace it with this candidate?</Body><Primary secondary label="Keep my text" onPress={()=>setReplace(null)}/><Primary label="Replace my text" busy={busy} onPress={()=>void transfer(replace,true)}/></View>:null}
      <TextAction label="New conversation" onPress={()=>void assistant.newConversation()}/>
     </>}
     <FormMessage message={s.error}/>
     {s.phase==='error'?<TextAction label="Retry assistant request" onPress={()=>void assistant.retry()}/>:null}
     {s.phase==='expired'?<TextAction label="Start again with my unsent text" onPress={()=>void assistant.continue()}/>:null}
    </ScrollView>
   </KeyboardAvoidingView>
  </Sheet>
 </>;
}
const styles=StyleSheet.create({
 launcher:{position:'absolute',right:16,zIndex:10,borderRadius:24,backgroundColor:colors.forest,paddingHorizontal:16,paddingVertical:13,minHeight:45},
 launcherText:{color:colors.white,fontWeight:'700',fontSize:13},turn:{backgroundColor:colors.surface,borderRadius:radius.md,padding:12,gap:8},mine:{backgroundColor:colors.selectedSurface},confirm:{borderWidth:1,borderColor:colors.secondaryBorder,borderRadius:radius.md,padding:12,gap:10},
});
