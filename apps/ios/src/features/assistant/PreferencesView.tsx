import {useState} from 'react';
import {DIETARY,LANGUAGES,MOODS} from '@fancy/contracts';
import {View} from 'react-native';
import {useServices,useSessionState} from '../../services.tsx';
import {Primary,TextAction} from '../../ui/Button.tsx';
import {MultiChoice} from '../../ui/ChoiceGroup.tsx';
import {Field} from '../../ui/Field.tsx';
import {FormMessage} from '../../ui/FormMessage.tsx';
import {Body,SectionTitle} from '../../ui/Text.tsx';
import {emptyPreferences,type Preferences} from './manager.ts';
export function PreferencesView(){
 const {assistant}=useServices();const state=assistant.getSnapshot();const auth=useSessionState();
 const [fields,setFields]=useState<Preferences>(()=>structuredClone(state.preferences));
 const [budget,setBudget]=useState(fields.budgetMaxPence===null?'':String(fields.budgetMaxPence/100));
 const [busy,setBusy]=useState(false);const [error,setError]=useState<string|null>(null);
 const toggle=(key:'areas'|'tableSizes'|'dietaryCodes'|'languages'|'moods',value:string|number)=>{setFields(p=>({...p,[key]:(p[key] as Array<string|number>).includes(value)?p[key].filter(v=>v!==value):[...p[key],value]}));};
 const save=async()=>{
  if(budget.trim()&&!/^\d+(\.\d{1,2})?$/.test(budget.trim())){setError('Enter a maximum budget in pounds, or leave it blank.');return;}
  const max=budget.trim()?Math.round(Number(budget)*100):null;
  if(max!==null&&(!Number.isSafeInteger(max)||max<1)){setError('Enter a positive budget.');return;}
  setBusy(true);await assistant.savePreferences({...fields,budgetMaxPence:max});setBusy(false);
 };
 return <View style={{gap:12}}>
  <SectionTitle>My preferences</SectionTitle>
  <Body muted>{auth.status==='signedIn'?'Confirmed values are shared across your signed-in devices.':'Guest values stay in this app’s memory and clear with New conversation or account changes.'} Preferences help order matches; they never exclude a meal unless you explicitly ask.</Body>
  <Field label="Budget up to / person (£)" value={budget} onChangeText={setBudget} keyboardType="decimal-pad" />
  <MultiChoice<string> label="Table sizes" options={[2,3,4,5,6].map(n=>[String(n),`${n} people`] as const)} values={fields.tableSizes.map(String)} onToggle={n=>toggle('tableSizes',Number(n))}/>
  <MultiChoice<string> label="Conversation languages" options={Object.entries(LANGUAGES)} values={fields.languages} onToggle={n=>toggle('languages',n)}/>
  <MultiChoice<string> label="Dietary (host-declared)" options={Object.entries(DIETARY)} values={fields.dietaryCodes} onToggle={n=>toggle('dietaryCodes',n)}/>
  <MultiChoice<string> label="Atmosphere" options={Object.entries(MOODS)} values={fields.moods} onToggle={n=>toggle('moods',n)}/>
  {assistant.areas.length?<MultiChoice<string> label="Areas" options={assistant.areas.map(area=>[area,area.split('-').map(w=>w[0]?.toUpperCase()+w.slice(1)).join(' ')] as const)} values={fields.areas} onToggle={area=>toggle('areas',area)}/>:<Body muted>Available areas appear after you explore meals. Existing area preferences can be cleared below.</Body>}
  <FormMessage message={error}/><Primary label="Confirm preferences" busy={busy} onPress={()=>void save()}/>
  <TextAction label="Clear selection" onPress={()=>{setFields(emptyPreferences());setBudget('');}}/>
  <TextAction destructive label="Delete saved preferences" onPress={()=>void assistant.deletePreferences()}/>
 </View>;
}
