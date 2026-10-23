/** Regression: a receipt-confirmed save must not navigate after its follow-up read loses its session. */
import {expect,it} from 'vitest';
import {act,screen,waitFor} from '@testing-library/react';
import {userEvent} from '@testing-library/user-event';
import {Route,Routes,useLocation} from 'react-router';
import {useSession} from '../api/session.tsx';
import {ProfileEditPage} from '../features/profile/ProfileEditPage.tsx';
import {renderWithProviders} from './render.tsx';
import {createFetchStub,deferred,ok,type StubResponse} from './fetchStub.ts';
import {me,session} from './fixtures.ts';
function Controls(){const {clearLocal}=useSession();const location=useLocation();return <><button onClick={clearLocal}>End test session</button><p data-testid="route">{location.pathname}</p></>;}
it('drops a late profile read after session clearance instead of navigating to the old return route',async()=>{
 const held=deferred<StubResponse>();let reads=0;
 const current=me({profileGate:{ageConfirmed:true,communityAccepted:true,profileComplete:true,missing:[]}});
 const stub=createFetchStub({getSession:()=>ok({...session(),user:current}),getMe:()=>++reads===1?ok(current):held.promise,
  updateMe:()=>{throw new TypeError('response lost');},getCommandReceipt:()=>ok({state:'SUCCEEDED'})});
 renderWithProviders(<><Routes><Route path="/profile/edit" element={<ProfileEditPage/>}/><Route path="*" element={<p>Guest screen</p>}/></Routes><Controls/></>,stub.fetch,'/profile/edit?returnTo=%2Faccount');
 await userEvent.click(await screen.findByRole('button',{name:/Save profile/}));
 await userEvent.click(await screen.findByRole('button',{name:'Check status'}));
 await waitFor(()=>expect(reads).toBe(2));
 await userEvent.click(screen.getByRole('button',{name:'End test session'}));
 await waitFor(()=>expect(screen.getByTestId('route').textContent).toBe('/sign-in'));
 await act(async()=>{held.resolve(ok(current));await held.promise;});
 expect(screen.getByTestId('route').textContent).toBe('/sign-in');
 expect(screen.queryByText('Profile saved.')).toBeNull();
});
