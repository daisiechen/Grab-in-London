/** Codex independent acceptance: component teardown must cancel the old account's queued writes. */
import {afterEach,expect,it} from 'vitest';
import {act,render,screen,waitFor} from '@testing-library/react';
import {userEvent} from '@testing-library/user-event';
import {ApiProvider} from '../api/ApiProvider.tsx';
import {testApi} from './render.tsx';
import {createFetchStub,deferred,ok,type StubResponse} from './fetchStub.ts';
import {FeedbackSection,resetFeedbackMemory} from '../features/post-meal/FeedbackSection.tsx';
import {clearAllPrivateState} from '../lib/drafts.ts';
import {HOST_ID,MEAL_ID,USER_ID} from './fixtures.ts';
afterEach(resetFeedbackMemory);
it('does not send the queued reconnect after feedback memory is cleared with a reference in flight',async()=>{
 const held=deferred<StubResponse>();
 const stub=createFetchStub({reviewPerson:()=>held.promise,selectReconnect:()=>ok({version:'1'})});
 const view=render(<ApiProvider api={testApi(stub.fetch)}><FeedbackSection scope={{accountId:USER_ID,mealId:MEAL_ID,subjectId:HOST_ID}} snapshot={{windowOpen:true,review:null,reconnect:{selected:false,version:'0',connection:'NONE'}}} subjectName="Alex" reload={async()=>{}} visibilityNote={null}/></ApiProvider>);
 await userEvent.type(screen.getByRole('textbox'),'A synthetic reference');
 await userEvent.click(screen.getByRole('checkbox'));
 await userEvent.click(screen.getByRole('button',{name:/Save feedback/}));
 await waitFor(()=>expect(stub.callsTo('reviewPerson')).toHaveLength(1));
 clearAllPrivateState();view.unmount();
 await act(async()=>{held.resolve(ok({version:'1'}));await held.promise;await new Promise(resolve=>setTimeout(resolve,0));});
 expect(stub.callsTo('selectReconnect')).toHaveLength(0);
});
