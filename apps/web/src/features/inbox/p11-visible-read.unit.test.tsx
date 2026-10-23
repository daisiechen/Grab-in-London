import {expect,it,vi} from 'vitest';
import {act,screen,waitFor} from '@testing-library/react';
import {renderApp} from '../../test/render.tsx';
import {createFetchStub,ok,page} from '../../test/fetchStub.ts';
import {fakePollerDeps} from '../../test/fakePoller.ts';
import {MEAL_ID,meal,session} from '../../test/fixtures.ts';

it('acknowledges only foreground-visible messages, crossing scanned gaps only after the last message is seen',async()=>{
 const observers=new Map<Element,IntersectionObserverCallback>();
 class Observer {
  private readonly callback:IntersectionObserverCallback;
  constructor(callback:IntersectionObserverCallback){this.callback=callback;}
  observe(element:Element){observers.set(element,this.callback);} disconnect(){} unobserve(){} takeRecords(){return [];}
  readonly root=null;readonly rootMargin='';readonly thresholds=[0,.8];
 }
 vi.stubGlobal('IntersectionObserver',Observer);
 const visibility=vi.spyOn(document,'visibilityState','get').mockReturnValue('visible');
 const id='14141414-1414-4141-8141-141414141414';
 const messages=['3','7'].map(seq=>({id:`00000000-0000-4000-8000-${seq.padStart(12,'0')}`,seq,body:`Visible candidate ${seq}`,sender:session().user,createdAt:'2026-10-23T15:00:00Z',redacted:false}));
 const response=page(messages);response.body={...(response.body as object),page:{nextCursor:null,hasMore:false,scannedThroughSeq:'9'}};
 const stub=createFetchStub({getSession:()=>ok(session()),inbox:()=>page([{conversation:{id,version:'1',kind:'GROUP',mealId:MEAL_ID,title:'Visible chat',canSend:true,dissolved:false,head:'9'},lastMessage:null,unreadCount:2}]),getMeal:()=>ok({meal:meal(),myApplication:null,conversationId:id}),readMessages:()=>response,markConversationRead:()=>({status:204})});
 renderApp(stub.fetch,`/inbox/${id}`,{pollerDeps:fakePollerDeps().deps});
 await screen.findByText('Visible candidate 7');
 expect(stub.callsTo('markConversationRead')).toHaveLength(0);
 const show=async(seq:string)=>{const element=screen.getByText(`Visible candidate ${seq}`).closest('[data-message-seq]')!;const callback=observers.get(element)!;expect(callback).toBeTypeOf('function');await act(async()=>{callback([{target:element,isIntersecting:true,intersectionRatio:1} as IntersectionObserverEntry],{} as IntersectionObserver);});};
 await show('3');await waitFor(()=>expect(stub.callsTo('markConversationRead').map(call=>call.body)).toEqual([{throughSeq:'3'}]));
 visibility.mockReturnValue('hidden');await act(async()=>{document.dispatchEvent(new Event('visibilitychange'));});
 await show('7');expect(stub.callsTo('markConversationRead')).toHaveLength(1);
 visibility.mockReturnValue('visible');await act(async()=>{document.dispatchEvent(new Event('visibilitychange'));});
 expect(stub.callsTo('markConversationRead')).toHaveLength(1);
 await show('7');await waitFor(()=>expect(stub.callsTo('markConversationRead').map(call=>call.body)).toEqual([{throughSeq:'3'},{throughSeq:'9'}]));
 await show('7');expect(stub.callsTo('markConversationRead')).toHaveLength(2);
});
