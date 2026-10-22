import {act,screen,waitFor} from '@testing-library/react';
import {userEvent} from '@testing-library/user-event';
import {expect,it} from 'vitest';
import {renderApp,renderWithProviders} from '../../test/render.tsx';
import {createFetchStub,deferred,fail,ok,meta,type StubResponse} from '../../test/fetchStub.ts';
import {MEAL_ID,meal,session} from '../../test/fixtures.ts';
import {useSession} from '../../api/session.tsx';
import {useApi} from '../../api/ApiProvider.tsx';
import {captureExpiredApplication,restoreExpiredApplication,clearAllPrivateState,loadDraft,saveDraft} from '../../lib/drafts.ts';
const text='I would enjoy a relaxed dinner and meeting everyone.';
it.each([false,true])('restores only the original account draft after a 401 sign-in detour (different account=%s)',async(different)=>{
 let signed=true;const stub=createFetchStub({getSession:()=>signed?ok(session(different?{id:'77777777-7777-4777-8777-777777777777'}:{})):fail(401,'AUTH_REQUIRED'),getMeal:()=>ok({meal:meal(),myApplication:null,conversationId:null}),applyMeal:()=>{signed=false;return fail(401,'AUTH_REQUIRED');},startEmail:()=>({status:201,body:{data:{challengeId:'66666666-6666-4666-8666-666666666666',expiresAt:new Date(Date.now()+300000).toISOString(),resendAfter:new Date().toISOString()},meta:meta()}}),verifyEmail:()=>{signed=true;return ok({outcome:'AUTHENTICATED'});}});
 // The initial editor always belongs to the original account.
 let first=true;stub.on('getSession',()=>{if(first){first=false;return ok(session());}return signed?ok(session(different?{id:'77777777-7777-4777-8777-777777777777'}:{})):fail(401,'AUTH_REQUIRED');});
 renderApp(stub.fetch,`/meals/${MEAL_ID}/apply`);await userEvent.type(await screen.findByLabelText('Your introduction'),text);saveDraft(`message:${MEAL_ID}`,{text:'Do not retain private messages'});saveDraft('profile',{bio:'Private profile form'});await userEvent.click(screen.getByRole('button',{name:'Send request'}));
 expect(await screen.findByRole('button',{name:'Continue with email'})).toBeTruthy();expect(screen.queryByDisplayValue(text)).toBeNull();expect(loadDraft(`message:${MEAL_ID}`)).toBeNull();expect(loadDraft('profile')).toBeNull();
 await userEvent.click(screen.getByRole('button',{name:'Continue with email'}));await userEvent.type(screen.getByLabelText('Email address'),'member@example.test');await userEvent.click(screen.getByRole('button',{name:'Send code'}));await userEvent.type(await screen.findByLabelText('6-digit code'),'123456');await userEvent.click(screen.getByRole('button',{name:'Verify & continue'}));
 expect((await screen.findByLabelText('Your introduction') as HTMLTextAreaElement).value).toBe(different?'':text);expect(stub.callsTo('applyMeal')).toHaveLength(1);
});
it('explicit logout cannot quarantine a draft even when a concurrent request returns 401',async()=>{
 const logout=deferred<StubResponse>();const stub=createFetchStub({getSession:()=>ok(session()),logout:()=>logout.promise,getMe:()=>fail(401,'AUTH_REQUIRED')});
 function Probe(){const {signOut,state}=useSession(),{api}=useApi();return <><span>{state.status}</span><button onClick={()=>void signOut()}>Log out</button><button onClick={()=>void api.client.call('getMe',{}).catch(()=>{})}>Expired request</button></>;}
 renderWithProviders(<Probe/>,stub.fetch,`/meals/${MEAL_ID}/apply`);await screen.findByText('signed-in');saveDraft(`apply:${MEAL_ID}`,{intro:text});await userEvent.click(screen.getByRole('button',{name:'Log out'}));await userEvent.click(screen.getByRole('button',{name:'Expired request'}));await act(async()=>logout.resolve({status:204}));expect(loadDraft(`apply:${MEAL_ID}`)).toBeNull();expect(sessionStorage.length).toBe(0);
});

it('does not let a late pre-expiry authentication response restore the quarantined draft',async()=>{
 let reads=0;const held=deferred<StubResponse>();const stub=createFetchStub({getSession:()=>++reads===2?held.promise:ok(session()),getMe:()=>fail(401,'AUTH_REQUIRED')});
 function Probe(){const {state,refresh}=useSession(),{api}=useApi();return <><span>{state.status}</span><button onClick={()=>void refresh()}>Refresh auth</button><button onClick={()=>void api.client.call('getMe',{}).catch(()=>{})}>Expire</button></>;}
 renderWithProviders(<Probe/>,stub.fetch,`/meals/${MEAL_ID}/apply`);await screen.findByText('signed-in');saveDraft(`apply:${MEAL_ID}`,{intro:text});await userEvent.click(screen.getByRole('button',{name:'Refresh auth'}));await waitFor(()=>expect(reads).toBe(2));await userEvent.click(screen.getByRole('button',{name:'Expire'}));await screen.findByText('guest');
 await act(async()=>held.resolve(ok(session())));expect(loadDraft(`apply:${MEAL_ID}`)).toBeNull();expect(screen.getByText('guest')).toBeTruthy();
 await userEvent.click(screen.getByRole('button',{name:'Refresh auth'}));await screen.findByText('signed-in');expect(loadDraft(`apply:${MEAL_ID}`)).toEqual({intro:text});
});
it('rejects oversized/foreign draft shapes and only captures an exact current application route',()=>{
 saveDraft(`apply:${MEAL_ID}`,{intro:text});expect(captureExpiredApplication('11111111-1111-4111-8111-111111111111','/discover')).toBeNull();expect(captureExpiredApplication('11111111-1111-4111-8111-111111111111',`/meals/${MEAL_ID}/apply/other`)).toBeNull();
 sessionStorage.setItem('fancy.auth.expiredApplication',JSON.stringify({ownerUserId:'11111111-1111-4111-8111-111111111111',mealId:MEAL_ID,intro:'x'.repeat(301)}));restoreExpiredApplication('11111111-1111-4111-8111-111111111111');expect(sessionStorage.getItem('fancy.auth.expiredApplication')).toBeNull();
 clearAllPrivateState();expect(sessionStorage.length).toBe(0);
});
