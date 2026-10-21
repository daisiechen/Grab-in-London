/** QA-CHAT-009: one production page lifetime through hidden/offline/backoff/authorization loss. */
import {expect,it} from 'vitest';
import {act,screen,waitFor} from '@testing-library/react';
import {userEvent} from '@testing-library/user-event';
import {renderApp} from '../../test/render.tsx';
import {createFetchStub,ok,page,fail,deferred,type StubResponse} from '../../test/fetchStub.ts';
import {fakePollerDeps} from '../../test/fakePoller.ts';
import {MEAL_ID,HOST_ID,meal,publicProfile,session} from '../../test/fixtures.ts';
const CONV='14141414-1414-4141-8141-141414141414';
it.each(['GROUP','DIRECT'])('QA-CHAT-009 %s hides polling, backs off to30s, authenticates before catchup and never sends retained text after403',async kind=>{
 const f=fakePollerDeps(),events:string[]=[];let offline=false,revoked=false;
 const message={id:'00000000-0000-4000-8000-000000000011',seq:'11',sender:publicProfile(HOST_ID,'Maya Chen'),body:'Previously authorized historical message',createdAt:'2026-10-21T11:00:00Z',redacted:false};
 const stub=createFetchStub({getSession:()=>{events.push('auth');return ok(session());},inbox:()=>page([{conversation:{id:CONV,version:'3',kind,mealId:kind==='GROUP'?MEAL_ID:null,title:'QA recovery chat',canSend:!revoked,dissolved:false,head:'11'},lastMessage:null,unreadCount:0}]),getMeal:()=>ok({meal:meal(),myApplication:null,conversationId:CONV}),markConversationRead:()=>ok({}),readMessages:call=>{const mode=call.url.searchParams.get('mode');events.push(String(mode));if(mode==='HISTORY')return page([message]);if(offline)throw new TypeError('QA controlled connection loss');return revoked?fail(403,'FORBIDDEN'):page([message]);}});
 renderApp(stub.fetch,`/inbox/${CONV}`,{pollerDeps:f.deps});
 await userEvent.type(await screen.findByLabelText('Message'),'Retained text must require a new explicit authorized action');
 await act(async()=>{await f.setVisible(false);});const reads=stub.callsTo('readMessages').length;expect(f.pending()).toEqual([]);
 await act(async()=>{await f.advance(60000);});expect(stub.callsTo('readMessages')).toHaveLength(reads);
 offline=true;events.length=0;await act(async()=>{await f.setVisible(true);});expect(events.slice(0,2)).toEqual(['auth','LIVE']);
 for(const delay of[2000,4000,8000,16000,30000]){expect(f.pending()).toEqual([delay]);await act(async()=>{await f.advance(delay);});}
 expect(f.pending()).toEqual([30000]);expect(stub.callsTo('sendMessage')).toHaveLength(0);
 await act(async()=>{await f.setVisible(false);});offline=false;revoked=true;events.length=0;
 await act(async()=>{await f.setVisible(true);});await screen.findByText(/messages.*read-only/);
 expect(events[0]).toBe('auth');expect(events).toContain('HISTORY');expect(events.slice(events.indexOf('HISTORY')+1)).not.toContain('LIVE');expect(screen.queryByLabelText('Message')).toBeNull();expect(screen.getByText(/Unsent text: Retained text/)).toBeTruthy();
 const count=stub.callsTo('readMessages').length;await act(async()=>{await f.advance(60000);});
 await waitFor(()=>expect(stub.callsTo('readMessages')).toHaveLength(count));expect(f.pending()).toEqual([]);expect(stub.callsTo('sendMessage')).toHaveLength(0);
});

it('QA-CHAT-009 metadata captured before revocation cannot restart LIVE after a terminal403',async()=>{
 const f=fakePollerDeps(),stale=deferred<StubResponse>();let inboxReads=0,revoked=false;
 const row={conversation:{id:CONV,version:'3',kind:'GROUP',mealId:MEAL_ID,title:'Stale metadata fence',canSend:true,dissolved:false,head:'11'},lastMessage:null,unreadCount:0};
 const message={id:'00000000-0000-4000-8000-000000000011',seq:'11',sender:publicProfile(HOST_ID,'Maya Chen'),body:'Authorized previous message',createdAt:'2026-10-21T11:00:00Z',redacted:false};
 const stub=createFetchStub({getSession:()=>ok(session()),inbox:()=>++inboxReads===1?page([row]):stale.promise,getMeal:()=>ok({meal:meal(),myApplication:null,conversationId:CONV}),markConversationRead:()=>ok({}),readMessages:call=>call.url.searchParams.get('mode')==='HISTORY'?page([message]):revoked?fail(403,'FORBIDDEN'):page([message])});
 renderApp(stub.fetch,`/inbox/${CONV}`,{pollerDeps:f.deps});await screen.findByLabelText('Message');
 await act(async()=>{await f.setVisible(false);});revoked=true;await act(async()=>{await f.setVisible(true);});
 await screen.findByText(/messages.*read-only/);expect(inboxReads).toBeGreaterThan(1);
 await act(async()=>{stale.resolve(page([row]));await f.flush();});
 const modes=stub.callsTo('readMessages').map(c=>c.url.searchParams.get('mode'));
 expect(modes.slice(modes.indexOf('HISTORY')+1)).not.toContain('LIVE');expect(f.pending()).toEqual([]);expect(stub.callsTo('sendMessage')).toHaveLength(0);
});
