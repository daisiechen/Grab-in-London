import {createContext,useCallback,useContext,useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {useLocation} from 'react-router';
import {ApiError,newIntentKey} from '@fancy/client';
import {useApi} from '../../api/ApiProvider.tsx';
import {useSession} from '../../api/session.tsx';
import {LivePoller} from '../../lib/poller.ts';
import {usePollerDeps} from '../../lib/pollerContext.tsx';
import {assistantError,emptyPreferences,routeContext,secretToken,type AIDraft,type AISession,type AIStatus,type AssistantEditor,type AssistantTurn,type PreferenceFields,type Preferences} from './model.ts';

export const ASSISTANT_INPUT_LIMIT_ERROR='Please shorten your message to 2,000 characters or fewer. Your text is kept.';

interface AssistantContextValue {
 open:boolean;home:boolean;manage:boolean;input:string;turns:AssistantTurn[];busy:boolean;error:string;notice:string;session:AISession|null;preferences:Preferences;preferencesBusy:boolean;editor:AssistantEditor|null;
 show:()=>void;close:()=>void;continueConversation:()=>Promise<void>;goHome:()=>void;showPreferences:()=>Promise<void>;setInput:(text:string)=>void;send:(input?:string,includeEditor?:boolean,mealIds?:string[])=>Promise<void>;newConversation:()=>Promise<void>;
 savePreferences:(fields:PreferenceFields,proposal?:{id:string;preferenceVersion:string})=>Promise<boolean>;deletePreferences:()=>Promise<void>;transfer:(draft:AIDraft,replaceConfirmed:boolean)=>Promise<boolean>;registerEditor:(editor:AssistantEditor|null)=>void;activity:()=>void;
}
const Context=createContext<AssistantContextValue|null>(null);
export function AssistantProvider({children}:{children:ReactNode}) {
 const {api}=useApi();const {state}=useSession();const location=useLocation();const pollerDeps=usePollerDeps();
 const [open,setOpen]=useState(false),[home,setHome]=useState(true),[manage,setManage]=useState(false),[input,setInputState]=useState(''),[turns,setTurns]=useState<AssistantTurn[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [session,setSession]=useState<AISession|null>(null),[preferences,setPreferences]=useState<Preferences>(emptyPreferences),[preferencesBusy,setPreferencesBusy]=useState(false),[editor,setEditor]=useState<AssistantEditor|null>(null);
 const preferencesRef=useRef(preferences);preferencesRef.current=preferences;
 const previousHandle=useRef<string|undefined>(undefined);
 const resumeRequired=useRef(false),resumeJob=useRef<Promise<boolean>|null>(null);
 const pauseRevision=useRef(0),sessionPreferenceEpoch=useRef<string|null>(null);
 const foreground=useRef(document.visibilityState!=='hidden');
 const heldStatus=useRef<{gen:number;owner:string;status:AIStatus}|null>(null),releaseStatus=useRef<(status:AIStatus)=>void>(()=>{});
 const actor=state.status==='signed-in'?state.session.user.id:state.status;const actorRef=useRef(actor);actorRef.current=actor;
 const [resumeRevision,setResumeRevision]=useState(0);
 const sessionRef=useRef<AISession|null>(null),editorRef=useRef<AssistantEditor|null>(null),generation=useRef(0),boot=useRef<Promise<AISession>|null>(null),guest=useRef(false),alive=useRef(true),lastEdit=useRef(0),requestRef=useRef<{id:string;fingerprint:string}|null>(null);
 const scene=useRef(''),sceneVersion=useRef(0);const nextScene=`${location.pathname}${location.search}`;
 if(scene.current!==nextScene){scene.current=nextScene;sceneVersion.current++;}
 sessionRef.current=session;editorRef.current=editor;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;generation.current++;api.setAIDeviceToken(null);};},[api]);
 const valid=(gen:number)=>alive.current&&generation.current===gen&&actorRef.current===actor;
 const clearConversation=useCallback((message:string)=>{generation.current++;heldStatus.current=null;resumeRequired.current=false;resumeJob.current=null;sessionPreferenceEpoch.current=null;boot.current=null;requestRef.current=null;previousHandle.current=sessionRef.current?.revokeHandle??previousHandle.current;sessionRef.current=null;setSession(null);setTurns([]);setBusy(false);setHome(true);setError('');setNotice(message);api.setAIDeviceToken(null);},[api]);
 const handleError=useCallback((e:unknown)=>{
  if(e instanceof ApiError&&['AI_SESSION_EXPIRED','AI_RESULT_EXPIRED'].includes(e.code))clearConversation(assistantError(e));else setError(assistantError(e));
 },[clearConversation]);
 const verifyCurrent=useCallback(async():Promise<boolean>=>{
  if(!foreground.current)return false;
  if(resumeJob.current)return resumeJob.current;
  const current=sessionRef.current;if(!current){if(boot.current)return false;resumeRequired.current=false;return true;}
  const gen=generation.current,owner=actorRef.current,pausedAt=pauseRevision.current,wasPaused=resumeRequired.current;
  resumeRequired.current=true;
  const stillCurrent=()=>valid(gen)&&pauseRevision.current===pausedAt&&actorRef.current===owner&&sessionRef.current?.sessionId===current.sessionId&&sessionRef.current.generation===current.generation;
  const job=(async()=>{
   try{
    if(Date.parse(current.expiresAt)<=Date.now()){handleError(new ApiError({status:410,code:'AI_SESSION_EXPIRED',message:'Conversation expired'}));return false;}
    if(state.status==='signed-in'){
     const {data}=await api.client.call('readAIPreferences',{});if(!stillCurrent())return false;
     if(data.epoch!==sessionPreferenceEpoch.current){clearConversation('Preferences changed on another device. Old conversation conditions were cleared. Your unsent message is kept.');preferencesRef.current=data;setPreferences(data);return false;}
     preferencesRef.current=data;setPreferences(data);
    }
    await api.client.call('readAI',{params:{sessionId:current.sessionId}});if(!stillCurrent())return false;
    resumeRequired.current=false;const held=heldStatus.current;heldStatus.current=null;if(held&&held.gen===gen&&held.owner===owner)releaseStatus.current(held.status);if(wasPaused)setResumeRevision(value=>value+1);return true;
   }catch(e){if(stillCurrent())handleError(e);return false;}
  })();resumeJob.current=job;
  try{return await job;}finally{if(resumeJob.current===job)resumeJob.current=null;}
 },[api,state.status,actor,clearConversation,handleError]);
 useEffect(()=>{
  const pause=()=>{foreground.current=false;if(sessionRef.current||boot.current){pauseRevision.current++;resumeRequired.current=true;resumeJob.current=null;}};
  const resume=()=>{if(document.visibilityState!=='hidden'){foreground.current=true;if(resumeRequired.current)void verifyCurrent();}};
  const visibility=()=>{if(document.visibilityState==='hidden')pause();else resume();};
  document.addEventListener('visibilitychange',visibility);window.addEventListener('blur',pause);window.addEventListener('focus',resume);
  return()=>{document.removeEventListener('visibilitychange',visibility);window.removeEventListener('blur',pause);window.removeEventListener('focus',resume);};
 },[verifyCurrent]);
 const ensureSession=useCallback(async()=>{
  if(sessionRef.current){if(Date.parse(sessionRef.current.expiresAt)>Date.now())return sessionRef.current;throw new ApiError({status:410,code:'AI_SESSION_EXPIRED',message:'Conversation expired'});}
  if(boot.current)return boot.current;
  const gen=generation.current;
  boot.current=(async()=>{
   if(state.status==='signed-in'){const {data}=await api.client.call('readAIPreferences',{});if(!valid(gen))throw new Error('Session changed');preferencesRef.current=data;setPreferences(data);}
   if(state.status!=='signed-in'&&!guest.current){const {data}=await api.client.call('createGuestSession',{body:{clientRequestId:newIntentKey(),client:'WEB'}});if(!valid(gen))throw new Error('Session changed');api.setGuestCsrfToken(data.csrfToken);guest.current=true;}
   const {data}=await api.client.call('bootstrapAI',{body:{deviceChallenge:secretToken(),...(previousHandle.current?{previousRevokeHandle:previousHandle.current}:{})},idempotencyKey:newIntentKey()});
   if(!valid(gen))throw new Error('Session changed');api.setAIDeviceToken(data.deviceToken);sessionPreferenceEpoch.current=preferencesRef.current.epoch;sessionRef.current=data;setSession(data);return data;
  })();
  try{return await boot.current;}finally{if(valid(gen))boot.current=null;}
 },[api,state.status]);
 const activity=useCallback((kind:'EDIT'|'EXPLICIT_ACTION'='EXPLICIT_ACTION')=>{
  const current=sessionRef.current;if(resumeRequired.current||!current||Date.parse(current.expiresAt)<=Date.now())return;
  const gen=generation.current;void api.client.call('activityAI',{params:{sessionId:current.sessionId},body:{generation:current.generation,activityType:kind,activityEventId:newIntentKey()},idempotencyKey:newIntentKey()}).then(({data})=>{if(valid(gen)&&sessionRef.current?.sessionId===current.sessionId){const next={...current,expiresAt:data.expiresAt};sessionRef.current=next;setSession(next);}}).catch(e=>{if(valid(gen))handleError(e);});
 },[api,handleError,actor]);
 const setInput=useCallback((text:string)=>{setInputState(text);if(text.length<=2000)setError(previous=>previous===ASSISTANT_INPUT_LIMIT_ERROR?'':previous);if(Date.now()-lastEdit.current>1000){lastEdit.current=Date.now();activity('EDIT');}},[activity]);
 const applyStatus=useCallback((status:AIStatus)=>{
  if(status.sessionId!==sessionRef.current?.sessionId||status.generation!==sessionRef.current.generation)return;
  if(resumeRequired.current){heldStatus.current={gen:generation.current,owner:actorRef.current,status};return;}
  setTurns(previous=>previous.map(t=>t.id===status.requestId?{...t,status,error:status.state==='FAILED'?'Fancy could not finish this request. You can retry it.':status.state==='SUPERSEDED'?'Your context changed. Please ask again.':null}:t));
  if(status.state!=='PENDING'){requestRef.current=null;setBusy(false);}
 },[]);
 releaseStatus.current=applyStatus;
 const pending=turns.findLast(t=>t.status?.state==='PENDING');
 useEffect(()=>{
  if(!open||home||manage||!pending?.status||!session)return;
  const gen=generation.current;const requestId=pending.id;
  const poller=new LivePoller(async()=>{
   if(resumeRequired.current&&!(await verifyCurrent()))return 'stop';if(!valid(gen))return 'stop';
   try{const {data}=await api.client.call('pollAI',{params:{requestId},query:{sessionId:session.sessionId,generation:session.generation}});if(!valid(gen))return 'stop';applyStatus(data);return data.state==='PENDING'?'continue':'stop';}
   catch(e){if(valid(gen))handleError(e);if(e instanceof ApiError&&[401,403,409,410].includes(e.status))return 'stop';throw e;}
  },pollerDeps(),async()=>{foreground.current=true;resumeRequired.current=true;return await verifyCurrent()&&valid(gen);});poller.start();return()=>poller.stop();
 },[api,open,home,manage,pending?.id,session?.sessionId,session?.generation,pollerDeps,applyStatus,handleError,verifyCurrent,resumeRevision]);
 useEffect(()=>{
  if(!session)return;
  const timer=setTimeout(()=>{if(sessionRef.current?.sessionId===session.sessionId&&Date.parse(sessionRef.current.expiresAt)<=Date.now())clearConversation('This conversation expired after 30 minutes without activity. Your unsent message is kept.');},Math.max(0,Date.parse(session.expiresAt)-Date.now()));return()=>clearTimeout(timer);
 },[session,clearConversation]);
 const readPreferences=useCallback(async()=>{
  if(state.status!=='signed-in')return;
  const gen=generation.current;setPreferencesBusy(true);
  try{const {data}=await api.client.call('readAIPreferences',{});if(valid(gen))setPreferences(data);}catch(e){if(valid(gen))handleError(e);}finally{if(valid(gen))setPreferencesBusy(false);}
 },[api,state.status,handleError]);
 const send=useCallback(async(explicitInput?:string,includeEditor=false,mealIds?:string[])=>{
  const original=explicitInput??input;const text=original.trim();if(!text||busy)return;
  if(original.length>2000){setError(ASSISTANT_INPUT_LIMIT_ERROR);return;}
  const gen=generation.current;setBusy(true);setError('');setNotice('');setHome(false);setManage(false);
  try{
   if(sessionRef.current&&!(await verifyCurrent())){if(valid(gen))setBusy(false);return;}
   const current=await ensureSession();if(!valid(gen))return;
   if(!foreground.current){setBusy(false);return;}
   if(resumeRequired.current&&!(await verifyCurrent())){if(valid(gen))setBusy(false);return;}
   if(!valid(gen)||sessionRef.current?.sessionId!==current.sessionId)return;
   const registered=editorRef.current;const context=routeContext(location.pathname,location.search);
   const body={...context,generation:current.generation,input:text,queryVersion:String(sceneVersion.current),preferenceVersion:state.status==='signed-in'?preferencesRef.current.version:'0',...(state.status==='guest'?{guestPreferences:preferencesRef.current.fields}:{}),...(mealIds?.length?{explicitMealIds:mealIds.slice(0,3)}:{}),contextVersion:String(sceneVersion.current),...(registered?{editorVersion:registered.version,...(registered.kind==='APPLICATION'&&registered.targetId?{explicitMealId:registered.targetId}:{}),...(registered.kind==='GROUP'&&registered.targetId?{explicitConversationId:registered.targetId}:{}),...(includeEditor?{editorText:registered.text}:{})}:{})};
   const fingerprint=JSON.stringify(body);if(requestRef.current?.fingerprint!==fingerprint)requestRef.current={id:newIntentKey(),fingerprint};const id=requestRef.current.id;
   setTurns(previous=>previous.some(t=>t.id===id)?previous:previous.concat({id,input:text,status:null,error:null}));
   const {data}=await api.client.call('requestAI',{params:{sessionId:current.sessionId},body:{...body,requestId:id},idempotencyKey:id});
   if(!valid(gen))return;if(resumeRequired.current){applyStatus(data);return;}setInputState(current=>current.trim()===text?'':current);applyStatus(data);
   void api.client.call('activityAI',{params:{sessionId:current.sessionId},body:{generation:current.generation,activityType:'SEND',activityEventId:id},idempotencyKey:id}).then(({data:active})=>{if(valid(gen)&&sessionRef.current?.sessionId===current.sessionId){const updated={...sessionRef.current,expiresAt:active.expiresAt};sessionRef.current=updated;setSession(updated);}}).catch(()=>{});
  }catch(e){if(valid(gen)){setBusy(false);handleError(e);}}
 },[api,input,busy,ensureSession,location.pathname,location.search,preferences.version,state.status,applyStatus,handleError,verifyCurrent]);
 const show=useCallback(()=>{setOpen(true);setHome(true);setManage(false);setError('');},[]);
 const close=useCallback(()=>{setOpen(false);setHome(true);requestAnimationFrame(()=>document.getElementById('fancy-assistant-launcher')?.focus());},[]);
 const continueConversation=useCallback(async()=>{
  const current=sessionRef.current;if(!current)return;const gen=generation.current;setError('');
  try{if(await verifyCurrent()&&valid(gen)){setHome(false);setManage(false);activity();}}catch(e){if(valid(gen))handleError(e);}
 },[activity,handleError,verifyCurrent]);
 const newConversation=useCallback(async()=>{
  if(resumeRequired.current&&sessionRef.current&&!(await verifyCurrent()))return;
  const current=sessionRef.current;setError('');
  try{if(current)await api.client.call('resetAI',{params:{sessionId:current.sessionId},body:{generation:current.generation,reason:'NEW'},idempotencyKey:newIntentKey()});setInputState('');clearConversation('A new conversation. Your saved preferences are kept.');}catch(e){handleError(e);}
 },[api,clearConversation,handleError,verifyCurrent]);
 const showPreferences=useCallback(async()=>{setManage(true);setError('');activity();await readPreferences();},[activity,readPreferences]);
 const savePreferences=useCallback(async(fields:PreferenceFields,proposal?:{id:string;preferenceVersion:string})=>{
  if(proposal&&sessionRef.current&&!(await verifyCurrent()))return false;
  const gen=generation.current;setPreferencesBusy(true);setError('');
  try{
   if(state.status!=='signed-in'){setPreferences(p=>({...p,fields,version:String(BigInt(p.version)+1n),confirmedAt:new Date().toISOString()}));clearConversation('Preferences are kept only while you use this guest session.');setManage(true);return true;}
   const current=sessionRef.current;if(proposal&&!current)throw new Error('No active proposal session');
   const {data}=await api.client.call('replaceAIPreferences',{ifMatch:proposal?.preferenceVersion??preferences.version,idempotencyKey:newIntentKey(),body:{fields,confirmation:true,...(proposal&&current?{proposalId:proposal.id,sessionId:current.sessionId,generation:current.generation}:{})}});
   if(!valid(gen))return false;setPreferences(data);clearConversation('Preferences updated. Conversation conditions have been cleared.');setManage(true);return true;
  }catch(e){if(valid(gen))handleError(e);return false;}finally{if(alive.current)setPreferencesBusy(false);}
 },[api,state.status,preferences.version,clearConversation,handleError,verifyCurrent]);
 const deletePreferences=useCallback(async()=>{
  const gen=generation.current;setPreferencesBusy(true);setError('');
  try{if(state.status==='signed-in'){const {data}=await api.client.call('deleteAIPreferences',{ifMatch:preferences.version,idempotencyKey:newIntentKey()});if(!valid(gen))return;setPreferences(data);}else setPreferences(emptyPreferences());clearConversation('Preferences deleted and conversation cleared. Your unsent text is kept.');setManage(true);}
  catch(e){if(valid(gen))handleError(e);}finally{if(alive.current)setPreferencesBusy(false);}
 },[api,state.status,preferences.version,clearConversation,handleError]);
 const transfer=useCallback(async(draft:AIDraft,replaceConfirmed:boolean)=>{
  const actionGeneration=generation.current,actionScene=sceneVersion.current,registered=editorRef.current;
  if(sessionRef.current&&!(await verifyCurrent()))return false;
  if(!valid(actionGeneration))return false;
  if(sceneVersion.current!==actionScene||editorRef.current!==registered){setError('Your editor changed while the draft was checked. Please review and try again.');return false;}
  const current=sessionRef.current;if(!current||!registered){setError('Open the original application, create form or group editor before transferring this draft.');return false;}
  if(draft.kind!==registered.kind||draft.targetId!==registered.targetId){setError('This draft belongs to a different editor. Open its original page.');return false;}
  if(registered.text.trim()&&!replaceConfirmed)return false;
  const gen=generation.current;const editorSnapshot=registered;setError('');
  try{const {data}=await api.client.call('validateAIDraft',{params:{draftId:draft.id},idempotencyKey:newIntentKey(),body:{sessionId:current.sessionId,generation:current.generation,editorKind:registered.kind,targetId:registered.targetId,editorVersion:registered.version,replaceConfirmed}});
   if(!valid(gen))return false;const latest=editorRef.current;if(sceneVersion.current!==actionScene||!latest||latest!==editorSnapshot||latest.kind!==editorSnapshot.kind||latest.targetId!==editorSnapshot.targetId||latest.version!==editorSnapshot.version){setError('Your editor changed while the draft was checked. Please review and try again.');return false;}latest.apply(data);setNotice('Draft transferred. Review it in the original editor before submitting.');close();return true;
  }catch(e){if(valid(gen))handleError(e);return false;}
 },[api,close,handleError,verifyCurrent]);
 const registerEditor=useCallback((registered:AssistantEditor|null)=>{editorRef.current=registered;setEditor(registered);},[]);
 const value=useMemo(()=>({open,home,manage,input,turns,busy,error,notice,session,preferences,preferencesBusy,editor,show,close,continueConversation,goHome:()=>{setHome(true);setManage(false);},showPreferences,setInput,send,newConversation,savePreferences,deletePreferences,transfer,registerEditor,activity:()=>activity()}),[open,home,manage,input,turns,busy,error,notice,session,preferences,preferencesBusy,editor,show,close,continueConversation,showPreferences,setInput,send,newConversation,savePreferences,deletePreferences,transfer,registerEditor,activity]);
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAssistant(){const context=useContext(Context);if(!context)throw new Error('AssistantProvider is required');return context;}
/** Parent editor owns its value/version; this hook never submits or persists AI response text. */
export function useAssistantEditor(editor:AssistantEditor|null){const {registerEditor}=useAssistant();const current=useRef(editor);current.current=editor;useEffect(()=>{registerEditor(editor?{...editor,apply:(draft)=>current.current?.apply(draft)}:null);return()=>registerEditor(null);},[registerEditor,editor?.kind,editor?.targetId,editor?.version,editor?.text]);}

export function useAssistantEditorRevision(fingerprint:string):string{const revision=useRef({fingerprint,value:0});if(revision.current.fingerprint!==fingerprint)revision.current={fingerprint,value:revision.current.value+1};return String(revision.current.value);}
