import {act,fireEvent,screen,waitFor,within} from '@testing-library/react-native';
import {Text} from 'react-native';
import {AppRoot} from './AppRoot.tsx';
import {SettingsScreen} from './features/settings/SettingsScreen.tsx';
import {useSessionState} from './services.tsx';
import {createTestApp,renderApp,signIn} from './test/render.tsx';
import {deferred} from './test/deferred.ts';
import {fail,noContent,type MockReply} from './test/mock-fetch.ts';
jest.mock('expo-router',()=>({useRouter:()=>({push:jest.fn(),replace:jest.fn()})}));
function Navigation(){const state=useSessionState();return state.status==='signedIn'?<SettingsScreen/>:<Text>Guest home</Text>;}
async function start(){const app=createTestApp();await renderApp(app,<AppRoot services={app.services}><Navigation/></AppRoot>);await waitFor(()=>expect(app.services.session.getState().status).toBe('signedOut'));await act(()=>signIn(app));return app;}
async function logout(){await fireEvent.press(screen.getByRole('button',{name:'Sign out'}));const actions=screen.getAllByRole('button',{name:'Sign out'});await fireEvent.press(actions[actions.length-1]!);await screen.findByText('Guest home');}
it('keeps remote-unconfirmed notice outside the settings navigation lifetime after local sign-out',async()=>{
 const app=await start(),response=deferred<MockReply>();app.mock.on('POST','/v1/auth/logout',()=>response.promise);
 await logout();expect(screen.queryByText('Your account')).toBeNull();expect(app.store.value).toBeNull();
 await act(async()=>response.resolve(fail(429,'RATE_LIMITED')));
 const notices=within(screen.getByTestId('app-notices'));
 expect(await notices.findByText(/Fancy hasn’t confirmed that the remote session ended/)).toBeTruthy();
 expect(app.services.session.getState().status).toBe('signedOut');
 await fireEvent.press(notices.getByRole('button',{name:'Dismiss sign-out notice'}));expect(screen.queryByText(/Fancy hasn’t confirmed/)).toBeNull();
});
it('shows no remote-unconfirmed notice after authoritative successful logout',async()=>{
 const app=await start();app.mock.on('POST','/v1/auth/logout',noContent());await logout();
 await waitFor(()=>expect(app.mock.callsTo('POST','/v1/auth/logout')).toHaveLength(1));expect(screen.queryByText(/Fancy hasn’t confirmed/)).toBeNull();
});
it('does not attach a late prior-logout warning to a newer sign-in',async()=>{
 const app=await start(),response=deferred<MockReply>();app.mock.on('POST','/v1/auth/logout',()=>response.promise);await logout();
 await act(()=>signIn(app));await act(async()=>response.resolve(fail(503,'UNAVAILABLE')));
 expect(app.services.session.getState().status).toBe('signedIn');expect(screen.queryByText(/Fancy hasn’t confirmed/)).toBeNull();
});
