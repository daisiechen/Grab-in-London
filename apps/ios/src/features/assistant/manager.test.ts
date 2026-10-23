// eslint-disable-next-line @typescript-eslint/no-require-imports -- Node SHA256 only in isolated test helpers
const {createHash}=require('node:crypto') as {createHash(algorithm:string):{update(value:string):{digest(format:string):string}}};
import {memoryAIConversationStore,type AIConversationStore} from './session-store.ts';
import {memoryGuestCredentialStore,type GuestCredentialStore} from './guest-store.ts';
import {ApiError,type ApiClient} from '@fancy/client';
import type {SessionManager} from '../auth/session.ts';
import {AssistantManager,emptyPreferences,type AIDraft} from './manager.ts';
import {deferred,flush} from '../../test/deferred.ts';
function setup(guestStore:GuestCredentialStore=memoryGuestCredentialStore(),conversationStore:AIConversationStore=memoryAIConversationStore(),initialActor='guest'){
 let now=0;let serial=0;let listener=()=>{};let actor=initialActor;
 const responses=new Map<string,()=>Promise<unknown>>();
 const call=jest.fn(async(op:string,args:unknown)=>{void args;return responses.get(op)?.()??{data:{}};});
 const auth={getState:()=>actor==='guest'?{status:'signedOut'}:{status:'signedIn',session:{user:{id:actor}}},subscribe:(fn:()=>void)=>{listener=fn;return()=>{};}} as unknown as SessionManager;
 const manager=new AssistantManager({guestStore,conversationStore,hashGuestCredential:async token=>createHash('sha256').update(token).digest('hex'),auth,api:{call} as unknown as ApiClient,newId:()=>`id-${++serial}`,now:()=>now,randomBytes:n=>new Uint8Array(n)});
 responses.set('readAIPreferences',async()=>({data:{fields:emptyPreferences(),version:'0',epoch:'0',confirmedAt:null}}));
 responses.set('createGuestSession',async()=>({data:{guestToken:'synthetic-guest-fixture',expiresAt:new Date(86400000).toISOString()}}));
 responses.set('bootstrapAI',async()=>({data:{sessionId:'session-1',generation:1,deviceToken:'synthetic-device-fixture',revokeHandle:'revoke',expiresAt:new Date(now+1800000).toISOString()}}));
 responses.set('readAI',async()=>({data:{turns:[],latestRequestId:null,expiresAt:new Date(now+1800000).toISOString()}}));
 responses.set('requestAI',async()=>{throw new Error('offline fixture');});
 manager.open();
 return {manager,call,responses,time:(n:number)=>{now=n;},actor:(id:string)=>{actor=id;listener();}};
}
it('recovers a temporary guest read failure on explicit retry without discarding its revocation identity',async()=>{
 const read=jest.fn().mockRejectedValueOnce(new Error('locked')).mockResolvedValue({token:'existing-guest',expiresAt:86400000});
 const h=setup({read,write:jest.fn(),clear:jest.fn()});
 await expect(h.manager.restoreIdentity()).rejects.toThrow('locked');
 await expect(h.manager.restoreIdentity()).resolves.toBeUndefined();
 expect(h.manager.credential).toBe('existing-guest');expect(h.call).not.toHaveBeenCalled();
});
it('retries failed credential persistence before bootstrap without minting another guest',async()=>{
 const store=memoryGuestCredentialStore(),write=jest.fn().mockRejectedValueOnce(new Error('locked')).mockImplementation(value=>store.write(value));
 const h=setup({...store,write});await h.manager.continue();await h.manager.continue();
 expect(h.manager.getSnapshot().phase).toBe('idle');expect(h.call.mock.calls.filter(c=>c[0]==='createGuestSession')).toHaveLength(1);
});
it('retries the same request intent and sends only explicitly confirmed guest preferences',async()=>{
 const h=setup();const prefs={...emptyPreferences(),budgetMaxPence:2000};
 await h.manager.savePreferences(prefs);h.manager.setText('Find a table');await h.manager.send();await h.manager.retry();
 const calls=h.call.mock.calls.filter(c=>c[0]==='requestAI');expect(calls).toHaveLength(2);expect(calls[1]?.[1]).toEqual(calls[0]?.[1]);
 expect(calls[0]?.[1]).toMatchObject({body:{guestPreferences:prefs,input:'Find a table'}});expect(h.manager.getSnapshot().text).toBe('Find a table');
});
it('single-flights bootstrap and ignores a response after account isolation',async()=>{
 const h=setup();const pending=deferred<unknown>();h.responses.set('bootstrapAI',()=>pending.promise);
 const a=h.manager.continue();const b=h.manager.continue();await flush();
 expect(h.call.mock.calls.filter(c=>c[0]==='bootstrapAI')).toHaveLength(1);
 h.actor('account-two');pending.resolve({data:{sessionId:'old',generation:1,deviceToken:'old',expiresAt:new Date(1800000).toISOString()}});await Promise.all([a,b]);
 expect(h.manager.deviceToken).toBeNull();expect(h.manager.getSnapshot().open).toBe(false);
});
it('expires exactly at TTL and preserves unsent text and confirmed guest preferences',async()=>{
 const h=setup();await h.manager.savePreferences({...emptyPreferences(),tableSizes:[2]});await h.manager.continue();h.manager.setText('Unsent');h.time(1800000);h.manager.tick();
 expect(h.manager.getSnapshot()).toMatchObject({phase:'expired',text:'Unsent',preferences:{tableSizes:[2]}});
 await h.manager.continue();expect(h.manager.getSnapshot().phase).toBe('idle');
 await h.manager.newConversation();expect(h.manager.getSnapshot().preferences).toEqual(emptyPreferences());
});
it('clears assistant input on NEW without applying or clearing the registered business editor',async()=>{
 const h=setup();await h.manager.continue();const apply=jest.fn();
 h.manager.registerEditor({key:'form',kind:'APPLICATION',targetId:'meal',current:()=>({text:'Keep the business draft',version:'2'}),apply});
 h.manager.setText('Discard this assistant draft');await h.manager.newConversation();
 expect(h.manager.getSnapshot().text).toBe('');expect(apply).not.toHaveBeenCalled();
 expect(h.call.mock.calls.find(c=>c[0]==='resetAI')?.[1]).toMatchObject({body:{reason:'NEW'}});
});
it('requires replacement confirmation and rejects edits during validation without applying',async()=>{
 const h=setup();await h.manager.continue();let version='1';const apply=jest.fn();
 const draft={id:'draft',kind:'APPLICATION',targetId:'meal',editorVersion:'1',text:'Candidate',fields:null} as unknown as AIDraft;
 h.manager.registerEditor({key:'form',kind:'APPLICATION',targetId:'meal',current:()=>({text:'My text',version}),apply});
 await expect(h.manager.transfer(draft,false)).rejects.toThrow('Confirm replacement');
 expect(h.call.mock.calls.filter(c=>c[0]==='validateAIDraft')).toHaveLength(0);
 const wait=deferred<unknown>();h.responses.set('validateAIDraft',()=>wait.promise);const transfer=h.manager.transfer(draft,true);await flush();expect(h.call.mock.calls.filter(c=>c[0]==='validateAIDraft')).toHaveLength(1);version='2';wait.resolve({data:draft});
 await expect(transfer).rejects.toMatchObject({code:'EDITOR_CONFLICT'});expect(apply).not.toHaveBeenCalled();
});
it('binds transfer before foreground verification, rejecting a replacement editor with the same version',async()=>{
 const h=setup();await h.manager.continue();const oldApply=jest.fn(),newApply=jest.fn();
 const draft={id:'draft',kind:'APPLICATION',targetId:'meal',editorVersion:'0',text:'Candidate',fields:null} as unknown as AIDraft;
 h.responses.set('validateAIDraft',async()=>({data:draft}));
 h.manager.registerEditor({key:'form',kind:'APPLICATION',targetId:'meal',current:()=>({text:'',version:'0'}),apply:oldApply});
 const transfer=h.manager.transfer(draft,false);
 h.manager.registerEditor({key:'form',kind:'APPLICATION',targetId:'meal',current:()=>({text:'',version:'0'}),apply:newApply});
 await expect(transfer).rejects.toMatchObject({code:'EDITOR_CONFLICT'});
 expect(oldApply).not.toHaveBeenCalled();expect(newApply).not.toHaveBeenCalled();
 expect(h.call.mock.calls.filter(c=>c[0]==='validateAIDraft')).toHaveLength(0);
});
it('does not apply a late answer while closed, and never implicitly sends editor content',async()=>{
 const h=setup();const pending=deferred<unknown>();h.responses.set('requestAI',()=>pending.promise);
 h.manager.registerEditor({key:'form',kind:'CREATE',targetId:null,current:()=>({text:'Private unfinished form',version:'7'}),apply:jest.fn()});
 h.manager.setContext({sourcePage:'CREATE'});h.manager.setText('Help me draft');const send=h.manager.send();await flush();h.manager.close();
 pending.resolve({data:{requestId:'request',state:'SUCCEEDED',result:{replyText:'Late',cards:[]}}});await send;
 expect(h.manager.getSnapshot().result).toBeNull();expect(h.manager.getSnapshot().text).toBe('Help me draft');
 const request=h.call.mock.calls.find(c=>c[0]==='requestAI')?.[1] as {body:Record<string,unknown>};expect(request.body.editorText).toBeUndefined();expect(request.body.editorVersion).toBe('7');
});
it('releases MEAL context on blur before asking from a page without explicit context',async()=>{
 const h=setup();const blur=h.manager.setContext({sourcePage:'MEAL',explicitMealId:'old-meal',explicitMealIds:['old-meal']});
 blur();h.manager.setText('Find dinner');await h.manager.send();
 const request=h.call.mock.calls.find(c=>c[0]==='requestAI')?.[1] as {body:Record<string,unknown>};
 expect(request.body.sourcePage).toBe('DISCOVER');expect(request.body.explicitMealId).toBeUndefined();expect(request.body.explicitMealIds).toBeUndefined();
});
it('does not let a retired focus cleanup erase the new page context',()=>{
 const h=setup();const blurMeal=h.manager.setContext({sourcePage:'MEAL',explicitMealId:'old-meal'});
 const blurChat=h.manager.setContext({sourcePage:'INBOX',explicitConversationId:'current-group'});blurMeal();
 expect(h.manager.contextValue).toEqual({sourcePage:'INBOX',explicitConversationId:'current-group'});
 blurChat();expect(h.manager.contextValue).toEqual({sourcePage:'DISCOVER'});
});
it('restores the same fixed-expiry guest across managers and NEW',async()=>{
 const store=memoryGuestCredentialStore();const first=setup(store);await first.manager.continue();const token=first.manager.credential;
 const stored=await store.read();expect(stored).toEqual({token,expiresAt:86400000});
 await first.manager.newConversation();expect(first.manager.credential).toBe(token);expect(await store.read()).toEqual(stored);
 const second=setup(store);await second.manager.continue();expect(second.manager.credential).toBe(token);
 expect(second.call.mock.calls.some(c=>c[0]==='createGuestSession')).toBe(false);expect(await store.read()).toEqual(stored);
});
it('cold local credentials offer explicit Continue without reading or persisting any transcript',async()=>{
 const guests=memoryGuestCredentialStore(),sessions=memoryAIConversationStore(),first=setup(guests,sessions);
 first.responses.set('readAI',async()=>({data:{turns:[{role:'assistant',text:'RAM_ONLY_OLD_TRANSCRIPT'}],latestRequestId:null,expiresAt:new Date(1800000).toISOString()}}));
 await first.manager.continue();first.manager.setText('RAM_ONLY_OLD_UNSENT');
 const stored=await sessions.read();expect(stored).toMatchObject({sessionId:'session-1',generation:1,owner:{kind:'GUEST'}});expect(JSON.stringify(stored)).not.toContain('RAM_ONLY');expect(Object.keys(stored!).sort()).toEqual(['deviceToken','expiresAt','generation','owner','revokeHandle','sessionId']);
 const cold=setup(guests,sessions);await flush();expect(cold.call).not.toHaveBeenCalled();expect(cold.manager.getSnapshot()).toMatchObject({restorable:true,turns:[],text:'',result:null,view:'home'});
 cold.manager.pause();await cold.manager.resume();await cold.manager.edited();await cold.manager.poll('old-result');expect(cold.call).not.toHaveBeenCalled();
 cold.responses.set('readAI',first.responses.get('readAI')!);await cold.manager.continue();expect(cold.call.mock.calls.map(c=>c[0])).toEqual(['readAI']);expect(cold.manager.getSnapshot().turns[0]?.text).toBe('RAM_ONLY_OLD_TRANSCRIPT');expect(cold.call.mock.calls[0]?.[1]).toEqual({params:{sessionId:'session-1'}});
});
it('treats a server RAM-loss 410 as expired without automatic regeneration and keeps local unsent text and confirmed preferences',async()=>{
 const h=setup();await h.manager.savePreferences({...emptyPreferences(),tableSizes:[2]});await h.manager.continue();
 h.manager.setText('LOCAL_UNSENT_AFTER_SERVER_RESTART');
 h.responses.set('readAI',async()=>{throw new ApiError({status:410,code:'AI_SESSION_EXPIRED',message:'Server RAM is gone'});});
 await h.manager.continue();
 expect(h.manager.getSnapshot()).toMatchObject({phase:'expired',text:'LOCAL_UNSENT_AFTER_SERVER_RESTART',preferences:{tableSizes:[2]},turns:[],result:null});
 expect(h.manager.deviceToken).toBeNull();expect(h.call.mock.calls.filter(c=>c[0]==='bootstrapAI')).toHaveLength(1);
 expect(h.call.mock.calls.some(c=>c[0]==='requestAI'||c[0]==='pollAI')).toBe(false);
});
it('creates a new subject only after the fixed 24h expiry',async()=>{
 const store=memoryGuestCredentialStore();await store.write({token:'synthetic-expired-fixture',expiresAt:86400000});const h=setup(store);h.time(86400000);
 h.responses.set('createGuestSession',async()=>({data:{guestToken:'synthetic-new-fixture',expiresAt:new Date(172800000).toISOString()}}));
 await h.manager.continue();expect(h.manager.credential).toBe('synthetic-new-fixture');expect(h.call.mock.calls.filter(c=>c[0]==='createGuestSession')).toHaveLength(1);
});
it('clears the secure guest record on login without retaining AI content',async()=>{
 const store=memoryGuestCredentialStore();const h=setup(store);await h.manager.continue();h.manager.setText('private');h.actor('logged-in');await flush();
 expect(await store.read()).toBeNull();expect(h.manager.credential).toBeNull();expect(h.manager.getSnapshot().text).toBe('');
});
it('fails closed on secure read or write failure without sending assistant requests or minting retries',async()=>{
 const readFailure:GuestCredentialStore={read:async()=>{throw new Error('locked');},write:jest.fn(),clear:jest.fn()};
 const h=setup(readFailure);await h.manager.continue();await h.manager.continue();expect(h.call).not.toHaveBeenCalled();
 const writeFailure:GuestCredentialStore={read:async()=>null,write:async()=>{throw new Error('locked');},clear:async()=>{}};
 const w=setup(writeFailure);await w.manager.continue();await w.manager.continue();expect(w.call.mock.calls.map(c=>c[0])).toEqual(['createGuestSession']);expect(w.manager.credential).toBeNull();
});
it('blocks future guest bootstrap if account-transition secure deletion fails',async()=>{
 const store=memoryGuestCredentialStore();const h=setup({...store,clear:async()=>{throw new Error('locked deletion');}});
 await h.manager.continue();h.actor('account');await flush();h.actor('guest');await flush();h.call.mockClear();
 await h.manager.continue();expect(h.call).not.toHaveBeenCalled();expect(h.manager.credential).toBeNull();expect(h.manager.getSnapshot().phase).toBe('error');
});
it.each(['x'.repeat(2001),' '+'x'.repeat(2000),'','  \n  '])('keeps invalid question text verbatim and sends no request (case %#)',async input=>{
 const h=setup();h.manager.setText(input);await h.manager.send();expect(h.manager.getSnapshot().text).toBe(input);expect(h.call).not.toHaveBeenCalled();
});
it('accepts exactly 2000 characters and recovers after shortening overlong input',async()=>{
 const h=setup();h.manager.setText('x'.repeat(2001));await h.manager.send();expect(h.manager.getSnapshot().error).not.toBeNull();
 h.manager.setText('x'.repeat(2000));expect(h.manager.getSnapshot().error).toBeNull();await h.manager.send();
 const calls=h.call.mock.calls.filter(c=>c[0]==='requestAI');expect(calls).toHaveLength(1);expect(calls[0]?.[1]).toMatchObject({body:{input:'x'.repeat(2000)}});
});
function signedInResumeFixture(){
 const h=setup();h.actor('account-a');h.manager.open();let epoch='1';
 h.responses.set('readAIPreferences',async()=>({data:{fields:{...emptyPreferences(),budgetMaxPence:epoch==='1'?3500:null},version:epoch,epoch,confirmedAt:null}}));
 h.responses.set('readAI',async()=>({data:{turns:[{role:'assistant',text:'OLD_CONTEXT'}],latestRequestId:null,expiresAt:new Date(1800000).toISOString()}}));
 return {...h,preferenceEpoch:(value:string)=>{epoch=value;}};
}
it('validates remote epoch on foreground, clears old context and keeps unsent input',async()=>{
 const h=signedInResumeFixture();await h.manager.continue();h.manager.setText('Unsent question');h.manager.pause();h.preferenceEpoch('2');
 await h.manager.resume();expect(h.manager.getSnapshot().preferences.budgetMaxPence).toBeNull();expect(h.manager.getSnapshot().turns).toEqual([]);expect(h.manager.getSnapshot().result).toBeNull();expect(h.manager.getSnapshot().text).toBe('Unsent question');
 expect(h.call.mock.calls.filter(c=>c[0]==='readAIPreferences')).toHaveLength(2);
});
it('hides old state while resume verification is pending; deduplicates concurrent resume reads',async()=>{
 const h=signedInResumeFixture();await h.manager.continue();h.manager.pause();const wait=deferred<unknown>();h.responses.set('readAIPreferences',()=>wait.promise);
 const one=h.manager.resume(),two=h.manager.resume();expect(h.manager.getSnapshot().turns).toEqual([]);expect(h.manager.getSnapshot().preferences).toEqual(emptyPreferences());
 wait.resolve({data:{fields:{...emptyPreferences(),budgetMaxPence:3500},version:'1',epoch:'1',confirmedAt:null}});await Promise.all([one,two]);
 expect(h.call.mock.calls.filter(c=>c[0]==='readAIPreferences')).toHaveLength(2);expect(h.manager.getSnapshot().turns).toEqual([{role:'assistant',text:'OLD_CONTEXT'}]);
 expect(h.call.mock.calls.filter(c=>c[0]==='activityAI')).toHaveLength(0);
});
it('fails closed offline on resume and blocks old context, draft transfer and provider requests',async()=>{
 const h=signedInResumeFixture();await h.manager.continue();h.manager.setText('Kept');h.manager.pause();h.responses.set('readAIPreferences',async()=>{throw new Error('offline');});
 await h.manager.resume();await h.manager.send();await h.manager.retry();
 expect(h.manager.getSnapshot()).toMatchObject({text:'Kept',turns:[],result:null,preferences:emptyPreferences()});expect(h.call.mock.calls.some(c=>c[0]==='requestAI')).toBe(false);
 const apply=jest.fn();const draft={id:'stale-draft',kind:'APPLICATION',targetId:'meal',editorVersion:'1',text:'Old candidate',fields:null} as unknown as AIDraft;
 h.manager.registerEditor({key:'old-form',kind:'APPLICATION',targetId:'meal',current:()=>({text:'User form',version:'1'}),apply});
 await expect(h.manager.transfer(draft,true)).rejects.toMatchObject({code:'AI_UNAVAILABLE'});await h.manager.savePreferences({...emptyPreferences(),budgetMaxPence:9999},'old-proposal');
 expect(h.call.mock.calls.some(c=>c[0]==='validateAIDraft'||c[0]==='replaceAIPreferences')).toBe(false);expect(apply).not.toHaveBeenCalled();
 h.responses.set('deleteAIPreferences',async()=>({data:{fields:emptyPreferences(),version:'2',epoch:'2',confirmedAt:null}}));await h.manager.deletePreferences();expect(h.call.mock.calls.some(c=>c[0]==='deleteAIPreferences')).toBe(true);
});
it.each(['account','new','pause'] as const)('does not apply a late foreground verification after %s',async action=>{
 const h=signedInResumeFixture();await h.manager.continue();h.manager.pause();const wait=deferred<unknown>();h.responses.set('readAIPreferences',()=>wait.promise);const resume=h.manager.resume();
 if(action==='account')h.actor('account-b');else if(action==='new')await h.manager.newConversation();else h.manager.pause();
 wait.resolve({data:{fields:{...emptyPreferences(),budgetMaxPence:9999},version:'8',epoch:'8',confirmedAt:null}});await resume;
 expect(h.manager.getSnapshot().preferences.budgetMaxPence).not.toBe(9999);expect(h.manager.getSnapshot().turns).toEqual([]);
});

