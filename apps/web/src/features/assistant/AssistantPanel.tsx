import {useEffect,useState,type FormEvent} from 'react';
import {Link} from 'react-router';
import {ArrowRightIcon,Cross2Icon,PaperPlaneIcon,ReloadIcon} from '@radix-ui/react-icons';
import {DIETARY,LANGUAGES,MOODS} from '@fancy/contracts';
import {useSession} from '../../api/session.tsx';
import {Sheet} from '../../ui/Sheet.tsx';
import {ConfirmSheet} from '../../ui/ConfirmSheet.tsx';
import {ChoiceGroup,Field,FormError,Primary,TextAction} from '../../ui/components.tsx';
import {poundsToPence,penceToPounds} from '../create/model.ts';
import {areaName} from '../meals/present.ts';
import {ASSISTANT_INPUT_LIMIT_ERROR,useAssistant} from './context.tsx';
import type {AIDraft,AIResult,PreferenceFields} from './model.ts';
import './assistant.css';

/** Original approved Fancy character, reproduced as vector controls rather than a new mascot. */
export function FancySprite(){return <svg className="assistant-sprite" viewBox="0 0 64 64" aria-hidden="true"><path d="M32 12C25 2 16 6 18 15c-13 4-16 18-11 29 4 10 11 13 25 11 14 2 21-1 25-11 5-11 2-25-11-29 2-9-7-13-14-3Z" fill="currentColor"/><path d="M30 13c0-8 7-11 13-9-1 6-6 10-13 9Z" fill="#d7ee79"/><ellipse cx="23" cy="33" rx="3" ry="4" fill="#f5f2e8"/><ellipse cx="41" cy="33" rx="3" ry="4" fill="#f5f2e8"/><path d="M26 43q6 5 12 0" fill="none" stroke="#f5f2e8" strokeWidth="2.5" strokeLinecap="round"/><circle cx="16" cy="40" r="3" fill="#ffb49b"/><circle cx="48" cy="40" r="3" fill="#ffb49b"/></svg>;}
export function preferencesSummary(fields:PreferenceFields):string {
 const parts=[...fields.areas.map(areaName),...(fields.budgetMaxPence?[`up to £${penceToPounds(fields.budgetMaxPence)}`]:[]),...(fields.tableSizes.length?[`tables for ${fields.tableSizes.join(' or ')}`]:[]),...fields.languages.map(v=>LANGUAGES[v as keyof typeof LANGUAGES]??v),...fields.dietaryCodes.map(v=>DIETARY[v as keyof typeof DIETARY]??v),...fields.moods.map(v=>MOODS[v as keyof typeof MOODS]??v)];return parts.join(' · ')||'No saved preferences yet.';
}
function PreferencesForm(){
 const assistant=useAssistant();const {state}=useSession();const [fields,setFields]=useState(assistant.preferences.fields),[budget,setBudget]=useState(assistant.preferences.fields.budgetMaxPence?penceToPounds(assistant.preferences.fields.budgetMaxPence):''),[issue,setIssue]=useState(''),[remove,setRemove]=useState(false);
 useEffect(()=>{setFields(assistant.preferences.fields);setBudget(assistant.preferences.fields.budgetMaxPence?penceToPounds(assistant.preferences.fields.budgetMaxPence):'');},[assistant.preferences]);
 const toggle=(key:'languages'|'dietaryCodes'|'moods',value:string)=>setFields(previous=>{const values:readonly string[]=previous[key];return {...previous,[key]:values.includes(value)?values.filter(item=>item!==value):[...values,value]};});
 const submit=(event:FormEvent)=>{event.preventDefault();const pence=budget.trim()?poundsToPence(budget):null;if(budget.trim()&&(!pence||pence<=0)){setIssue('Use a positive amount in pounds, such as 35 or 35.50.');return;}setIssue('');void assistant.savePreferences({...fields,budgetMaxPence:pence});};
 return <section className="assistant-preferences"><h3>What I remember</h3><p>{state.status==='signed-in'?'Only preferences you approve. You can change or delete them at any time.':'Guest preferences stay in this session. They are not copied into an account when you sign in.'}</p><p className="assistant-saved">{preferencesSummary(assistant.preferences.fields)}</p>
 <form noValidate onSubmit={submit}>
  {fields.areas.length>0&&<p>Areas: {fields.areas.map(areaName).join(', ')}</p>}
  <Field label="Budget up to (£ per person)" error={issue}>{props=><input {...props} inputMode="decimal" value={budget} maxLength={8} placeholder="Any budget" onChange={e=>{setBudget(e.target.value);assistant.activity();}}/>}</Field>
  <ChoiceGroup label="Table size, including host" multiple options={[2,3,4,5,6].map(n=>[String(n),String(n)] as const)} value={fields.tableSizes.map(String)} onChange={v=>setFields(previous=>({...previous,tableSizes:previous.tableSizes.includes(Number(v))?previous.tableSizes.filter(n=>n!==Number(v)):[...previous.tableSizes,Number(v)]}))}/>
  <ChoiceGroup label="Languages" multiple options={Object.entries(LANGUAGES)} value={fields.languages} onChange={v=>toggle('languages',v)}/>
  <ChoiceGroup label="Dietary preferences" multiple options={Object.entries(DIETARY)} value={fields.dietaryCodes} onChange={v=>toggle('dietaryCodes',v)}/>
  <ChoiceGroup label="Conversation mood" multiple options={Object.entries(MOODS)} value={fields.moods} onChange={v=>toggle('moods',v)}/>
  <p className="assistant-note">Saved preferences help rank results. They do not change the filters you have chosen.</p>
  <Primary type="submit" disabled={assistant.preferencesBusy}>{assistant.preferencesBusy?'Saving…':'Confirm and save preferences'}</Primary>
 </form>
 <TextAction danger disabled={assistant.preferencesBusy} onClick={()=>setRemove(true)}>Delete preferences</TextAction>
 <ConfirmSheet open={remove} onOpenChange={setRemove} title="Delete your preferences?" confirmLabel="Delete preferences" keepLabel="Keep preferences" busy={assistant.preferencesBusy} onConfirm={()=>{setRemove(false);void assistant.deletePreferences();}}><p>This also clears the conversation context that used them. Your unsent text stays.</p></ConfirmSheet>
 </section>;
}
function draftPath(draft:AIDraft){return draft.kind==='CREATE'?'/create':draft.kind==='APPLICATION'?`/meals/${draft.targetId}/apply`:`/inbox/${draft.targetId}`;}
function Result({result,onReplace}:{result:AIResult;onReplace:(draft:AIDraft)=>void}){
 const a=useAssistant();const [working,setWorking]=useState(false),[proposalSaved,setProposalSaved]=useState(false);
 const useDraft=async(draft:AIDraft)=>{if(a.editor?.text.trim()){onReplace(draft);return;}setWorking(true);try{await a.transfer(draft,false);}finally{setWorking(false);}};
 const registered=result.draft&&a.editor?.kind===result.draft.kind&&a.editor.targetId===result.draft.targetId;
 return <div className="assistant-answer"><strong>Fancy</strong><p className="assistant-reply">{result.replyText}</p>
 {result.cards.map(card=><Link key={card.mealId} className="assistant-meal-card" to={`/meals/${card.mealId}`} onClick={a.close}><strong>{card.title}</strong><span>{new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',dateStyle:'medium',timeStyle:'short'}).format(new Date(card.startsAt))} · Table for {card.capacity}</span><span>Up to £{penceToPounds(card.budgetMaxPence)} per person</span><b>View meal <ArrowRightIcon/></b></Link>)}
 {result.cards.length>1&&<TextAction disabled={a.busy} onClick={()=>void a.send('Compare these meals.',false,result.cards.map(card=>card.mealId))}>Compare these meals</TextAction>}
 {result.comparison&&<div className="assistant-compare" role="region" aria-label="Meal comparison" tabIndex={0}><table><thead><tr><th scope="col">Meal</th><th scope="col">When</th><th scope="col">Budget</th><th scope="col">Table</th><th scope="col">Status</th></tr></thead><tbody>{result.comparison.map(card=><tr key={card.mealId}><th scope="row"><Link to={`/meals/${card.mealId}`} onClick={a.close}>{card.title}</Link></th><td>{new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',dateStyle:'short',timeStyle:'short'}).format(new Date(card.startsAt))}</td><td>£{penceToPounds(card.budgetMaxPence)}</td><td>{card.capacity}</td><td>{card.status}</td></tr>)}</tbody></table></div>}
 {result.preferenceProposal&&<div className="assistant-draft"><p>{preferencesSummary(result.preferenceProposal.fields)}</p><Primary secondary disabled={a.preferencesBusy||proposalSaved} onClick={()=>{void a.savePreferences(result.preferenceProposal!.fields,{id:result.preferenceProposal!.id,preferenceVersion:result.preferenceProposal!.preferenceVersion}).then(saved=>{if(saved)setProposalSaved(true);});}}>{proposalSaved?'Preference proposal reviewed':'Confirm and remember'}</Primary></div>}
 {result.draft&&<div className="assistant-draft"><span className="assistant-eyebrow">DRAFT · FOR YOU TO REVIEW</span>{result.draft.text&&<p className="assistant-reply">{result.draft.text}</p>}{result.draft.fields&&<><strong>{result.draft.fields.title}</strong><p className="assistant-reply">{result.draft.fields.description}</p></>}
  {registered?<Primary secondary disabled={working} onClick={()=>void useDraft(result.draft!)}>{working?'Checking draft…':result.draft.kind==='CREATE'?'Use in meal form':result.draft.kind==='APPLICATION'?'Use in application':'Use in group editor'}</Primary>:<Link className="primary secondary" to={draftPath(result.draft)} onClick={a.close}>Open original editor <ArrowRightIcon/></Link>}
  <p className="assistant-note">Nothing is sent or published. Review the original editor, then submit it yourself.</p>
 </div>}
 </div>;
}
export function AssistantPanel(){
 const a=useAssistant();const [replace,setReplace]=useState<AIDraft|null>(null),[replacing,setReplacing]=useState(false),[includeEditor,setIncludeEditor]=useState(false);
 const prompts=a.editor?.kind==='CREATE'?['Help me introduce my meal.','Help me plan a relaxed table.']:a.editor?.kind==='GROUP'?['Help me draft a message to the group.']:a.editor?.kind==='APPLICATION'?['Help me write an application.','Explain this meal.']:['Find a meal this week.','Help me host a meal.'];
 useEffect(()=>{setIncludeEditor(false);},[a.editor?.kind,a.editor?.targetId,a.open]);
 useEffect(()=>{if(!a.session)setReplace(null);},[a.session]);
 const send=(event:FormEvent)=>{event.preventDefault();void a.send(undefined,includeEditor);setIncludeEditor(false);};
 return <><Sheet open={a.open} onOpenChange={value=>value?a.show():a.close()} title="A little help from Fancy" description="Find a table. Make a plan. You decide."><div className="assistant-panel">
 <div className="assistant-tools"><FancySprite/><span>{a.editor?'Your current editor':'Your meal plans'}</span><TextAction onClick={()=>void a.showPreferences()} disabled={a.preferencesBusy}>My preferences</TextAction><button type="button" className="assistant-close" aria-label="Close assistant" onClick={a.close}><Cross2Icon/></button></div>
 <div className="assistant-utilities">{(!a.home||a.manage)&&<TextAction onClick={a.goHome}>Assistant home</TextAction>}{a.turns.length>0&&<TextAction onClick={()=>void a.newConversation()}>New conversation</TextAction>}</div>
 <FormError>{a.error}</FormError>{a.notice&&<p className="assistant-notice" role="status">{a.notice}</p>}
 {a.manage?<PreferencesForm/>:<>
  <div className="assistant-conversation" role="log" aria-label="Conversation with Fancy">
   {a.home||!a.turns.length?<div className="assistant-welcome"><span className="assistant-eyebrow">YOUR NEXT GOOD MEAL</span><h2>What sounds good?</h2><p>Tell me when, where and what you’d like to spend. Or let’s get your own table started.</p>{a.turns.length>0&&<button type="button" className="assistant-continue" onClick={()=>void a.continueConversation()}><strong>Continue conversation <ArrowRightIcon/></strong><span>{a.busy?'Your request is still being checked.':'Pick up where you left off.'}</span></button>}<div className="assistant-prompts">{prompts.map(prompt=><button type="button" key={prompt} disabled={a.busy} onClick={()=>void a.send(prompt)}>{prompt}<ArrowRightIcon/></button>)}</div><p className="assistant-note">Conversations restart after 30 minutes without activity. Saved account preferences stay until you delete them.</p></div>:a.turns.map(turn=><article className="assistant-turn" key={turn.id}><span className="assistant-eyebrow">You</span><p className="assistant-question">{turn.input}</p>{turn.status?.result&&<Result result={turn.status.result} onReplace={setReplace}/>}<FormError>{turn.error}</FormError>{turn.status?.state==='PENDING'&&<p className="assistant-processing" role="status"><ReloadIcon/>Fancy is working on your request…</p>}</article>)}
  </div>
  <form noValidate className="assistant-composer" onSubmit={send}>
   <Field label="Ask Fancy" error={a.input.length>2000?ASSISTANT_INPUT_LIMIT_ERROR:undefined}>{props=><textarea className="resize-none" {...props} value={a.input} onChange={e=>a.setInput(e.target.value)} rows={3} placeholder="A relaxed dinner on Friday, around £30…"/>}</Field>
   {a.editor?.text.trim()&&<label className="assistant-editor-consent"><input type="checkbox" checked={includeEditor} onChange={e=>setIncludeEditor(e.target.checked)}/>Include my current editor text for this request</label>}
   <div className="assistant-send-row"><small>{a.input.length}/2000</small><button type="submit" className="assistant-send" disabled={a.busy||!a.input.trim()} aria-label="Send to Fancy">{a.busy?'Working…':'Send'}<PaperPlaneIcon/></button></div>
  </form>
 </>}
 </div></Sheet>
 <ConfirmSheet open={replace!==null} onOpenChange={value=>{if(!value)setReplace(null);}} title="Replace your editor text?" keepLabel="Keep my text" confirmLabel="Replace with this draft" busy={replacing} error={a.error} onConfirm={()=>{if(!replace)return;setReplacing(true);void a.transfer(replace,true).then(ok=>{if(ok)setReplace(null);}).finally(()=>setReplacing(false));}}><p>Your current text will be replaced, not added to. You can review the result before sending or publishing.</p></ConfirmSheet>
 </>;
}
