/** Mock transport integration across the actual Shell, editors and acknowledgement effect. */
import {act,screen,waitFor} from '@testing-library/react';
import {userEvent} from '@testing-library/user-event';
import {describe,expect,it,vi} from 'vitest';
import {Link,Route,Routes} from 'react-router';
import {renderApp,renderWithProviders} from '../../test/render.tsx';
import {createFetchStub,deferred,fail,noContent,ok,page,type StubResponse} from '../../test/fetchStub.ts';
import {fakePollerDeps} from '../../test/fakePoller.ts';
import {MEAL_ID,HOST_ID,meal,publicProfile,session} from '../../test/fixtures.ts';
import {ApplyPage} from '../apply/ApplyPage.tsx';
import {AssistantProvider} from './context.tsx';
const CONVERSATION='14141414-1414-4141-8141-141414141414';
const SECOND='99999999-9999-4999-8999-999999999999';
const message=(seq:string,body:string)=>({id:`00000000-0000-4000-8000-${seq.padStart(12,'0')}`,seq,sender:publicProfile(HOST_ID),body,createdAt:'2026-10-21T11:00:00.000Z',redacted:false});
const messagePage=(seq:string,body:string,head:string)=>({status:200,body:{data:[message(seq,body)],page:{nextCursor:null,hasMore:false,scannedThroughSeq:head},meta:{requestId:'mock',serverNow:'2026-10-21T12:00:00Z'}}});
function chatStub(){return createFetchStub({getSession:()=>ok(session()),inbox:()=>page([{conversation:{id:CONVERSATION,version:'1',kind:'GROUP',mealId:MEAL_ID,title:'A friendly table',canSend:true,dissolved:false,head:'14'},lastMessage:null,unreadCount:2}]),getMeal:()=>ok({meal:meal(),myApplication:null,conversationId:CONVERSATION}),readMessages:()=>messagePage('11','Rendered first message.','14'),markConversationRead:()=>noContent()});}

describe('actual Web editor and message-read integration',()=>{
 it('acknowledges only after rendering, increases throughSeq monotonically and never loops on a failed acknowledgement',async()=>{
  const stub=chatStub(),timers=fakePollerDeps();let n=0;stub.on('readMessages',()=>++n===1?messagePage('11','Rendered first message.','14'):messagePage('19','Rendered second message.','20'));
  stub.on('markConversationRead',call=>{const seq=(call.body as {throughSeq:string}).throughSeq;expect(screen.queryByText(seq==='14'?'Rendered first message.':'Rendered second message.')).not.toBeNull();return fail(503,'PROVIDER_UNAVAILABLE');});
  renderApp(stub.fetch,`/inbox/${CONVERSATION}`,{pollerDeps:timers.deps});await screen.findByText('Rendered first message.');await waitFor(()=>expect(stub.callsTo('markConversationRead')).toHaveLength(1));
  await act(async()=>timers.advance(2000));await screen.findByText('Rendered second message.');await waitFor(()=>expect(stub.callsTo('markConversationRead')).toHaveLength(2));
  await act(async()=>timers.advance(6000));expect(stub.callsTo('markConversationRead')).toHaveLength(2);expect(stub.callsTo('markConversationRead').map(call=>(call.body as {throughSeq:string}).throughSeq)).toEqual(['14','20']);
 });
 it('does not acknowledge a late response in a hidden tab and acknowledges after it becomes visible',async()=>{
  const stub=chatStub(),timers=fakePollerDeps(),late=deferred<StubResponse>();stub.on('readMessages',()=>late.promise);renderApp(stub.fetch,`/inbox/${CONVERSATION}`,{pollerDeps:timers.deps});await waitFor(()=>expect(stub.callsTo('readMessages')).toHaveLength(1));
  const visibility=vi.spyOn(document,'visibilityState','get').mockReturnValue('hidden');await act(async()=>{document.dispatchEvent(new Event('visibilitychange'));late.resolve(messagePage('11','Hidden response is rendered without an ack.','14'));});await screen.findByText('Hidden response is rendered without an ack.');expect(stub.callsTo('markConversationRead')).toHaveLength(0);
  visibility.mockReturnValue('visible');await act(async()=>document.dispatchEvent(new Event('visibilitychange')));await waitFor(()=>expect(stub.callsTo('markConversationRead')).toHaveLength(1));
 });
 it('loads the new meal editor state instead of carrying an introduction to a different target',async()=>{
  const stub=createFetchStub({getSession:()=>ok(session()),getMeal:call=>ok({meal:meal({id:call.params.mealId}),myApplication:null,conversationId:null})});
  renderWithProviders(<AssistantProvider><Link to={`/meals/${SECOND}/apply`}>Switch meal</Link><Routes><Route path="/meals/:mealId/apply" element={<ApplyPage/>}/></Routes></AssistantProvider>,stub.fetch,`/meals/${MEAL_ID}/apply`);
  await userEvent.type(await screen.findByRole('textbox',{name:'Your introduction'}),'Private wording intended only for the first table.');await userEvent.click(screen.getByRole('link',{name:'Switch meal'}));await waitFor(()=>expect(stub.callsTo('getMeal').some(call=>call.params.mealId===SECOND)).toBe(true));expect((await screen.findByRole('textbox',{name:'Your introduction'}) as HTMLTextAreaElement).value).toBe('');
 });
});
