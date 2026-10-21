/** A read failure is not an empty conversation. Real ChatPage with controlled read transport. */
import {it,expect} from 'vitest';
import {act,screen,waitFor} from '@testing-library/react';
import {renderApp} from '../../test/render.tsx';
import {createFetchStub,ok,page,fail} from '../../test/fetchStub.ts';
import {fakePollerDeps} from '../../test/fakePoller.ts';
import {MEAL_ID,meal,session} from '../../test/fixtures.ts';
const CONV='14141414-1414-4141-8141-141414141414';
it('QA-JOURNEY-008 initial message rate limit remains a visible read failure and never claims an empty history',async()=>{
 const clock=fakePollerDeps(),row={conversation:{id:CONV,version:'1',kind:'GROUP',mealId:MEAL_ID,title:'QA failed read',canSend:true,dissolved:false,head:'3'},lastMessage:null,unreadCount:1};
 const stub=createFetchStub({getSession:()=>ok(session()),inbox:()=>page([row]),getMeal:()=>ok({meal:meal(),myApplication:null,conversationId:CONV}),readMessages:()=>fail(429,'RATE_LIMITED',{retryAfterSeconds:10})});
 renderApp(stub.fetch,`/inbox/${CONV}`,{pollerDeps:clock.deps});await screen.findByLabelText('Message');await waitFor(()=>expect(stub.callsTo('readMessages')).toHaveLength(1));await act(async()=>{await clock.flush();});
 expect(screen.queryByText('SAY HELLO')).toBeNull();expect(screen.queryByText('NO MESSAGES')).toBeNull();expect(screen.getByText(/(?:couldn.t|unable|unavailable|retrying|too many).*?(?:load|messages|request|retry)|(?:message|load).*?(?:failed|retrying|unavailable)/i)).toBeTruthy();expect(stub.callsTo('sendMessage')).toHaveLength(0);
});
