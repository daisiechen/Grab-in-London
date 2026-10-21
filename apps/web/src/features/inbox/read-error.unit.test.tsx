import {expect,it} from 'vitest';
import {act,screen} from '@testing-library/react';
import {userEvent} from '@testing-library/user-event';
import {renderApp} from '../../test/render.tsx';
import {createFetchStub,ok,page,fail,deferred,type StubResponse} from '../../test/fetchStub.ts';
import {fakePollerDeps} from '../../test/fakePoller.ts';
import {MEAL_ID,meal,session} from '../../test/fixtures.ts';
const id='14141414-1414-4141-8141-141414141414';
function fixture(read:(mode:string)=>StubResponse|Promise<StubResponse>){const clock=fakePollerDeps();const stub=createFetchStub({getSession:()=>ok(session()),inbox:()=>page([{conversation:{id,version:'1',kind:'GROUP',mealId:MEAL_ID,title:'Read state',canSend:true,dissolved:false,head:'3'},lastMessage:null,unreadCount:1}]),getMeal:()=>ok({meal:meal(),myApplication:null,conversationId:id}),readMessages:c=>read(c.url.searchParams.get('mode')!),markConversationRead:()=>({status:204})});renderApp(stub.fetch,`/inbox/${id}`,{pollerDeps:clock.deps});return {clock,stub};}
it('shows first-read loading then failure, preserves backoff, and shows empty only after successful recovery',async()=>{
 const pending=deferred<StubResponse>();let calls=0;const {clock,stub}=fixture(()=>++calls===1?pending.promise:page([]));
 await screen.findByLabelText('Message');expect(screen.queryByText('SAY HELLO')).toBeNull();expect(screen.getByText('Loading messages…')).toBeTruthy();
 await act(async()=>pending.resolve(fail(429,'RATE_LIMITED',{retryAfterSeconds:10})));
 expect(await screen.findByText(/Couldn’t load messages/)).toBeTruthy();expect(screen.queryByText('SAY HELLO')).toBeNull();expect(clock.pending()).toEqual([2000]);
 await act(async()=>clock.advance(1999));expect(stub.callsTo('readMessages')).toHaveLength(1);
 await act(async()=>clock.advance(1));expect(await screen.findByText('SAY HELLO')).toBeTruthy();expect(screen.queryByText(/Couldn’t load messages/)).toBeNull();expect(stub.callsTo('sendMessage')).toHaveLength(0);
});
it('keeps existing messages and unsent composer text during a later read failure',async()=>{
 let calls=0;const {clock,stub}=fixture(()=>++calls===1?page([{id:'12121212-1212-4121-8121-121212121212',seq:'1',body:'Already visible',sender:{id:session().user.id,displayName:'Sam',avatarUrl:null},createdAt:new Date().toISOString(),redacted:false}]):fail(429,'RATE_LIMITED'));
 await screen.findByText('Already visible');await userEvent.type(screen.getByLabelText('Message'),'Keep my draft');await act(async()=>clock.advance(2000));
 expect(await screen.findByText(/Couldn’t load messages/)).toBeTruthy();expect(screen.getByText('Already visible')).toBeTruthy();expect((screen.getByLabelText('Message') as HTMLTextAreaElement).value).toBe('Keep my draft');expect(stub.callsTo('sendMessage')).toHaveLength(0);
});
it('keeps HISTORY terminal when its read fails and permits only an explicit HISTORY retry',async()=>{
 let history=0;const {stub}=fixture(mode=>mode==='LIVE'?fail(403,'FORBIDDEN'):++history===1?fail(429,'RATE_LIMITED'):page([]));
 await screen.findByText(/Couldn’t load messages/);expect(screen.queryByText('NO MESSAGES')).toBeNull();expect(screen.queryByLabelText('Message')).toBeNull();
 await userEvent.click(screen.getByRole('button',{name:'Retry loading messages'}));expect(await screen.findByText('NO MESSAGES')).toBeTruthy();expect(stub.callsTo('readMessages').map(c=>c.url.searchParams.get('mode'))).toEqual(['LIVE','HISTORY','HISTORY']);
});