it('a second pause fences an old resume; a second active event performs a new verification',async()=>{
 const h=signedInResumeFixture();await h.manager.continue();h.manager.setText('Unsent');h.manager.pause();const old=deferred<unknown>();h.responses.set('readAIPreferences',()=>old.promise);const first=h.manager.resume();
 h.manager.pause();old.resolve({data:{fields:{...emptyPreferences(),budgetMaxPence:9999},version:'1',epoch:'1',confirmedAt:null}});expect(await first).toBe(false);
 expect(h.manager.getSnapshot()).toMatchObject({preferences:emptyPreferences(),turns:[],text:'Unsent'});await h.manager.send();expect(h.call.mock.calls.some(c=>c[0]==='requestAI')).toBe(false);
 h.preferenceEpoch('2');h.responses.set('readAIPreferences',async()=>({data:{fields:emptyPreferences(),version:'2',epoch:'2',confirmedAt:null}}));await h.manager.resume();expect(h.manager.getSnapshot().preferences).toEqual(emptyPreferences());expect(h.call.mock.calls.filter(c=>c[0]==='readAIPreferences')).toHaveLength(3);
});
it('does not let an awaiting send resume into account B after account A verification completes late',async()=>{
 const h=signedInResumeFixture();await h.manager.continue();h.manager.setText('A question');h.manager.pause();const old=deferred<unknown>();h.responses.set('readAIPreferences',()=>old.promise);const resume=h.manager.resume();const send=h.manager.send();h.actor('account-b');
 old.resolve({data:{fields:{...emptyPreferences(),budgetMaxPence:9999},version:'1',epoch:'1',confirmedAt:null}});await Promise.all([resume,send]);expect(h.manager.getSnapshot().text).toBe('');expect(h.call.mock.calls.some(c=>c[0]==='requestAI')).toBe(false);
});

