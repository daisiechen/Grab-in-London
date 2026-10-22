import * as ExpoCrypto from 'expo-crypto';
import {memoryAIConversationStore,type AIConversationStore,type AIConversationCredential,type AIConversationOwner} from './session-store.ts';
import type {GuestCredentialStore} from './guest-store.ts';
import {ApiError,type ApiClient,type RequestOf,type ResponseOf} from '@fancy/client';
import type {SessionManager} from '../auth/session.ts';
import {base64UrlEncode} from '../../platform/base64url.ts';
export type Preferences=ResponseOf<'readAIPreferences'>['data']['fields'];
export type AIDraft=ResponseOf<'validateAIDraft'>['data'];
export type AIResult=NonNullable<ResponseOf<'pollAI'>['data']['result']>;
export type AIContext=Pick<RequestOf<'requestAI'>['body'],'sourcePage'|'explicitMealId'|'explicitMealIds'|'explicitConversationId'|'appliedFilters'> & {unsupportedFilters?:boolean};
export interface Editor {key:string;kind:AIDraft['kind'];targetId:string|null;current:()=>{text:string;version:string};apply:(draft:AIDraft)=>void}
export interface AssistantState {
 open:boolean;view:'home'|'chat'|'preferences';phase:'idle'|'loading'|'processing'|'error'|'expired';text:string;
 error:string|null;result:AIResult|null;turns:Array<{role:'user'|'assistant';text:string}>;
 preferences:Preferences;preferenceVersion:string;expiresAt:number|null;restorable:boolean;
}
export const ASSISTANT_INPUT_MAX=2000;
export const OVERLONG_INPUT_MESSAGE='Shorten this question to 2,000 characters or fewer. Your text is kept.';
export const emptyPreferences=():Preferences=>({areas:[],budgetMaxPence:null,tableSizes:[],dietaryCodes:[],languages:[],moods:[]});
const initial=():AssistantState=>({open:false,view:'home',phase:'idle',text:'',error:null,result:null,turns:[],preferences:emptyPreferences(),preferenceVersion:'0',expiresAt:null,restorable:false});
const message=(e:unknown)=>e instanceof ApiError
 ? e.code==='AI_UNAVAILABLE'||e.code==='AI_BUDGET_EXCEEDED'?'Ask Fancy isn’t available right now. Your text is kept; preferences still work.'
 : e.code==='EDITOR_CONFLICT'?'Your text changed. Review it again before replacing anything.'
 : e.code==='TARGET_CHANGED'?'That meal or chat changed. Open it again before using this candidate.'
 : e.kind==='network'?'You appear to be offline. Your text is kept. Retry uses the same request.'
 : e.kind==='conflict'?'This changed elsewhere. Reload before trying again.'
 : e.kind==='rate_limit'?'Please wait before trying again. Your text is kept.'
 : 'We couldn’t complete this. Please try again.' : 'We couldn’t complete this. Please try again.';