it('keeps a failed AI credential write pending without repeating bootstrap or minting a guest',async()=>{
 const guests=memoryGuestCredentialStore(),sessions=memoryAIConversationStore(),write=jest.fn().mockRejectedValueOnce(new Error('locked')).mockImplementation(v=>sessions.write(v));const h=setup(guests,{...sessions,write});
 await h.manager.continue();expect(h.manager.getSnapshot().phase).toBe('error');expect(h.call.mock.calls.filter(c=>c[0]==='readAI')).toHaveLength(0);
 await h.manager.continue();expect(h.manager.getSnapshot().phase).toBe('idle');expect(h.call.mock.calls.filter(c=>c[0]==='bootstrapAI')).toHaveLength(1);expect(h.call.mock.calls.filter(c=>c[0]==='createGuestSession')).toHaveLength(1);expect(await sessions.read()).not.toBeNull();
});
it('clears a cold guest conversation bound to a different bearer without reading its old session',async()=>{
 const guests=memoryGuestCredentialStore(),sessions=memoryAIConversationStore(),first=setup(guests,sessions);await first.manager.continue();await guests.write({token:'synthetic-other-guest',expiresAt:86400000});
 const cold=setup(guests,sessions);await flush();expect(cold.manager.deviceToken).toBeNull();expect(cold.manager.getSnapshot().restorable).toBe(false);expect(cold.call).not.toHaveBeenCalled();expect(await sessions.read()).toBeNull();
});
it('cold server410 clears only AI credential metadata and retains same guest and local unsent text',async()=>{
 const guests=memoryGuestCredentialStore(),sessions=memoryAIConversationStore(),first=setup(guests,sessions);await first.manager.continue();const subject=await guests.read();const cold=setup(guests,sessions);await flush();cold.manager.setText('UNSENT_AFTER_RAM_LOSS');cold.responses.set('readAI',async()=>{throw new ApiError({status:410,code:'AI_SESSION_EXPIRED',message:'Synthetic RAM loss'});});
 await cold.manager.continue();await flush();expect(cold.manager.getSnapshot()).toMatchObject({phase:'expired',text:'UNSENT_AFTER_RAM_LOSS',turns:[],result:null,restorable:false});expect(await sessions.read()).toBeNull();expect(await guests.read()).toEqual(subject);expect(cold.call.mock.calls.map(c=>c[0])).toEqual(['readAI']);
});
it('cold TTL expiry clears metadata locally with no automatic bootstrap or read',async()=>{
 const guests=memoryGuestCredentialStore(),sessions=memoryAIConversationStore(),first=setup(guests,sessions);await first.manager.continue();const cold=setup(guests,sessions);cold.time(1800000);await flush();expect(cold.manager.getSnapshot()).toMatchObject({phase:'expired',restorable:false});expect(cold.call).not.toHaveBeenCalled();expect(await sessions.read()).toBeNull();expect(await guests.read()).not.toBeNull();
});
it('a late secure write followed by account change cannot repopulate the new owner',async()=>{
 const guests=memoryGuestCredentialStore(),sessions=memoryAIConversationStore(),waiting=deferred<void>();const write=jest.fn(async v=>{await waiting.promise;await sessions.write(v);});const h=setup(guests,{...sessions,write});const action=h.manager.continue();await flush();expect(write).toHaveBeenCalledTimes(1);h.actor('other-account');waiting.resolve();await action;await flush();expect(await sessions.read()).toBeNull();expect(h.manager.deviceToken).toBeNull();expect(h.call.mock.calls.filter(c=>c[0]==='readAI')).toHaveLength(0);expect(h.manager.getSnapshot().restorable).toBe(false);
});
it('failed account-transition deletion blocks all AI traffic until secure deletion succeeds',async()=>{
 const guests=memoryGuestCredentialStore(),sessions=memoryAIConversationStore(),h=setup(guests,sessions);await h.manager.continue();let locked=true;const clear=jest.fn(async()=>{if(locked)throw new Error('locked');await sessions.clear();});
 const next=setup(guests,{...sessions,clear});await flush();next.actor('other-account');await flush();await next.manager.continue();expect(next.call).not.toHaveBeenCalled();locked=false;await next.manager.continue();expect(next.call.mock.calls.some(c=>c[0]==='bootstrapAI')).toBe(true);expect((await sessions.read())?.owner).toEqual({kind:'USER',userId:'other-account'});
});
it('a late cold read after owner change cannot show the old conversation or error',async()=>{
 const guests=memoryGuestCredentialStore(),sessions=memoryAIConversationStore(),first=setup(guests,sessions);await first.manager.continue();const old=await sessions.read(),wait=deferred<typeof old>();const h=setup(guests,{...sessions,read:()=>wait.promise});await flush();h.actor('new-owner');wait.resolve(old);await flush();expect(h.manager.deviceToken).toBeNull();expect(h.manager.getSnapshot()).toMatchObject({restorable:false,error:null,turns:[],result:null});expect(h.call).not.toHaveBeenCalled();
});
it('authoritative edit expiry is persisted without saving the edited text',async()=>{
 const sessions=memoryAIConversationStore(),h=setup(memoryGuestCredentialStore(),sessions);await h.manager.continue();h.manager.setText('PRIVATE_EDIT');h.time(1000);h.responses.set('activityAI',async()=>({data:{expiresAt:new Date(1801000).toISOString()}}));await h.manager.edited();expect((await sessions.read())?.expiresAt).toBe(1801000);expect(JSON.stringify(await sessions.read())).not.toContain('PRIVATE_EDIT');
});
it('signed-in cold Continue fetches preferences and RAM only after explicit action',async()=>{
 const guests=memoryGuestCredentialStore(),sessions=memoryAIConversationStore(),first=setup(guests,sessions,'same-owner');await first.manager.continue();const cold=setup(guests,sessions,'same-owner');await flush();expect(cold.call).not.toHaveBeenCalled();expect(cold.manager.getSnapshot()).toMatchObject({restorable:true,preferences:emptyPreferences(),turns:[]});await cold.manager.continue();expect(cold.call.mock.calls.map(c=>c[0])).toEqual(['readAIPreferences','readAI']);
});

it('SEND persists only the authoritative server expiry, not the request or returned result',async()=>{
 const sessions=memoryAIConversationStore(),h=setup(memoryGuestCredentialStore(),sessions);await h.manager.continue();h.manager.setText('PRIVATE_SEND');h.responses.set('requestAI',async()=>({data:{requestId:'id-result',state:'SUCCEEDED',result:{replyText:'PRIVATE_MODEL_RESULT',cards:[]}}}));h.responses.set('readAI',async()=>({data:{turns:[],latestRequestId:null,expiresAt:new Date(1900000).toISOString()}}));await h.manager.send();expect((await sessions.read())?.expiresAt).toBe(1900000);expect(JSON.stringify(await sessions.read())).not.toContain('PRIVATE_');
});

it('offline cold Continue retries the same credential instead of creating a replacement conversation',async()=>{
 const guests=memoryGuestCredentialStore(),sessions=memoryAIConversationStore(),first=setup(guests,sessions);await first.manager.continue();const old=await sessions.read();const cold=setup(guests,sessions);await flush();cold.manager.setText('UNSENT_OFFLINE_COLD');let offline=true;cold.responses.set('readAI',async()=>{if(offline)throw new ApiError({status:0,code:'NETWORK_ERROR',message:'Synthetic offline'});return {data:{turns:[],latestRequestId:null,expiresAt:new Date(1800000).toISOString()}};});
 await cold.manager.continue();expect(cold.manager.getSnapshot()).toMatchObject({phase:'error',text:'UNSENT_OFFLINE_COLD',turns:[],restorable:true});expect(await sessions.read()).toEqual(old);offline=false;await cold.manager.retry();expect(cold.manager.getSnapshot().phase).toBe('idle');expect(cold.call.mock.calls.map(c=>c[0])).toEqual(['readAI','readAI']);expect(cold.call.mock.calls.every(c=>(c[1] as {params:{sessionId:string}}).params.sessionId==='session-1')).toBe(true);
});

it('a displayed cold candidate reaching TTL reports expiry without silently bootstrapping on Continue',async()=>{
 const guests=memoryGuestCredentialStore(),sessions=memoryAIConversationStore(),first=setup(guests,sessions);await first.manager.continue();const cold=setup(guests,sessions);await flush();expect(cold.manager.getSnapshot().restorable).toBe(true);cold.time(1800000);await cold.manager.continue();await flush();expect(cold.manager.getSnapshot().phase).toBe('expired');expect(cold.call).not.toHaveBeenCalled();expect(await sessions.read()).toBeNull();
});