/** Only install-bound credentials persist; prompts, preferences, turns, results and drafts remain RAM-only. */
export class AssistantManager {
 private readonly conversationStore:AIConversationStore;private conversationLoaded=false;private hydrating:{epoch:number;promise:Promise<void>}|null=null;private coldCandidate=false;private pendingCredential:ResponseOf<'bootstrapAI'>['data']|null=null;private initialAuthPending:boolean;private loginTransition=false;
 private guestLoaded=false;private failedStorage:(()=>Promise<void>)|null=null;private storageTail:Promise<void>=Promise.resolve();
 private state=initial();private readonly listeners=new Set<()=>void>();private epoch=0;private presentation=0;
 private session:ResponseOf<'bootstrapAI'>['data']|null=null;private guest:{token:string;expiresAt:number}|null=null;
 private guestIntent:string|null=null;private bootChallenge:string|null=null;private bootKey:string|null=null;
 private pending:{body:RequestOf<'requestAI'>['body'];sessionId:string}|null=null;private editors=new Map<string,Editor>();
 private booting:Promise<void>|null=null;private polling=false;
 private foreground=true;private needsResumeCheck=false;private preferenceEpoch:string|null=null;
 private resuming:{epoch:number;promise:Promise<boolean>}|null=null;
 private observedAreas=new Set<string>();private shownRequests=new Set<string>();private shownResults=new Set<string>();
 private contextOwner:symbol|null=null;private context:AIContext={sourcePage:'DISCOVER'};private actor:string;private revokingDevice:string|null=null;
 private readonly deps:{auth:SessionManager;api:ApiClient;newId:()=>string;randomBytes:(n:number)=>Uint8Array;now:()=>number;guestStore:GuestCredentialStore;conversationStore?:AIConversationStore;hashGuestCredential?:(token:string)=>Promise<string>;revokeGuest?:(session:ResponseOf<'bootstrapAI'>['data'],credential:string)=>Promise<void>};
 constructor(deps:AssistantManager['deps']){
  this.deps=deps;this.conversationStore=deps.conversationStore??memoryAIConversationStore();this.actor=this.actorKey();
  this.initialAuthPending=['restoring','unavailable'].includes(deps.auth.getState().status);
  deps.auth.subscribe(()=>{const state=deps.auth.getState(),actor=this.actorKey();
   if(this.initialAuthPending&&!['restoring','unavailable'].includes(state.status)){
    this.initialAuthPending=false;this.actor=actor;
    if(this.loginTransition&&state.status==='signedIn'){this.loginTransition=false;this.clear();}
    // A verified initial refresh adopts the stored owner; it is not an account switch.
    else if(this.state.open){const epoch=this.epoch;void this.restoreConversation(epoch).catch(e=>{if(epoch===this.epoch)this.handle(e);});}
   }else if(actor!==this.actor){this.actor=actor;this.loginTransition=false;this.clear();}
  });
 }
 getSnapshot=()=>this.state;
 subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>this.listeners.delete(fn);};
 private set(patch:Partial<AssistantState>){this.state={...this.state,...patch};for(const l of this.listeners)l();}
 private actorKey(){const s=this.deps.auth.getState();return s.status==='signedIn'?s.session.user.id:'guest';}
 private guard(epoch:number){if(epoch!==this.epoch)throw new Error('Assistant session changed');}
 get credential(){return this.guest&&this.guest.expiresAt>this.deps.now()?this.guest.token:null;}
 get deviceToken(){return this.session?.deviceToken??this.revokingDevice;}
 get areas(){return [...this.observedAreas].sort();}
 observeAreas(areas:readonly string[]){const size=this.observedAreas.size;for(const area of areas)if(area!=='unknown'&&/^[a-z0-9-]+$/.test(area))this.observedAreas.add(area);if(this.observedAreas.size!==size)this.set({});}
 get contextValue(){return this.context;}
 setContext(context:AIContext){
  const owner=Symbol('focused-assistant-context');this.contextOwner=owner;this.context=context;
  return()=>{if(this.contextOwner===owner){this.contextOwner=null;this.context={sourcePage:'DISCOVER'};}};
 }
 registerEditor(editor:Editor){this.editors.set(editor.key,editor);return()=>{if(this.editors.get(editor.key)===editor)this.editors.delete(editor.key);};}
 editorFor(draft:AIDraft){return [...this.editors.values()].find(e=>e.kind===draft.kind&&e.targetId===draft.targetId);}
 open(){const epoch=this.epoch;this.presentation++;this.set({open:true,view:'home',error:null});void this.restoreConversation(epoch).catch(e=>{if(epoch===this.epoch)this.handle(e);});}
 close(){this.presentation++;this.set({open:false});}
 pause(){
  this.needsResumeCheck=this.needsResumeCheck||(!this.coldCandidate&&(!!this.session||!!this.booting||this.preferenceEpoch!==null));
  this.foreground=false;this.epoch++;this.presentation++;this.booting=null;this.polling=false;this.resuming=null;
  this.set({turns:[],result:null,...(this.needsResumeCheck?{phase:'loading' as const,error:null}:{}),...(this.deps.auth.getState().status==='signedIn'?{preferences:emptyPreferences()}:{})});
 }
 resume():Promise<boolean>{
  this.foreground=true;this.tick();if(this.coldCandidate)return Promise.resolve(true);if(!this.needsResumeCheck)return Promise.resolve(true);
  if(this.resuming?.epoch===this.epoch)return this.resuming.promise;
  const epoch=this.epoch;const promise=this.verifyResume(epoch);const entry={epoch,promise};this.resuming=entry;
  void promise.finally(()=>{if(this.resuming===entry)this.resuming=null;});return promise;
 }
 private async ensureResumed(allowCold=false){const epoch=this.epoch;if(!this.foreground)return false;
  try{await this.restoreConversation(epoch);await this.flushStorage(epoch);if(this.coldCandidate&&!allowCold){this.set({error:'Continue this conversation before using its context.'});return false;}
   const valid=this.needsResumeCheck?await this.resume():true;return valid&&this.foreground&&epoch===this.epoch;
  }catch(e){if(epoch===this.epoch)this.handle(e);return false;}
 }
 private async verifyResume(epoch:number):Promise<boolean>{
  const signedIn=this.deps.auth.getState().status==='signedIn';
  this.set({phase:'loading',turns:[],result:null,error:null,...(signedIn?{preferences:emptyPreferences()}:{})});
  try{
   if(signedIn){
    const p=await this.deps.api.call('readAIPreferences',{});this.guard(epoch);
    const changed=this.preferenceEpoch!==null&&(this.preferenceEpoch!==p.data.epoch||this.state.preferenceVersion!==p.data.version);
    this.preferenceEpoch=p.data.epoch;
    if(changed){this.invalidateConversation(true);this.needsResumeCheck=false;this.set({preferences:p.data.fields,preferenceVersion:p.data.version,phase:'expired',error:'Your preferences changed on another device. The old conversation was cleared. Your unsent text is kept.'});return true;}
    this.set({preferences:p.data.fields,preferenceVersion:p.data.version});
   }
   const session=this.session;
   if(session){
    const current=await this.deps.api.call('readAI',{params:{sessionId:session.sessionId}});this.guard(epoch);
    this.needsResumeCheck=false;
    await this.persistConversation(Date.parse(current.data.expiresAt),epoch);this.guard(epoch);
    this.set({turns:current.data.turns.filter(t=>t.role==='user'||t.role==='assistant').map(t=>({role:t.role as 'user'|'assistant',text:t.text})),expiresAt:Date.parse(current.data.expiresAt),phase:'idle',error:null});
    if(current.data.latestRequestId)await this.poll(current.data.latestRequestId,false);
   }else{this.guard(epoch);this.needsResumeCheck=false;this.set({phase:'idle',error:null});}
   this.guard(epoch);return !this.needsResumeCheck;
  }catch(e){
   if(epoch===this.epoch){
    if(e instanceof ApiError&&(e.kind==='gone'||e.code==='AI_SUPERSEDED'))this.invalidateConversation(true);
    this.needsResumeCheck=true;this.set({phase:'error',turns:[],result:null,error:'We couldn’t verify this conversation. Your unsent text is kept. Reconnect and retry before using Ask Fancy.',...(signedIn?{preferences:emptyPreferences()}:{})});
   }
   return false;
  }
 }
 setText(text:string){this.set({text,...(this.state.error===OVERLONG_INPUT_MESSAGE||this.state.error==='Use 1–2,000 characters.'?{error:null}:{})});}
 async edited(){
  if(!this.foreground||this.coldCandidate||this.needsResumeCheck||!this.session||this.state.phase==='expired')return;
  const epoch=this.epoch;
  try{const active=await this.deps.api.call('activityAI',{params:{sessionId:this.session.sessionId},body:{generation:this.session.generation,activityType:'EDIT',activityEventId:this.deps.newId()}});this.guard(epoch);await this.persistConversation(Date.parse(active.data.expiresAt),epoch);this.guard(epoch);this.set({expiresAt:Date.parse(active.data.expiresAt)});}catch(e){if(epoch===this.epoch)this.handle(e);}
 }
 async preferences(){this.set({view:'preferences',error:null});await this.loadPreferences();}
 private async loadPreferences(strict=false){
  if(this.deps.auth.getState().status!=='signedIn')return;
  const epoch=this.epoch;
  try{const p=await this.deps.api.call('readAIPreferences',{});this.guard(epoch);if(this.session&&this.preferenceEpoch!==null&&this.preferenceEpoch!==p.data.epoch){this.invalidateConversation(true);this.set({phase:'idle'});}this.preferenceEpoch=p.data.epoch;this.set({preferences:p.data.fields,preferenceVersion:p.data.version});}catch(e){if(epoch===this.epoch)this.handle(e);if(strict)throw e;}
 }
 async savePreferences(fields:Preferences,proposalId?:string){
  if(proposalId&&(!(await this.ensureResumed())||!this.session||this.state.result?.preferenceProposal?.id!==proposalId)){this.set({error:'This proposal changed or expired. Ask again before confirming.'});return;}
  const epoch=this.epoch;
  try{
   if(this.deps.auth.getState().status==='signedIn'){
    const p=await this.deps.api.call('replaceAIPreferences',{ifMatch:this.state.preferenceVersion,idempotencyKey:this.deps.newId(),body:{fields,confirmation:true,...(proposalId&&this.session?{proposalId,sessionId:this.session.sessionId,generation:this.session.generation}:{})}});
    this.guard(epoch);this.preferenceEpoch=p.data.epoch;this.invalidateConversation(true);this.set({preferences:p.data.fields,preferenceVersion:p.data.version,phase:'idle',error:null,view:'home'});
   }else{this.invalidateConversation(true);this.set({preferences:structuredClone(fields),preferenceVersion:'0',phase:'idle',error:null,view:'home'});}
  }catch(e){if(epoch===this.epoch){this.handle(e);if(e instanceof ApiError&&e.kind==='conflict')await this.loadPreferences();}}
 }
 async deletePreferences(){
  if(this.deps.auth.getState().status!=='signedIn'){await this.savePreferences(emptyPreferences());return;}
  const epoch=this.epoch;
  try{const p=await this.deps.api.call('deleteAIPreferences',{ifMatch:this.state.preferenceVersion,idempotencyKey:this.deps.newId()});this.guard(epoch);this.preferenceEpoch=p.data.epoch;this.invalidateConversation(true);this.set({preferences:p.data.fields,preferenceVersion:p.data.version,phase:'idle',error:null,view:'home'});}catch(e){if(epoch===this.epoch)this.handle(e);}
 }
 private async bootstrap(){
  await this.restoreConversation(this.epoch);if(this.session)return;if(this.booting)return this.booting;
  const job=this.createSession();this.booting=job;try{await job;}finally{if(this.booting===job)this.booting=null;}
 }
 private async storage(action:()=>Promise<void>,epoch=this.epoch){
  const task=this.storageTail.then(async()=>{await action();this.failedStorage=null;});
  this.storageTail=task.catch(()=>{if(epoch===this.epoch){this.failedStorage=action;this.guestLoaded=false;}});await task;
 }
 private async flushStorage(epoch:number){await this.storageTail;this.guard(epoch);if(this.failedStorage){await this.storage(this.failedStorage,epoch);this.guard(epoch);}}
 async restoreIdentity(){await this.restoreGuest(this.epoch);}
 /** Explicit fresh login is distinguishable from cold refresh without modifying the auth owner. */
 async prepareLogin(){this.loginTransition=true;this.invalidateConversation(false);await this.flushStorage(this.epoch);}
 private async owner(epoch:number):Promise<AIConversationOwner>{
  const state=this.deps.auth.getState();if(state.status==='signedIn')return {kind:'USER',userId:state.session.user.id};
  await this.restoreGuest(epoch);this.guard(epoch);if(!this.credential)throw new Error('Guest credential unavailable');
  const hash=await (this.deps.hashGuestCredential??(token=>ExpoCrypto.digestStringAsync(ExpoCrypto.CryptoDigestAlgorithm.SHA256,token)))(this.credential);this.guard(epoch);return {kind:'GUEST',credentialSha256:hash};
 }
 private async persistConversation(expiresAt:number,epoch:number,candidate=this.session){
  if(!candidate||!Number.isFinite(expiresAt)||expiresAt<=this.deps.now())throw new Error('Invalid AI session expiry');
  const owner=await this.owner(epoch);this.guard(epoch);const value:AIConversationCredential={sessionId:candidate.sessionId,generation:candidate.generation,deviceToken:candidate.deviceToken,revokeHandle:candidate.revokeHandle,expiresAt,owner};
  await this.storage(async()=>{this.guard(epoch);await this.conversationStore.write(value);if(epoch!==this.epoch){await this.conversationStore.clear();throw new Error('Assistant session changed');}if(this.pendingCredential===candidate){this.session=candidate;this.pendingCredential=null;this.coldCandidate=false;this.set({expiresAt,restorable:true});}},epoch);this.guard(epoch);
 }
 private async restoreConversation(epoch:number):Promise<void>{
  await this.flushStorage(epoch);if(this.conversationLoaded)return;
  if(this.hydrating?.epoch===epoch)return this.hydrating.promise;
  const promise=(async()=>{const stored=await this.conversationStore.read();this.guard(epoch);
   if(!stored){this.conversationLoaded=true;return;}
   if(['restoring','unavailable'].includes(this.deps.auth.getState().status))throw new Error('Verify your account before continuing.');
   if(stored.expiresAt<=this.deps.now()){
    await this.storage(()=>this.conversationStore.clear(),epoch);this.guard(epoch);this.conversationLoaded=true;this.set({phase:'expired',restorable:false,error:'This conversation expired. Your unsent text is kept.'});return;
   }
   let matches=false;const state=this.deps.auth.getState();
   if(stored.owner.kind==='USER')matches=state.status==='signedIn'&&stored.owner.userId===state.session.user.id;
   else if(state.status==='signedOut'){await this.restoreGuest(epoch);this.guard(epoch);if(this.credential){const owner=await this.owner(epoch);matches=owner.kind==='GUEST'&&owner.credentialSha256===stored.owner.credentialSha256;}}
   if(!matches){await this.storage(()=>this.conversationStore.clear(),epoch);this.guard(epoch);this.conversationLoaded=true;return;}
   this.guard(epoch);this.session={sessionId:stored.sessionId,generation:stored.generation,deviceToken:stored.deviceToken,revokeHandle:stored.revokeHandle,expiresAt:new Date(stored.expiresAt).toISOString()};this.coldCandidate=true;this.conversationLoaded=true;this.set({restorable:true,expiresAt:stored.expiresAt,phase:'idle',error:null});
  })();const entry={epoch,promise};this.hydrating=entry;try{await promise;}finally{if(this.hydrating===entry)this.hydrating=null;}
 }

 private async restoreGuest(epoch:number){
  await this.flushStorage(epoch);this.guard(epoch);
  // Retry a failed write/clear before reading or creating any guest. In particular, a failed
  // account-transition clear must never resurrect the old guest identity.
  if(this.failedStorage){await this.storage(this.failedStorage);this.guard(epoch);}
  if(this.guestLoaded)return;
  try{const stored=await this.deps.guestStore.read();this.guard(epoch);
   if(stored&&stored.expiresAt>this.deps.now())this.guest=stored;
   else if(stored)await this.storage(()=>this.deps.guestStore.clear());
   this.guard(epoch);this.guestLoaded=true;
  }catch(e){this.guestLoaded=false;throw e;}
 }
 private async createSession(){
  const epoch=this.epoch;
  if(this.deps.auth.getState().status!=='signedIn'){
   await this.restoreGuest(epoch);this.guard(epoch);
   if(!this.credential){
    this.guestIntent??=this.deps.newId();
    const g=await this.deps.api.call('createGuestSession',{body:{clientRequestId:this.guestIntent,client:'IOS'}});this.guard(epoch);
    if(!g.data.guestToken)throw new Error('No guest credential');const guest={token:g.data.guestToken,expiresAt:Date.parse(g.data.expiresAt)};if(!Number.isFinite(guest.expiresAt)||guest.expiresAt<=this.deps.now())throw new Error('Invalid guest expiry');
    await this.storage(()=>this.deps.guestStore.write(guest));this.guard(epoch);this.guest=guest;
   }
  }else await this.loadPreferences(true);
  this.guard(epoch);this.bootChallenge??=base64UrlEncode(this.deps.randomBytes(32));this.bootKey??=this.deps.newId();
  const created=await this.deps.api.call('bootstrapAI',{body:{deviceChallenge:this.bootChallenge},idempotencyKey:this.bootKey});this.guard(epoch);
  this.pendingCredential=created.data;await this.persistConversation(Date.parse(created.data.expiresAt),epoch,created.data);this.guard(epoch);this.session=created.data;this.coldCandidate=false;this.set({expiresAt:Date.parse(created.data.expiresAt),restorable:true});
 }
 async continue(){
  const actionEpoch=this.epoch;if(!(await this.ensureResumed(true))||actionEpoch!==this.epoch)return;this.tick();if(actionEpoch!==this.epoch)return;const epoch=this.epoch;const presentation=this.presentation;this.set({view:'chat',phase:'loading',error:null});
  try{
   await this.bootstrap();this.guard(epoch);if(this.coldCandidate&&this.deps.auth.getState().status==='signedIn'){await this.loadPreferences(true);this.guard(epoch);}const s=this.session!;
   const current=await this.deps.api.call('readAI',{params:{sessionId:s.sessionId}});this.guard(epoch);
   if(presentation!==this.presentation)return;
   await this.persistConversation(Date.parse(current.data.expiresAt),epoch);this.guard(epoch);this.coldCandidate=false;this.needsResumeCheck=false;
   this.set({turns:current.data.turns.filter(t=>t.role==='user'||t.role==='assistant').map(t=>({role:t.role as 'user'|'assistant',text:t.text})),expiresAt:Date.parse(current.data.expiresAt),phase:'idle'});
   if(current.data.latestRequestId)await this.poll(current.data.latestRequestId,false);
  }catch(e){if(epoch===this.epoch&&presentation===this.presentation)this.handle(e);}
 }
 async send(includeEditorText=false){
  const actionEpoch=this.epoch;if(!(await this.ensureResumed())||actionEpoch!==this.epoch)return;this.tick();if(actionEpoch!==this.epoch)return;if(this.state.phase==='processing'||this.state.phase==='loading')return;
  if(this.context.unsupportedFilters){this.set({error:'Ask Fancy can’t apply the current map, time-of-day or text-search filter yet. Clear that filter before asking.',phase:'error'});return;}
  const input=this.state.text.trim();if(this.state.text.length>ASSISTANT_INPUT_MAX){this.set({error:OVERLONG_INPUT_MESSAGE});return;}if(!input){this.set({error:'Use 1–2,000 characters.'});return;}
  const epoch=this.epoch;const presentation=this.presentation;this.set({view:'chat',phase:'loading',error:null});
  try{
   await this.bootstrap();this.guard(epoch);if(this.coldCandidate&&this.deps.auth.getState().status==='signedIn'){await this.loadPreferences(true);this.guard(epoch);}const s=this.session!;
   const editor=[...this.editors.values()].find(e=>this.context.sourcePage==='CREATE'?e.kind==='CREATE':this.context.explicitConversationId?e.kind==='GROUP'&&e.targetId===this.context.explicitConversationId:e.kind==='APPLICATION'&&e.targetId===this.context.explicitMealId);
   const draft=editor?.current();const context={...this.context};delete context.unsupportedFilters;
   this.pending={sessionId:s.sessionId,body:{requestId:this.deps.newId(),generation:s.generation,input,...context,queryVersion:'0',preferenceVersion:this.state.preferenceVersion,contextVersion:'0',...(draft?{editorVersion:draft.version,...(includeEditorText?{editorText:draft.text}:{})}:{}),...(this.deps.auth.getState().status!=='signedIn'?{guestPreferences:this.state.preferences}:{})}};
   await this.submitPending(epoch,presentation);
  }catch(e){if(epoch===this.epoch&&presentation===this.presentation)this.handle(e);}
 }
 async retry(){
  if(!this.pending){await this.continue();return;}
  const actionEpoch=this.epoch;if(!(await this.ensureResumed())||actionEpoch!==this.epoch)return;
  this.set({phase:'loading',error:null});const epoch=this.epoch;const presentation=this.presentation;
  try{await this.submitPending(epoch,presentation);}catch(e){if(epoch===this.epoch&&presentation===this.presentation)this.handle(e);}
 }
 private async submitPending(epoch:number,presentation:number){
  const p=this.pending!;const response=await this.deps.api.call('requestAI',{params:{sessionId:p.sessionId},body:p.body});this.guard(epoch);
  if(presentation!==this.presentation)return;
  // SEND extends server activity; read its authoritative expiry rather than estimating from device time.
  const current=await this.deps.api.call('readAI',{params:{sessionId:p.sessionId}});this.guard(epoch);if(presentation!==this.presentation)return;
  await this.persistConversation(Date.parse(current.data.expiresAt),epoch);this.guard(epoch);if(presentation!==this.presentation)return;this.set({expiresAt:Date.parse(current.data.expiresAt)});
  const alreadyShown=this.shownRequests.has(p.body.requestId);this.shownRequests.add(p.body.requestId);
  this.set({text:this.state.text.trim()===p.body.input?'':this.state.text,turns:alreadyShown?this.state.turns:[...this.state.turns,{role:'user',text:p.body.input}]});this.accept(response.data);
 }
 async poll(requestId=this.pending?.body.requestId,appendReply=true){
  if(!this.foreground||this.coldCandidate||this.needsResumeCheck||!requestId||!this.session||!this.state.open||this.polling)return;this.polling=true;
  const epoch=this.epoch;const presentation=this.presentation;const s=this.session;
  try{const result=await this.deps.api.call('pollAI',{params:{requestId},query:{sessionId:s.sessionId,generation:s.generation}});this.guard(epoch);if(presentation===this.presentation)this.accept(result.data,appendReply);}catch(e){if(epoch===this.epoch&&presentation===this.presentation)this.handle(e);}finally{if(epoch===this.epoch)this.polling=false;}
 }
 private accept(data:ResponseOf<'pollAI'>['data'],appendReply=true){
  if(data.state==='PENDING'){if(this.shownResults.has(data.requestId))return;this.set({phase:'processing',error:null});return;}
  const pending=this.pending;this.pending=null;
  if(data.state==='SUCCEEDED'||data.state==='NEEDS_INPUT'){
   const reply=data.result;const append=appendReply&&!this.shownResults.has(data.requestId);this.shownResults.add(data.requestId);this.set({result:reply,phase:'idle',error:null,turns:reply&&append?[...this.state.turns,{role:'assistant',text:reply.replyText}]:this.state.turns});
  }else{this.set({phase:'error',result:null,text:this.state.text||pending?.body.input||'',error:data.state==='SUPERSEDED'?'This result changed or expired. Start a new conversation.':'No answer was confirmed. Your original request is kept below.'});}
 }
 async transfer(draft:AIDraft,replaceConfirmed:boolean){
  const actionEpoch=this.epoch;if(!(await this.ensureResumed())||actionEpoch!==this.epoch)throw new ApiError({status:503,code:'AI_UNAVAILABLE',message:'Conversation verification required'});
  const editor=this.editorFor(draft);if(!editor||!this.session)throw new Error('Open the original form first');
  const epoch=this.epoch;const snapshot=editor.current();const s=this.session;
  if(snapshot.text.trim()&&!replaceConfirmed)throw new Error('Confirm replacement first');
  const reply=await this.deps.api.call('validateAIDraft',{params:{draftId:draft.id},idempotencyKey:this.deps.newId(),body:{sessionId:s.sessionId,generation:s.generation,editorKind:editor.kind,targetId:editor.targetId,editorVersion:snapshot.version,replaceConfirmed}});
  this.guard(epoch);
  if(this.editorFor(draft)!==editor||editor.current().version!==snapshot.version)throw new ApiError({status:409,code:'EDITOR_CONFLICT',message:'Editor changed'});
  editor.apply(reply.data);this.close();
 }
 async newConversation(){
  const old=this.session;this.resuming=null;this.booting=null;this.epoch++;this.presentation++;const epoch=this.epoch;this.session=null;this.pendingCredential=null;this.pending=null;this.shownRequests.clear();this.shownResults.clear();this.bootChallenge=null;this.bootKey=null;this.guestIntent=null;this.coldCandidate=false;this.conversationLoaded=true;this.hydrating=null;
  const preferences=this.deps.auth.getState().status==='signedIn'&&!this.needsResumeCheck?this.state.preferences:emptyPreferences();this.set({phase:'idle',text:'',turns:[],result:null,error:null,expiresAt:null,restorable:false,preferences,view:'home'});
  try{await this.storage(()=>this.conversationStore.clear(),epoch);this.guard(epoch);}catch(e){if(epoch===this.epoch)this.handle(e);return;}
  if(old)try{this.revokingDevice=old.deviceToken;await this.deps.api.call('resetAI',{params:{sessionId:old.sessionId},body:{generation:old.generation,reason:'NEW'},idempotencyKey:this.deps.newId()});}catch{/* Local generation already ended. Server TTL bounds unreachable revocation. */}finally{if(this.revokingDevice===old.deviceToken)this.revokingDevice=null;}
 }

 private invalidateConversation(keepText:boolean){this.resuming=null;this.polling=false;this.revokeGuest();this.booting=null;this.epoch++;this.presentation++;this.session=null;this.pendingCredential=null;this.pending=null;this.shownRequests.clear();this.shownResults.clear();this.bootChallenge=null;this.bootKey=null;this.coldCandidate=false;this.hydrating=null;this.conversationLoaded=true;void this.storage(()=>this.conversationStore.clear()).catch(()=>{});this.set({restorable:false,result:null,turns:[],expiresAt:null,...(keepText?{}:{text:''})});}
 tick(){if(this.session&&this.state.expiresAt!==null&&this.deps.now()>=this.state.expiresAt){this.invalidateConversation(true);this.set({phase:'expired',error:'This conversation expired after 30 minutes without activity. Your unsent text and confirmed preferences are kept.'});}}
 private handle(e:unknown){
  if(e instanceof ApiError&&(e.kind==='gone'||e.code==='AI_SUPERSEDED')){this.invalidateConversation(true);this.set({phase:'expired',error:'This conversation expired or was reset elsewhere. Your unsent text is kept.'});}
  else this.set({phase:'error',error:message(e)});
 }
 private revokeGuest(){if(this.session&&this.guest)void this.deps.revokeGuest?.(this.session,this.guest.token).catch(()=>{});}
 clear(){this.resuming=null;this.needsResumeCheck=false;this.preferenceEpoch=null;this.polling=false;this.guestLoaded=true;this.revokeGuest();this.booting=null;this.epoch++;this.presentation++;this.failedStorage=null;this.conversationLoaded=false;this.hydrating=null;this.coldCandidate=false;
  void this.storage(async()=>{await this.deps.guestStore.clear();await this.conversationStore.clear();}).catch(()=>{});
  this.session=null;this.pendingCredential=null;this.guest=null;this.guestIntent=null;this.bootChallenge=null;this.bootKey=null;this.pending=null;this.revokingDevice=null;this.editors.clear();this.shownRequests.clear();this.shownResults.clear();this.contextOwner=null;this.context={sourcePage:'DISCOVER'};this.state=initial();for(const l of this.listeners)l();}

 report(error:unknown){this.set({error:message(error)});}
}
